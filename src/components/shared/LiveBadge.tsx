"use client";

import { useTranslations } from "next-intl";

export function LiveBadge() {
  const t = useTranslations("common");

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-cyan-700">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-500" />
      {t("live")}
    </span>
  );
}
