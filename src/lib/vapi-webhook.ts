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

  console.log("[webhook] call-started callId:", callId, "phone:", patientPhone);

  if (!callId || !patientPhone) {
    console.warn("[webhook] missing callId or phone — aborting");
    return;
  }

  const { data: patient, error: patientErr } = await supabaseAdmin
    .from("patients")
    .select("id, language")
    .eq("phone", patientPhone)
    .single();

  console.log(
    "[webhook] patient lookup:",
    patient?.id ?? "NOT FOUND",
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

  await supabaseAdmin.from("call_sessions").upsert({
    call_id: callId,
    patient_id: patient.id,
    context: {
      memory: memory ?? "",
      meds: medsRes.data ?? [],
      appointments: apptsRes.data ?? [],
    },
  });

  await supabaseAdmin.from("calls").upsert(
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
}

export async function processEndOfCallWebhook(
  body: VapiWebhookBody,
): Promise<void> {
  const callId = getVapiCallId(body);
  const transcript = getVapiTranscript(body);

  if (!callId) return;

  const { data: call } = await supabaseAdmin
    .from("calls")
    .select("id, patient_id")
    .eq("vapi_call_id", callId)
    .single();

  if (!call) return;

  if (!call.patient_id) return;

  await supabaseAdmin
    .from("calls")
    .update({
      status: "completed",
      transcript,
      ended_at: new Date().toISOString(),
    })
    .eq("vapi_call_id", callId);

  await supabaseAdmin.from("call_sessions").delete().eq("call_id", callId);

  await fireEvent({
    type: "call.completed",
    callId: call.id,
    patientId: call.patient_id,
  });
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
