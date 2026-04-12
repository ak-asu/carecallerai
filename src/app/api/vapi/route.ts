import { NextRequest, NextResponse } from "next/server";

import {
  getVapiMessageType,
  parseAndVerifyVapiRequest,
} from "@/lib/vapi-signature";
import {
  buildUnsupportedToolResults,
  processCallStartedWebhook,
  processEndOfCallWebhook,
} from "@/lib/vapi-webhook";

export const dynamic = "force-dynamic";

// Top 50 drug names for AssemblyAI wordBoost — improves transcription accuracy
// for the brand/generic names most commonly mentioned in patient calls
const WORD_BOOST = [
  "warfarin",
  "coumadin",
  "lisinopril",
  "metformin",
  "glucophage",
  "atorvastatin",
  "lipitor",
  "amlodipine",
  "norvasc",
  "sertraline",
  "zoloft",
  "gabapentin",
  "neurontin",
  "omeprazole",
  "prilosec",
  "furosemide",
  "lasix",
  "escitalopram",
  "lexapro",
  "metoprolol",
  "lopressor",
  "losartan",
  "cozaar",
  "levothyroxine",
  "synthroid",
  "albuterol",
  "ventolin",
  "prednisone",
  "fluticasone",
  "flonase",
  "montelukast",
  "singulair",
  "pantoprazole",
  "protonix",
  "rosuvastatin",
  "crestor",
  "simvastatin",
  "zocor",
  "clopidogrel",
  "plavix",
  "hydrochlorothiazide",
  "spironolactone",
  "aldactone",
  "carvedilol",
  "coreg",
  "valsartan",
  "diovan",
  "enalapril",
  "ramipril",
  "semaglutide",
  "ozempic",
  "wegovy",
  "jardiance",
  "farxiga",
  "lantus",
  "humalog",
  "prozac",
  "cymbalta",
  "wellbutrin",
  "klonopin",
  "ativan",
  "xanax",
];

function buildAssistantConfig() {
  const sttProvider = process.env.STT_PROVIDER?.trim() ?? "assembly-ai";
  const customSttUrl = process.env.CUSTOM_STT_URL?.trim();

  const transcriber =
    sttProvider === "custom" && customSttUrl
      ? {
          provider: "custom-transcriber" as const,
          server: { url: customSttUrl },
        }
      : {
          provider: "assembly-ai" as const,
          wordBoost: WORD_BOOST,
          languageCode: "en",
        };

  return {
    transcriber,
    model: {
      provider: "custom-llm" as const,
      url: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/api/vapi/llm`,
    },
    voice: {
      provider: "11labs" as const,
      voiceId: process.env.ELEVENLABS_VOICE_ID ?? "21m00Tcm4TlvDq8ikWAM",
    },
    // Smart endpointing: wait for a natural pause before sending to LLM.
    // Prevents the LLM from firing on every partial speech segment.
    smartEndpointingEnabled: true,
    smartEndpointingPlan: {
      provider: "vapi" as const,
    },
  };
}

export async function POST(req: NextRequest) {
  const parsed = await parseAndVerifyVapiRequest(req);

  if (!parsed.ok) {
    return NextResponse.json(
      { ok: false, error: parsed.error },
      { status: parsed.status },
    );
  }

  const body = parsed.body;
  const messageType = getVapiMessageType(body);

  switch (messageType) {
    case "assistant-request": {
      // Return inline assistant config so we can control the transcriber
      // dynamically via STT_PROVIDER env var — no Vapi dashboard change needed
      return NextResponse.json({ assistant: buildAssistantConfig() });
    }

    case "assistant.started":
    case "call-started":
      await processCallStartedWebhook(body);

      return NextResponse.json({ ok: true });

    case "call-ended":
    case "end-of-call-report":
      await processEndOfCallWebhook(body);

      return NextResponse.json({ ok: true });

    case "status-update":
      // in-progress fires when call connects — use as backup for call setup
      // in case assistant.started didn't carry the customer phone.
      if (body.message?.status === "in-progress") {
        await processCallStartedWebhook(body);
      }
      // ended fires on abrupt endings where VAPI skips end-of-call-report
      if (body.message?.status === "ended") {
        await processEndOfCallWebhook(body);
      }

      return NextResponse.json({ ok: true });

    case "tool-calls":
      return NextResponse.json({ results: buildUnsupportedToolResults(body) });

    default:
      return NextResponse.json({ ok: true });
  }
}
