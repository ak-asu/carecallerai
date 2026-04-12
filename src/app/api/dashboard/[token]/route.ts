import { NextRequest, NextResponse } from "next/server";

import { getDashboardDataByToken } from "@/lib/dashboardData";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const { pin } = await req.json();
  const dashboardResult = await getDashboardDataByToken(token, String(pin ?? ""));

  if (!dashboardResult.ok) {
    return NextResponse.json(
      { error: dashboardResult.error },
      { status: dashboardResult.status },
    );
  }

  return NextResponse.json(dashboardResult.data);
}
