"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { GlassCard } from "@/components/ui/GlassCard";
import { GlassButton } from "@/components/ui/GlassButton";

interface PinGateProps {
  token: string;
  onVerified: (data: unknown, pin: string) => void;
}

export function PinGate({ token, onVerified }: PinGateProps) {
  const t = useTranslations("pin");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch(`/api/dashboard/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });

    if (res.ok) {
      const data = await res.json();

      onVerified(data, pin);
    } else {
      setError(t("error"));
    }
    setLoading(false);
  }

  return (
    <div className="page-shell flex min-h-screen items-center justify-center p-4">
      <GlassCard className="w-full max-w-sm">
        <p className="eyebrow mb-3 text-center">{t("eyebrow")}</p>
        <h1 className="mb-6 text-center text-2xl font-semibold text-slate-900">
          {t("title")}
        </h1>
        <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
          <input
            className="input-surface rounded-[1.5rem] px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-sky-200"
            placeholder={t("placeholder")}
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <GlassButton
            className="justify-center py-3"
            disabled={loading || !pin}
            type="submit"
          >
            {loading ? "..." : t("submit")}
          </GlassButton>
        </form>
      </GlassCard>
    </div>
  );
}
