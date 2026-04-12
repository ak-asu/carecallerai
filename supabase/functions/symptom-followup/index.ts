import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async () => {
  const cutoff = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

  const { data: patients } = await supabase
    .from("patients")
    .select("id, language, severity_score")
    .gte("severity_score", 5)
    .gte("last_call_at", cutoff);

  for (const patient of patients ?? []) {
    const { data: pending } = await supabase
      .from("notifications")
      .select("id")
      .eq("patient_id", patient.id)
      .eq("status", "pending")
      .eq("type", "call")
      .limit(1);

    if (!pending?.length) {
      await supabase.from("notifications").insert({
        patient_id: patient.id,
        type: "call",
        message: "CareCaller would like to follow up on your recent symptoms.",
        language: patient.language,
        status: "pending",
        scheduled_at: new Date(Date.now() + 3600 * 1000).toISOString(),
        triggered_by: "symptom-followup-cron",
      });
    }
  }

  return new Response("ok");
});
