// RxNorm-style drug dictionary (subset for demo — extend as needed)
const DRUG_DICT: Record<string, string> = {
  lexapro: 'Lexapro', escitalopram: 'Escitalopram',
  metoprolol: 'Metoprolol', lopressor: 'Metoprolol',
  lisinopril: 'Lisinopril', zestril: 'Lisinopril',
  warfarin: 'Warfarin', coumadin: 'Warfarin',
  amlodipine: 'Amlodipine', norvasc: 'Amlodipine',
  lasix: 'Furosemide', furosemide: 'Furosemide',
  metformin: 'Metformin', glucophage: 'Metformin',
  atorvastatin: 'Atorvastatin', lipitor: 'Atorvastatin',
  omeprazole: 'Omeprazole', prilosec: 'Omeprazole',
  sertraline: 'Sertraline', zoloft: 'Sertraline',
  gabapentin: 'Gabapentin', neurontin: 'Gabapentin',
}

const TEXT_NUMBERS: Record<string, string> = {
  one: '1', two: '2', three: '3', four: '4', five: '5',
  six: '6', seven: '7', eight: '8', nine: '9', ten: '10',
  fifteen: '15', twenty: '20', twentyfive: '25', thirty: '30',
  forty: '40', fifty: '50', hundred: '100',
}

const FREQUENCY_MAP: Record<string, string> = {
  'once a day': 'QD', 'once daily': 'QD', 'one time a day': 'QD',
  'twice a day': 'BID', 'twice daily': 'BID', 'two times a day': 'BID',
  'three times a day': 'TID', 'thrice daily': 'TID',
  'four times a day': 'QID',
  'every night': 'QHS', 'at bedtime': 'QHS',
}

const SAFETY_TERMS = [
  'chest pain', 'chest tightness', 'shortness of breath', "can't breathe",
  'cannot breathe', 'difficulty breathing', 'stroke', 'facial drooping',
  'arm weakness', 'slurred speech', 'suicidal', 'want to die', 'hurt myself',
  'kill myself', 'allergic reaction', 'anaphylaxis', 'severe bleeding',
  'unconscious', 'seizure', 'heart attack',
]

const NEGATION_PATTERNS = [
  /\bno longer\b/i, /\bdon'?t have\b/i, /\bdo not have\b/i,
  /\bstopped? taking\b/i, /\bstopped?\b/i, /\bnot taking\b/i,
  /\bnever had\b/i, /\bwithout\b/i, /\bdenies?\b/i,
  /\bno\s+(chest|pain|breath|symptom)/i,
]

export function normalizeDose(text: string): string {
  let result = text.toLowerCase()

  // Replace text numbers
  for (const [word, num] of Object.entries(TEXT_NUMBERS)) {
    result = result.replace(new RegExp(`\\b${word}\\b`, 'gi'), num)
  }

  // Normalize units
  result = result
    .replace(/milligrams?/gi, 'mg')
    .replace(/micrograms?/gi, 'mcg')
    .replace(/milliliters?/gi, 'mL')
    .replace(/units?/gi, 'units')
    .replace(/(\d)\s*mg/gi, '$1 mg')

  // Normalize frequency
  for (const [phrase, abbr] of Object.entries(FREQUENCY_MAP)) {
    result = result.replace(new RegExp(phrase, 'gi'), abbr)
  }

  return result.trim()
}

export function isNegated(text: string): boolean {
  return NEGATION_PATTERNS.some((pattern) => pattern.test(text))
}

export function isSafetyCandidate(text: string): boolean {
  const lower = text.toLowerCase()
  return SAFETY_TERMS.some((term) => lower.includes(term))
}

export function extractDrugCandidates(text: string): string[] {
  const lower = text.toLowerCase()
  const found: string[] = []
  for (const [key, normalized] of Object.entries(DRUG_DICT)) {
    if (lower.includes(key) && !found.includes(normalized)) {
      found.push(normalized)
    }
  }
  return found
}

export function normalizeDrugName(raw: string): string {
  return DRUG_DICT[raw.toLowerCase()] ?? raw
}

// Confidence: average of word STT confidences, boosted if drug found in dict
export function computeConfidence(
  wordConfidences: number[],
  foundInDict: boolean
): number {
  const avg = wordConfidences.length > 0
    ? wordConfidences.reduce((a, b) => a + b, 0) / wordConfidences.length
    : 0.5
  return Math.min(1, foundInDict ? avg + 0.15 : avg)
}
