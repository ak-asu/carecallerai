"use client";

import { useEffect, useMemo, useState } from "react";
import Script from "next/script";
import { useTranslations } from "next-intl";

import { GlassButton } from "@/components/ui/GlassButton";
import { GlassCard } from "@/components/ui/GlassCard";

type SupportedLanguage = "en" | "es";

interface HomeVoiceAgentCardProps {
  locale: string;
}

interface SignedUrlResponse {
  signedUrl?: string;
}

export function HomeVoiceAgentCard({
  locale,
}: HomeVoiceAgentCardProps) {
  const t = useTranslations("landing.voiceAgent");
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage>(
    locale.startsWith("es") ? "es" : "en",
  );

  async function loadSignedUrl() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/elevenlabs/signed-url", {
        cache: "no-store",
      });
      const payload = (await response.json()) as SignedUrlResponse & {
        error?: string;
      };

      if (!response.ok || !payload.signedUrl) {
        throw new Error(payload.error ?? "signed_url_failed");
      }

      setSignedUrl(payload.signedUrl);
    } catch {
      setSignedUrl(null);
      setError(t("error"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSignedUrl();
  }, []);

  const widgetKey = useMemo(
    () => `${selectedLanguage}:${signedUrl ?? "pending"}`,
    [selectedLanguage, signedUrl],
  );

  return (
    <>
      <Script
        src="https://unpkg.com/@elevenlabs/convai-widget-embed"
        strategy="afterInteractive"
      />
      <GlassCard className="rounded-[2rem]">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(22rem,1.05fr)] lg:items-start">
          <div className="max-w-2xl">
            <p className="eyebrow mb-3">{t("eyebrow")}</p>
            <h2 className="text-3xl font-semibold text-slate-900">
              {t("title")}
            </h2>
            <p className="mt-4 text-sm leading-7 text-slate-600 md:text-base">
              {t("description")}
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                  selectedLanguage === "en"
                    ? "border-sky-200 bg-sky-50 text-sky-700"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                }`}
                onClick={() => setSelectedLanguage("en")}
                type="button"
              >
                {t("english")}
              </button>
              <button
                className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                  selectedLanguage === "es"
                    ? "border-sky-200 bg-sky-50 text-sky-700"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                }`}
                onClick={() => setSelectedLanguage("es")}
                type="button"
              >
                {t("spanish")}
              </button>
            </div>

            <p className="mt-4 text-sm leading-7 text-slate-600">
              {t("hint")}
            </p>
          </div>

          <div className="rounded-[1.75rem] border border-slate-200/80 bg-white/72 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              {t("widgetLabel")}
            </p>

            {loading ? (
              <div className="mt-4 rounded-[1.5rem] border border-slate-200/70 bg-white/80 px-5 py-8 text-sm leading-7 text-slate-600">
                {t("loading")}
              </div>
            ) : error ? (
              <div className="mt-4 rounded-[1.5rem] border border-[#E9BDC3] bg-[#FBEAEC] p-5">
                <p className="text-sm leading-7 text-[#B04858]">{error}</p>
                <GlassButton
                  className="mt-4 justify-center"
                  onClick={() => {
                    void loadSignedUrl();
                  }}
                  variant="secondary"
                >
                  {t("retry")}
                </GlassButton>
              </div>
            ) : (
              <div className="mt-4 min-h-[20rem] rounded-[1.5rem] border border-slate-200/70 bg-[radial-gradient(circle_at_top,rgba(237,244,255,0.82),rgba(255,255,255,0.92)_55%)] p-3">
                <elevenlabs-convai
                  key={widgetKey}
                  action-text={t("actionText")}
                  dismissible="false"
                  end-call-text={t("endCallText")}
                  expand-text={t("expandText")}
                  listening-text={t("listeningText")}
                  override-language={selectedLanguage}
                  signed-url={signedUrl ?? undefined}
                  speaking-text={t("speakingText")}
                  start-call-text={t("startCallText")}
                  variant="expanded"
                />
              </div>
            )}
          </div>
        </div>
      </GlassCard>
    </>
  );
}
