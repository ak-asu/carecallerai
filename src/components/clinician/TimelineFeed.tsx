import type { TimelineEvent } from "@/types";

import { useTranslations } from "next-intl";

import { GlassCard } from "@/components/ui/GlassCard";
import { GlassBadge } from "@/components/ui/GlassBadge";
import {
  getTimelineEventContent,
  getTimelineEventLabel,
} from "@/lib/timelineText";

export function TimelineFeed({
  events,
  locale,
}: {
  events: TimelineEvent[];
  locale: string;
}) {
  const tCommon = useTranslations("common");
  const tTimeline = useTranslations("timeline");

  return (
    <div className="flex flex-col gap-2">
      {events.map((event) => (
        <GlassCard
          key={event.id}
          className={event.flagged ? "border-red-500/20" : ""}
        >
          <div className="flex items-start gap-3">
            <GlassBadge color={event.flagged ? "red" : "blue"}>
              {getTimelineEventLabel(event.event_type, tTimeline)}
            </GlassBadge>
            <div className="flex-1">
              <p className="text-sm text-slate-700">
                {getTimelineEventContent(event, tTimeline)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {new Intl.DateTimeFormat(locale, {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(event.created_at))}
              </p>
            </div>
            {event.severity > 0 && (
              <span className="text-xs text-slate-500">
                {tCommon("severityShort", { severity: event.severity })}
              </span>
            )}
          </div>
        </GlassCard>
      ))}
    </div>
  );
}
