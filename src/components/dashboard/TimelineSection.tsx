"use client";
import type { TimelineEvent } from "@/types";

import { useTranslations } from "next-intl";

import { GlassCard } from "@/components/ui/GlassCard";
import { GlassBadge } from "@/components/ui/GlassBadge";

function formatContent(event: TimelineEvent): string {
  const c = event.content as Record<string, unknown>;

  switch (event.event_type) {
    case "savings_found": {
      const drug = (c.drugName as string) ?? "medication";
      const count = (c.links as unknown[])?.length ?? 0;
      return `Savings found for ${drug}: ${count} option${count !== 1 ? "s" : ""}`;
    }
    case "call":
      return (c.summary as string) ?? "Call completed";
    case "escalation":
      return (c.reason as string) ?? (c.summary as string) ?? "Escalation triggered";
    case "correction":
      return (c.summary as string) ?? (c.description as string) ?? "Correction submitted";
    case "appointment":
      return (c.summary as string) ?? (c.description as string) ?? "Appointment updated";
    case "symptom_report":
      return (c.summary as string) ?? (c.description as string) ?? "Symptom reported";
    default:
      return (
        (c.summary as string) ??
        (c.description as string) ??
        (c.text as string) ??
        event.event_type.replace(/_/g, " ")
      );
  }
}

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
                {formatContent(event)}
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
