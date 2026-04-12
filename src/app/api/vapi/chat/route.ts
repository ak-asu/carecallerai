import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { runCallPipeline } from '@/lib/vapi'

export async function POST(req: NextRequest) {
  const body = await req.json()

  // Vapi sends OpenAI-compatible messages array
  const messages: Array<{ role: string; content: string }> = body.messages ?? []
  const callId: string = body.call?.id ?? ''

  // Get last user message
  const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')
  const transcript = lastUserMsg?.content ?? ''

  if (!transcript || !callId) {
    return NextResponse.json({
      id: `chatcmpl-${Date.now()}`,
      object: 'chat.completion',
      choices: [{ message: { role: 'assistant', content: 'Hello, how can I help you today?' }, finish_reason: 'stop', index: 0 }],
    })
  }

  // Get patient from session cache
  const { data: session } = await supabaseAdmin
    .from('call_sessions')
    .select('patient_id')
    .eq('call_id', callId)
    .single()

  const { data: patient } = session?.patient_id
    ? await supabaseAdmin.from('patients').select('id, language').eq('id', session.patient_id).single()
    : { data: null }

  const { responseText } = await runCallPipeline({
    transcript,
    callId,
    patientId: patient?.id ?? '',
    language: patient?.language ?? 'en',
    callType: 'inbound',
    wordConfidences: body.call?.transcript?.words?.map((w: { confidence: number }) => w.confidence) ?? [],
  })

  // Return OpenAI-compatible response
  return NextResponse.json({
    id: `chatcmpl-${Date.now()}`,
    object: 'chat.completion',
    choices: [{ message: { role: 'assistant', content: responseText }, finish_reason: 'stop', index: 0 }],
  })
}
