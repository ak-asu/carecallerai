"use client";

import type { TimelineEvent } from "@/types";

import { useLocale, useTranslations } from "next-intl";

import { GlassCard } from "@/components/ui/GlassCard";
import { GlassBadge } from "@/components/ui/GlassBadge";
import {
  getTimelineEventContent,
  getTimelineEventLabel,
} from "@/lib/timelineText";

const eventColor = {
  call: "blue",
  correction: "emerald",
  appointment: "cyan",
  symptom_report: "amber",
  escalation: "red",
  savings_found: "purple",
} as const;

export function TimelineSection({ events }: { events: TimelineEvent[] }) {
  const locale = useLocale();
  const tDashboard = useTranslations("dashboard");
  const tTimeline = useTranslations("timeline");

  if (!events.length) return null;

  return (
    <section>
      <h2 className="eyebrow mb-4">{tDashboard("timeline")}</h2>
      <div className="flex flex-col gap-2">
        {events.map((event) => (
          <GlassCard key={event.id} className="flex items-start gap-3">
            <GlassBadge
              color={
                eventColor[event.event_type as keyof typeof eventColor] ??
                "blue"
              }
            >
              {getTimelineEventLabel(event.event_type, tTimeline)}
            </GlassBadge>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-slate-700">
                {getTimelineEventContent(event, tTimeline)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {new Intl.DateTimeFormat(locale, {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(event.created_at))}
              </p>
            </div>
          </GlassCard>
        ))}
      </div>
    </section>
  );
}
