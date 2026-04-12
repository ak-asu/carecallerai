import { GlassCard } from '@/components/ui/GlassCard'

export function CallTranscriptView({ transcript, summary }: { transcript: string; summary: string }) {
  return (
    <GlassCard>
      {summary && (
        <div className="mb-3 p-3 rounded-xl bg-blue-500/10 border border-blue-500/10">
          <p className="text-xs text-blue-300 uppercase tracking-wider mb-1">AI Summary</p>
          <p className="text-sm text-white/80">{summary}</p>
        </div>
      )}
      <p className="text-xs text-white/40 uppercase tracking-wider mb-2">Full Transcript</p>
      <p className="text-sm text-white/60 whitespace-pre-wrap leading-relaxed">{transcript}</p>
    </GlassCard>
  )
}
