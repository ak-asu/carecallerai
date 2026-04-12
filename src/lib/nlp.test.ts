import { describe, it, expect } from "vitest";

import {
  normalizeDose,
  isNegated,
  isSafetyCandidate,
  extractDrugCandidates,
  normalizeDrugName,
  flagNumericAmbiguity,
  computeConfidence,
} from "./nlp";

describe("normalizeDose", () => {
  it("converts text numbers to digits", () => {
    expect(normalizeDose("ten milligrams")).toBe("10 mg");
    expect(normalizeDose("five milligrams once a day")).toBe("5 mg QD");
    expect(normalizeDose("twenty mg twice daily")).toBe("20 mg BID");
    expect(normalizeDose("10mg")).toBe("10 mg");
  });
});

describe("isNegated", () => {
  it("detects negation patterns", () => {
    expect(isNegated("I don't have chest pain")).toBe(true);
    expect(isNegated("I no longer take Lexapro")).toBe(true);
    expect(isNegated("I stopped taking metoprolol")).toBe(true);
    expect(isNegated("I have chest pain")).toBe(false);
    expect(isNegated("I am taking Lexapro")).toBe(false);
  });
});

describe("isSafetyCandidate", () => {
  it("flags high-risk phrases", () => {
    expect(isSafetyCandidate("I have chest pain")).toBe(true);
    expect(isSafetyCandidate("I can't breathe")).toBe(true);
    expect(isSafetyCandidate("I want to hurt myself")).toBe(true);
    expect(isSafetyCandidate("I feel a bit tired")).toBe(false);
  });
});

describe("extractDrugCandidates", () => {
  it("finds known drug names", () => {
    const result = extractDrugCandidates("I take lexapro and metoprolol");

    expect(result).toContain("Escitalopram");
    expect(result).toContain("Metoprolol");
  });

  it("finds brand names from expanded dict", () => {
    const result = extractDrugCandidates("I need a refill for Ozempic");

    expect(result).toContain("Semaglutide");
  });
});

describe("normalizeDrugName", () => {
  it("exact match returns canonical name", () => {
    expect(normalizeDrugName("warfarin")).toBe("Warfarin");
    expect(normalizeDrugName("lipitor")).toBe("Atorvastatin");
  });

  it("phonetic match catches STT near-misses", () => {
    // 'lasix' vs 'fasix' — same phonetic encoding
    expect(normalizeDrugName("fasix")).toBe("Furosemide");
    // 'lexapro' vs 'lexipro'
    expect(normalizeDrugName("lexipro")).toBe("Escitalopram");
  });

  it("levenshtein match catches minor typos", () => {
    // 'warfarin' vs 'warfarn' (distance 1)
    expect(normalizeDrugName("warfarn")).toBe("Warfarin");
  });

  it("unknown drug returns original", () => {
    expect(normalizeDrugName("unknowndrug")).toBe("unknowndrug");
  });
});

describe("flagNumericAmbiguity", () => {
  it("flags fifteen/fifty confusion", () => {
    expect(flagNumericAmbiguity("take fifty mg once a day")).toBe(
      "take NUMERIC_AMBIGUOUS mg once a day",
    );
    expect(flagNumericAmbiguity("take fifteen mg once a day")).toBe(
      "take NUMERIC_AMBIGUOUS mg once a day",
    );
  });

  it("flags forty/fourteen confusion", () => {
    expect(flagNumericAmbiguity("forty units of insulin")).toBe(
      "NUMERIC_AMBIGUOUS units of insulin",
    );
    expect(flagNumericAmbiguity("fourteen units of insulin")).toBe(
      "NUMERIC_AMBIGUOUS units of insulin",
    );
  });

  it("flags ninety/nineteen confusion", () => {
    expect(flagNumericAmbiguity("ninety mg daily")).toBe(
      "NUMERIC_AMBIGUOUS mg daily",
    );
    expect(flagNumericAmbiguity("nineteen mg daily")).toBe(
      "NUMERIC_AMBIGUOUS mg daily",
    );
  });

  it("does not flag unambiguous numeric values", () => {
    expect(flagNumericAmbiguity("ten mg once a day")).toBe("ten mg once a day");
    expect(flagNumericAmbiguity("100 mg twice daily")).toBe(
      "100 mg twice daily",
    );
  });
});

describe("computeConfidence", () => {
  it("returns avg word confidence boosted by dict match", () => {
    const conf = computeConfidence([0.8, 0.9], true);

    expect(conf).toBeGreaterThan(0.9);
    expect(conf).toBeLessThanOrEqual(1.0);
  });

  it("returns avg without boost when not in dict", () => {
    const conf = computeConfidence([0.8, 0.9], false);

    expect(conf).toBeCloseTo(0.85, 1);
  });
});
