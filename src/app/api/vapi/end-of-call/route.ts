import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { fireEvent } from '@/lib/events'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const callId: string = body.message?.call?.id ?? body.call?.id
  const transcript: string = body.message?.artifact?.transcript ?? ''

  if (!callId) return NextResponse.json({ ok: false }, { status: 400 })

  // Get call record
  const { data: call } = await supabaseAdmin
    .from('calls')
    .select('id, patient_id')
    .eq('vapi_call_id', callId)
    .single()

  if (!call) return NextResponse.json({ ok: true })

  // Update call status + store transcript
  await supabaseAdmin.from('calls').update({
    status: 'completed',
    transcript,
    ended_at: new Date().toISOString(),
  }).eq('vapi_call_id', callId)

  // Clean up session cache
  await supabaseAdmin.from('call_sessions').delete().eq('call_id', callId)

  // Fire post-call processing
  await fireEvent({ type: 'call.completed', callId: call.id, patientId: call.patient_id })

  return NextResponse.json({ ok: true })
}
