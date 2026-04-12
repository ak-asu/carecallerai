import { GlassBadge } from './GlassBadge'
import type { EntitySource } from '@/types'

const config: Record<EntitySource, { label: string; labelEs: string; color: 'blue' | 'emerald' | 'purple' | 'cyan' }> = {
  stt_inferred: { label: 'system inferred', labelEs: 'inferido', color: 'blue' },
  context_enriched: { label: 'context matched', labelEs: 'coincidencia', color: 'cyan' },
  patient_verified: { label: 'you confirmed', labelEs: 'confirmado', color: 'emerald' },
  clinician_verified: { label: 'doctor verified', labelEs: 'médico verificó', color: 'purple' },
}

export function SourceTag({ source, locale = 'en' }: { source: EntitySource; locale?: string }) {
  const { label, labelEs, color } = config[source]
  return <GlassBadge color={color}>{locale === 'es' ? labelEs : label}</GlassBadge>
}
