import type { GroqExtractionResult, Medication, Appointment } from "@/types";

import {
  isSafetyCandidate,
  isNegated,
  extractDrugCandidates,
  normalizeDose,
  computeConfidence,
  flagNumericAmbiguity,
} from "./nlp";
import { extractAndRespond } from "./groq";
import { supabaseAdmin } from "./supabase";
import { fireEvent } from "./events";

const CONFIDENCE_THRESHOLD = 0.85;

export async function runCallPipeline(params: {
  transcript: string;
  callId: string;
  patientId: string;
  language: string;
  callType: "inbound" | "outbound";
  messages?: Array<{ role: string; content: string }>;
  wordConfidences?: number[];
}): Promise<{ responseText: string; action: string }> {
  const {
    transcript,
    callId,
    patientId,
    language,
    callType,
    messages = [],
    wordConfidences = [],
  } = params;

  // --- Layer 1: Rules (~5ms) ---
  const isSafety = isSafetyCandidate(transcript);
  const negated = isNegated(transcript);
  const drugCandidates = extractDrugCandidates(transcript);
  const normalizedTranscript = normalizeDose(transcript);
  const hasNumericAmbiguity =
    flagNumericAmbiguity(normalizedTranscript).includes("NUMERIC_AMBIGUOUS");
  const entityConfidence = computeConfidence(
    wordConfidences,
    drugCandidates.length > 0,
  );

  // If safety keyword and NOT negated → immediate escalation (no LLM needed)
  if (isSafety && !negated) {
    const safetyResponse =
      language === "es"
        ? "Escucho que está experimentando algo preocupante. Estoy notificando a su médico ahora mismo. Si está en peligro inmediato, por favor llame al 911."
        : "I hear that you're experiencing something concerning. I'm notifying your clinician right now. If you're in immediate danger, please call 911.";

    await logDecision(
      callId,
      patientId,
      transcript,
      "escalated",
      "safety_keyword_detected_not_negated",
      entityConfidence,
    );
    await fireEvent({
      type: "escalation.created",
      patientId,
      callId,
      severity: 9,
    });

    return { responseText: safetyResponse, action: "escalated" };
  }

  // --- Layer 2: Context enrichment from pre-cache (~30ms) ---
  const { data: session } = await supabaseAdmin
    .from("call_sessions")
    .select("context")
    .eq("call_id", callId)
    .single();

  const sessionContext = session?.context as
    | {
        memory?: string;
        meds?: Medication[];
        appointments?: Appointment[];
      }
    | undefined;

  const meds: Medication[] = sessionContext?.meds ?? [];
  const appointments: Appointment[] = sessionContext?.appointments ?? [];
  const supermemoryContext: string = sessionContext?.memory ?? "";

  // Contradiction check
  const contradiction = detectContradiction(transcript, meds);

  // Determine if Layer 3 needed
  const needsGroq =
    entityConfidence < CONFIDENCE_THRESHOLD ||
    contradiction.detected ||
    drugCandidates.length > 0 ||
    hasNumericAmbiguity;

  let result: GroqExtractionResult;

  if (!needsGroq) {
    // Fast path (Layer 1+2 only, ~200ms): return a simple acknowledgment
    // without calling Groq. The agent continues the dialogue with a brief prompt.
    const ackText =
      language === "es"
        ? "Entendido. ¿Hay algo más que quiera comentarme hoy?"
        : "Got it. Is there anything else you would like to share with me today?";

    await logDecision(
      callId,
      patientId,
      transcript,
      "accepted",
      "fast_path_high_confidence",
      entityConfidence,
    );

    return { responseText: ackText, action: "accepted" };
  } else {
    // --- Layer 3: Groq reasoning ---
    const agentType = contradiction.detected
      ? "clarification"
      : callType === "outbound"
        ? "intake"
        : "inbound";

    result = await extractAndRespond({
      transcript,
      agentType,
      language,
      verifiedMeds: meds.map((m) => ({
        drug_name_normalized: m.drug_name_normalized,
        dose: m.dose,
      })),
      supermemoryContext,
      flaggedEntities: drugCandidates,
      contradiction,
      numericAmbiguity: hasNumericAmbiguity,
      conversationHistory: messages,
    });
  }

  void appointments; // used in context but not directly iterated

  await logDecision(
    callId,
    patientId,
    transcript,
    result.action,
    result.clarification_text ?? "",
    entityConfidence,
  );

  const responseText =
    result.response_text?.trim() ||
    result.clarification_text?.trim() ||
    (language === "es"
      ? "Lo siento, ¿puede repetir eso? Quiero asegurarme de entenderle bien."
      : "I'm sorry, could you say that again? I want to make sure I understand you correctly.");

  return { responseText, action: result.action };
}

function detectContradiction(
  transcript: string,
  meds: Medication[],
): { detected: boolean; field?: string; heard?: string; record?: string } {
  const lower = transcript.toLowerCase();

  for (const med of meds) {
    if (lower.includes(med.drug_name_normalized.toLowerCase())) {
      // Basic dose contradiction: heard a dose that doesn't match record
      const doseMatch = lower.match(/(\d+)\s*mg/);

      if (doseMatch && med.dose) {
        const heardDose = doseMatch[0];
        const recordDose = med.dose;

        if (!recordDose.includes(heardDose)) {
          return {
            detected: true,
            field: "dose",
            heard: heardDose,
            record: recordDose,
          };
        }
      }
    }
  }

  return { detected: false };
}

async function logDecision(
  vapiCallId: string,
  patientId: string,
  transcript: string,
  action: string,
  rationale: string,
  confidence: number,
): Promise<void> {
  // call_entities.call_id references calls.id (DB UUID), not the VAPI call ID string
  const { data: callRow } = await supabaseAdmin
    .from("calls")
    .select("id")
    .eq("vapi_call_id", vapiCallId)
    .single();

  if (!callRow?.id || !patientId) {
    // No matching call or patient yet — skip to avoid FK violation
    return;
  }

  await supabaseAdmin.from("call_entities").insert({
    call_id: callRow.id,
    patient_id: patientId,
    entity_type: "utterance",
    value_raw: transcript,
    value_normalized: transcript,
    confidence,
    action_taken: action,
    source: "stt_inferred",
    decision_rationale: rationale,
  });
}
