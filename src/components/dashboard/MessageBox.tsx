"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";

import { GlassCard } from "@/components/ui/GlassCard";
import { GlassButton } from "@/components/ui/GlassButton";

export function MessageBox({ patientId }: { patientId: string }) {
  const t = useTranslations("dashboard");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );

  async function handleSend() {
    if (!message.trim()) return;
    setStatus("sending");

    const res = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patientId, message }),
    });

    if (res.ok) {
      setStatus("sent");
      setMessage("");
    } else {
      setStatus("error");
    }
  }

  return (
    <GlassCard>
      <h2 className="mb-3 text-sm font-medium text-white/50 uppercase tracking-wider">
        {t("messageCareTeam")}
      </h2>
      {status === "sent" ? (
        <p className="text-sm text-emerald-400">{t("messageSent")}</p>
      ) : (
        <>
          <textarea
            className="w-full rounded-xl border border-blue-500/20 bg-blue-950/30 px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50 resize-none"
            disabled={status === "sending"}
            placeholder={t("messagePlaceholder")}
            rows={3}
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              if (status === "error") setStatus("idle");
            }}
          />
          {status === "error" && (
            <p className="mt-1 text-xs text-red-400">
              Failed to send. Please try again.
            </p>
          )}
          <div className="mt-2 flex justify-end">
            <GlassButton
              disabled={!message.trim() || status === "sending"}
              onClick={handleSend}
            >
              {status === "sending" ? "..." : t("messageSend")}
            </GlassButton>
          </div>
        </>
      )}
    </GlassCard>
  );
}
