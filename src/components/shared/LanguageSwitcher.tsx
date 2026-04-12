"use client";
import { useEffect, useState } from "react";

import { usePathname } from "@/i18n/navigation";

export function LanguageSwitcher({ currentLocale }: { currentLocale: string }) {
  const pathname = usePathname();
  const [pendingLocale, setPendingLocale] = useState<string | null>(null);

  useEffect(() => {
    if (pendingLocale !== null) {
      window.location.href = `/${pendingLocale}${pathname}`;
    }
  }, [pendingLocale, pathname]);

  return (
    <div className="flex gap-2">
      {["en", "es"].map((locale) => (
        <button
          key={locale}
          className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
            locale === currentLocale
              ? "bg-blue-500/30 text-blue-300 border border-blue-500/40"
              : "text-white/40 hover:text-white/70"
          }`}
          onClick={() => setPendingLocale(locale)}
        >
          {locale.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
