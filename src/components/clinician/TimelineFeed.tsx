import type { TimelineEvent } from "@/types";

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
      return (
        (c.reason as string) ?? (c.summary as string) ?? "Escalation triggered"
      );
    case "correction":
      return (
        (c.summary as string) ??
        (c.description as string) ??
        "Correction submitted"
      );
    case "appointment": {
      if (c.action === "confirmed") return "Appointment confirmed";
      if (c.action === "cancelled") return "Appointment cancelled";
      if (c.action === "rescheduled")
        return `Appointment rescheduled${c.reason ? `: ${c.reason as string}` : ""}`;

      return (
        (c.summary as string) ??
        (c.description as string) ??
        "Appointment updated"
      );
    }
    case "symptom_report":
      return (
        (c.summary as string) ?? (c.description as string) ?? "Symptom reported"
      );
    default:
      return (
        (c.summary as string) ??
        (c.description as string) ??
        (c.text as string) ??
        event.event_type.replace(/_/g, " ")
      );
  }
}

export function TimelineFeed({ events }: { events: TimelineEvent[] }) {
  return (
    <div className="flex flex-col gap-2">
      {events.map((event) => (
        <GlassCard
          key={event.id}
          className={event.flagged ? "border-red-500/20" : ""}
        >
          <div className="flex items-start gap-3">
            <GlassBadge color={event.flagged ? "red" : "blue"}>
              {event.event_type.replace("_", " ")}
            </GlassBadge>
            <div className="flex-1">
              <p className="text-sm text-white/70">{formatContent(event)}</p>
              <p className="text-xs text-white/30 mt-0.5">
                {new Date(event.created_at).toLocaleString()}
              </p>
            </div>
            {event.severity > 0 && (
              <span className="text-xs text-white/40">
                sev {event.severity}
              </span>
            )}
          </div>
        </GlassCard>
      ))}
    </div>
  );
}
