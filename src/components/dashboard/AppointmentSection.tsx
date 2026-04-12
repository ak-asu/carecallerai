"use client";
import type { Appointment } from "@/types";

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

export function AppointmentSection({
  appointments: initial,
  patientId,
}: {
  appointments: Appointment[];
  patientId: string;
}) {
  const t = useTranslations("dashboard");
  const appointments = useRealtimeAppointment(patientId, initial);

  if (!appointments.length) return null;

  async function handleAction(
    id: string,
    action: "confirm" | "request_change",
  ) {
    await fetch("/api/appointments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appointmentId: id, patientId, action }),
    });
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
          <GlassCard
            key={appt.id}
            className="flex items-center justify-between gap-3"
          >
            <div>
              <p className="font-medium text-white">
                {new Date(appt.datetime).toLocaleString()}
              </p>
              {appt.reschedule_reason && (
                <p className="text-xs text-amber-300 mt-0.5">
                  {appt.reschedule_reason}
                </p>
              )}
              <div className="mt-1">
                <GlassBadge color={statusColor[appt.status]}>
                  {appt.status}
                </GlassBadge>
              </div>
            </div>
            {appt.status === "scheduled" && (
              <div className="flex gap-2 shrink-0">
                <GlassButton
                  variant="success"
                  onClick={() => handleAction(appt.id, "confirm")}
                >
                  {t("confirm")}
                </GlassButton>
                <GlassButton
                  variant="secondary"
                  onClick={() => handleAction(appt.id, "request_change")}
                >
                  {t("fix")}
                </GlassButton>
              </div>
            )}
          </GlassCard>
        ))}
      </div>
    </section>
  );
}
