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
      const assistantId = process.env.VAPI_ASSISTANT_ID?.trim();

      if (!assistantId) {
        return NextResponse.json(
          { error: "Missing VAPI_ASSISTANT_ID for assistant-request events." },
          { status: 500 },
        );
      }

      return NextResponse.json({ assistantId });
    }

    case "call-started":
      await processCallStartedWebhook(body);

      return NextResponse.json({ ok: true });

    case "call-ended":
    case "end-of-call-report":
      await processEndOfCallWebhook(body);

      return NextResponse.json({ ok: true });

    case "tool-calls":
      return NextResponse.json({ results: buildUnsupportedToolResults(body) });

    default:
      return NextResponse.json({ ok: true });
  }
}
