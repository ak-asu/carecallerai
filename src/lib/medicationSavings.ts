import type { Medication, MedicationSavings, Patient, Symptom } from "@/types";
import type { Json } from "@/lib/database.types";

import { getPatientMemoryContext } from "@/lib/supermemory";
import { supabaseAdmin } from "@/lib/supabase";
import { searchMedSavings } from "@/lib/tavily";

const SAVINGS_STALE_MS = 1000 * 60 * 60 * 12;

type MedicationSavingsRow = {
  id: string;
  patient_id: string;
  medication_id: string | null;
  drug_name: string;
  context_summary: string | null;
  tavily_query: string;
  links: unknown;
  source: string;
  fetched_at: string;
  updated_at: string;
};

function normalizeLinks(input: unknown) {
  if (!Array.isArray(input)) return [];

  return input
    .map((link) => {
      const record = link as Record<string, unknown>;

      if (typeof record.url !== "string" || typeof record.title !== "string") {
        return null;
      }

      return {
        url: record.url,
        title: record.title,
        summary:
          typeof record.summary === "string" ? record.summary : undefined,
        source: typeof record.source === "string" ? record.source : undefined,
      };
    })
    .filter((link): link is NonNullable<typeof link> => link !== null);
}

function rowToSavings(row: MedicationSavingsRow): MedicationSavings {
  return {
    medicationId: row.medication_id,
    drugName: row.drug_name,
    contextSummary: row.context_summary,
    query: row.tavily_query,
    links: normalizeLinks(row.links),
    fetchedAt: row.fetched_at,
    source: row.source === "tavily" ? "tavily" : "stored",
  };
}

function isFresh(fetchedAt: string | null | undefined) {
  if (!fetchedAt) return false;

  return Date.now() - new Date(fetchedAt).getTime() < SAVINGS_STALE_MS;
}

export async function getMedicationSavingsForPatient(input: {
  patient: Pick<Patient, "id" | "name_alias" | "language">;
  medications: Array<{
    id: Medication["id"];
    drug_name_normalized: string | null;
    drug_name: string;
    dose: string | null;
    active: boolean | null;
  }>;
  symptoms: Pick<Symptom, "symptom_name">[];
}) {
  const activeMedications = input.medications.filter(
    (medication) =>
      medication.active !== false &&
      (medication.drug_name_normalized?.trim() || medication.drug_name.trim()),
  );

  if (!activeMedications.length) return [];

  const { data: existingRows } = await supabaseAdmin
    .from("medication_savings")
    .select(
      "id, patient_id, medication_id, drug_name, context_summary, tavily_query, links, source, fetched_at, updated_at",
    )
    .eq("patient_id", input.patient.id)
    .order("fetched_at", { ascending: false });

  const existingByMedication = new Map<string, MedicationSavingsRow>();

  for (const row of (existingRows ?? []) as MedicationSavingsRow[]) {
    const medicationId = row.medication_id;

    if (!medicationId || existingByMedication.has(medicationId)) continue;
    existingByMedication.set(medicationId, row);
  }

  const memoryContext = await getPatientMemoryContext(input.patient.id);
  const symptomNames = input.symptoms.map((symptom) => symptom.symptom_name);
  const results: MedicationSavings[] = [];

  for (const medication of activeMedications) {
    const existing = existingByMedication.get(medication.id);

    if (existing && isFresh(existing.fetched_at)) {
      results.push(rowToSavings(existing));
      continue;
    }

    const liveSavings = await searchMedSavings({
      medicationId: medication.id,
      drugName:
        medication.drug_name_normalized?.trim() || medication.drug_name.trim(),
      dose: medication.dose,
      patientName: input.patient.name_alias,
      language: input.patient.language,
      symptoms: symptomNames,
      memoryContext,
    });

    if (!liveSavings) {
      if (existing) {
        results.push(rowToSavings(existing));
      }
      continue;
    }

    await supabaseAdmin.from("medication_savings").upsert(
      {
        patient_id: input.patient.id,
        medication_id: medication.id,
        drug_name: liveSavings.drugName,
        context_summary: liveSavings.contextSummary ?? null,
        tavily_query: liveSavings.query ?? liveSavings.drugName,
        links: liveSavings.links as unknown as Json,
        source: "tavily",
        fetched_at: liveSavings.fetchedAt ?? new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "patient_id,medication_id,source" },
    );

    results.push(liveSavings);
  }

  return results;
}
