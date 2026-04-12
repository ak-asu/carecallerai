import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { getAppointmentRecommendations } from "@/lib/doctorSchedule";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const { pin } = await req.json();

  const { data: patient } = await supabaseAdmin
    .from("patients")
    .select("*")
    .eq("token", token)
    .single();

  if (!patient)
    return NextResponse.json({ error: "not_found" }, { status: 404 });

  const valid = await bcrypt.compare(String(pin), patient.password_hash);

  if (!valid)
    return NextResponse.json({ error: "invalid_pin" }, { status: 401 });

  // Fetch all dashboard data
  const [
    medsRes,
    apptsRes,
    timelineRes,
    escalationsRes,
    lastCallRes,
    symptomsRes,
    messagesRes,
  ] = await Promise.all([
    supabaseAdmin
      .from("medications")
      .select("*")
      .eq("patient_id", patient.id)
      .eq("active", true),
    supabaseAdmin
      .from("appointments")
      .select("*, doctors(name, specialty)")
      .eq("patient_id", patient.id)
      .gte("datetime", new Date().toISOString())
      .order("datetime")
      .limit(3),
    supabaseAdmin
      .from("patient_timeline")
      .select("*")
      .eq("patient_id", patient.id)
      .order("created_at", { ascending: false })
      .limit(10),
    supabaseAdmin
      .from("escalations")
      .select("*")
      .eq("patient_id", patient.id)
      .eq("status", "pending"),
    supabaseAdmin
      .from("calls")
      .select("id, summary, severity_score, ended_at")
      .eq("patient_id", patient.id)
      .eq("status", "completed")
      .order("ended_at", { ascending: false })
      .limit(1),
    supabaseAdmin
      .from("symptoms")
      .select(
        "id, patient_id, call_id, symptom_name, severity, onset_date, resolved, flagged_to_clinician",
      )
      .eq("patient_id", patient.id)
      .or("resolved.is.null,resolved.eq.false")
      .order("severity", { ascending: false })
      .limit(6),
    supabaseAdmin
      .from("notifications")
      .select("id, created_at, status")
      .eq("patient_id", patient.id)
      .eq("type", "patient_message")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const patientMessages = messagesRes.data ?? [];
  const appointmentRecommendations = await getAppointmentRecommendations(
    symptomsRes.data ?? [],
  );

  return NextResponse.json({
    patient: {
      id: patient.id,
      name_alias: patient.name_alias,
      language: patient.language,
      severity_score: patient.severity_score,
    },
    medications: medsRes.data ?? [],
    appointments: apptsRes.data ?? [],
    timeline: timelineRes.data ?? [],
    escalations: escalationsRes.data ?? [],
    symptoms: symptomsRes.data ?? [],
    messages: {
      totalCount: patientMessages.length,
      pendingCount: patientMessages.filter(
        (message) => message.status === "pending",
      ).length,
      latestAt: patientMessages[0]?.created_at ?? null,
    },
    lastCall: lastCallRes.data?.[0] ?? null,
    recommendations: appointmentRecommendations,
  });
}
