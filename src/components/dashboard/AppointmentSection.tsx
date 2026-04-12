"use client";
import type { AppointmentWithDoctor } from "@/types";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { GlassCard } from "@/components/ui/GlassCard";
import { GlassBadge } from "@/components/ui/GlassBadge";
import { GlassButton } from "@/components/ui/GlassButton";
import { LiveBadge } from "@/components/shared/LiveBadge";
import { useRealtimeAppointment } from "@/hooks/useRealtimeAppointment";

const statusColor = {
  scheduled: "blue",
  confirmed: "emerald",
  rescheduled: "amber",
  cancelled: "red",
} as const;

function formatDatetime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function AppointmentSection({
  appointments: initial,
  patientId,
}: {
  appointments: AppointmentWithDoctor[];
  patientId: string;
}) {
  const t = useTranslations("dashboard");
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
        <h2 className="text-sm font-medium text-white/50 uppercase tracking-wider">
          {t("appointments")}
        </h2>
        <LiveBadge />
      </div>
      <div className="flex flex-col gap-2">
        {appointments.map((appt) => (
          <GlassCard key={appt.id}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-white">
                  {formatDatetime(appt.datetime)}
                </p>
                {appt.doctors && (
                  <p className="text-sm text-white/50 mt-0.5">
                    {appt.doctors.name}
                    {appt.doctors.specialty
                      ? ` · ${appt.doctors.specialty}`
                      : ""}
                  </p>
                )}
                {appt.reschedule_reason && (
                  <p className="text-xs text-amber-300 mt-0.5">
                    {appt.reschedule_reason}
                  </p>
                )}
                <div className="mt-1.5">
                  <GlassBadge color={statusColor[appt.status]}>
                    {appt.status}
                  </GlassBadge>
                </div>
              </div>
              {appt.status !== "cancelled" && (
                <div className="flex flex-col gap-1.5 shrink-0">
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
