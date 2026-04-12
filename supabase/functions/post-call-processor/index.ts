import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const TAVILY_URL = "https://api.tavily.com/search";

const NEGATION_PATTERNS: RegExp[] = [
  /\bno\b/i,
  /\bnot\b/i,
  /\bwithout\b/i,
  /\bdenies?\b/i,
  /\bdon'?t\b/i,
  /\bdo not\b/i,
  /\bno longer\b/i,
];

const COMMON_SYMPTOMS = [
  "chest pain",
  "shortness of breath",
  "dizziness",
  "nausea",
  "fatigue",
  "headache",
  "swelling",
  "fever",
  "cough",
];

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

function clampSeverity(input: unknown): number {
  const n = Number(input);

  if (!Number.isFinite(n)) return 0;

  return Math.min(10, Math.max(0, Math.round(n)));
}

function hasNegation(text: string): boolean {
  return NEGATION_PATTERNS.some((pattern) => pattern.test(text));
}

function sanitizeEntities(entities: unknown): ExtractedEntity[] {
  if (!Array.isArray(entities)) return [];

  const out: ExtractedEntity[] = [];

  for (const raw of entities) {
    const record = raw as Partial<ExtractedEntity>;
    const type = String(record.type ?? "").toLowerCase();
    const valueRaw = String(record.value_raw ?? "").trim();
    const valueNormalized = String(record.value_normalized ?? valueRaw).trim();

    if (!valueRaw) continue;
    if (!["drug", "dose", "symptom", "adherence", "numeric"].includes(type)) {
      continue;
    }

    const confidenceRaw = Number(record.confidence ?? 0.5);
    const confidence = Number.isFinite(confidenceRaw)
      ? Math.min(1, Math.max(0, confidenceRaw))
      : 0.5;

    const negated = Boolean(record.negated) || hasNegation(valueRaw);

    out.push({
      type: type as ExtractedEntity["type"],
      value_raw: valueRaw,
      value_normalized: valueNormalized,
      confidence,
      negated,
    });
  }

  return out;
}

function inferFallbackEntities(transcript: string): ExtractedEntity[] {
  const lower = transcript.toLowerCase();
  const inferred: ExtractedEntity[] = [];

  for (const symptom of COMMON_SYMPTOMS) {
    if (lower.includes(symptom)) {
      inferred.push({
        type: "symptom",
        value_raw: symptom,
        value_normalized: symptom,
        confidence: 0.6,
        negated: hasNegation(lower),
      });
    }
  }

  const doseMatches = transcript.matchAll(
    /(\d+(?:\.\d+)?)\s*(mg|mcg|ml|units?)/gi,
  );

  for (const match of doseMatches) {
    const dose = `${match[1]} ${match[2].toLowerCase()}`;

    inferred.push({
      type: "dose",
      value_raw: dose,
      value_normalized: dose,
      confidence: 0.55,
      negated: false,
    });
  }

  return inferred;
}

async function fetchSavingsLinks(
  drugName: string,
): Promise<Array<{ url: string; title: string }>> {
  const res = await fetch(TAVILY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: Deno.env.get("TAVILY_API_KEY"),
      query: `${drugName} patient savings program coupon GoodRx`,
      search_depth: "basic",
      max_results: 2,
      include_domains: ["goodrx.com", "needymeds.org", "pparx.org"],
    }),
  });

  if (!res.ok) return [];

  const data = await res.json();

  return (data.results ?? []).map((r: { url: string; title: string }) => ({
    url: r.url,
    title: r.title,
  }));
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

  const severity = clampSeverity(parsed?.severity);
  let entities = sanitizeEntities(parsed?.entities);

  if (entities.length === 0) {
    entities = inferFallbackEntities(call.transcript);
  }

  // Update call record
  await supabase
    .from("calls")
    .update({
      summary: parsed.summary,
      severity_score: severity,
    })
    .eq("id", callId);

  // Update patient severity
  await supabase
    .from("patients")
    .update({
      severity_score: severity,
      last_call_at: new Date().toISOString(),
    })
    .eq("id", patientId);

  // Insert structured entities into call_entities
  for (const entity of entities) {
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
  const symptomEntities = entities.filter(
    (e) => e.type === "symptom" && !e.negated,
  );

  for (const s of symptomEntities) {
    await supabase.from("symptoms").insert({
      patient_id: patientId,
      call_id: callId,
      symptom_name: s.value_normalized,
      severity,
      flagged_to_clinician: severity >= 7,
    });
  }

  // Timeline entry
  await supabase.from("patient_timeline").insert({
    patient_id: patientId,
    event_type: "call",
    content: {
      summary: parsed.summary,
      severity,
      callId,
      entity_count: entities.length,
    },
    severity,
    flagged: severity >= 7,
    source: "stt_inferred",
  });

  const drugEntities = entities.filter((e) => e.type === "drug" && !e.negated);

  const uniqueDrugs = Array.from(
    new Set(
      drugEntities
        .map((e) => e.value_normalized?.trim())
        .filter((d): d is string => Boolean(d)),
    ),
  ).slice(0, 3);

  for (const drugName of uniqueDrugs) {
    const links = await fetchSavingsLinks(drugName);

    if (!links.length) continue;

    await supabase.from("patient_timeline").insert({
      patient_id: patientId,
      event_type: "savings_found",
      content: { drugName, links },
      severity: 0,
      flagged: false,
      source: "stt_inferred",
    });
  }

  // Schedule follow-up
  if (severity >= 4 || Boolean(parsed.followUpRequired)) {
    const hoursUntilFollowup = severity >= 7 ? 4 : 24;
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
  if (severity >= 7) {
    await supabase.from("escalations").insert({
      patient_id: patientId,
      call_id: callId,
      trigger_term: "high_severity_post_call",
      context_summary: parsed.summary,
      severity,
      status: "pending",
    });
  }

  return new Response("ok");
});
