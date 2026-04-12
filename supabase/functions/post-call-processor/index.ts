import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

interface ExtractedEntity {
  type: "drug" | "dose" | "symptom" | "adherence" | "numeric";
  value_raw: string;
  value_normalized: string;
  confidence: number;
  negated: boolean;
}

interface PostCallAnalysis {
  summary: string;
  severity: number;
  entities: ExtractedEntity[];
  followUpRequired: boolean;
}

Deno.serve(async (req) => {
  const { callId, patientId } = await req.json();

  const { data: call } = await supabase
    .from("calls")
    .select("transcript, language")
    .eq("id", callId)
    .single();

  if (!call?.transcript) return new Response("ok");

  const genai = new GoogleGenerativeAI(Deno.env.get("GEMINI_API_KEY")!);
  const model = genai.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `You are a clinical documentation assistant. Analyze this patient call transcript and return ONLY valid JSON.

Transcript: "${call.transcript}"

Return this exact structure:
{
  "summary": "2-3 sentence clinical summary",
  "severity": 0,
  "entities": [
    {
      "type": "drug|dose|symptom|adherence|numeric",
      "value_raw": "exact text from transcript",
      "value_normalized": "standardized form (e.g. 'Warfarin 5 mg', 'pain level 7/10')",
      "confidence": 0.95,
      "negated": false
    }
  ],
  "followUpRequired": false
}

Entity types:
- "drug": any medication name (normalized to generic name if known)
- "dose": dosage amount (normalize to numeric + unit: "10 mg", "500 mcg")
- "symptom": reported symptom ("chest pain", "nausea", "dizziness")
- "adherence": medication adherence flag ("missed dose", "stopped taking", "running low")
- "numeric": important number with context ("pain 7/10", "blood pressure 140/90")

Severity: 0=no concerns, 5=moderate (follow up 24h), 8=urgent (4h), 10=emergency.
Negated=true means the patient explicitly denied this entity ("no chest pain").
Confidence: your confidence that the entity was correctly transcribed (0.0-1.0).
NEVER invent entities not present in the transcript.`;

  const result = await model.generateContent(prompt);
  const text = result.response
    .text()
    .replace(/```json\n?|\n?```/g, "")
    .trim();

  let parsed: PostCallAnalysis;
  try {
    parsed = JSON.parse(text);
  } catch {
    console.error("Failed to parse Gemini response:", text);
    return new Response("parse_error");
  }

  // Update call record
  await supabase
    .from("calls")
    .update({
      summary: parsed.summary,
      severity_score: parsed.severity,
    })
    .eq("id", callId);

  // Update patient severity
  await supabase
    .from("patients")
    .update({
      severity_score: parsed.severity,
      last_call_at: new Date().toISOString(),
    })
    .eq("id", patientId);

  // Insert structured entities into call_entities
  for (const entity of parsed.entities ?? []) {
    await supabase.from("call_entities").insert({
      call_id: callId,
      patient_id: patientId,
      entity_type: entity.type,
      value_raw: entity.value_raw,
      value_normalized: entity.value_normalized,
      confidence: entity.confidence,
      negated: entity.negated,
      action_taken: "accepted",
      source: "stt_inferred",
      decision_rationale: "post_call_gemini_extraction",
    });
  }

  // Insert symptoms separately for the symptoms table (from entity list)
  const symptomEntities = (parsed.entities ?? []).filter(
    (e) => e.type === "symptom" && !e.negated,
  );
  for (const s of symptomEntities) {
    await supabase.from("symptoms").insert({
      patient_id: patientId,
      call_id: callId,
      symptom_name: s.value_normalized,
      severity: parsed.severity,
      flagged_to_clinician: parsed.severity >= 7,
    });
  }

  // Timeline entry
  await supabase.from("patient_timeline").insert({
    patient_id: patientId,
    event_type: "call",
    content: {
      summary: parsed.summary,
      severity: parsed.severity,
      callId,
      entity_count: parsed.entities?.length ?? 0,
    },
    severity: parsed.severity,
    flagged: parsed.severity >= 7,
    source: "stt_inferred",
  });

  // Schedule follow-up
  if (parsed.severity >= 4) {
    const hoursUntilFollowup = parsed.severity >= 7 ? 4 : 24;
    const scheduledAt = new Date(
      Date.now() + hoursUntilFollowup * 3600 * 1000,
    ).toISOString();

    await supabase.from("notifications").insert({
      patient_id: patientId,
      type: "call",
      message: "CareCaller follow-up scheduled based on your recent symptoms.",
      language: call.language,
      status: "pending",
      scheduled_at: scheduledAt,
      triggered_by: `call.completed:${callId}`,
    });
  }

  // Escalation
  if (parsed.severity >= 7) {
    await supabase.from("escalations").insert({
      patient_id: patientId,
      call_id: callId,
      trigger_term: "high_severity_post_call",
      context_summary: parsed.summary,
      severity: parsed.severity,
      status: "pending",
    });
  }

  return new Response("ok");
});
