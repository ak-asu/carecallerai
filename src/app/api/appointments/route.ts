import { NextRequest, NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase";
import { fireEvent } from "@/lib/events";

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function POST(req: NextRequest) {
  const {
    patientId,
    doctorId: incomingDoctorId,
    doctorName,
    specialty,
    googleCalendarId,
    datetime,
    scheduledBy,
    reason,
  } = await req.json();

  if (!patientId || !doctorName || !specialty || !datetime) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  let doctorId = incomingDoctorId as string | null;

  if (!doctorId) {
    const { data: existingDoctor } = await supabaseAdmin
      .from("doctors")
      .select("id")
      .eq("name", doctorName)
      .eq("specialty", specialty)
      .maybeSingle();

    if (existingDoctor) {
      doctorId = existingDoctor.id;
    } else {
      const { data: createdDoctor, error: createDoctorError } =
        await supabaseAdmin
          .from("doctors")
          .insert({
            name: doctorName,
            specialty,
            google_calendar_id:
              googleCalendarId ?? `carecaller-${slugify(doctorName)}`,
          })
          .select("id")
          .single();

      if (createDoctorError || !createdDoctor) {
        return NextResponse.json(
          { error: "doctor_create_failed" },
          { status: 500 },
        );
      }

      doctorId = createdDoctor.id;
    }
  }

  const { data: conflictingAppointment } = await supabaseAdmin
    .from("appointments")
    .select("id")
    .eq("doctor_id", doctorId)
    .eq("datetime", datetime)
    .neq("status", "cancelled")
    .maybeSingle();

  if (conflictingAppointment) {
    return NextResponse.json({ error: "slot_taken" }, { status: 409 });
  }

  const { data: appointment, error: appointmentError } = await supabaseAdmin
    .from("appointments")
    .insert({
      patient_id: patientId,
      doctor_id: doctorId,
      datetime,
      status: "scheduled",
      google_calendar_event_id: `carecaller-${doctorId}-${new Date(datetime).getTime()}`,
      updated_at: new Date().toISOString(),
    })
    .select("*, doctors(name, specialty)")
    .single();

  if (appointmentError || !appointment) {
    return NextResponse.json(
      { error: "appointment_create_failed" },
      { status: 500 },
    );
  }

  await supabaseAdmin.from("patient_timeline").insert({
    patient_id: patientId,
    event_type: "appointment",
    content: {
      action: "scheduled",
      appointmentId: appointment.id,
      datetime,
      doctorName,
      specialty,
      reason: reason ?? null,
    },
    severity: 0,
    source:
      scheduledBy === "clinician" ? "clinician_verified" : "patient_verified",
  });

  await supabaseAdmin.from("notifications").insert({
    patient_id: patientId,
    type: "appointment",
    message: `Appointment scheduled with ${doctorName} on ${new Date(datetime).toLocaleString()}.`,
    status: "pending",
    triggered_by: "appointment.recommendation",
  });

  return NextResponse.json({ ok: true, appointment });
}

export async function PATCH(req: NextRequest) {
  const { appointmentId, patientId, action, datetime, status, reason } =
    await req.json();
  // action: 'confirm' | 'request_change' | 'cancel' | 'reschedule'

  if (action === "confirm") {
    await supabaseAdmin
      .from("appointments")
      .update({ status: "confirmed", updated_at: new Date().toISOString() })
      .eq("id", appointmentId);

    await supabaseAdmin.from("patient_timeline").insert({
      patient_id: patientId,
      event_type: "appointment",
      content: { action: "confirmed", appointmentId },
      severity: 0,
      source: "patient_verified",
    });
  } else if (action === "cancel") {
    await supabaseAdmin
      .from("appointments")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", appointmentId);

    await supabaseAdmin.from("patient_timeline").insert({
      patient_id: patientId,
      event_type: "appointment",
      content: { action: "cancelled", appointmentId },
      severity: 0,
      source: "patient_verified",
    });

    await fireEvent({ type: "appointment.updated", appointmentId, patientId });
  } else if (action === "request_change") {
    await supabaseAdmin
      .from("appointments")
      .update({
        conflict_detected: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", appointmentId);

    await fireEvent({ type: "appointment.updated", appointmentId, patientId });
  } else if (action === "reschedule") {
    await supabaseAdmin
      .from("appointments")
      .update({
        datetime: datetime,
        status: status ?? "rescheduled",
        reschedule_reason: reason ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", appointmentId);

    await supabaseAdmin.from("patient_timeline").insert({
      patient_id: patientId,
      event_type: "appointment",
      content: {
        action: "rescheduled",
        datetime,
        reason: reason ?? null,
        appointmentId,
      },
      severity: 0,
      source: "clinician_verified",
    });

    await fireEvent({ type: "appointment.updated", appointmentId, patientId });
  }

  return NextResponse.json({ ok: true });
}
