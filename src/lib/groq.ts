import type { GroqExtractionResult } from "@/types";

import Groq from "groq-sdk";

let groq: Groq | null = null;

function getGroqClient() {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    throw new Error(
      "Missing GROQ_API_KEY. Set GROQ_API_KEY before using Groq.",
    );
  }

  if (!groq) {
    groq = new Groq({ apiKey });
  }

  return groq;
}

const AGENT_PROMPTS = {
  intake: (lang: string) =>
    `You are CareCaller, a warm and empathetic healthcare voice agent doing a patient check-in${lang === "es" ? " — respond entirely in Spanish" : ""}. You have the full conversation history below. Acknowledge what the patient has already told you and ask only ONE focused follow-up question. Never repeat a question already asked or answered in this conversation. Keep responses short and natural — this is a phone call, not a form.`,
  inbound: (lang: string) =>
    `You are CareCaller, a helpful and empathetic healthcare voice agent${lang === "es" ? " — respond entirely in Spanish" : ""}. You have the full conversation history below. Acknowledge what the patient has shared, provide helpful information, and ask at most ONE follow-up question. Never ask something already answered in this conversation. Keep responses concise — this is a phone call.`,
  clarification: (lang: string) =>
    `You are CareCaller${lang === "es" ? " — respond in Spanish" : ""}. Something in the last message wasn't clear. Based on the conversation history below, ask ONE brief clarification. Be warm and natural.`,
  escalation: (lang: string) =>
    `You are CareCaller${lang === "es" ? " — respond in Spanish" : ""}. An urgent health concern has been detected. Calmly provide guidance and inform the patient their clinician will be notified. If life-threatening, advise calling 911.`,
};

export async function extractAndRespond(params: {
  transcript: string;
  agentType: keyof typeof AGENT_PROMPTS;
  language: string;
  verifiedMeds: Array<{ drug_name_normalized: string; dose: string }>;
  supermemoryContext: string;
  flaggedEntities: string[];
  contradiction: {
    detected: boolean;
    field?: string;
    heard?: string;
    record?: string;
  };
  numericAmbiguity?: boolean;
  conversationHistory?: Array<{ role: string; content: string }>;
}): Promise<GroqExtractionResult> {
  const {
    transcript,
    agentType,
    language,
    verifiedMeds,
    supermemoryContext,
    flaggedEntities,
    contradiction,
    numericAmbiguity = false,
    conversationHistory = [],
  } = params;

  const systemPrompt = AGENT_PROMPTS[agentType](language);
  const medsContext = verifiedMeds
    .map((m) => `${m.drug_name_normalized} ${m.dose}`)
    .join(", ");

  // Format up to the last 10 turns so the model has full call context
  const historyBlock =
    conversationHistory.length > 0
      ? "Conversation so far:\n" +
        conversationHistory
          .slice(-10)
          .map(
            (m) =>
              `${m.role === "user" ? "Patient" : "CareCaller"}: ${m.content}`,
          )
          .join("\n") +
        "\n"
      : "";

  const userPrompt = `${historyBlock}
Patient's verified medications: ${medsContext || "none on file"}
Prior memory context: ${supermemoryContext || "none"}
${contradiction.detected ? `CONTRADICTION: Patient said "${contradiction.heard}" but record shows "${contradiction.record}" for ${contradiction.field}` : ""}
${flaggedEntities.length ? `LOW CONFIDENCE ENTITIES: ${flaggedEntities.join(", ")}` : ""}
${numericAmbiguity ? `NUMERIC AMBIGUITY: Ask the patient to confirm the exact dose number.` : ""}

Patient's latest message: "${transcript}"

Respond ONLY with valid JSON:
{
  "entities": [{"type": "drug|dose|symptom|date|appointment", "value_raw": "", "value_normalized": "", "confidence": 0.0, "negated": false, "source": "stt_inferred"}],
  "action": "accepted|clarified|escalated|human_review|propose_alternatives",
  "clarification_text": null,
  "response_text": "Your spoken response — natural, brief, and relevant to the full conversation"
}
Rules: Never invent medications. Never ask about something already addressed in the conversation. If safety term is negated, do not escalate.`;

  const groq = getGroqClient();
  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
    temperature: 0.2,
    max_tokens: 400,
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";

  return JSON.parse(raw) as GroqExtractionResult;
}
