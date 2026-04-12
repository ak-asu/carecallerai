"use client";

import { useLocale, useTranslations } from "next-intl";

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
  const locale = useLocale();
  const t = useTranslations("dashboard");

  if (!lastCall) return null;

  return (
    <GlassCard className="h-full">
      <p className="eyebrow mb-3">{t("lastCall")}</p>
      <p className="text-sm leading-7 text-slate-700">{lastCall.summary}</p>
      <div className="mt-2 flex items-center gap-2">
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${severityDotColor(lastCall.severity_score)}`}
        />
        <p className="text-xs text-slate-500">
          {new Intl.DateTimeFormat(locale, {
            dateStyle: "medium",
            timeStyle: "short",
          }).format(new Date(lastCall.ended_at))}
        </p>
      </div>
    </GlassCard>
  );
}
