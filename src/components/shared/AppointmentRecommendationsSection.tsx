"use client";

import type {
  AppointmentWithDoctor,
  DoctorRecommendation,
  RecommendedAppointmentSlot,
} from "@/types";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { GlassBadge } from "@/components/ui/GlassBadge";
import { GlassButton } from "@/components/ui/GlassButton";
import { GlassCard } from "@/components/ui/GlassCard";

function formatSlotLabel(slot: RecommendedAppointmentSlot, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(slot.starts_at));
}

function formatNextAvailable(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function AppointmentRecommendationsSection({
  patientId,
  recommendations: initialRecommendations,
  mode,
  onAppointmentBooked,
}: {
  patientId: string;
  recommendations: DoctorRecommendation[];
  mode: "patient" | "clinician";
  onAppointmentBooked?: (appointment: AppointmentWithDoctor) => void;
}) {
  const locale = useLocale();
  const t = useTranslations("scheduling");
  const [recommendations, setRecommendations] = useState(
    initialRecommendations,
  );
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);

  async function handleBook(
    recommendation: DoctorRecommendation,
    slot: RecommendedAppointmentSlot,
  ) {
    setBookingId(slot.id);
    setFeedback(null);

    const res = await fetch("/api/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patientId,
        doctorId: recommendation.doctor_id,
        doctorName: recommendation.doctor_name,
        specialty: recommendation.specialty,
        googleCalendarId: recommendation.google_calendar_id,
        scheduleId: recommendation.schedule_id,
        datetime: slot.starts_at,
        scheduledBy: mode,
        reason:
          recommendation.matched_symptoms.length > 0
            ? recommendation.matched_symptoms.join(", ")
            : null,
      }),
    });

    setBookingId(null);

    if (!res.ok) {
      setFeedback({ tone: "error", message: t("bookingFailed") });

      return;
    }

    const payload = (await res.json()) as {
      appointment: AppointmentWithDoctor;
    };

    setFeedback({ tone: "success", message: t("booked") });
    setRecommendations((prev) =>
      prev
        .map((item) =>
          item.schedule_id === recommendation.schedule_id
            ? {
                ...item,
                doctor_id: payload.appointment.doctor_id,
                slots: item.slots.filter(
                  (candidate) => candidate.id !== slot.id,
                ),
                next_available_at:
                  item.slots.find((candidate) => candidate.id !== slot.id)
                    ?.starts_at ?? null,
              }
            : item,
        )
        .filter((item) => item.slots.length > 0),
    );

    onAppointmentBooked?.(payload.appointment);

    if (!onAppointmentBooked) {
      window.location.reload();
    }
  }

  return (
    <GlassCard className="rounded-[2rem]">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="eyebrow mb-3">
            {mode === "patient" ? t("patientTitle") : t("clinicianTitle")}
          </p>
          <h2 className="text-3xl font-semibold text-slate-900">
            {mode === "patient" ? t("patientHeadline") : t("clinicianHeadline")}
          </h2>
        </div>
        <GlassBadge color="cyan">{t("calendarBadge")}</GlassBadge>
      </div>

      <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600 md:text-base">
        {mode === "patient" ? t("patientSubtitle") : t("clinicianSubtitle")}
      </p>

      {feedback && (
        <p
          className={`mt-4 text-sm font-medium ${
            feedback.tone === "success" ? "text-emerald-700" : "text-red-600"
          }`}
        >
          {feedback.message}
        </p>
      )}

      {!recommendations.length ? (
        <p className="mt-6 text-sm leading-7 text-slate-600">
          {t("noRecommendations")}
        </p>
      ) : (
        <div
          className={`mt-6 grid gap-4 ${
            mode === "clinician" ? "2xl:grid-cols-2" : "xl:grid-cols-2"
          }`}
        >
          {recommendations.map((recommendation) => (
            <div
              key={recommendation.schedule_id}
              className="rounded-[1.6rem] border border-slate-200/80 bg-white/78 p-5"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="eyebrow mb-2">{recommendation.specialty}</p>
                  <h3 className="text-2xl font-semibold text-slate-900">
                    {recommendation.doctor_name}
                  </h3>
                  <p className="mt-2 text-sm text-slate-600">
                    {t("distanceAway", {
                      distance: recommendation.distance_miles.toFixed(1),
                    })}
                  </p>
                </div>
                <div className="flex flex-wrap items-start gap-2 lg:max-w-[16rem] lg:justify-end">
                  <GlassBadge className="whitespace-nowrap" color="blue">
                    {t("sortedByDistance")}
                  </GlassBadge>
                  {recommendation.next_available_at && (
                    <GlassBadge className="leading-6" color="emerald">
                      {t("nextAvailable")}:{" "}
                      {formatNextAvailable(
                        recommendation.next_available_at,
                        locale,
                      )}
                    </GlassBadge>
                  )}
                </div>
              </div>

              {recommendation.matched_symptoms.length > 0 && (
                <div className="mt-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {t("recommendedFor")}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {recommendation.matched_symptoms.map((symptom) => (
                      <GlassBadge
                        key={`${recommendation.schedule_id}-${symptom}`}
                        color="amber"
                      >
                        {symptom}
                      </GlassBadge>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-5">
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {t("availableSlots")}
                </p>
                <div className="grid gap-3 sm:grid-cols-2 md:max-h-[7rem] md:overflow-y-auto md:pr-2">
                  {recommendation.slots.map((slot) => (
                    <GlassButton
                      key={slot.id}
                      className="flex min-h-24 w-full flex-col items-start rounded-[1.2rem] px-4 py-3 text-left"
                      disabled={bookingId === slot.id}
                      variant="secondary"
                      onClick={() => handleBook(recommendation, slot)}
                    >
                      <span className="text-base font-semibold leading-7 text-slate-800">
                        {formatSlotLabel(slot, locale)}
                      </span>
                      <span className="mt-3 text-xs uppercase tracking-[0.16em] text-sky-700">
                        {bookingId === slot.id ? t("booking") : t("bookSlot")}
                      </span>
                    </GlassButton>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </GlassCard>
  );
}
