import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async () => {
  // Get all upcoming appointments
  const { data: appointments } = await supabase
    .from("appointments")
    .select("*, patients(language, phone), doctors(name)")
    .eq("status", "scheduled")
    .gt("datetime", new Date().toISOString());

  for (const appt of appointments ?? []) {
    // For demo: check if conflict_detected flag was set by an external trigger
    if (appt.conflict_detected) {
      // Find next slot (mock: add 24h)
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
        },
        severity: 1,
        source: "stt_inferred",
      });
    }
  }

  return new Response("ok");
});
