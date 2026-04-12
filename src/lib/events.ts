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
  // Insert the job and capture the ID so edge functions can mark it completed
  const { data: job } = await supabaseAdmin
    .from("automation_jobs")
    .insert({
      type: event.type,
      status: "pending",
      payload: event,
      triggered_by: event.type,
    })
    .select("id")
    .single();

  const jobId: string | null = job?.id ?? null;
  // Pass jobId so each function can mark the job completed when done
  const payload = { ...event, jobId };

  if (event.type === "call.completed") {
    await invokeEdgeFunction("post-call-processor", payload);
  }
  if (event.type === "escalation.created") {
    await invokeEdgeFunction("escalation-handler", payload);
  }
  if (event.type === "correction.created") {
    await invokeEdgeFunction("correction-processor", payload);
  }
  if (event.type === "appointment.updated") {
    await invokeEdgeFunction("appointment-monitor", payload);
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
