"use client";
import { useTranslations } from "next-intl";

import { GlassCard } from "@/components/ui/GlassCard";

export function SavingsCard({
  drugName,
  links,
}: {
  drugName: string;
  links: { url: string; title: string }[];
}) {
  const t = useTranslations("dashboard");

  if (!links.length) return null;

  return (
    <GlassCard className="border-purple-500/10">
      <p className="eyebrow mb-3">
        {t("savings")} — {drugName}
      </p>
      <div className="flex flex-col gap-1.5">
        {links.map((link) => (
          <a
            key={link.url}
            className="truncate text-sm font-medium text-sky-700 underline underline-offset-2 hover:text-sky-800"
            href={link.url}
            rel="noopener noreferrer"
            target="_blank"
          >
            {link.title}
          </a>
        ))}
      </div>
    </GlassCard>
  );
}
