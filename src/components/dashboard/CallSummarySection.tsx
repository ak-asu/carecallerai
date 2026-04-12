"use client";
import { useTranslations } from "next-intl";

import { GlassCard } from "@/components/ui/GlassCard";

interface CallSummarySectionProps {
  lastCall: {
    summary: string;
    severity_score: number;
    ended_at: string;
  } | null;
}

function severityDotColor(score: number): string {
  if (score >= 7) return "bg-red-400";
  if (score >= 4) return "bg-amber-400";

  return "bg-emerald-400";
}

export function CallSummarySection({ lastCall }: CallSummarySectionProps) {
  const t = useTranslations("dashboard");

  if (!lastCall) return null;

  return (
    <GlassCard>
      <p className="text-xs text-white/40 uppercase tracking-wider mb-2">
        {t("lastCall")}
      </p>
      <p className="text-white/80 text-sm leading-relaxed">
        {lastCall.summary}
      </p>
      <div className="mt-2 flex items-center gap-2">
        <span
          className={`h-2 w-2 rounded-full shrink-0 ${severityDotColor(lastCall.severity_score)}`}
        />
        <p className="text-xs text-white/30">
          {new Date(lastCall.ended_at).toLocaleString()}
        </p>
      </div>
    </GlassCard>
  );
}
