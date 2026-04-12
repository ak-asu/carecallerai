import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { fireEvent } from '@/lib/events'

export async function PATCH(req: NextRequest) {
  const { appointmentId, patientId, action } = await req.json()
  // action: 'confirm' | 'request_change'

  if (action === 'confirm') {
    await supabaseAdmin.from('appointments').update({
      status: 'confirmed',
      updated_at: new Date().toISOString(),
    }).eq('id', appointmentId)

    await supabaseAdmin.from('patient_timeline').insert({
      patient_id: patientId,
      event_type: 'appointment',
      content: { action: 'confirmed', appointmentId },
      severity: 0,
      source: 'patient_verified',
    })
  } else {
    await supabaseAdmin.from('appointments').update({
      conflict_detected: true,
      updated_at: new Date().toISOString(),
    }).eq('id', appointmentId)

    await fireEvent({ type: 'appointment.updated', appointmentId, patientId })
  }

  return NextResponse.json({ ok: true })
}
