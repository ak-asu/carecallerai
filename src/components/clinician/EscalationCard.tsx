import type { Escalation } from "@/types";

import { GlassCard } from "@/components/ui/GlassCard";
import { GlassBadge } from "@/components/ui/GlassBadge";

export function EscalationCard({ escalation }: { escalation: Escalation }) {
  return (
    <GlassCard glow className="border-red-500/20">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <GlassBadge color="red">Severity {escalation.severity}</GlassBadge>
            <GlassBadge
              color={escalation.status === "pending" ? "amber" : "emerald"}
            >
              {escalation.status}
            </GlassBadge>
          </div>
          <p className="text-sm text-white/70">{escalation.context_summary}</p>
          <p className="text-xs text-white/30 mt-1">
            Trigger: {escalation.trigger_term}
          </p>
          <p className="text-xs text-white/30">
            {new Date(escalation.created_at).toLocaleString()}
          </p>
        </div>
      </div>
    </GlassCard>
  );
}
