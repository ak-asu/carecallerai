'use client'
import { useState } from 'react'
import { GlassCard } from '@/components/ui/GlassCard'
import { GlassButton } from '@/components/ui/GlassButton'

interface CorrectionModalProps {
  label: string
  currentValue: string
  entityType: string
  patientId: string
  callId?: string
  onClose: () => void
  onSaved: () => void
}

export function CorrectionModal({ label, currentValue, entityType, patientId, callId, onClose, onSaved }: CorrectionModalProps) {
  const [newValue, setNewValue] = useState(currentValue)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    await fetch('/api/dashboard/correction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId, entityType, oldValue: currentValue, newValue, sourceCallId: callId }),
    })
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <GlassCard className="w-full max-w-md">
        <h3 className="mb-4 font-medium text-white">Correct {label}</h3>
        <input
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          className="w-full rounded-xl border border-blue-500/20 bg-blue-950/30 px-4 py-2.5 text-white focus:outline-none focus:border-blue-500/50"
        />
        <div className="mt-4 flex justify-end gap-2">
          <GlassButton variant="secondary" onClick={onClose}>Cancel</GlassButton>
          <GlassButton variant="success" onClick={handleSave} disabled={saving || !newValue}>{saving ? 'Saving...' : 'Save'}</GlassButton>
        </div>
      </GlassCard>
    </div>
  )
}
