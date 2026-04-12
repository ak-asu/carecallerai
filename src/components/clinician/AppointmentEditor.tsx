"use client";
import type { AppointmentStatus, AppointmentWithDoctor } from "@/types";

import { useState } from "react";

import { GlassCard } from "@/components/ui/GlassCard";
import { GlassBadge } from "@/components/ui/GlassBadge";
import { GlassButton } from "@/components/ui/GlassButton";

const statusColor = {
  scheduled: "blue",
  confirmed: "emerald",
  rescheduled: "amber",
  cancelled: "red",
} as const;

function toDatetimeLocal(iso: string): string {
  // Convert ISO string to datetime-local input format (YYYY-MM-DDTHH:mm)
  return iso.slice(0, 16);
}

function formatDatetime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function AppointmentCard({
  appt,
  patientId,
}: {
  appt: AppointmentWithDoctor;
  patientId: string;
}) {
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
        <div className="flex-1 min-w-0">
          <p className="font-medium text-white">
            {formatDatetime(appt.datetime)}
          </p>
          {appt.doctors && (
            <p className="text-sm text-white/50 mt-0.5">
              {appt.doctors.name}
              {appt.doctors.specialty ? ` · ${appt.doctors.specialty}` : ""}
            </p>
          )}
          {appt.reschedule_reason && !editing && (
            <p className="text-xs text-amber-300 mt-0.5">
              {appt.reschedule_reason}
            </p>
          )}
          <div className="mt-1.5 flex items-center gap-2">
            <GlassBadge color={statusColor[appt.status]}>
              {appt.status}
            </GlassBadge>
            {saved && <span className="text-xs text-emerald-400">Saved</span>}
          </div>
        </div>
        {!editing && (
          <GlassButton variant="secondary" onClick={() => setEditing(true)}>
            Edit
          </GlassButton>
        )}
      </div>

      {editing && (
        <div className="mt-4 flex flex-col gap-3 border-t border-white/10 pt-4">
          <div>
            <label className="text-xs text-white/40 uppercase tracking-wider mb-1 block">
              New date &amp; time
            </label>
            <input
              className="w-full rounded-xl border border-blue-500/20 bg-blue-950/30 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/50"
              type="datetime-local"
              value={datetime}
              onChange={(e) => setDatetime(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-white/40 uppercase tracking-wider mb-1 block">
              Status
            </label>
            <select
              className="w-full rounded-xl border border-blue-500/20 bg-blue-950/30 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/50"
              value={status}
              onChange={(e) => setStatus(e.target.value as AppointmentStatus)}
            >
              <option value="scheduled">Scheduled</option>
              <option value="confirmed">Confirmed</option>
              <option value="rescheduled">Rescheduled</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-white/40 uppercase tracking-wider mb-1 block">
              Reason (optional)
            </label>
            <textarea
              className="w-full rounded-xl border border-blue-500/20 bg-blue-950/30 px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50 resize-none"
              placeholder="e.g. Doctor unavailable, patient request..."
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <GlassButton
              disabled={saving}
              variant="secondary"
              onClick={() => setEditing(false)}
            >
              Cancel
            </GlassButton>
            <GlassButton
              disabled={saving || !datetime}
              variant="success"
              onClick={handleSave}
            >
              {saving ? "Saving..." : "Save"}
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
  if (!appointments.length) return null;

  return (
    <section className="mb-6">
      <h2 className="mb-3 text-sm font-medium text-white/50 uppercase tracking-wider">
        Appointments
      </h2>
      <div className="flex flex-col gap-2">
        {appointments.map((appt) => (
          <AppointmentCard key={appt.id} appt={appt} patientId={patientId} />
        ))}
      </div>
    </section>
  );
}
