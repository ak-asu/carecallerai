import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { LanguageSwitcher } from "@/components/shared/LanguageSwitcher";
import { HomeVoiceAgentCard } from "@/components/landing/HomeVoiceAgentCard";
import { GlassBadge } from "@/components/ui/GlassBadge";
import { GlassButton } from "@/components/ui/GlassButton";
import { GlassCard } from "@/components/ui/GlassCard";

const featureKeys = ["monitoring", "corrections", "clinician"] as const;
const workflowKeys = [
  "vapi",
  "assembly",
  "rules",
  "context",
  "groq",
  "dashboards",
] as const;
const changeKeys = ["patient", "clinician", "ui"] as const;

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "landing" });

  return (
    <div className="page-shell">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-10 px-4 py-8 md:px-6 lg:px-8 lg:py-10">
        <header className="flex flex-col gap-6 rounded-[2rem] border border-white/50 bg-white/55 px-6 py-6 shadow-soft backdrop-blur-xl md:px-8 md:py-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <GlassBadge className="mb-4" color="cyan">
                {t("badge")}
              </GlassBadge>
              <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-slate-900 md:text-6xl">
                {t("title")}
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
                {t("description")}
              </p>
            </div>
            <div className="grid gap-3 lg:min-w-[17rem]">
              <LanguageSwitcher currentLocale={locale} />
              <Link
                className="inline-flex"
                href={`/${locale}/dashboard/demo-patient-token-abc123`}
              >
                <GlassButton className="w-full justify-center py-3">
                  {t("openPatientDashboard")}
                </GlassButton>
              </Link>
              <Link
                className="inline-flex"
                href={`/${locale}/clinician/00000000-0000-0000-0000-000000000002`}
              >
                <GlassButton
                  className="w-full justify-center py-3"
                  variant="secondary"
                >
                  {t("openClinicianWorkspace")}
                </GlassButton>
              </Link>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {featureKeys.map((key) => (
              <GlassCard key={key} className="rounded-[1.75rem]">
                <p className="eyebrow mb-3">{t("featureEyebrow")}</p>
                <h2 className="text-2xl font-semibold text-slate-900">
                  {t(`featureCards.${key}.title`)}
                </h2>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  {t(`featureCards.${key}.description`)}
                </p>
              </GlassCard>
            ))}
          </div>
        </header>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.9fr)]">
          <GlassCard className="rounded-[2rem]">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="eyebrow mb-3">{t("workflowEyebrow")}</p>
                <h2 className="text-3xl font-semibold text-slate-900">
                  {t("workflowTitle")}
                </h2>
              </div>
              <p className="max-w-xl text-sm leading-7 text-slate-600">
                {t("workflowDescription")}
              </p>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              {workflowKeys.map((key, index) => (
                <span
                  key={key}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold ${
                    index === workflowKeys.length - 1
                      ? "border-sky-200 bg-sky-50 text-sky-700"
                      : "border-slate-200 bg-white text-slate-700"
                  }`}
                >
                  {t(`workflowSteps.${key}`)}
                </span>
              ))}
            </div>
          </GlassCard>

          <GlassCard className="surface-card-dark rounded-[2rem]">
            <p className="eyebrow mb-3 text-cyan-300">{t("changesEyebrow")}</p>
            <h2 className="text-3xl font-semibold text-white">
              {t("changesTitle")}
            </h2>
            <ul className="mt-5 space-y-4 text-sm leading-7 text-slate-200/88">
              {changeKeys.map((key) => (
                <li key={key}>{t(`changes.${key}`)}</li>
              ))}
            </ul>
          </GlassCard>
        </section>

        <HomeVoiceAgentCard locale={locale} />
      </div>
    </div>
  );
}
