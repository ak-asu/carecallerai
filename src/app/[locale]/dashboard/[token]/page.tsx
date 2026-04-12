'use client'
import { useState } from 'react'
import { useParams } from 'next/navigation'
import { PinGate } from '@/components/shared/PinGate'
import { LanguageSwitcher } from '@/components/shared/LanguageSwitcher'
import { AlertBanner } from '@/components/dashboard/AlertBanner'
import { CallSummarySection } from '@/components/dashboard/CallSummarySection'
import { MedicationSection } from '@/components/dashboard/MedicationSection'
import { AppointmentSection } from '@/components/dashboard/AppointmentSection'
import { TimelineSection } from '@/components/dashboard/TimelineSection'
import { SavingsCard } from '@/components/dashboard/SavingsCard'
import { useRealtimeAlerts } from '@/hooks/useRealtimeAlerts'
import { useTranslations } from 'next-intl'
import type { Appointment, Escalation, Medication, TimelineEvent } from '@/types'

interface DashboardData {
  patient: { id: string; name_alias: string; language: string; severity_score: number }
  medications: Medication[]
  appointments: Appointment[]
  timeline: TimelineEvent[]
  escalations: Escalation[]
  lastCall: { summary: string; severity_score: number; ended_at: string } | null
}

export default function DashboardPage() {
  const params = useParams()
  const token = params.token as string
  const locale = params.locale as string
  const t = useTranslations('dashboard')
  const [data, setData] = useState<DashboardData | null>(null)

  const escalations = useRealtimeAlerts(data?.patient?.id ?? '', data?.escalations ?? [])

  if (!data) {
    return <PinGate token={token} onVerified={(d) => setData(d as DashboardData)} />
  }

  const { patient, medications, appointments, timeline, lastCall } = data

  // Extract savings_found events for SavingsCard rendering
  const savingsEvents = timeline.filter((e) => e.event_type === 'savings_found') as Array<
    TimelineEvent & { content: { drugName: string; links: { url: string; title: string }[] } }
  >

  return (
    <div className="min-h-screen p-4 md:p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">{t('title')}</h1>
          <p className="text-sm text-white/40">{patient.name_alias}</p>
        </div>
        <LanguageSwitcher currentLocale={locale} />
      </div>

      {/* Alert banner */}
      <div className="mb-4">
        <AlertBanner escalations={escalations} severity={patient.severity_score} />
      </div>

      <div className="flex flex-col gap-6">
        <CallSummarySection lastCall={lastCall} />
        <MedicationSection medications={medications} patientId={patient.id} locale={locale} />
        {savingsEvents.map((e) => (
          <SavingsCard key={e.id} drugName={e.content.drugName} links={e.content.links} />
        ))}
        <AppointmentSection appointments={appointments} patientId={patient.id} />
        <TimelineSection events={timeline} />
      </div>
    </div>
  )
}
