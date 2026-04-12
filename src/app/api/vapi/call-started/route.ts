import { NextRequest, NextResponse } from "next/server";

import { getVapiCallId, parseAndVerifyVapiRequest } from "@/lib/vapi-signature";
import { processCallStartedWebhook } from "@/lib/vapi-webhook";

export const dynamic = "force-dynamic";

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

  await processCallStartedWebhook(parsed.body);

  return NextResponse.json({ ok: true });
}
