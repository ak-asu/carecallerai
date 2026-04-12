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
      <p className="text-xs text-white/40 uppercase tracking-wider mb-2">
        {t("savings")} — {drugName}
      </p>
      <div className="flex flex-col gap-1.5">
        {links.map((link) => (
          <a
            key={link.url}
            className="text-sm text-blue-400 hover:text-blue-300 underline underline-offset-2 truncate"
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
