"use client";
import type { EntitySource } from "@/types";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { CorrectionModal } from "./CorrectionModal";

import { GlassCard } from "@/components/ui/GlassCard";
import { GlassButton } from "@/components/ui/GlassButton";
import { SourceTag } from "@/components/ui/SourceTag";

interface EntityCardProps {
  label: string;
  value: string;
  confidence: number;
  source: EntitySource;
  entityType: string;
  patientId: string;
  callId?: string;
  locale?: string;
}

const borderByConfidence = (c: number, contradiction: boolean) =>
  contradiction
    ? "border-l-4 border-l-red-500"
    : c >= 0.85
      ? "border-l-4 border-l-emerald-500"
      : "border-l-4 border-l-amber-500";

export function EntityCard({
  label,
  value,
  confidence,
  source,
  entityType,
  patientId,
  callId,
  locale = "en",
}: EntityCardProps) {
  const t = useTranslations("dashboard");
  const [showModal, setShowModal] = useState(false);
  const [confirmed, setConfirmed] = useState(
    source === "patient_verified" || source === "clinician_verified",
  );
  const contradiction = confidence < 0.4;

  async function handleConfirm() {
    await fetch("/api/dashboard/correction", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patientId,
        entityType,
        oldValue: value,
        newValue: value,
        sourceCallId: callId,
      }),
    });
    setConfirmed(true);
  }

  return (
    <>
      <GlassCard
        className={`flex items-center justify-between gap-3 ${borderByConfidence(confidence, contradiction)}`}
      >
        <div className="flex-1 min-w-0">
          <p className="text-xs text-white/40 uppercase tracking-wider">
            {label}
          </p>
          <p className="mt-0.5 font-medium text-white truncate">{value}</p>
          <div className="mt-1.5">
            <SourceTag
              locale={locale}
              source={confirmed ? "patient_verified" : source}
            />
          </div>
        </div>
        {!confirmed && (
          <div className="flex gap-2 shrink-0">
            <GlassButton variant="success" onClick={handleConfirm}>
              {t("confirm")}
            </GlassButton>
            <GlassButton variant="secondary" onClick={() => setShowModal(true)}>
              {t("fix")}
            </GlassButton>
          </div>
        )}
        {confirmed && <span className="text-emerald-400 text-lg">✓</span>}
      </GlassCard>
      {showModal && (
        <CorrectionModal
          callId={callId}
          currentValue={value}
          entityType={entityType}
          label={label}
          patientId={patientId}
          onClose={() => setShowModal(false)}
          onSaved={() => {
            setShowModal(false);
            setConfirmed(true);
          }}
        />
      )}
    </>
  );
}
