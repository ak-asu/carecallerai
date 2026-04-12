import { NextRequest, NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const { patientId, message } = await req.json();

  if (!patientId || !message?.trim()) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("notifications").insert({
    patient_id: patientId,
    type: "patient_message",
    message: message.trim(),
    status: "pending",
    language: "en",
  });

  if (error) {
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
