import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

interface EscalationEvent {
  type?: string;
  patientId?: string;
  callId?: string;
  severity?: number;
  jobId?: string | null;
}

Deno.serve(async (req) => {
  let payload: EscalationEvent;

  try {
    payload = (await req.json()) as EscalationEvent;
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "invalid_json" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const patientId = payload.patientId?.trim();
  const callId = payload.callId?.trim();
  const severity = Number(payload.severity ?? 8);

  if (!patientId) {
    return new Response(
      JSON.stringify({ ok: false, error: "missing_patient_id" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  // Find the matching pending escalation when possible.
  const escalationQuery = supabase
    .from("escalations")
    .select("id, severity, status, clinician_notified_at")
    .eq("patient_id", patientId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1);

  const { data: escalations, error: escalationError } = callId
    ? await escalationQuery.eq("call_id", callId)
    : await escalationQuery;

  if (escalationError) {
    return new Response(
      JSON.stringify({ ok: false, error: "escalation_lookup_failed" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const escalation = escalations?.[0];
  const nowIso = new Date().toISOString();

  if (escalation && !escalation.clinician_notified_at) {
    await supabase
      .from("escalations")
      .update({ clinician_notified_at: nowIso })
      .eq("id", escalation.id);
  }

  const effectiveSeverity = escalation?.severity ?? severity;

  await supabase.from("notifications").insert({
    patient_id: patientId,
    type: "clinician_alert",
    message: `Escalation requires clinician review${callId ? ` (call ${callId})` : ""}.`,
    language: "en",
    status: "pending",
    triggered_by: `escalation.created:${callId ?? "unknown"}`,
  });

  await supabase.from("patient_timeline").insert({
    patient_id: patientId,
    event_type: "escalation",
    content: {
      callId: callId ?? null,
      escalationId: escalation?.id ?? null,
      notifiedAt: nowIso,
      source: "escalation-handler",
    },
    severity: effectiveSeverity,
    flagged: true,
    source: "stt_inferred",
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
      escalationId: escalation?.id ?? null,
      severity: effectiveSeverity,
    }),
    {
      headers: { "Content-Type": "application/json" },
    },
  );
});
