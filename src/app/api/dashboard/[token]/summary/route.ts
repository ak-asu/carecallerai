import { NextRequest, NextResponse } from "next/server";

import { getDashboardDataByToken } from "@/lib/dashboardData";
import { generateSpeechFromText } from "@/lib/elevenlabs";
import { buildPatientSummary } from "@/lib/patientSummary";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const { pin, locale } = await req.json();

  const dashboardResult = await getDashboardDataByToken(token, String(pin ?? ""));

  if (!dashboardResult.ok) {
    return NextResponse.json(
      { error: dashboardResult.error },
      { status: dashboardResult.status },
    );
  }

  const summary = buildPatientSummary(dashboardResult.data, String(locale ?? "en"));

  try {
    const audio = await generateSpeechFromText(summary);

    return NextResponse.json({
      summary,
      audioBase64: audio?.audioBase64 ?? null,
      mimeType: audio?.mimeType ?? null,
    });
  } catch {
    return NextResponse.json({
      summary,
      audioBase64: null,
      mimeType: null,
      audioUnavailable: true,
    });
  }
}
