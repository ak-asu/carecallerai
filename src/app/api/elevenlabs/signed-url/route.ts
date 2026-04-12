import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface SignedUrlPayload {
  signed_url?: string;
}

export async function GET() {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  const agentId = process.env.ELEVENLABS_CONVERSATIONAL_AGENT_ID?.trim();
  const branchId = process.env.ELEVENLABS_CONVERSATIONAL_BRANCH_ID?.trim();

  if (!apiKey || !agentId) {
    return NextResponse.json(
      { error: "elevenlabs_agent_not_configured" },
      { status: 500 },
    );
  }

  const params = new URLSearchParams({
    agent_id: agentId,
    include_conversation_id: "true",
  });

  if (branchId) {
    params.set("branch_id", branchId);
  }

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?${params.toString()}`,
      {
        headers: {
          "xi-api-key": apiKey,
        },
        cache: "no-store",
      },
    );

    if (!response.ok) {
      const detail = await response.text();

      throw new Error(`elevenlabs_signed_url_failed:${response.status}:${detail}`);
    }

    const payload = (await response.json()) as SignedUrlPayload;

    if (!payload.signed_url) {
      throw new Error("elevenlabs_signed_url_missing");
    }

    return NextResponse.json({ signedUrl: payload.signed_url });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "elevenlabs_signed_url_failed" },
      { status: 502 },
    );
  }
}
