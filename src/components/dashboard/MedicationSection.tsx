"use client";
import type { Medication, EntitySource } from "@/types";

import { useTranslations } from "next-intl";

import { EntityCard } from "./EntityCard";

interface MedicationSectionProps {
  medications: Medication[];
  patientId: string;
  locale?: string;
}

export function MedicationSection({
  medications,
  patientId,
  locale,
}: MedicationSectionProps) {
  const t = useTranslations("dashboard");

  if (!medications.length) return null;

  return (
    <section>
      <h2 className="mb-3 text-sm font-medium text-white/50 uppercase tracking-wider">
        {t("medications")}
      </h2>
      <div className="flex flex-col gap-2">
        {medications.map((med) => (
          <EntityCard
            key={med.id}
            confidence={1}
            entityType="drug"
            label={`${med.drug_name_normalized} · ${med.frequency}`}
            locale={locale}
            patientId={patientId}
            source={med.source as EntitySource}
            value={med.dose}
          />
        ))}
      </div>
    </section>
  );
}
