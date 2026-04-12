import type { MedicationSavings, SavingsLink } from "@/types";
import type { PatientMemoryContext } from "@/lib/supermemory";

import { tavily } from "@tavily/core";

let client: ReturnType<typeof tavily> | null = null;

function getTavilyClient() {
  const apiKey = process.env.TAVILY_API_KEY;

  if (!apiKey) {
    throw new Error(
      "Missing TAVILY_API_KEY. Set TAVILY_API_KEY before using Tavily.",
    );
  }

  if (!client) {
    client = tavily({ apiKey });
  }

  return client;
}

function formatSourceLabel(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "web";
  }
}

function canonicalizeUrl(url: string) {
  try {
    const parsed = new URL(url);

    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return url;
  }
}

function formatSummary(summary: string | undefined) {
  if (!summary) return null;

  return summary.replace(/\s+/g, " ").trim();
}

function compactText(text: string | null | undefined, limit = 220) {
  if (!text) return "";

  return text.replace(/\s+/g, " ").trim().slice(0, limit);
}

function extractMemoryKeywords(memoryContext: string) {
  const keywords = [
    "diabetes",
    "blood pressure",
    "hypertension",
    "cholesterol",
    "neuropathy",
    "heart failure",
    "heart disease",
    "kidney disease",
    "asthma",
    "copay",
    "insurance",
    "adherence",
    "refill",
    "side effects",
    "caregiver",
    "transportation",
    "pharmacy",
    "coverage",
    "prior authorization",
    "fixed income",
  ];

  return keywords.filter((keyword) =>
    memoryContext.toLowerCase().includes(keyword),
  );
}

export function buildMedicationSavingsContext(input: {
  patientName: string;
  language: string;
  drugName: string;
  dose?: string | null;
  frequency?: string | null;
  symptoms?: string[];
  memoryContext?: PatientMemoryContext | null;
}) {
  const symptomSummary = (input.symptoms ?? []).slice(0, 3).join(", ");
  const memorySummary = input.memoryContext?.combinedSummary ?? "";
  const memoryKeywords = extractMemoryKeywords(memorySummary).slice(0, 4);
  const parts = [
    `${input.patientName} profile`,
    input.language ? `language ${input.language}` : null,
    input.dose ? `dose ${input.dose}` : null,
    input.frequency ? `frequency ${input.frequency}` : null,
    symptomSummary ? `symptoms ${symptomSummary}` : null,
    input.memoryContext?.profileSummary
      ? `profile ${compactText(input.memoryContext.profileSummary, 140)}`
      : null,
    input.memoryContext?.affordabilitySummary
      ? `affordability ${compactText(input.memoryContext.affordabilitySummary, 140)}`
      : null,
    input.memoryContext?.adherenceSummary
      ? `adherence ${compactText(input.memoryContext.adherenceSummary, 140)}`
      : null,
    input.memoryContext?.clinicalSummary
      ? `history ${compactText(input.memoryContext.clinicalSummary, 140)}`
      : null,
    memoryKeywords.length ? `memory ${memoryKeywords.join(", ")}` : null,
  ].filter(Boolean);

  return parts.join(" | ");
}

export function buildMedicationSavingsQuery(input: {
  drugName: string;
  dose?: string | null;
  symptoms?: string[];
  memoryContext?: PatientMemoryContext | null;
}) {
  const currentYear = new Date().getFullYear();
  const combinedMemory = input.memoryContext?.combinedSummary ?? "";
  const contextTerms = [
    ...(input.symptoms ?? []).slice(0, 2),
    ...extractMemoryKeywords(combinedMemory).slice(0, 4),
  ];
  const supportTerms = [
    input.memoryContext?.affordabilitySummary ? "financial assistance" : "",
    input.memoryContext?.adherenceSummary ? "adherence support" : "",
    input.memoryContext?.clinicalSummary ? "condition-specific savings" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return [
    "current",
    currentYear,
    input.drugName,
    input.dose ?? "",
    "coupon discount copay card patient assistance savings price manufacturer program",
    supportTerms,
    contextTerms.join(" "),
  ]
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function searchMedSavings(input: {
  medicationId?: string | null;
  drugName: string;
  dose?: string | null;
  patientName: string;
  language: string;
  symptoms?: string[];
  memoryContext?: PatientMemoryContext | null;
}): Promise<MedicationSavings | null> {
  try {
    const client = getTavilyClient();
    const query = buildMedicationSavingsQuery({
      drugName: input.drugName,
      dose: input.dose,
      symptoms: input.symptoms,
      memoryContext: input.memoryContext,
    });
    const contextSummary = buildMedicationSavingsContext({
      patientName: input.patientName,
      language: input.language,
      drugName: input.drugName,
      dose: input.dose,
      symptoms: input.symptoms,
      memoryContext: input.memoryContext,
    });
    const res = await client.search(query, {
      searchDepth: "advanced",
      maxResults: 5,
      includeDomains: [
        "goodrx.com",
        "singlecare.com",
        "rxsaver.com",
        "wellrx.com",
        "needymeds.org",
        "drugs.com",
      ],
    });

    const links = Array.from(
      new Map(
        (res.results ?? [])
          .map((result): SavingsLink | null =>
            result.url && result.title
              ? {
                  title: result.title,
                  url: result.url,
                  summary:
                    formatSummary(result.content) ??
                    compactText(contextSummary, 120),
                  source: formatSourceLabel(result.url),
                }
              : null,
          )
          .filter((result): result is SavingsLink => result !== null)
          .map((result) => [canonicalizeUrl(result.url), result]),
      ).values(),
    );

    if (!links.length) return null;

    return {
      medicationId: input.medicationId ?? null,
      drugName: input.drugName,
      contextSummary,
      query,
      links,
      fetchedAt: new Date().toISOString(),
      source: "tavily",
    };
  } catch {
    return null;
  }
}
