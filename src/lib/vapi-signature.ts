import type { NextRequest } from "next/server";

interface VapiCall {
  id?: string;
  customer?: {
    number?: string;
  };
  artifact?: {
    transcript?: string;
  };
  transcript?: unknown;
}

interface VapiToolCall {
  id?: string;
  name?: string;
  parameters?: Record<string, unknown>;
}

interface VapiCustomer {
  number?: string;
}

interface VapiMessage {
  type?: string;
  status?: string;
  call?: VapiCall;
  // VAPI also surfaces customer at message-level (not just inside call)
  customer?: VapiCustomer;
  artifact?: {
    transcript?: string;
  };
  toolCallList?: VapiToolCall[];
}

export interface VapiWebhookBody {
  message?: VapiMessage;
  call?: VapiCall;
  // VAPI may also put customer at root body level
  customer?: VapiCustomer;
}

type ParsedWebhookResult =
  | { ok: true; body: VapiWebhookBody }
  | { ok: false; status: number; error: string };

// Vapi sends the raw secret as a plain value in the X-Vapi-Secret header.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export function verifyVapiSignature(
  _rawBody: string,
  headers: Headers,
  secret: string,
): boolean {
  const incoming = headers.get("x-vapi-secret")?.trim() ?? "";
  return timingSafeEqual(incoming, secret);
}

export async function parseAndVerifyVapiRequest(
  req: NextRequest,
): Promise<ParsedWebhookResult> {
  const rawBody = await req.text();

  if (!rawBody.trim()) {
    return { ok: false, status: 400, error: "Missing request body" };
  }

  const secret = process.env.VAPI_WEBHOOK_SECRET?.trim();

  if (secret) {
    if (!verifyVapiSignature(rawBody, req.headers, secret)) {
      return { ok: false, status: 401, error: "Invalid webhook signature" };
    }
  }

  try {
    const body = JSON.parse(rawBody) as VapiWebhookBody;

    return { ok: true, body };
  } catch {
    return { ok: false, status: 400, error: "Invalid JSON payload" };
  }
}

export function getVapiMessageType(body: VapiWebhookBody): string {
  return body.message?.type ?? "";
}

export function getVapiCallId(body: VapiWebhookBody): string {
  return body.message?.call?.id ?? body.call?.id ?? "";
}

export function getVapiPatientPhone(body: VapiWebhookBody): string {
  // Check all locations VAPI may place the caller's number
  return (
    body.message?.call?.customer?.number ??
    body.message?.customer?.number ??
    body.call?.customer?.number ??
    body.customer?.number ??
    ""
  );
}

export function getVapiTranscript(body: VapiWebhookBody): string {
  const messageTranscript = body.message?.artifact?.transcript;
  const callArtifactTranscript = body.call?.artifact?.transcript;
  const callTranscript =
    typeof body.call?.transcript === "string" ? body.call.transcript : "";

  return messageTranscript ?? callArtifactTranscript ?? callTranscript ?? "";
}

export function getVapiToolCalls(body: VapiWebhookBody): VapiToolCall[] {
  return body.message?.toolCallList ?? [];
}
