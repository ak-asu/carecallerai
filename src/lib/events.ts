import { supabaseAdmin } from "./supabase";

export type AutomationEvent =
  | { type: "call.completed"; callId: string; patientId: string }
  | {
      type: "escalation.created";
      patientId: string;
      callId: string;
      severity: number;
    }
  | { type: "correction.created"; patientId: string; correctionId: string }
  | { type: "appointment.updated"; appointmentId: string; patientId: string };

export async function fireEvent(event: AutomationEvent): Promise<void> {
  await supabaseAdmin.from("automation_jobs").insert({
    type: event.type,
    status: "pending",
    payload: event,
    triggered_by: event.type,
  });

  // For immediate events, invoke the relevant Edge Function
  if (event.type === "call.completed") {
    await invokeEdgeFunction("post-call-processor", event);
  }
  // escalation.created: logged to automation_jobs for async pickup by a clinician notification handler
  // appointment.updated: triggers appointment-monitor to check and reschedule
  if (event.type === "appointment.updated") {
    await invokeEdgeFunction("appointment-monitor", event);
  }
}

async function invokeEdgeFunction(
  name: string,
  payload: unknown,
): Promise<void> {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/${name}`;
  const serverKey =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serverKey) return;

  await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serverKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  }).catch(() => {}); // fire-and-forget
}
