"use client";
import type { Escalation } from "@/types";

import { useTranslations } from "next-intl";

export function AlertBanner({
  escalations,
  severity,
}: {
  escalations: Escalation[];
  severity: number;
}) {
  const t = useTranslations("dashboard");

  if (!escalations.length && severity < 4) return null;

  const isEmergency = severity >= 9;
  const isUrgent = severity >= 7;

  return (
    <div
      className={`rounded-2xl border p-4 ${
        isEmergency
          ? "border-red-500/40 bg-red-950/40 text-red-200"
          : isUrgent
            ? "animate-pulse border-red-500/30 bg-red-950/30 text-red-300"
            : "border-amber-500/30 bg-amber-950/30 text-amber-300"
      }`}
    >
      <p className="font-medium">
        {isEmergency
          ? t("emergency")
          : isUrgent
            ? t("staffWillContact")
            : t("followUpScheduled")}
      </p>
      {isEmergency && (
        <p className="mt-1 text-sm opacity-80">Call 911 / Llame al 911</p>
      )}
    </div>
  );
}
