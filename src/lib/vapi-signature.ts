import type { NextRequest } from "next/server";

import { createHmac } from "node:crypto";

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

interface VapiMessage {
  type?: string;
  status?: string;
  call?: VapiCall;
  artifact?: {
    transcript?: string;
  };
  toolCallList?: VapiToolCall[];
}

export interface VapiWebhookBody {
  message?: VapiMessage;
  call?: VapiCall;
}

type ParsedWebhookResult =
  | { ok: true; body: VapiWebhookBody }
  | { ok: false; status: number; error: string };

const SIGNATURE_HEADERS = ["x-vapi-signature", "x-webhook-signature"] as const;

function getSignatureHeader(headers: Headers): string {
  for (const header of SIGNATURE_HEADERS) {
    const value = headers.get(header);

    if (value?.trim()) return value.trim();
  }

  return "";
}

function timingSafeCompare(left: string, right: string): boolean {
  if (left.length !== right.length) return false;

  let mismatch = 0;

  for (let i = 0; i < left.length; i += 1) {
    mismatch |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }

  return mismatch === 0;
}

function parseSignatureCandidates(signatureHeader: string): string[] {
  const rawParts = signatureHeader
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  const candidates = new Set<string>();

  for (const part of rawParts) {
    if (part.startsWith("sha256=")) {
      candidates.add(part.slice("sha256=".length).trim());
      continue;
    }

    if (part.includes("=")) {
      const [, ...rest] = part.split("=");
      const value = rest.join("=").trim();

      if (value) candidates.add(value);
      continue;
    }

    candidates.add(part);
  }

  return Array.from(candidates);
}

export function verifyVapiSignature(
  rawBody: string,
  signatureHeader: string,
  secret: string,
): boolean {
  if (!signatureHeader || !secret) return false;

  const expectedHex = createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");
  const expectedBase64 = createHmac("sha256", secret)
    .update(rawBody)
    .digest("base64");
  const candidates = parseSignatureCandidates(signatureHeader);

  return candidates.some(
    (candidate) =>
      timingSafeCompare(candidate, expectedHex) ||
      timingSafeCompare(candidate, expectedBase64),
  );
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
    const signature = getSignatureHeader(req.headers);

    if (!signature || !verifyVapiSignature(rawBody, signature, secret)) {
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
  return (
    body.message?.call?.customer?.number ?? body.call?.customer?.number ?? ""
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
