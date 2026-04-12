"use client";
import type { MedicationSavings } from "@/types";

import { useLocale, useTranslations } from "next-intl";

import { GlassCard } from "@/components/ui/GlassCard";
import { GlassBadge } from "@/components/ui/GlassBadge";

export function SavingsCard({ savings }: { savings: MedicationSavings[] }) {
  const locale = useLocale();
  const t = useTranslations("dashboard");
  const tCommon = useTranslations("common");

  const sections = savings.filter((entry) => entry.links.length > 0);

  if (!sections.length) return null;

  return (
    <GlassCard className="rounded-[2rem] border-purple-500/10 xl:flex xl:max-h-[72vh] xl:flex-col">
      <div className="flex items-start justify-between gap-3">
        <p className="eyebrow">{t("savings")}</p>
        {sections.some((entry) => entry.source === "tavily") && (
          <GlassBadge color="cyan">{tCommon("live")}</GlassBadge>
        )}
      </div>
      <div className="mt-4 space-y-5 xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:pr-2">
        {sections.map((entry) => (
          <section
            key={`${entry.medicationId ?? entry.drugName}-${entry.source}`}
            className="rounded-[1.45rem] border border-slate-200/70 bg-white/56 p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-sky-800">
                  {entry.drugName}
                </h3>
                {entry.contextSummary && (
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {entry.contextSummary}
                  </p>
                )}
              </div>
              {entry.fetchedAt && (
                <p className="text-xs text-slate-500">
                  {t("savingsUpdated", {
                    date: new Intl.DateTimeFormat(locale, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(entry.fetchedAt)),
                  })}
                </p>
              )}
            </div>
            <div className="mt-4 flex flex-col gap-3">
              {entry.links.map((link) => (
                <a
                  key={`${entry.drugName}-${link.url}`}
                  className="rounded-[1.35rem] border border-slate-200/70 bg-white/70 p-4 transition-colors hover:border-sky-200 hover:bg-sky-50/60"
                  href={link.url}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold text-sky-800">
                      {link.title}
                    </p>
                    {link.source && (
                      <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                        {link.source}
                      </span>
                    )}
                  </div>
                  {link.summary && (
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {link.summary}
                    </p>
                  )}
                </a>
              ))}
            </div>
          </section>
        ))}
      </div>
    </GlassCard>
  );
}
