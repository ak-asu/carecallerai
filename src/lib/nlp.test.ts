import { describe, it, expect } from "vitest";

import {
  normalizeDose,
  isNegated,
  isSafetyCandidate,
  extractDrugCandidates,
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

    expect(result).toContain("Lexapro");
    expect(result).toContain("Metoprolol");
  });
});
