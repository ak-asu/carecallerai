import { isSafetyCandidate, isNegated, extractDrugCandidates, normalizeDose, computeConfidence } from './nlp'
import { extractAndRespond } from './groq'
import { supabaseAdmin } from './supabase'
import { fireEvent } from './events'
import type { GroqExtractionResult, Medication, Appointment } from '@/types'

const CONFIDENCE_THRESHOLD = 0.85

export async function runCallPipeline(params: {
  transcript: string
  callId: string
  patientId: string
  language: string
  callType: 'inbound' | 'outbound'
  wordConfidences?: number[]
}): Promise<{ responseText: string; action: string }> {
  const { transcript, callId, patientId, language, callType, wordConfidences = [] } = params

  // --- Layer 1: Rules (~5ms) ---
  const isSafety = isSafetyCandidate(transcript)
  const negated = isNegated(transcript)
  const drugCandidates = extractDrugCandidates(transcript)
  normalizeDose(transcript)
  const entityConfidence = computeConfidence(wordConfidences, drugCandidates.length > 0)

  // If safety keyword and NOT negated → immediate escalation (no LLM needed)
  if (isSafety && !negated) {
    const safetyResponse = language === 'es'
      ? 'Escucho que está experimentando algo preocupante. Estoy notificando a su médico ahora mismo. Si está en peligro inmediato, por favor llame al 911.'
      : "I hear that you're experiencing something concerning. I'm notifying your clinician right now. If you're in immediate danger, please call 911."

    await logDecision(callId, patientId, transcript, 'escalated', 'safety_keyword_detected_not_negated', entityConfidence)
    await fireEvent({ type: 'escalation.created', patientId, callId, severity: 9 })
    return { responseText: safetyResponse, action: 'escalated' }
  }

  // --- Layer 2: Context enrichment from pre-cache (~30ms) ---
  const { data: session } = await supabaseAdmin
    .from('call_sessions')
    .select('context')
    .eq('call_id', callId)
    .single()

  const meds: Medication[] = session?.context?.meds ?? []
  const appointments: Appointment[] = session?.context?.appointments ?? []
  const supermemoryContext: string = session?.context?.memory ?? ''

  // Contradiction check
  const contradiction = detectContradiction(transcript, meds)

  // Determine if Layer 3 needed
  const needsGroq = entityConfidence < CONFIDENCE_THRESHOLD || contradiction.detected || drugCandidates.length > 0

  let result: GroqExtractionResult

  if (!needsGroq) {
    // Fast path: generate simple dialog response without full Groq NER
    result = await extractAndRespond({
      transcript,
      agentType: callType === 'outbound' ? 'intake' : 'inbound',
      language,
      verifiedMeds: meds.map((m) => ({ drug_name_normalized: m.drug_name_normalized, dose: m.dose })),
      supermemoryContext,
      flaggedEntities: [],
      contradiction: { detected: false },
    })
  } else {
    // --- Layer 3: Groq reasoning ---
    const agentType = contradiction.detected
      ? 'clarification'
      : callType === 'outbound'
        ? 'intake'
        : 'inbound'

    result = await extractAndRespond({
      transcript,
      agentType,
      language,
      verifiedMeds: meds.map((m) => ({ drug_name_normalized: m.drug_name_normalized, dose: m.dose })),
      supermemoryContext,
      flaggedEntities: drugCandidates,
      contradiction,
    })
  }

  // Suppress unused variable warning
  void appointments

  await logDecision(callId, patientId, transcript, result.action, result.clarification_text ?? '', entityConfidence)

  return { responseText: result.response_text, action: result.action }
}

function detectContradiction(
  transcript: string,
  meds: Medication[]
): { detected: boolean; field?: string; heard?: string; record?: string } {
  const lower = transcript.toLowerCase()
  for (const med of meds) {
    if (lower.includes(med.drug_name_normalized.toLowerCase())) {
      // Basic dose contradiction: heard a dose that doesn't match record
      const doseMatch = lower.match(/(\d+)\s*mg/)
      if (doseMatch && med.dose) {
        const heardDose = doseMatch[0]
        const recordDose = med.dose
        if (!recordDose.includes(heardDose)) {
          return { detected: true, field: 'dose', heard: heardDose, record: recordDose }
        }
      }
    }
  }
  return { detected: false }
}

async function logDecision(
  callId: string,
  patientId: string,
  transcript: string,
  action: string,
  rationale: string,
  confidence: number
): Promise<void> {
  await supabaseAdmin.from('call_entities').insert({
    call_id: callId,
    patient_id: patientId,
    entity_type: 'utterance',
    value_raw: transcript,
    value_normalized: transcript,
    confidence,
    action_taken: action,
    source: 'stt_inferred',
    decision_rationale: rationale,
  })
}
