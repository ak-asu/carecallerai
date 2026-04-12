import { describe, expect, it } from "vitest";

import { derivePatientSeverity } from "./patientSeverity";

describe("derivePatientSeverity", () => {
  it("uses active symptom severity instead of a stale stored patient score", () => {
    expect(
      derivePatientSeverity({
        storedSeverity: 10,
        symptoms: [{ severity: 4, flagged_to_clinician: false }],
        escalations: [],
      }),
    ).toBe(4);
  });

  it("raises severity when multiple unresolved symptoms stack up", () => {
    expect(
      derivePatientSeverity({
        storedSeverity: 2,
        symptoms: [
          { severity: 5, flagged_to_clinician: false },
          { severity: 4, flagged_to_clinician: false },
          { severity: 4, flagged_to_clinician: false },
        ],
        escalations: [],
      }),
    ).toBe(6);
  });

  it("keeps a high floor for clinician-flagged symptoms", () => {
    expect(
      derivePatientSeverity({
        storedSeverity: 1,
        symptoms: [
          { severity: 2, flagged_to_clinician: true },
          { severity: 3, flagged_to_clinician: false },
        ],
        escalations: [],
      }),
    ).toBe(7);
  });

  it("respects open escalations even when symptoms are mild", () => {
    expect(
      derivePatientSeverity({
        storedSeverity: 2,
        symptoms: [{ severity: 3, flagged_to_clinician: false }],
        escalations: [{ severity: 8, status: "pending" }],
      }),
    ).toBe(8);
  });

  it("drops to a mild fallback when there are no active symptoms", () => {
    expect(
      derivePatientSeverity({
        storedSeverity: 9,
        symptoms: [],
        escalations: [],
      }),
    ).toBe(3);
  });
});
