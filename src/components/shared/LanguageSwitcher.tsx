"use client";

import { startTransition } from "react";
import { useTranslations } from "next-intl";

export function LanguageSwitcher({ currentLocale }: { currentLocale: string }) {
  const t = useTranslations("languageSwitcher");

  function switchLocale(nextLocale: string) {
    if (nextLocale === currentLocale) return;

    const url = new URL(window.location.href);
    const segments = url.pathname.split("/").filter(Boolean);

    if (segments[0] === "en" || segments[0] === "es") {
      segments[0] = nextLocale;
    } else {
      segments.unshift(nextLocale);
    }

    url.pathname = `/${segments.join("/")}`;

    startTransition(() => {
      window.location.assign(`${url.pathname}${url.search}${url.hash}`);
    });
  }

  return (
    <div className="inline-flex items-center gap-3 rounded-full border border-white/60 bg-white/78 px-3 py-2 shadow-sm backdrop-blur-xl">
      <span className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-slate-500">
        {t("label")}
      </span>
      <div className="flex gap-1 rounded-full bg-slate-100/80 p-1">
        {["en", "es"].map((locale) => {
          const active = locale === currentLocale;

          return (
            <button
              key={locale}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] transition-colors ${
                active
                  ? "bg-white text-sky-700 shadow-sm"
                  : "text-slate-500 hover:bg-white/80 hover:text-slate-700"
              }`}
              type="button"
              onClick={() => switchLocale(locale)}
            >
              {locale.toUpperCase()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
