import type { Escalation, Symptom } from "@/types";

type SeverityInputs = {
  storedSeverity?: number | null;
  symptoms?: Array<{
    severity: Symptom["severity"] | null;
    flagged_to_clinician: Symptom["flagged_to_clinician"] | null;
  }>;
  escalations?: Array<{
    severity: Escalation["severity"] | null;
    status: string | null;
  }>;
};

function clampSeverity(value: number) {
  return Math.max(0, Math.min(10, Math.round(value)));
}

export function derivePatientSeverity({
  storedSeverity = 0,
  symptoms = [],
  escalations = [],
}: SeverityInputs): number {
  const activeEscalations = escalations.filter(
    (escalation) => escalation.status !== "resolved",
  );
  const escalationFloor = activeEscalations.reduce((highest, escalation) => {
    const next =
      typeof escalation.severity === "number" ? escalation.severity : 0;

    return Math.max(highest, clampSeverity(next));
  }, 0);

  const symptomSeverities = symptoms
    .map((symptom) =>
      typeof symptom.severity === "number"
        ? clampSeverity(symptom.severity)
        : 0,
    )
    .filter((severity) => severity > 0)
    .sort((left, right) => right - left);
  const flaggedSymptomFloor = symptoms.some(
    (symptom) => symptom.flagged_to_clinician,
  )
    ? 7
    : 0;

  if (!symptomSeverities.length) {
    if (escalationFloor > 0) return escalationFloor;

    return Math.min(clampSeverity(storedSeverity ?? 0), 3);
  }

  const topSymptoms = symptomSeverities.slice(0, 3);
  const averageTopSeverity =
    topSymptoms.reduce((sum, severity) => sum + severity, 0) /
    topSymptoms.length;
  const symptomLoadBonus =
    symptomSeverities.length >= 4 ? 2 : symptomSeverities.length >= 2 ? 1 : 0;
  const symptomScore = Math.max(
    symptomSeverities[0],
    clampSeverity(averageTopSeverity + symptomLoadBonus),
    flaggedSymptomFloor,
  );

  return Math.max(symptomScore, escalationFloor);
}
