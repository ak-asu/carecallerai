"use client";

import type { AppointmentWithDoctor } from "@/types";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { GlassCard } from "@/components/ui/GlassCard";
import { GlassBadge } from "@/components/ui/GlassBadge";
import { GlassButton } from "@/components/ui/GlassButton";
import { LiveBadge } from "@/components/shared/LiveBadge";
import { buildGoogleCalendarLink } from "@/lib/calendarLinks";
import { useRealtimeAppointment } from "@/hooks/useRealtimeAppointment";

const statusColor = {
  scheduled: "blue",
  confirmed: "emerald",
  rescheduled: "amber",
  cancelled: "red",
} as const;

function formatDatetime(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function AppointmentSection({
  appointments: initial,
  patientId,
}: {
  appointments: AppointmentWithDoctor[];
  patientId: string;
}) {
  const locale = useLocale();
  const t = useTranslations("dashboard");
  const tCommon = useTranslations("common");
  const appointments = useRealtimeAppointment(
    patientId,
    initial,
  ) as AppointmentWithDoctor[];
  const [loading, setLoading] = useState<string | null>(null);

  if (!appointments.length) return null;

  async function handleAction(
    id: string,
    action: "confirm" | "request_change" | "cancel",
  ) {
    setLoading(id + action);
    await fetch("/api/appointments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appointmentId: id, patientId, action }),
    });
    setLoading(null);
  }

  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <h2 className="eyebrow">{t("appointments")}</h2>
        <LiveBadge />
      </div>
      <div className="flex flex-col gap-2">
        {appointments.map((appt) => (
          <GlassCard key={appt.id}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900">
                  {formatDatetime(appt.datetime, locale)}
                </p>
                {appt.doctors && (
                  <p className="mt-1 text-sm text-slate-600">
                    {appt.doctors.name}
                    {appt.doctors.specialty
                      ? ` · ${appt.doctors.specialty}`
                      : ""}
                  </p>
                )}
                {appt.reschedule_reason && (
                  <p className="mt-1 text-xs text-amber-700">
                    {appt.reschedule_reason}
                  </p>
                )}
                {appt.doctors && (
                  <a
                    className="mt-2 inline-flex text-xs font-semibold uppercase tracking-[0.16em] text-sky-700 underline underline-offset-2"
                    href={buildGoogleCalendarLink({
                      title: `CareCaller visit with ${appt.doctors.name}`,
                      details: `${appt.doctors.specialty ?? ""}`.trim(),
                      startAt: appt.datetime,
                    })}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {t("googleCalendarLink")}
                  </a>
                )}
                <div className="mt-1.5">
                  <GlassBadge color={statusColor[appt.status]}>
                    {tCommon(`appointmentStatus.${appt.status}`)}
                  </GlassBadge>
                </div>
              </div>
              {appt.status !== "cancelled" && (
                <div className="shrink-0 flex flex-col gap-1.5">
                  {appt.status === "scheduled" && (
                    <GlassButton
                      disabled={loading === appt.id + "confirm"}
                      variant="success"
                      onClick={() => handleAction(appt.id, "confirm")}
                    >
                      {t("confirm")}
                    </GlassButton>
                  )}
                  {appt.status === "scheduled" && (
                    <GlassButton
                      disabled={loading === appt.id + "request_change"}
                      variant="secondary"
                      onClick={() => handleAction(appt.id, "request_change")}
                    >
                      {t("requestChange")}
                    </GlassButton>
                  )}
                  <GlassButton
                    disabled={loading === appt.id + "cancel"}
                    variant="danger"
                    onClick={() => handleAction(appt.id, "cancel")}
                  >
                    {t("cancelAppt")}
                  </GlassButton>
                </div>
              )}
            </div>
          </GlassCard>
        ))}
      </div>
    </section>
  );
}
