import type { Doctor } from "@/types";

import { useTranslations } from "next-intl";

import { GlassCard } from "@/components/ui/GlassCard";

export function DoctorPanel({ doctors }: { doctors: Doctor[] }) {
  const t = useTranslations("clinician");

  if (!doctors.length) return null;

  return (
    <section className="mb-6">
      <h2 className="eyebrow mb-4">{t("doctors")}</h2>
      <div className="flex flex-wrap gap-3">
        {doctors.map((doc) => (
          <GlassCard key={doc.id} className="min-w-[180px] flex-1">
            <p className="font-semibold text-slate-900">{doc.name}</p>
            {doc.specialty && (
              <p className="mt-1 text-xs text-slate-500">{doc.specialty}</p>
            )}
            {doc.phone && (
              <p className="mt-2 text-sm text-slate-600">{doc.phone}</p>
            )}
          </GlassCard>
        ))}
      </div>
    </section>
  );
}
