import { fireEvent } from "./events";
import { queryMemory } from "./supermemory";
import { supabaseAdmin } from "./supabase";
import {
  getVapiCallId,
  getVapiPatientPhone,
  getVapiToolCalls,
  getVapiTranscript,
  type VapiWebhookBody,
} from "./vapi-signature";

export async function processCallStartedWebhook(
  body: VapiWebhookBody,
): Promise<void> {
  const callId = getVapiCallId(body);
  const patientPhone = getVapiPatientPhone(body);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawBody = body as any;
  console.log(
    "[webhook] call-started callId:", callId,
    "phone:", patientPhone,
    "raw_msg_call_customer:", rawBody?.message?.call?.customer?.number,
    "raw_msg_customer:", rawBody?.message?.customer?.number,
    "raw_call_customer:", rawBody?.call?.customer?.number,
  );

  if (!callId || !patientPhone) {
    console.warn("[webhook] missing callId or phone — aborting");
    return;
  }

  const { data: patientRows, error: patientErr } = await supabaseAdmin
    .from("patients")
    .select("id, language")
    .eq("phone", patientPhone)
    .limit(1);

  const patient = patientRows?.[0] ?? null;

  console.log(
    "[webhook] patient lookup:",
    patient?.id ?? "NOT FOUND",
    "rows:", patientRows?.length ?? 0,
    patientErr?.message ?? "",
  );

  if (!patient) return;

  const [memory, medsRes, apptsRes] = await Promise.all([
    queryMemory(patient.id, "medications symptoms history appointments"),
    supabaseAdmin
      .from("medications")
      .select("*")
      .eq("patient_id", patient.id)
      .eq("active", true),
    supabaseAdmin
      .from("appointments")
      .select("*")
      .eq("patient_id", patient.id)
      .eq("status", "scheduled"),
  ]);

  const { error: sessionErr } = await supabaseAdmin
    .from("call_sessions")
    .upsert({
      call_id: callId,
      patient_id: patient.id,
      context: {
        memory: memory ?? "",
        meds: medsRes.data ?? [],
        appointments: apptsRes.data ?? [],
      },
    });

  console.log("[webhook] call_sessions upsert:", sessionErr?.message ?? "ok");

  const { error: callErr } = await supabaseAdmin.from("calls").upsert(
    {
      patient_id: patient.id,
      vapi_call_id: callId,
      type: "inbound",
      status: "in_progress",
      language: patient.language,
      started_at: new Date().toISOString(),
    },
    { onConflict: "vapi_call_id" },
  );

  console.log("[webhook] calls upsert:", callErr?.message ?? "ok");
}

export async function processEndOfCallWebhook(
  body: VapiWebhookBody,
): Promise<void> {
  const callId = getVapiCallId(body);
  const transcript = getVapiTranscript(body);

  console.log("[webhook] end-of-call callId:", callId, "transcript length:", transcript.length);

  if (!callId) return;

  // Use limit(1) instead of .single() so a missing row doesn't throw
  const { data: callRows, error: callLookupErr } = await supabaseAdmin
    .from("calls")
    .select("id, patient_id")
    .eq("vapi_call_id", callId)
    .limit(1);

  const call = callRows?.[0] ?? null;

  console.log(
    "[webhook] call lookup:",
    call?.id ?? "NOT FOUND",
    callLookupErr?.message ?? "",
  );

  if (!call?.id || !call.patient_id) return;

  const { error: updateErr } = await supabaseAdmin
    .from("calls")
    .update({
      status: "completed",
      transcript,
      ended_at: new Date().toISOString(),
    })
    .eq("vapi_call_id", callId);

  console.log("[webhook] calls update:", updateErr?.message ?? "ok");

  await supabaseAdmin.from("call_sessions").delete().eq("call_id", callId);

  await fireEvent({
    type: "call.completed",
    callId: call.id,
    patientId: call.patient_id,
  });

  console.log("[webhook] call.completed fired for callId:", call.id);
}

export function buildUnsupportedToolResults(
  body: VapiWebhookBody,
): Array<{ name: string; toolCallId: string; result: string }> {
  return getVapiToolCalls(body).map((toolCall) => ({
    name: toolCall.name ?? "unknown_tool",
    toolCallId: toolCall.id ?? "unknown_tool_call_id",
    result: JSON.stringify({
      status: "not_implemented",
      message: "Tool handling is not implemented for this endpoint.",
    }),
  }));
}
