"use client";

import { useTranslations } from "next-intl";

export function LiveBadge() {
  const t = useTranslations("common");

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#CFE1E3] bg-[#EAF3F4] px-2.5 py-1 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[#4C7F86]">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#6E9B87]" />
      {t("live")}
    </span>
  );
}
