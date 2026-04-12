import Groq from 'groq-sdk'
import type { GroqExtractionResult } from '@/types'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! })

const AGENT_PROMPTS = {
  intake: (lang: string) => `You are CareCaller, a compassionate healthcare voice agent conducting a patient check-in${lang === 'es' ? ' in Spanish' : ''}. Ask structured questions about symptoms, medications, and adherence. Be warm but concise. You ONLY use facts from the transcript and provided patient records. NEVER invent medications or diagnoses.`,
  inbound: (lang: string) => `You are CareCaller, a helpful healthcare voice agent handling an inbound patient call${lang === 'es' ? ' in Spanish' : ''}. Help with refill requests, scheduling questions, and general guidance. You ONLY use facts from the transcript and provided patient records. NEVER invent medications or clinical information.`,
  clarification: (lang: string) => `You are CareCaller${lang === 'es' ? ' responding in Spanish' : ''}. You need to clarify something you didn't fully understand. Ask one clear, focused question. Offer alternatives only from the patient's known medication list.`,
  escalation: (lang: string) => `You are CareCaller${lang === 'es' ? ' responding in Spanish' : ''}. You have detected a potentially urgent health concern. Calmly provide emergency guidance and inform the patient that a clinician will be notified. If life-threatening, advise calling 911.`,
}

export async function extractAndRespond(params: {
  transcript: string
  agentType: keyof typeof AGENT_PROMPTS
  language: string
  verifiedMeds: Array<{ drug_name_normalized: string; dose: string }>
  supermemoryContext: string
  flaggedEntities: string[]
  contradiction: { detected: boolean; field?: string; heard?: string; record?: string }
}): Promise<GroqExtractionResult> {
  const { transcript, agentType, language, verifiedMeds, supermemoryContext, flaggedEntities, contradiction } = params

  const systemPrompt = AGENT_PROMPTS[agentType](language)
  const medsContext = verifiedMeds.map((m) => `${m.drug_name_normalized} ${m.dose}`).join(', ')

  const userPrompt = `
Patient's verified medications: ${medsContext || 'none on file'}
Prior context from memory: ${supermemoryContext || 'none'}
${contradiction.detected ? `CONTRADICTION DETECTED: Patient said "${contradiction.heard}" but record shows "${contradiction.record}" for ${contradiction.field}` : ''}
${flaggedEntities.length ? `LOW CONFIDENCE ENTITIES needing clarification: ${flaggedEntities.join(', ')}` : ''}

Patient's latest utterance: "${transcript}"

Respond ONLY with valid JSON matching this exact structure:
{
  "entities": [{"type": "drug|dose|symptom|date|appointment", "value_raw": "", "value_normalized": "", "confidence": 0.0, "negated": false, "source": "stt_inferred"}],
  "contradiction": {"detected": false, "field": "", "heard": "", "record": ""},
  "safety_trigger": {"detected": false, "term": "", "negated": false},
  "action": "accepted|clarified|escalated|human_review|propose_alternatives",
  "clarification_text": null,
  "response_text": "Your spoken response to the patient"
}
Rules: Never invent medications. If unsure, set action to "clarified" and ask. If safety trigger is negated ("no chest pain"), set safety_trigger.detected = false.`

  const completion = await groq.chat.completions.create({
    model: 'llama-3.1-8b-instant',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.1,
    max_tokens: 512,
  })

  const raw = completion.choices[0]?.message?.content ?? '{}'
  return JSON.parse(raw) as GroqExtractionResult
}
