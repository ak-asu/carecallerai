"use client";
import { useRouter, usePathname } from "@/i18n/navigation";

export function LanguageSwitcher({ currentLocale }: { currentLocale: string }) {
  const router = useRouter();
  const pathname = usePathname();

  function switchLocale(locale: string) {
    router.replace(pathname, { locale });
  }

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
          onClick={() => switchLocale(locale)}
        >
          {locale.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
