import { useTranslations } from "next-intl";

import { GlassCard } from "@/components/ui/GlassCard";

export function CallTranscriptView({
  transcript,
  summary,
}: {
  transcript: string;
  summary: string;
}) {
  const t = useTranslations("clinician");

  return (
    <GlassCard>
      {summary && (
        <div className="mb-4 rounded-[1.5rem] border border-sky-100 bg-sky-50 p-4">
          <p className="eyebrow mb-2">{t("aiSummary")}</p>
          <p className="text-sm leading-7 text-slate-700">{summary}</p>
        </div>
      )}
      <p className="eyebrow mb-3">{t("fullTranscript")}</p>
      <p className="whitespace-pre-wrap text-sm leading-7 text-slate-600">
        {transcript}
      </p>
    </GlassCard>
  );
}
