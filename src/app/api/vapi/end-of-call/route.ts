import { NextRequest, NextResponse } from "next/server";

import { getVapiCallId, parseAndVerifyVapiRequest } from "@/lib/vapi-signature";
import { processEndOfCallWebhook } from "@/lib/vapi-webhook";

export async function POST(req: NextRequest) {
  const parsed = await parseAndVerifyVapiRequest(req);

  if (!parsed.ok) {
    return NextResponse.json(
      { ok: false, error: parsed.error },
      { status: parsed.status },
    );
  }

  const callId = getVapiCallId(parsed.body);

  if (!callId) {
    return NextResponse.json(
      { ok: false, error: "Missing call ID" },
      { status: 400 },
    );
  }

  await processEndOfCallWebhook(parsed.body);

  return NextResponse.json({ ok: true });
}
