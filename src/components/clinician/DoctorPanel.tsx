import type { Doctor } from "@/types";

import { GlassCard } from "@/components/ui/GlassCard";

export function DoctorPanel({ doctors }: { doctors: Doctor[] }) {
  if (!doctors.length) return null;

  return (
    <section className="mb-6">
      <h2 className="mb-3 text-sm font-medium text-white/50 uppercase tracking-wider">
        Care Team
      </h2>
      <div className="flex flex-wrap gap-3">
        {doctors.map((doc) => (
          <GlassCard key={doc.id} className="flex-1 min-w-[180px]">
            <p className="font-medium text-white">{doc.name}</p>
            {doc.specialty && (
              <p className="text-xs text-white/50 mt-0.5">{doc.specialty}</p>
            )}
            {doc.phone && (
              <p className="text-xs text-white/40 mt-1">{doc.phone}</p>
            )}
          </GlassCard>
        ))}
      </div>
    </section>
  );
}
