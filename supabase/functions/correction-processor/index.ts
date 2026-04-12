import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const FUNCTION_URL = `${Deno.env.get("SUPABASE_URL")}/functions/v1`;
const SERVER_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface CorrectionEvent {
  type?: string;
  patientId?: string;
  correctionId?: string;
  jobId?: string | null;
}

async function invokeFunction(name: string, payload: Record<string, unknown>) {
  try {
    await fetch(`${FUNCTION_URL}/${name}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SERVER_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch {
    // Best-effort async follow-up; do not fail correction processing.
  }
}

Deno.serve(async (req) => {
  let payload: CorrectionEvent;

  try {
    payload = (await req.json()) as CorrectionEvent;
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "invalid_json" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const patientId = payload.patientId?.trim();
  const correctionId = payload.correctionId?.trim();

  if (!patientId || !correctionId) {
    return new Response(
      JSON.stringify({ ok: false, error: "missing_patient_or_correction_id" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const { data: correction, error: correctionError } = await supabase
    .from("corrections")
    .select(
      "id, entity_type, old_value, new_value, applied_to_memory, source_call_id",
    )
    .eq("id", correctionId)
    .eq("patient_id", patientId)
    .single();

  if (correctionError || !correction) {
    return new Response(
      JSON.stringify({ ok: false, error: "correction_not_found" }),
      {
        status: 404,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  if (!correction.applied_to_memory) {
    await supabase
      .from("corrections")
      .update({ applied_to_memory: true })
      .eq("id", correction.id);
  }

  // Re-score patient severity based on latest completed call after a correction.
  const { data: latestCall } = await supabase
    .from("calls")
    .select("severity_score")
    .eq("patient_id", patientId)
    .eq("status", "completed")
    .order("ended_at", { ascending: false })
    .limit(1)
    .single();

  if (typeof latestCall?.severity_score === "number") {
    await supabase
      .from("patients")
      .update({ severity_score: latestCall.severity_score })
      .eq("id", patientId);
  }

  // Route downstream enrichments based on correction type.
  const entityType = String(correction.entity_type ?? "").toLowerCase();

  if (entityType === "drug" || entityType === "dose") {
    await invokeFunction("medication-enrichment", {
      patientId,
      correctionId,
      reason: "correction_medication_changed",
    });
  }

  if (entityType === "appointment" || entityType === "date") {
    await invokeFunction("appointment-monitor", {
      patientId,
      correctionId,
      reason: "correction_appointment_changed",
    });
  }

  await supabase.from("patient_timeline").insert({
    patient_id: patientId,
    event_type: "correction_processed",
    content: {
      correctionId,
      entityType: correction.entity_type,
      oldValue: correction.old_value,
      newValue: correction.new_value,
      sourceCallId: correction.source_call_id,
    },
    severity: 0,
    flagged: false,
    source: "patient_verified",
  });

  if (payload.jobId) {
    await supabase
      .from("automation_jobs")
      .update({ status: "completed", completed_at: new Date().toISOString(), result: { ok: true } })
      .eq("id", payload.jobId);
  }

  return new Response(
    JSON.stringify({
      ok: true,
      correctionId,
      entityType: correction.entity_type,
    }),
    { headers: { "Content-Type": "application/json" } },
  );
});
