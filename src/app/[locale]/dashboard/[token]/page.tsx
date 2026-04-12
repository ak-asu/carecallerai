"use client";
import type {
  AppointmentWithDoctor,
  Escalation,
  Medication,
  TimelineEvent,
} from "@/types";

import { useState, useEffect, useRef } from "react";
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
import { useRealtimeAlerts } from "@/hooks/useRealtimeAlerts";
import { GlassBadge } from "@/components/ui/GlassBadge";

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
  lastCall: {
    summary: string;
    severity_score: number;
    ended_at: string;
  } | null;
}

function severityColor(score: number): "red" | "amber" | "emerald" {
  if (score >= 7) return "red";
  if (score >= 4) return "amber";

  return "emerald";
}

export default function DashboardPage() {
  const params = useParams();
  const token = params.token as string;
  const locale = params.locale as string;
  const t = useTranslations("dashboard");
  const [data, setData] = useState<DashboardData | null>(null);
  const autoVerified = useRef(false);

  const escalations = useRealtimeAlerts(
    data?.patient?.id ?? "",
    data?.escalations ?? [],
  );

  // Auto-verify using cached PIN (set after successful login, cleared on tab close)
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
      .then((d) => {
        if (d) setData(d as DashboardData);
        else sessionStorage.removeItem(`pin_${token}`);
      })
      .catch(() => sessionStorage.removeItem(`pin_${token}`));
  }, [token, data]);

  if (!data) {
    return (
      <PinGate
        token={token}
        onVerified={(d, pin) => {
          sessionStorage.setItem(`pin_${token}`, pin);
          setData(d as DashboardData);
        }}
      />
    );
  }

  const { patient, medications, appointments, timeline, lastCall } = data;

  const savingsEvents = timeline.filter(
    (e) => e.event_type === "savings_found",
  ) as Array<
    TimelineEvent & {
      content: { drugName: string; links: { url: string; title: string }[] };
    }
  >;

  return (
    <div className="min-h-screen p-4 md:p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-xl font-semibold text-white">{t("title")}</h1>
            <p className="text-sm text-white/40">{patient.name_alias}</p>
          </div>
          {patient.severity_score >= 5 && (
            <GlassBadge color={severityColor(patient.severity_score)}>
              {t("severityLabel")} {patient.severity_score}/10
            </GlassBadge>
          )}
        </div>
        <LanguageSwitcher currentLocale={locale} />
      </div>

      {/* Alert banner */}
      <div className="mb-4">
        <AlertBanner
          escalations={escalations}
          severity={patient.severity_score}
        />
      </div>

      <div className="flex flex-col gap-6">
        <CallSummarySection lastCall={lastCall} />
        <MedicationSection
          locale={locale}
          medications={medications}
          patientId={patient.id}
        />
        {savingsEvents.map((e) => (
          <SavingsCard
            key={e.id}
            drugName={e.content.drugName}
            links={e.content.links}
          />
        ))}
        <AppointmentSection
          appointments={appointments}
          patientId={patient.id}
        />
        <MessageBox patientId={patient.id} />
        <TimelineSection
          events={timeline.filter((e) => e.event_type !== "savings_found")}
        />
      </div>
    </div>
  );
}
