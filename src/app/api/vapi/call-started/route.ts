import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { queryMemory } from '@/lib/supermemory'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const callId: string = body.message?.call?.id ?? body.call?.id
  const patientPhone: string = body.message?.call?.customer?.number ?? ''

  if (!callId) return NextResponse.json({ ok: false }, { status: 400 })

  // Look up patient by phone
  const { data: patient } = await supabaseAdmin
    .from('patients')
    .select('id, language')
    .eq('phone', patientPhone)
    .single()

  if (!patient) return NextResponse.json({ ok: true })

  // Pre-fetch context in parallel
  const [memory, medsRes, apptsRes] = await Promise.all([
    queryMemory(patient.id, 'medications symptoms history appointments'),
    supabaseAdmin.from('medications').select('*').eq('patient_id', patient.id).eq('active', true),
    supabaseAdmin.from('appointments').select('*').eq('patient_id', patient.id).eq('status', 'scheduled'),
  ])

  // Cache in call_sessions
  await supabaseAdmin.from('call_sessions').upsert({
    call_id: callId,
    patient_id: patient.id,
    context: {
      memory: memory ?? '',
      meds: medsRes.data ?? [],
      appointments: apptsRes.data ?? [],
    },
  })

  // Create call record
  await supabaseAdmin.from('calls').insert({
    patient_id: patient.id,
    vapi_call_id: callId,
    type: 'inbound',
    status: 'in_progress',
    language: patient.language,
    started_at: new Date().toISOString(),
  })

  return NextResponse.json({ ok: true })
}
