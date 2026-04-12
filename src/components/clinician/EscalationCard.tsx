import type { Escalation } from "@/types";

import { useTranslations } from "next-intl";

import { GlassCard } from "@/components/ui/GlassCard";
import { GlassBadge } from "@/components/ui/GlassBadge";

export function EscalationCard({
  escalation,
  locale,
}: {
  escalation: Escalation;
  locale: string;
}) {
  const t = useTranslations("clinician");
  const tCommon = useTranslations("common");

  return (
    <GlassCard glow className="border-red-500/20">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <GlassBadge color="red">
              {t("severity")} {escalation.severity}
            </GlassBadge>
            <GlassBadge
              color={escalation.status === "pending" ? "amber" : "emerald"}
            >
              {tCommon(`escalationStatus.${escalation.status}`)}
            </GlassBadge>
          </div>
          <p className="text-sm text-slate-700">{escalation.context_summary}</p>
          <p className="mt-2 text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
            {t("trigger")}: {escalation.trigger_term}
          </p>
          <p className="text-xs text-slate-500">
            {new Intl.DateTimeFormat(locale, {
              dateStyle: "medium",
              timeStyle: "short",
            }).format(new Date(escalation.created_at))}
          </p>
        </div>
      </div>
    </GlassCard>
  );
}
