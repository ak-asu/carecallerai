import { NextRequest, NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase";
import { runCallPipeline } from "@/lib/vapi";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json();

  // Vapi sends OpenAI-compatible messages array
  const messages: Array<{ role: string; content: string }> =
    body.messages ?? [];
  const callId: string = body.call?.id ?? "";
  const isStreaming: boolean = body.stream === true;

  console.log("[LLM] callId:", callId, "stream:", isStreaming);

  // Get last user message
  const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
  const transcript = lastUserMsg?.content ?? "";

  console.log("[LLM] transcript:", transcript?.slice(0, 120));

  if (!transcript || !callId) {
    const greeting =
      "Hello, I'm CareCaller. How can I help you today?";

    return respondJson(greeting, isStreaming);
  }

  // Get patient from session cache
  const { data: session, error: sessionErr } = await supabaseAdmin
    .from("call_sessions")
    .select("patient_id")
    .eq("call_id", callId)
    .single();

  console.log(
    "[LLM] session lookup — patient_id:",
    session?.patient_id ?? null,
    "err:",
    sessionErr?.message ?? null,
  );

  const { data: patient } = session?.patient_id
    ? await supabaseAdmin
        .from("patients")
        .select("id, language")
        .eq("id", session.patient_id)
        .single()
    : { data: null };

  console.log("[LLM] patient:", patient?.id ?? "none");

  let responseText: string;

  try {
    ({ responseText } = await runCallPipeline({
      transcript,
      callId,
      patientId: patient?.id ?? "",
      language: patient?.language ?? "en",
      callType: "inbound",
      wordConfidences:
        body.call?.transcript?.words?.map(
          (w: { confidence: number }) => w.confidence,
        ) ?? [],
    }));
  } catch (err) {
    console.error("[LLM] runCallPipeline error:", err);
    responseText =
      "I'm sorry, I ran into an issue. Could you please repeat that?";
  }

  console.log("[LLM] responseText:", responseText?.slice(0, 120));

  return respondJson(responseText, isStreaming);
}

function respondJson(content: string, streaming: boolean): NextResponse | Response {
  const id = `chatcmpl-${Date.now()}`;
  const created = Math.floor(Date.now() / 1000);

  if (streaming) {
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      start(controller) {
        // Chunk 1: content delta
        const contentChunk = {
          id,
          object: "chat.completion.chunk",
          created,
          model: "carecaller-v1",
          choices: [
            {
              delta: { role: "assistant", content },
              finish_reason: null,
              index: 0,
            },
          ],
        };
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(contentChunk)}\n\n`),
        );

        // Chunk 2: stop signal
        const stopChunk = {
          id,
          object: "chat.completion.chunk",
          created,
          model: "carecaller-v1",
          choices: [
            {
              delta: {},
              finish_reason: "stop",
              index: 0,
            },
          ],
        };
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(stopChunk)}\n\n`),
        );

        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  // Non-streaming (standard JSON)
  return NextResponse.json({
    id,
    object: "chat.completion",
    created,
    model: "carecaller-v1",
    choices: [
      {
        message: { role: "assistant", content },
        finish_reason: "stop",
        index: 0,
      },
    ],
  });
}
