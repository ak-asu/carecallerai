"use client";

import type { AppointmentStatus, AppointmentWithDoctor } from "@/types";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { GlassCard } from "@/components/ui/GlassCard";
import { GlassBadge } from "@/components/ui/GlassBadge";
import { GlassButton } from "@/components/ui/GlassButton";
import { buildGoogleCalendarLink } from "@/lib/calendarLinks";

const statusColor = {
  scheduled: "blue",
  confirmed: "emerald",
  rescheduled: "amber",
  cancelled: "red",
} as const;

function toDatetimeLocal(iso: string): string {
  return iso.slice(0, 16);
}

function formatDatetime(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

function AppointmentCard({
  appt,
  patientId,
}: {
  appt: AppointmentWithDoctor;
  patientId: string;
}) {
  const locale = useLocale();
  const t = useTranslations("clinician");
  const tCommon = useTranslations("common");
  const [editing, setEditing] = useState(false);
  const [datetime, setDatetime] = useState(toDatetimeLocal(appt.datetime));
  const [status, setStatus] = useState<AppointmentStatus>(appt.status);
  const [reason, setReason] = useState(appt.reschedule_reason ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    const res = await fetch("/api/appointments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        appointmentId: appt.id,
        patientId,
        action: "reschedule",
        datetime: new Date(datetime).toISOString(),
        status,
        reason: reason.trim() || null,
      }),
    });

    setSaving(false);
    if (res.ok) {
      setSaved(true);
      setEditing(false);
      setTimeout(() => setSaved(false), 3000);
    }
  }

  return (
    <GlassCard>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-slate-900">
            {formatDatetime(appt.datetime, locale)}
          </p>
          {appt.doctors && (
            <p className="mt-1 text-sm text-slate-600">
              {appt.doctors.name}
              {appt.doctors.specialty ? ` · ${appt.doctors.specialty}` : ""}
            </p>
          )}
          {appt.reschedule_reason && !editing && (
            <p className="mt-1 text-xs text-amber-700">
              {appt.reschedule_reason}
            </p>
          )}
          {appt.doctors && !editing && (
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
          <div className="mt-1.5 flex items-center gap-2">
            <GlassBadge color={statusColor[appt.status]}>
              {tCommon(`appointmentStatus.${appt.status}`)}
            </GlassBadge>
            {saved && (
              <span className="text-xs text-emerald-400">{t("saved")}</span>
            )}
          </div>
        </div>
        {!editing && (
          <GlassButton variant="secondary" onClick={() => setEditing(true)}>
            {t("edit")}
          </GlassButton>
        )}
      </div>

      {editing && (
        <div className="mt-4 flex flex-col gap-3 border-t border-white/10 pt-4">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              {t("newDatetime")}
            </label>
            <input
              className="input-surface w-full rounded-[1.25rem] px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-200"
              type="datetime-local"
              value={datetime}
              onChange={(e) => setDatetime(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              {t("statusLabel")}
            </label>
            <select
              className="input-surface w-full rounded-[1.25rem] px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-200"
              value={status}
              onChange={(e) => setStatus(e.target.value as AppointmentStatus)}
            >
              <option value="scheduled">
                {tCommon("appointmentStatus.scheduled")}
              </option>
              <option value="confirmed">
                {tCommon("appointmentStatus.confirmed")}
              </option>
              <option value="rescheduled">
                {tCommon("appointmentStatus.rescheduled")}
              </option>
              <option value="cancelled">
                {tCommon("appointmentStatus.cancelled")}
              </option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              {t("reason")}
            </label>
            <textarea
              className="input-surface w-full resize-none rounded-[1.25rem] px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-200"
              placeholder={t("reasonPlaceholder")}
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <GlassButton
              disabled={saving}
              variant="secondary"
              onClick={() => setEditing(false)}
            >
              {t("cancelEdit")}
            </GlassButton>
            <GlassButton
              disabled={saving || !datetime}
              variant="success"
              onClick={handleSave}
            >
              {saving ? t("saving") : t("save")}
            </GlassButton>
          </div>
        </div>
      )}
    </GlassCard>
  );
}

export function AppointmentEditor({
  appointments,
  patientId,
}: {
  appointments: AppointmentWithDoctor[];
  patientId: string;
}) {
  const t = useTranslations("clinician");

  if (!appointments.length) return null;

  return (
    <section className="mb-6">
      <h2 className="eyebrow mb-4">{t("appointments")}</h2>
      <div className="flex flex-col gap-2">
        {appointments.map((appt) => (
          <AppointmentCard key={appt.id} appt={appt} patientId={patientId} />
        ))}
      </div>
    </section>
  );
}
