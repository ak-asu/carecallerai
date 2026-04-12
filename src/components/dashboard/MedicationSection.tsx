'use client'
import { useTranslations } from 'next-intl'
import { EntityCard } from './EntityCard'
import type { Medication, EntitySource } from '@/types'

interface MedicationSectionProps {
  medications: Medication[]
  patientId: string
  locale?: string
}

export function MedicationSection({ medications, patientId, locale }: MedicationSectionProps) {
  const t = useTranslations('dashboard')
  if (!medications.length) return null

  return (
    <section>
      <h2 className="mb-3 text-sm font-medium text-white/50 uppercase tracking-wider">{t('medications')}</h2>
      <div className="flex flex-col gap-2">
        {medications.map((med) => (
          <EntityCard
            key={med.id}
            label={`${med.drug_name_normalized} · ${med.frequency}`}
            value={med.dose}
            confidence={1}
            source={med.source as EntitySource}
            entityType="drug"
            patientId={patientId}
            locale={locale}
          />
        ))}
      </div>
    </section>
  )
}
