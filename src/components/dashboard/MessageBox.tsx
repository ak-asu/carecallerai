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
      <h2 className="eyebrow mb-4">{t("messageCareTeam")}</h2>
      {status === "sent" ? (
        <p className="text-sm font-medium text-emerald-700">
          {t("messageSent")}
        </p>
      ) : (
        <>
          <textarea
            className="input-surface w-full resize-none rounded-[1.5rem] px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-200"
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
            <p className="mt-1 text-xs text-red-400">{t("messageError")}</p>
          )}
          <div className="mt-2 flex justify-end">
            <GlassButton
              className="min-w-28 justify-center"
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
