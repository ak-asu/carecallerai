import { GlassCard } from '@/components/ui/GlassCard'
import { GlassBadge } from '@/components/ui/GlassBadge'
import type { TimelineEvent } from '@/types'

export function TimelineFeed({ events }: { events: TimelineEvent[] }) {
  return (
    <div className="flex flex-col gap-2">
      {events.map((event) => (
        <GlassCard key={event.id} className={event.flagged ? 'border-red-500/20' : ''}>
          <div className="flex items-start gap-3">
            <GlassBadge color={event.flagged ? 'red' : 'blue'}>{event.event_type.replace('_', ' ')}</GlassBadge>
            <div className="flex-1">
              <p className="text-sm text-white/70">
                {(event.content as Record<string, unknown>)?.summary as string ?? JSON.stringify(event.content).slice(0, 120)}
              </p>
              <p className="text-xs text-white/30 mt-0.5">{new Date(event.created_at).toLocaleString()}</p>
            </div>
            {event.severity > 0 && <span className="text-xs text-white/40">sev {event.severity}</span>}
          </div>
        </GlassCard>
      ))}
    </div>
  )
}
