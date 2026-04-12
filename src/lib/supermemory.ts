import Supermemory from "supermemory";

let client: Supermemory | null = null;

export interface PatientMemoryContext {
  profileSummary: string;
  affordabilitySummary: string;
  adherenceSummary: string;
  clinicalSummary: string;
  combinedSummary: string;
}

function getSupermemoryClient() {
  const apiKey = process.env.SUPERMEMORY_API_KEY;

  if (!apiKey) {
    throw new Error(
      "Missing SUPERMEMORY_API_KEY. Set SUPERMEMORY_API_KEY before using Supermemory features.",
    );
  }

  if (!client) {
    client = new Supermemory({ apiKey });
  }

  return client;
}

export async function addMemory(
  patientId: string,
  content: string,
): Promise<void> {
  const client = getSupermemoryClient();

  await client.add({ content, metadata: { patientId } });
}

export async function queryMemory(
  patientId: string,
  query: string,
): Promise<string> {
  try {
    const client = getSupermemoryClient();
    const res = await client.search.execute({
      q: query,
      filters: {
        AND: [{ key: "patientId", value: patientId, filterType: "metadata" }],
      },
      limit: 5,
    });

    return (res.results ?? [])
      .map((r) => {
        if (r.content) {
          return r.content;
        }

        if (Array.isArray(r.chunks)) {
          return r.chunks
            .map((chunk) => chunk.content ?? "")
            .filter(Boolean)
            .join("\n");
        }

        return "";
      })
      .filter(Boolean)
      .join("\n");
  } catch {
    return "";
  }
}

function normalizeMemoryText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function uniqueSentences(text: string, limit = 2) {
  const seen = new Set<string>();

  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => normalizeMemoryText(sentence))
    .filter(Boolean)
    .filter((sentence) => {
      const key = sentence.toLowerCase();

      if (seen.has(key)) return false;
      seen.add(key);

      return true;
    })
    .slice(0, limit);
}

function compactMemorySection(text: string, limit = 2) {
  return uniqueSentences(text, limit).join(" ");
}

export async function getPatientMemoryContext(
  patientId: string,
): Promise<PatientMemoryContext> {
  const [
    profileSummary,
    affordabilitySummary,
    adherenceSummary,
    clinicalSummary,
  ] = await Promise.all([
    queryMemory(
      patientId,
      "patient profile chronic conditions demographics family support care goals",
    ),
    queryMemory(
      patientId,
      "medication affordability insurance copay coupons pharmacy cost barriers financial concerns",
    ),
    queryMemory(
      patientId,
      "medication adherence refill issues side effects missed doses patient preferences routines barriers",
    ),
    queryMemory(
      patientId,
      "recent symptoms timeline recent appointments recent care updates complications",
    ),
  ]);

  const compactProfile = compactMemorySection(profileSummary);
  const compactAffordability = compactMemorySection(affordabilitySummary);
  const compactAdherence = compactMemorySection(adherenceSummary);
  const compactClinical = compactMemorySection(clinicalSummary);
  const combinedSummary = [
    compactProfile,
    compactAffordability,
    compactAdherence,
    compactClinical,
  ]
    .filter(Boolean)
    .join(" | ");

  return {
    profileSummary: compactProfile,
    affordabilitySummary: compactAffordability,
    adherenceSummary: compactAdherence,
    clinicalSummary: compactClinical,
    combinedSummary,
  };
}
