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
      className={`rounded-[1.75rem] border p-5 ${
        isEmergency
          ? "border-red-200 bg-red-50 text-red-700"
          : isUrgent
            ? "border-red-200 bg-red-50 text-red-700"
            : "border-amber-200 bg-amber-50 text-amber-700"
      }`}
    >
      <p className="font-semibold">
        {isEmergency
          ? t("emergency")
          : isUrgent
            ? t("staffWillContact")
            : t("followUpScheduled")}
      </p>
      {isEmergency && (
        <p className="mt-1 text-sm opacity-80">{t("emergencyHotline")}</p>
      )}
    </div>
  );
}
