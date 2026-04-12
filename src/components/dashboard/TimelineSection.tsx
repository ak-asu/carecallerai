"use client";
import type { TimelineEvent } from "@/types";

import { useTranslations } from "next-intl";

import { GlassCard } from "@/components/ui/GlassCard";
import { GlassBadge } from "@/components/ui/GlassBadge";

const eventColor = {
  call: "blue",
  correction: "emerald",
  appointment: "cyan",
  symptom_report: "amber",
  escalation: "red",
  savings_found: "purple",
} as const;

export function TimelineSection({ events }: { events: TimelineEvent[] }) {
  const t = useTranslations("dashboard");

  if (!events.length) return null;

  return (
    <section>
      <h2 className="mb-3 text-sm font-medium text-white/50 uppercase tracking-wider">
        {t("timeline")}
      </h2>
      <div className="flex flex-col gap-2">
        {events.map((event) => (
          <GlassCard key={event.id} className="flex items-start gap-3">
            <GlassBadge
              color={
                eventColor[event.event_type as keyof typeof eventColor] ??
                "blue"
              }
            >
              {event.event_type.replace("_", " ")}
            </GlassBadge>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white/70 truncate">
                {typeof event.content === "object" && event.content !== null
                  ? (((event.content as Record<string, unknown>)
                      .summary as string) ??
                    JSON.stringify(event.content).slice(0, 80))
                  : String(event.content)}
              </p>
              <p className="text-xs text-white/30 mt-0.5">
                {new Date(event.created_at).toLocaleString()}
              </p>
            </div>
          </GlassCard>
        ))}
      </div>
    </section>
  );
}
