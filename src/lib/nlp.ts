import { DoubleMetaphone, LevenshteinDistance } from "natural";

import DRUG_DICT_RAW from "./data/rxnorm-drugs.json";

// Expanded RxNorm drug dictionary — ~200 generic + brand names
const DRUG_DICT: Record<string, string> = DRUG_DICT_RAW as Record<string, string>;

// Pre-compute phonetic encodings for all dict keys (done once at module load)
const DRUG_PHONETICS: Array<[string, string, string]> = Object.keys(DRUG_DICT).map(
  (key) => {
    const [primary] = new DoubleMetaphone().process(key);
    return [key, primary ?? "", DRUG_DICT[key]];
  }
);

const TEXT_NUMBERS: Record<string, string> = {
  one: "1",
  two: "2",
  three: "3",
  four: "4",
  five: "5",
  six: "6",
  seven: "7",
  eight: "8",
  nine: "9",
  ten: "10",
  eleven: "11",
  twelve: "12",
  thirteen: "13",
  fifteen: "15",
  sixteen: "16",
  seventeen: "17",
  eighteen: "18",
  nineteen: "19",
  twenty: "20",
  twentyfive: "25",
  thirty: "30",
  forty: "40",
  fifty: "50",
  sixty: "60",
  seventy: "70",
  eighty: "80",
  ninety: "90",
  hundred: "100",
};

const FREQUENCY_MAP: Record<string, string> = {
  "once a day": "QD",
  "once daily": "QD",
  "one time a day": "QD",
  "twice a day": "BID",
  "twice daily": "BID",
  "two times a day": "BID",
  "three times a day": "TID",
  "thrice daily": "TID",
  "four times a day": "QID",
  "every night": "QHS",
  "at bedtime": "QHS",
};

const SAFETY_TERMS = [
  "chest pain",
  "chest tightness",
  "shortness of breath",
  "can't breathe",
  "cannot breathe",
  "difficulty breathing",
  "stroke",
  "facial drooping",
  "arm weakness",
  "slurred speech",
  "suicidal",
  "want to die",
  "hurt myself",
  "kill myself",
  "allergic reaction",
  "anaphylaxis",
  "severe bleeding",
  "unconscious",
  "seizure",
  "heart attack",
];

const NEGATION_PATTERNS = [
  /\bno longer\b/i,
  /\bdon'?t have\b/i,
  /\bdo not have\b/i,
  /\bstopped? taking\b/i,
  /\bstopped?\b/i,
  /\bnot taking\b/i,
  /\bnever had\b/i,
  /\bwithout\b/i,
  /\bdenies?\b/i,
  /\bno\s+(chest|pain|breath|symptom)/i,
];

// Acoustically confusable dose/count pairs at 8kHz telephony.
// Both members of each pair are flagged — the downstream context layer resolves.
const NUMERIC_AMBIGUOUS_PATTERNS: Array<[RegExp, string]> = [
  [/\b(fifteen|fifty)\s*(mg|mcg|units?|ml|milligrams?|micrograms?|tablets?)\b/gi, "NUMERIC_AMBIGUOUS"],
  [/\b(fourteen|forty)\s*(mg|mcg|units?|ml|milligrams?|micrograms?|tablets?)\b/gi, "NUMERIC_AMBIGUOUS"],
  [/\b(nineteen|ninety)\s*(mg|mcg|units?|ml|milligrams?|micrograms?|tablets?)\b/gi, "NUMERIC_AMBIGUOUS"],
  [/\b(eighteen|eighty)\s*(mg|mcg|units?|ml|milligrams?|micrograms?|tablets?)\b/gi, "NUMERIC_AMBIGUOUS"],
  [/\b(thirteen|thirty)\s*(mg|mcg|units?|ml|milligrams?|micrograms?|tablets?)\b/gi, "NUMERIC_AMBIGUOUS"],
  [/\b(sixteen|sixty)\s*(mg|mcg|units?|ml|milligrams?|micrograms?|tablets?)\b/gi, "NUMERIC_AMBIGUOUS"],
];

export function normalizeDose(text: string): string {
  let result = text.toLowerCase();

  for (const [word, num] of Object.entries(TEXT_NUMBERS)) {
    result = result.replace(new RegExp(`\\b${word}\\b`, "gi"), num);
  }

  result = result
    .replace(/milligrams?/gi, "mg")
    .replace(/micrograms?/gi, "mcg")
    .replace(/milliliters?/gi, "mL")
    .replace(/units?/gi, "units")
    .replace(/(\d)\s*mg/gi, "$1 mg");

  for (const [phrase, abbr] of Object.entries(FREQUENCY_MAP)) {
    result = result.replace(new RegExp(phrase, "gi"), abbr);
  }

  return result.trim();
}

export function isNegated(text: string): boolean {
  return NEGATION_PATTERNS.some((pattern) => pattern.test(text));
}

export function isSafetyCandidate(text: string): boolean {
  const lower = text.toLowerCase();
  return SAFETY_TERMS.some((term) => lower.includes(term));
}

export function extractDrugCandidates(text: string): string[] {
  const lower = text.toLowerCase();
  const found: string[] = [];

  for (const [key, normalized] of Object.entries(DRUG_DICT)) {
    if (lower.includes(key) && !found.includes(normalized)) {
      found.push(normalized);
    }
  }

  return found;
}

export function normalizeDrugName(raw: string): string {
  const lower = raw.toLowerCase().trim();

  // Stage 1: exact dict lookup
  if (DRUG_DICT[lower]) return DRUG_DICT[lower];

  // Stage 2: phonetic match (DoubleMetaphone)
  const [rawPrimary] = new DoubleMetaphone().process(lower);
  if (rawPrimary) {
    for (const [_key, keyPrimary, normalized] of DRUG_PHONETICS) {
      if (keyPrimary && rawPrimary === keyPrimary) return normalized;
    }
  }

  // Stage 3: Levenshtein distance <= 2 (catches minor transcription errors)
  for (const [key, , normalized] of DRUG_PHONETICS) {
    if (LevenshteinDistance(lower, key) <= 2) return normalized;
  }

  return raw;
}

/**
 * Flag acoustically ambiguous numeric dose quantities.
 * Replaces the numeric word with NUMERIC_AMBIGUOUS token.
 * These always route to Layer 3 for context-based resolution.
 */
export function flagNumericAmbiguity(text: string): string {
  let result = text;
  for (const [pattern, replacement] of NUMERIC_AMBIGUOUS_PATTERNS) {
    result = result.replace(pattern, (_match, _numWord, unit) => `${replacement} ${unit}`);
  }
  return result;
}

// Confidence: average of word STT confidences, boosted if drug found in dict
export function computeConfidence(
  wordConfidences: number[],
  foundInDict: boolean,
): number {
  const avg =
    wordConfidences.length > 0
      ? wordConfidences.reduce((a, b) => a + b, 0) / wordConfidences.length
      : 0.5;

  return Math.min(1, foundInDict ? avg + 0.15 : avg);
}
