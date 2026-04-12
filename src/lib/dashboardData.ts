import type {
  AppointmentWithDoctor,
  DoctorRecommendation,
  Escalation,
  Language,
  Medication,
  MedicationSavings,
  Symptom,
  TimelineEvent,
} from "@/types";

import bcrypt from "bcryptjs";

import { getAppointmentRecommendations } from "@/lib/doctorSchedule";
import { getMedicationSavingsForPatient } from "@/lib/medicationSavings";
import { derivePatientSeverity } from "@/lib/patientSeverity";
import { supabaseAdmin } from "@/lib/supabase";

export interface DashboardPatientData {
  id: string;
  name_alias: string;
  language: string;
  severity_score: number;
}

export interface DashboardLastCall {
  summary: string;
  severity_score: number;
  ended_at: string;
}

export interface DashboardMessageStats {
  totalCount: number;
  pendingCount: number;
  latestAt: string | null;
}

export interface DashboardDataPayload {
  patient: DashboardPatientData;
  medications: Medication[];
  appointments: AppointmentWithDoctor[];
  timeline: TimelineEvent[];
  escalations: Escalation[];
  symptoms: Symptom[];
  messages: DashboardMessageStats;
  liveSavings: MedicationSavings[];
  lastCall: DashboardLastCall | null;
  recommendations: DoctorRecommendation[];
}

export async function getDashboardDataByToken(
  token: string,
  pin: string,
): Promise<
  | { ok: true; data: DashboardDataPayload }
  | { ok: false; status: 404 | 401; error: "not_found" | "invalid_pin" }
> {
  const { data: patient } = await supabaseAdmin
    .from("patients")
    .select("*")
    .eq("token", token)
    .single();

  if (!patient) {
    return { ok: false, status: 404, error: "not_found" };
  }

  const valid = await bcrypt.compare(String(pin), patient.password_hash);

  if (!valid) {
    return { ok: false, status: 401, error: "invalid_pin" };
  }

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
  const medications = medsRes.data ?? [];
  const symptoms = symptomsRes.data ?? [];
  const escalations = escalationsRes.data ?? [];
  const derivedSeverity = derivePatientSeverity({
    storedSeverity: patient.severity_score,
    symptoms,
    escalations,
  });
  const [appointmentRecommendations, liveSavings] = await Promise.all([
    getAppointmentRecommendations(symptoms),
    getMedicationSavingsForPatient({
      patient: {
        id: patient.id,
        name_alias: patient.name_alias,
        language: patient.language as Language,
      },
      medications,
      symptoms,
    }),
  ]);

  return {
    ok: true,
    data: {
      patient: {
        id: patient.id,
        name_alias: patient.name_alias,
        language: patient.language,
        severity_score: derivedSeverity,
      },
      medications: medications as Medication[],
      appointments: (apptsRes.data ?? []) as AppointmentWithDoctor[],
      timeline: (timelineRes.data ?? []) as TimelineEvent[],
      escalations: escalations as Escalation[],
      symptoms: symptoms as Symptom[],
      liveSavings,
      messages: {
        totalCount: patientMessages.length,
        pendingCount: patientMessages.filter(
          (message) => message.status === "pending",
        ).length,
        latestAt: patientMessages[0]?.created_at ?? null,
      },
      lastCall: (lastCallRes.data?.[0] ?? null) as DashboardLastCall | null,
      recommendations: appointmentRecommendations as DoctorRecommendation[],
    },
  };
}
