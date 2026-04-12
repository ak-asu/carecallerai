import { NextRequest, NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase";
import { fireEvent } from "@/lib/events";

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
