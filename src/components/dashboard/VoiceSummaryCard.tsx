"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { GlassButton } from "@/components/ui/GlassButton";
import { GlassCard } from "@/components/ui/GlassCard";

interface VoiceSummaryCardProps {
  token: string;
  locale: string;
}

interface VoiceSummaryResponse {
  summary: string;
  audioBase64: string | null;
  mimeType: string | null;
  audioUnavailable?: boolean;
}

function base64ToBlob(base64: string, mimeType: string) {
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (character) =>
    character.charCodeAt(0),
  );

  return new Blob([bytes], { type: mimeType });
}

export function VoiceSummaryCard({
  token,
  locale,
}: VoiceSummaryCardProps) {
  const t = useTranslations("dashboard");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioUnavailable, setAudioUnavailable] = useState(false);

  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  useEffect(() => {
    if (!audioUrl || !audioRef.current) return;

    audioRef.current.load();
    void audioRef.current.play().catch(() => {});
  }, [audioUrl]);

  async function handleGenerateSummary() {
    const pin = sessionStorage.getItem(`pin_${token}`);

    if (!pin) {
      setError(t("voiceSummary.pinMissing"));

      return;
    }

    setLoading(true);
    setError(null);
    setAudioUnavailable(false);

    try {
      const response = await fetch(`/api/dashboard/${token}/summary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin, locale }),
      });
      const payload = (await response.json()) as
        | VoiceSummaryResponse
        | { error?: string };

      if (!response.ok || !("summary" in payload)) {
        throw new Error("summary_request_failed");
      }

      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }

      setSummary(payload.summary);
      setAudioUnavailable(Boolean(payload.audioUnavailable));

      if (payload.audioBase64 && payload.mimeType) {
        const blob = base64ToBlob(payload.audioBase64, payload.mimeType);

        setAudioUrl(URL.createObjectURL(blob));
      } else {
        setAudioUrl(null);
      }
    } catch {
      setError(t("voiceSummary.error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <GlassCard className="rounded-[2rem]">
      <div className="flex flex-col gap-5">
        <div className="rounded-[1.6rem] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.86),rgba(245,249,255,0.76))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
          <div className="flex flex-col gap-4">
            <div className="min-w-0">
              <p className="eyebrow mb-3">{t("voiceSummary.eyebrow")}</p>
              <h3 className="max-w-[12ch] text-[1.7rem] font-semibold leading-tight text-slate-900">
                {t("voiceSummary.title")}
              </h3>
              <p className="mt-3 max-w-[30ch] text-sm leading-6 text-slate-600">
                {t("voiceSummary.description")}
              </p>
            </div>
            <GlassButton
              className="w-full justify-center px-5 py-3"
              disabled={loading}
              onClick={handleGenerateSummary}
            >
              {loading
                ? t("voiceSummary.loading")
                : summary
                  ? t("voiceSummary.refresh")
                  : t("voiceSummary.generate")}
            </GlassButton>
          </div>
        </div>

        {error && (
          <p className="rounded-[1.25rem] border border-[#E9BDC3] bg-[#FBEAEC] px-4 py-3 text-sm leading-6 text-[#B04858]">
            {error}
          </p>
        )}

        {summary && (
          <div className="rounded-[1.5rem] border border-slate-200/70 bg-white/78 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              {t("voiceSummary.textLabel")}
            </p>
            <p className="mt-3 text-sm leading-7 text-slate-700">{summary}</p>
          </div>
        )}

        {audioUrl && (
          <div className="rounded-[1.5rem] border border-slate-200/70 bg-white/78 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              {t("voiceSummary.audioLabel")}
            </p>
            <audio ref={audioRef} className="mt-3 w-full" controls preload="auto">
              <source src={audioUrl} type="audio/mpeg" />
            </audio>
          </div>
        )}

        {summary && audioUnavailable && (
          <p className="rounded-[1.25rem] border border-slate-200/70 bg-white/70 px-4 py-3 text-sm leading-6 text-slate-600">
            {t("voiceSummary.audioUnavailable")}
          </p>
        )}
      </div>
    </GlassCard>
  );
}
