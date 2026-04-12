import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

interface AppointmentEvent {
  type?: string;
  appointmentId?: string;
  patientId?: string;
  jobId?: string | null;
}

Deno.serve(async (req) => {
  let payload: AppointmentEvent = {};

  try {
    payload = (await req.json()) as AppointmentEvent;
  } catch {
    // fire-and-forget callers may send empty bodies
  }

  // If a specific appointment was flagged, only query that one.
  // Otherwise fall back to a full scan (e.g. cron-based invocations).
  let query = supabase
    .from("appointments")
    .select("*, patients(language, phone), doctors(name)")
    .eq("status", "scheduled")
    .gt("datetime", new Date().toISOString());

  if (payload.appointmentId) {
    query = query.eq("id", payload.appointmentId);
  }

  const { data: appointments } = await query;

  for (const appt of appointments ?? []) {
    if (!appt.conflict_detected) continue;

    // Auto-reschedule: push +24h as a placeholder slot
    const newDatetime = new Date(
      new Date(appt.datetime).getTime() + 24 * 3600 * 1000,
    ).toISOString();

    await supabase
      .from("appointments")
      .update({
        datetime: newDatetime,
        status: "rescheduled",
        reschedule_reason: "Doctor unavailable at original time",
        conflict_detected: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", appt.id);

    await supabase.from("notifications").insert({
      patient_id: appt.patient_id,
      type: "call",
      message: `Your appointment with ${appt.doctors?.name} has been rescheduled to ${new Date(newDatetime).toLocaleString()}.`,
      language: appt.patients?.language ?? "en",
      status: "pending",
      triggered_by: `appointment.conflict:${appt.id}`,
    });

    await supabase.from("patient_timeline").insert({
      patient_id: appt.patient_id,
      event_type: "appointment",
      content: {
        action: "rescheduled",
        newDatetime,
        doctorName: appt.doctors?.name,
        reason: "Doctor unavailable at original time",
      },
      severity: 1,
      source: "stt_inferred",
    });
  }

  if (payload.jobId) {
    await supabase
      .from("automation_jobs")
      .update({ status: "completed", completed_at: new Date().toISOString(), result: { ok: true } })
      .eq("id", payload.jobId);
  }

  return new Response("ok");
});
