'use client'
import { useEffect, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase'
import type { Escalation } from '@/types'

export function useRealtimeAlerts(patientId: string, initial: Escalation[]) {
  const [escalations, setEscalations] = useState<Escalation[]>(initial)

  useEffect(() => {
    if (!patientId) return
    const channel = supabaseBrowser
      .channel(`escalations:${patientId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'escalations',
        filter: `patient_id=eq.${patientId}`,
      }, (payload) => {
        setEscalations((prev) => [...prev, payload.new as Escalation])
      })
      .subscribe()

    return () => { supabaseBrowser.removeChannel(channel) }
  }, [patientId])

  return escalations
}
