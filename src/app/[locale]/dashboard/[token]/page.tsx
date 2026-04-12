"use client";

import type {
  AppointmentWithDoctor,
  DoctorRecommendation,
  Escalation,
  MedicationSavings,
  Medication,
  Symptom,
  TimelineEvent,
} from "@/types";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { PinGate } from "@/components/shared/PinGate";
import { LanguageSwitcher } from "@/components/shared/LanguageSwitcher";
import { AlertBanner } from "@/components/dashboard/AlertBanner";
import { CallSummarySection } from "@/components/dashboard/CallSummarySection";
import { MedicationSection } from "@/components/dashboard/MedicationSection";
import { AppointmentSection } from "@/components/dashboard/AppointmentSection";
import { TimelineSection } from "@/components/dashboard/TimelineSection";
import { SavingsCard } from "@/components/dashboard/SavingsCard";
import { MessageBox } from "@/components/dashboard/MessageBox";
import { AppointmentRecommendationsSection } from "@/components/shared/AppointmentRecommendationsSection";
import { useRealtimeAlerts } from "@/hooks/useRealtimeAlerts";
import { GlassBadge } from "@/components/ui/GlassBadge";
import { GlassCard } from "@/components/ui/GlassCard";

interface DashboardData {
  patient: {
    id: string;
    name_alias: string;
    language: string;
    severity_score: number;
  };
  medications: Medication[];
  appointments: AppointmentWithDoctor[];
  timeline: TimelineEvent[];
  escalations: Escalation[];
  symptoms: Symptom[];
  messages: {
    totalCount: number;
    pendingCount: number;
    latestAt: string | null;
  };
  liveSavings: MedicationSavings[];
  lastCall: {
    summary: string;
    severity_score: number;
    ended_at: string;
  } | null;
  recommendations: DoctorRecommendation[];
}

function severityColor(score: number): "red" | "amber" | "emerald" {
  if (score >= 7) return "red";
  if (score >= 4) return "amber";

  return "emerald";
}

function monitoringState(
  score: number,
  hasEscalation: boolean,
  t: (key: any) => string,
) {
  if (score >= 8 || hasEscalation) {
    return {
      label: t("monitoring.high.title"),
      accent: "border-red-200 bg-red-50 text-red-700",
      summary: t("monitoring.high.summary"),
    };
  }

  if (score >= 4) {
    return {
      label: t("monitoring.watch.title"),
      accent: "border-amber-200 bg-amber-50 text-amber-700",
      summary: t("monitoring.watch.summary"),
    };
  }

  return {
    label: t("monitoring.steady.title"),
    accent: "border-emerald-200 bg-emerald-50 text-emerald-700",
    summary: t("monitoring.steady.summary"),
  };
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

function dedupeSavingsEntries(entries: MedicationSavings[]): MedicationSavings[] {
  const grouped = new Map<string, MedicationSavings>();

  for (const entry of entries) {
    const key = entry.drugName.trim().toLowerCase();
    const existing = grouped.get(key);

    if (!existing) {
      grouped.set(key, {
        ...entry,
        links: Array.from(
          new Map(entry.links.map((link) => [link.url, link])).values(),
        ),
      });
      continue;
    }

    const mergedLinks = Array.from(
      new Map(
        [...existing.links, ...entry.links].map((link) => [link.url, link]),
      ).values(),
    );
    const nextFetchedAt =
      existing.fetchedAt && entry.fetchedAt
        ? new Date(existing.fetchedAt) > new Date(entry.fetchedAt)
          ? existing.fetchedAt
          : entry.fetchedAt
        : existing.fetchedAt ?? entry.fetchedAt;

    grouped.set(key, {
      ...existing,
      medicationId: existing.medicationId ?? entry.medicationId,
      contextSummary: existing.contextSummary ?? entry.contextSummary,
      query: existing.query ?? entry.query,
      links: mergedLinks,
      fetchedAt: nextFetchedAt,
      source:
        existing.source === "tavily" || entry.source === "tavily"
          ? "tavily"
          : existing.source,
    });
  }

  return Array.from(grouped.values());
}

export default function DashboardPage() {
  const params = useParams();
  const token = params.token as string;
  const locale = params.locale as string;
  const t = useTranslations("dashboard");
  const tCommon = useTranslations("common");
  const [data, setData] = useState<DashboardData | null>(null);
  const autoVerified = useRef(false);

  const escalations = useRealtimeAlerts(
    data?.patient?.id ?? "",
    data?.escalations ?? [],
  );

  useEffect(() => {
    if (autoVerified.current || data) return;
    const cached = sessionStorage.getItem(`pin_${token}`);

    if (!cached) return;
    autoVerified.current = true;

    fetch(`/api/dashboard/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: cached }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((payload) => {
        if (payload) setData(payload as DashboardData);
        else sessionStorage.removeItem(`pin_${token}`);
      })
      .catch(() => sessionStorage.removeItem(`pin_${token}`));
  }, [token, data]);

  if (!data) {
    return (
      <PinGate
        token={token}
        onVerified={(payload, pin) => {
          sessionStorage.setItem(`pin_${token}`, pin);
          setData(payload as DashboardData);
        }}
      />
    );
  }

  const { patient, medications, appointments, timeline, lastCall, symptoms } =
    data;
  const careTeam = Array.from(
    new Map(
      appointments
        .filter((appointment) => appointment.doctors?.name)
        .map((appointment) => [
          appointment.doctors?.name ?? "",
          appointment.doctors,
        ]),
    ).values(),
  );
  const savingsEvents = timeline.filter(
    (event) => event.event_type === "savings_found",
  ) as Array<
    TimelineEvent & {
      content: {
        drugName: string;
        links: { url: string; title: string }[];
      };
    }
  >;
  const savingsData = dedupeSavingsEntries(
    data.liveSavings.length > 0
      ? data.liveSavings
      : savingsEvents.map((event) => ({
          drugName: event.content.drugName,
          links: event.content.links,
          fetchedAt: null,
          source: "timeline" as const,
        })),
  );
  const correctionCount = timeline.filter(
    (event) => event.event_type === "correction",
  ).length;
  const verifiedMedicationCount = medications.filter(
    (medication) =>
      medication.source === "patient_verified" ||
      medication.source === "clinician_verified",
  ).length;
  const monitoring = monitoringState(
    patient.severity_score,
    escalations.length > 0,
    t,
  );
  const nextAppointment = appointments[0] ?? null;
  const timelineEvents = timeline.filter(
    (event) => event.event_type !== "savings_found",
  );
  const fallbackDate = tCommon("notYet");

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
              {t("headline")}
            </p>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600 md:text-base">
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
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="metric-chip">
                {t("pendingMessagesMetric", {
                  count: data.messages.pendingCount,
                })}
              </span>
              <LanguageSwitcher currentLocale={locale} />
            </div>
          </div>
        </header>

        <AlertBanner
          escalations={escalations}
          severity={patient.severity_score}
        />

        <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="space-y-6">
            <GlassCard className="surface-card-dark rounded-[2rem]">
              <p className="eyebrow mb-3 text-[#BDD8CC]">{t("profileCard")}</p>
              <h2 className="text-3xl font-semibold text-white">
                {patient.name_alias}
              </h2>
              <p className="mt-2 text-sm leading-7 text-slate-200/85">
                {t("languageLabel")}: {patient.language.toUpperCase()}
                <br />
                {t("lastSummaryLabel")}:{" "}
                {formatDateTime(
                  lastCall?.ended_at ?? null,
                  locale,
                  fallbackDate,
                )}
              </p>

              <div className="mt-6 grid grid-cols-2 gap-3">
                <div className="rounded-[1.5rem] border border-white/10 bg-white/6 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#C8DED4]">
                    {t("medicationConfidence")}
                  </p>
                  <p className="mt-3 text-3xl font-semibold text-white">
                    {verifiedMedicationCount}
                  </p>
                  <p className="mt-1 text-sm text-slate-300/80">
                    {t("verifiedMeds")}
                  </p>
                </div>
                <div className="rounded-[1.5rem] border border-white/10 bg-white/6 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#C8DED4]">
                    {t("corrections")}
                  </p>
                  <p className="mt-3 text-3xl font-semibold text-white">
                    {correctionCount}
                  </p>
                  <p className="mt-1 text-sm text-slate-300/80">
                    {t("correctionsTimeline")}
                  </p>
                </div>
              </div>

              <div className="mt-6 rounded-[1.5rem] border border-white/10 bg-white/6 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#C8DED4]">
                  {t("messageSummary")}
                </p>
                <p className="mt-3 text-sm leading-7 text-slate-200/88">
                  {t("messageSummaryText", {
                    totalCount: data.messages.totalCount,
                    pendingCount: data.messages.pendingCount,
                  })}
                </p>
              </div>
            </GlassCard>

            <GlassCard className="rounded-[2rem]">
              <p className="eyebrow mb-4">{t("currentSymptoms")}</p>
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

            <GlassCard className="rounded-[2rem]">
              <p className="eyebrow mb-4">{t("careTeam")}</p>
              {careTeam.length ? (
                <div className="space-y-3">
                  {careTeam.map((doctor) => (
                    <div
                      key={`${doctor?.name}-${doctor?.specialty ?? ""}`}
                      className="rounded-[1.35rem] border border-slate-200/70 bg-white/70 p-4"
                    >
                      <p className="font-semibold text-slate-900">
                        {doctor?.name}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        {doctor?.specialty ?? t("generalCare")}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm leading-7 text-slate-600">
                  {t("noCareTeam")}
                </p>
              )}
            </GlassCard>
          </aside>

          <main className="space-y-6">
            <section className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.85fr)]">
              <GlassCard className="rounded-[2rem]">
                <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                  <div className="max-w-2xl">
                    <p className="eyebrow mb-3">{t("overview")}</p>
                    <h2 className="text-3xl font-semibold text-slate-900">
                      {monitoring.label}
                    </h2>
                    <p className="mt-4 text-sm leading-7 text-slate-600 md:text-base">
                      {monitoring.summary}
                    </p>
                  </div>
                  <div
                    className={`rounded-[1.5rem] border px-5 py-4 text-sm font-semibold ${monitoring.accent}`}
                  >
                    {t("recommendedAction")}
                  </div>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-3">
                  <div className="rounded-[1.5rem] border border-slate-200/70 bg-white/72 p-4">
                    <p className="eyebrow mb-2">{t("responseWindow")}</p>
                    <p className="text-lg font-semibold text-slate-900">
                      {patient.severity_score >= 7 || escalations.length
                        ? t("responseWindowValue.withinHours")
                        : patient.severity_score >= 4
                          ? t("responseWindowValue.sameDay")
                          : t("responseWindowValue.routineFollowUp")}
                    </p>
                    <p className="mt-2 text-sm leading-7 text-slate-600">
                      {t("responseWindowHint")}
                    </p>
                  </div>
                  <div className="rounded-[1.5rem] border border-slate-200/70 bg-white/72 p-4">
                    <p className="eyebrow mb-2">{t("nextTouchpoint")}</p>
                    <p className="text-lg font-semibold text-slate-900">
                      {nextAppointment
                        ? new Intl.DateTimeFormat(locale, {
                            dateStyle: "medium",
                          }).format(new Date(nextAppointment.datetime))
                        : t("noVisitScheduled")}
                    </p>
                    <p className="mt-2 text-sm leading-7 text-slate-600">
                      {nextAppointment?.doctors?.name
                        ? `${nextAppointment.doctors.name}${nextAppointment.doctors.specialty ? ` · ${nextAppointment.doctors.specialty}` : ""}`
                        : t("messagingFallback")}
                    </p>
                  </div>
                  <div className="rounded-[1.5rem] border border-slate-200/70 bg-white/72 p-4">
                    <p className="eyebrow mb-2">{t("clinicianReady")}</p>
                    <p className="text-lg font-semibold text-slate-900">
                      {escalations.length
                        ? t("pendingEscalations", { count: escalations.length })
                        : t("noActiveEscalation")}
                    </p>
                    <p className="mt-2 text-sm leading-7 text-slate-600">
                      {t("latestPatientMessage", {
                        date: formatDateTime(
                          data.messages.latestAt,
                          locale,
                          fallbackDate,
                        ),
                      })}
                    </p>
                  </div>
                </div>
              </GlassCard>

              <div className="grid gap-6">
                <CallSummarySection lastCall={lastCall} />
                {savingsData.length > 0 ? (
                  <SavingsCard savings={savingsData} />
                ) : (
                  <GlassCard className="rounded-[2rem]">
                    <p className="eyebrow mb-3">{t("costSupport")}</p>
                    <p className="text-sm leading-7 text-slate-600">
                      {t("costSupportEmpty")}
                    </p>
                  </GlassCard>
                )}
              </div>
            </section>

            <AppointmentRecommendationsSection
              mode="patient"
              patientId={patient.id}
              recommendations={data.recommendations}
              onAppointmentBooked={(appointment) => {
                setData((current) => {
                  if (!current) return current;

                  const nextAppointments = [
                    ...current.appointments,
                    appointment,
                  ]
                    .sort(
                      (left, right) =>
                        new Date(left.datetime).getTime() -
                        new Date(right.datetime).getTime(),
                    )
                    .slice(0, 6);

                  return {
                    ...current,
                    appointments: nextAppointments,
                  };
                });
              }}
            />

            <section className="grid gap-6 xl:grid-cols-[minmax(0,1.12fr)_minmax(320px,0.88fr)]">
              <GlassCard className="rounded-[2rem]">
                <MedicationSection
                  locale={locale}
                  medications={medications}
                  patientId={patient.id}
                />
              </GlassCard>

              <div className="grid gap-6">
                <GlassCard className="rounded-[2rem]">
                  <AppointmentSection
                    appointments={appointments}
                    patientId={patient.id}
                  />
                </GlassCard>
                <MessageBox patientId={patient.id} />
              </div>
            </section>

            <GlassCard className="rounded-[2rem]">
              <TimelineSection events={timelineEvents} />
            </GlassCard>
          </main>
        </div>
      </div>
    </div>
  );
}
