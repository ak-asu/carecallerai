import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

Deno.serve(async (req) => {
  const { callId, patientId } = await req.json()

  const { data: call } = await supabase.from('calls').select('transcript, language').eq('id', callId).single()
  if (!call?.transcript) return new Response('ok')

  // Gemini summary
  const genai = new GoogleGenerativeAI(Deno.env.get('GEMINI_API_KEY')!)
  const model = genai.getGenerativeModel({ model: 'gemini-2.5-flash' })
  const prompt = `Analyze this patient call transcript. Return JSON only:
{"summary":"2-3 sentence clinical summary","severity":0-10,"symptoms":["list"],"medicationChanges":["list"],"followUpRequired":true/false}
Transcript: "${call.transcript}"`

  const result = await model.generateContent(prompt)
  const text = result.response.text().replace(/```json\n?|\n?```/g, '').trim()
  const parsed = JSON.parse(text)

  // Update call with summary and severity
  await supabase.from('calls').update({
    summary: parsed.summary,
    severity_score: parsed.severity,
  }).eq('id', callId)

  // Update patient severity
  await supabase.from('patients').update({ severity_score: parsed.severity, last_call_at: new Date().toISOString() }).eq('id', patientId)

  // Add timeline entry
  await supabase.from('patient_timeline').insert({
    patient_id: patientId,
    event_type: 'call',
    content: { summary: parsed.summary, severity: parsed.severity, callId },
    severity: parsed.severity,
    flagged: parsed.severity >= 7,
    source: 'stt_inferred',
  })

  // Insert symptoms
  for (const symptom of parsed.symptoms ?? []) {
    await supabase.from('symptoms').insert({
      patient_id: patientId,
      call_id: callId,
      symptom_name: symptom,
      severity: parsed.severity,
    })
  }

  // Schedule follow-up based on severity
  if (parsed.severity >= 4) {
    const hoursUntilFollowup = parsed.severity >= 7 ? 4 : 24
    const scheduledAt = new Date(Date.now() + hoursUntilFollowup * 3600 * 1000).toISOString()
    await supabase.from('notifications').insert({
      patient_id: patientId,
      type: 'call',
      message: 'CareCaller follow-up scheduled based on your recent symptoms.',
      language: call.language,
      status: 'pending',
      scheduled_at: scheduledAt,
      triggered_by: `call.completed:${callId}`,
    })
  }

  // Immediate escalation
  if (parsed.severity >= 7) {
    await supabase.from('escalations').insert({
      patient_id: patientId,
      call_id: callId,
      trigger_term: 'high_severity_post_call',
      context_summary: parsed.summary,
      severity: parsed.severity,
      status: 'pending',
    })
  }

  return new Response('ok')
})
