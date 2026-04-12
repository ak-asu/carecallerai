'use client'
import { useTranslations } from 'next-intl'
import { GlassCard } from '@/components/ui/GlassCard'

interface CallSummarySectionProps {
  lastCall: { summary: string; severity_score: number; ended_at: string } | null
}

export function CallSummarySection({ lastCall }: CallSummarySectionProps) {
  const t = useTranslations('dashboard')
  if (!lastCall) return null

  return (
    <GlassCard>
      <p className="text-xs text-white/40 uppercase tracking-wider mb-2">{t('lastCall')}</p>
      <p className="text-white/80 text-sm leading-relaxed">{lastCall.summary}</p>
      <p className="mt-2 text-xs text-white/30">{new Date(lastCall.ended_at).toLocaleString()}</p>
    </GlassCard>
  )
}
