"use client";

import { useLocale, useTranslations } from "next-intl";

import { GlassCard } from "@/components/ui/GlassCard";

interface PatientMessage {
  id: string;
  message: string;
  status: string;
  created_at: string;
}

export function PatientMessages({ messages }: { messages: PatientMessage[] }) {
  const locale = useLocale();
  const t = useTranslations("clinician");

  return (
    <section className="mb-6">
      <h2 className="eyebrow mb-4">{t("messages")}</h2>
      {!messages.length ? (
        <p className="text-sm text-slate-500">{t("noMessages")}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {messages.map((msg) => (
            <GlassCard key={msg.id} className="flex items-start gap-3">
              {msg.status === "pending" && (
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-sky-500" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm text-slate-700">{msg.message}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {new Intl.DateTimeFormat(locale, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(msg.created_at))}
                </p>
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </section>
  );
}
