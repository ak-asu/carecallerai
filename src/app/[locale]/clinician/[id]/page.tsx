import type {
  AppointmentWithDoctor,
  Call,
  Doctor,
  Escalation,
  Medication,
  Patient,
  Symptom,
  TimelineEvent,
} from "@/types";

import { getTranslations } from "next-intl/server";

import { getAppointmentRecommendations } from "@/lib/doctorSchedule";
import { supabaseAdmin } from "@/lib/supabase";
import { TimelineFeed } from "@/components/clinician/TimelineFeed";
import { EscalationCard } from "@/components/clinician/EscalationCard";
import { CallTranscriptView } from "@/components/clinician/CallTranscriptView";
import { DoctorPanel } from "@/components/clinician/DoctorPanel";
import { AppointmentEditor } from "@/components/clinician/AppointmentEditor";
import { PatientMessages } from "@/components/clinician/PatientMessages";
import { AppointmentRecommendationsSection } from "@/components/shared/AppointmentRecommendationsSection";
import { LanguageSwitcher } from "@/components/shared/LanguageSwitcher";
import { GlassBadge } from "@/components/ui/GlassBadge";
import { GlassCard } from "@/components/ui/GlassCard";

function severityColor(score: number): "red" | "amber" | "emerald" {
  if (score >= 7) return "red";
  if (score >= 4) return "amber";

  return "emerald";
}

function formatDateTime(
  value: string | null,
  locale: string,
  fallback: string,
) {
  if (!value) return fallback;

  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function recommendedAction(
  patient: Patient,
  escalations: Escalation[],
  nextAppointment: AppointmentWithDoctor | null,
  t: (key: any) => string,
) {
  if (escalations.length > 0 || patient.severity_score >= 8) {
    return t("recommendedAction.urgent");
  }

  if (patient.severity_score >= 5) {
    return nextAppointment
      ? t("recommendedAction.midWithAppointment")
      : t("recommendedAction.midWithoutAppointment");
  }

  return t("recommendedAction.stable");
}

interface PatientMessage {
  id: string;
  message: string;
  status: string;
  created_at: string;
}

export default async function ClinicianPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id, locale } = await params;
  const t = await getTranslations({ locale, namespace: "clinician" });
  const tCommon = await getTranslations({ locale, namespace: "common" });

  const [
    patientRes,
    timelineRes,
    escalationsRes,
    callsRes,
    apptsRes,
    messagesRes,
    medicationsRes,
    symptomsRes,
  ] = await Promise.all([
    supabaseAdmin.from("patients").select("*").eq("id", id).single(),
    supabaseAdmin
      .from("patient_timeline")
      .select("*")
      .eq("patient_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabaseAdmin
      .from("escalations")
      .select("*")
      .eq("patient_id", id)
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("calls")
      .select("*")
      .eq("patient_id", id)
      .eq("status", "completed")
      .order("ended_at", { ascending: false })
      .limit(5),
    supabaseAdmin
      .from("appointments")
      .select("*, doctors(*)")
      .eq("patient_id", id)
      .order("datetime"),
    supabaseAdmin
      .from("notifications")
      .select("id, message, status, created_at")
      .eq("patient_id", id)
      .eq("type", "patient_message")
      .order("created_at", { ascending: false })
      .limit(20),
    supabaseAdmin
      .from("medications")
      .select("*")
      .eq("patient_id", id)
      .eq("active", true)
      .order("verified_at", { ascending: false }),
    supabaseAdmin
      .from("symptoms")
      .select("*")
      .eq("patient_id", id)
      .or("resolved.is.null,resolved.eq.false")
      .order("severity", { ascending: false })
      .limit(8),
  ]);

  const patient = patientRes.data as Patient | null;
  const timeline = (timelineRes.data ?? []) as TimelineEvent[];
  const escalations = (escalationsRes.data ?? []) as Escalation[];
  const calls = (callsRes.data ?? []) as Call[];
  const appointments = (apptsRes.data ?? []) as AppointmentWithDoctor[];
  const messages = (messagesRes.data ?? []) as PatientMessage[];
  const medications = (medicationsRes.data ?? []) as Medication[];
  const symptoms = (symptomsRes.data ?? []) as Symptom[];

  const doctorMap = new Map<string, Doctor>();

  for (const appointment of appointments) {
    if (
      appointment.doctors &&
      appointment.doctor_id &&
      !doctorMap.has(appointment.doctor_id)
    ) {
      doctorMap.set(
        appointment.doctor_id,
        appointment.doctors as unknown as Doctor,
      );
    }
  }
  const doctors = Array.from(doctorMap.values());

  if (!patient) {
    return <div className="p-8 text-slate-500">{t("notFound")}</div>;
  }

  const nextAppointment =
    appointments.find((appointment) => appointment.status !== "cancelled") ??
    null;
  const latestCall = calls[0] ?? null;
  const recommendations = await getAppointmentRecommendations(symptoms, {
    limitDoctors: 6,
  });
  const fallbackDate = tCommon("notYet");
  const nextAction = recommendedAction(
    patient,
    escalations,
    nextAppointment,
    t,
  );
  const currentState =
    patient.severity_score >= 7 || escalations.length > 0
      ? t("state.needsAttention")
      : patient.severity_score >= 4
        ? t("state.moderateWatch")
        : t("state.stableHomeMonitoring");

  return (
    <div className="page-shell">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 lg:px-8 lg:py-8">
        <header className="flex flex-col gap-6 rounded-[2rem] border border-white/50 bg-white/55 px-6 py-6 shadow-soft backdrop-blur-xl md:px-8 md:py-7 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <p className="eyebrow mb-3">{t("eyebrow")}</p>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900 md:text-5xl">
              {patient.name_alias}
            </h1>
            <p className="mt-2 text-xl font-medium text-slate-700">
              {t("subtitle")}
            </p>
          </div>

          <div className="flex flex-col items-start gap-3 lg:items-end">
            <div className="flex flex-wrap items-center gap-2">
              <GlassBadge color={severityColor(patient.severity_score)}>
                {t("severityFormat", { score: patient.severity_score })}
              </GlassBadge>
              <GlassBadge color="cyan">
                {patient.language.toUpperCase()}
              </GlassBadge>
              {patient.phone && (
                <GlassBadge color="blue">{patient.phone}</GlassBadge>
              )}
            </div>
            <LanguageSwitcher currentLocale={locale} />
          </div>
        </header>

        <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)_340px]">
          <aside className="space-y-6">
            <GlassCard className="surface-card-dark rounded-[2rem]">
              <p className="eyebrow mb-3 text-cyan-300">{t("snapshot")}</p>
              <h2 className="text-3xl font-semibold text-white">
                {patient.name_alias}
              </h2>
              <p className="mt-3 text-sm leading-7 text-slate-200/88">
                {t("lastCallLabel")}:{" "}
                {formatDateTime(patient.last_call_at, locale, fallbackDate)}
                <br />
                {t("upcomingAppointmentLabel")}:{" "}
                {formatDateTime(
                  nextAppointment?.datetime ?? null,
                  locale,
                  fallbackDate,
                )}
              </p>

              <div className="mt-6 grid grid-cols-2 gap-3">
                <div className="rounded-[1.5rem] border border-white/10 bg-white/6 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">
                    {t("messagesMetric")}
                  </p>
                  <p className="mt-2 text-3xl font-semibold text-white">
                    {messages.length}
                  </p>
                </div>
                <div className="rounded-[1.5rem] border border-white/10 bg-white/6 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">
                    {t("escalationsMetric")}
                  </p>
                  <p className="mt-2 text-3xl font-semibold text-white">
                    {escalations.length}
                  </p>
                </div>
              </div>
            </GlassCard>

            <GlassCard className="rounded-[2rem]">
              <p className="eyebrow mb-4">{t("activeMeds")}</p>
              {medications.length ? (
                <div className="flex flex-wrap gap-2">
                  {medications.map((medication) => (
                    <GlassBadge key={medication.id} color="emerald">
                      {medication.drug_name_normalized ?? medication.drug_name}
                    </GlassBadge>
                  ))}
                </div>
              ) : (
                <p className="text-sm leading-7 text-slate-600">
                  {t("noMeds")}
                </p>
              )}
            </GlassCard>

            <GlassCard className="rounded-[2rem]">
              <p className="eyebrow mb-4">{t("activeSymptoms")}</p>
              {symptoms.length ? (
                <div className="flex flex-wrap gap-2">
                  {symptoms.map((symptom) => (
                    <GlassBadge
                      key={symptom.id}
                      color={(symptom.severity ?? 0) >= 6 ? "red" : "amber"}
                    >
                      {symptom.symptom_name}
                    </GlassBadge>
                  ))}
                </div>
              ) : (
                <p className="text-sm leading-7 text-slate-600">
                  {t("noSymptoms")}
                </p>
              )}
            </GlassCard>

            <DoctorPanel doctors={doctors} />
          </aside>

          <main className="space-y-6">
            <GlassCard className="rounded-[2rem]">
              <div className="grid gap-5 md:grid-cols-[minmax(0,1.15fr)_minmax(220px,0.85fr)]">
                <div>
                  <p className="eyebrow mb-3">{t("currentState")}</p>
                  <h2 className="text-3xl font-semibold text-slate-900">
                    {currentState}
                  </h2>
                  <p className="mt-4 text-sm leading-7 text-slate-600 md:text-base">
                    {nextAction}
                  </p>
                </div>
                <div className="rounded-[1.75rem] border border-slate-200/70 bg-white/78 p-5">
                  <p className="eyebrow mb-3">{t("nextMove")}</p>
                  <p className="text-base font-semibold leading-8 text-slate-900">
                    {nextAction}
                  </p>
                </div>
              </div>
            </GlassCard>

            <AppointmentRecommendationsSection
              mode="clinician"
              patientId={id}
              recommendations={recommendations}
            />
            <AppointmentEditor appointments={appointments} patientId={id} />
            <PatientMessages messages={messages} />

            <section className="mb-6">
              <h2 className="eyebrow mb-4">{t("title")}</h2>
              <TimelineFeed events={timeline} locale={locale} />
            </section>
          </main>

          <aside className="space-y-6">
            <section>
              <h2 className="eyebrow mb-4">{t("escalations")}</h2>
              {escalations.length ? (
                <div className="flex flex-col gap-3">
                  {escalations.map((escalation) => (
                    <EscalationCard
                      key={escalation.id}
                      escalation={escalation}
                      locale={locale}
                    />
                  ))}
                </div>
              ) : (
                <GlassCard className="rounded-[2rem]">
                  <p className="text-sm leading-7 text-slate-600">
                    {t("noEscalations")}
                  </p>
                </GlassCard>
              )}
            </section>

            <section>
              <h2 className="eyebrow mb-4">{t("recentCalls")}</h2>
              <div className="flex flex-col gap-4">
                {(latestCall ? calls : []).map((call) => (
                  <CallTranscriptView
                    key={call.id}
                    summary={call.summary ?? ""}
                    transcript={call.transcript ?? ""}
                  />
                ))}
                {!latestCall && (
                  <GlassCard className="rounded-[2rem]">
                    <p className="text-sm leading-7 text-slate-600">
                      {t("noCompletedCalls")}
                    </p>
                  </GlassCard>
                )}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
