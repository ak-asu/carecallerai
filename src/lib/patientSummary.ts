import type { DashboardDataPayload } from "@/lib/dashboardData";
import type { Language } from "@/types";

function normalizeLocale(locale: string): Language {
  return locale === "es" ? "es" : "en";
}

function formatDateTime(value: string, locale: Language) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function toSpeechDose(value: string, locale: Language) {
  return locale === "es"
    ? value.replace(/\bmg\b/gi, "miligramos")
    : value.replace(/\bmg\b/gi, "milligrams");
}

function joinList(values: string[], locale: Language) {
  if (!values.length) return "";
  if (values.length === 1) return values[0];

  const conjunction = locale === "es" ? " y " : " and ";

  return `${values.slice(0, -1).join(", ")}${conjunction}${values[values.length - 1]}`;
}

function truncate(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;

  return `${value.slice(0, maxLength).trimEnd()}...`;
}

export function buildPatientSummary(
  dashboardData: DashboardDataPayload,
  localeValue: string,
) {
  const locale = normalizeLocale(localeValue);
  const { patient, medications, appointments, escalations, symptoms, messages } =
    dashboardData;

  const appointment = appointments[0] ?? null;
  const medicationList = medications.slice(0, 3).map((medication) => {
    const dose = toSpeechDose(medication.dose, locale);

    return locale === "es"
      ? `${medication.drug_name_normalized}, ${dose}, ${medication.frequency}`
      : `${medication.drug_name_normalized}, ${dose}, ${medication.frequency}`;
  });
  const medicationSuffix =
    medications.length > 3
      ? locale === "es"
        ? `, y ${medications.length - 3} mas`
        : `, plus ${medications.length - 3} more`
      : "";
  const symptomsText = symptoms.length
    ? joinList(symptoms.slice(0, 3).map((symptom) => symptom.symptom_name), locale)
    : locale === "es"
      ? "no hay sintomas activos registrados"
      : "there are no active symptoms logged";
  const escalationText =
    escalations.length > 0
      ? locale === "es"
        ? `${escalations.length} escalacion${escalations.length === 1 ? "" : "es"} pendiente${escalations.length === 1 ? "" : "s"}`
        : `${escalations.length} open escalation${escalations.length === 1 ? "" : "s"}`
      : locale === "es"
        ? "sin escalaciones activas"
        : "no active escalations";
  const appointmentText = appointment
    ? locale === "es"
      ? `La proxima cita es el ${formatDateTime(appointment.datetime, locale)} con ${appointment.doctors?.name ?? "tu equipo de atencion"}.`
      : `The next appointment is ${formatDateTime(appointment.datetime, locale)} with ${appointment.doctors?.name ?? "your care team"}.`
    : locale === "es"
      ? "No hay una cita futura programada."
      : "There is no upcoming appointment scheduled.";
  const lastCallText = dashboardData.lastCall?.summary
    ? locale === "es"
      ? `El resumen de la ultima llamada dice: ${truncate(dashboardData.lastCall.summary, 180)}`
      : `The latest call summary says: ${truncate(dashboardData.lastCall.summary, 180)}`
    : locale === "es"
      ? "Todavia no hay un resumen de llamada guardado."
      : "There is no saved call summary yet.";
  const messageText =
    locale === "es"
      ? `Hay ${messages.pendingCount} mensaje${messages.pendingCount === 1 ? "" : "s"} pendiente${messages.pendingCount === 1 ? "" : "s"} para el equipo.`
      : `There ${messages.pendingCount === 1 ? "is" : "are"} ${messages.pendingCount} pending patient message${messages.pendingCount === 1 ? "" : "s"} for the team.`;
  const savingsText =
    dashboardData.liveSavings.length > 0
      ? locale === "es"
        ? `Tambien hay informacion de ahorro disponible para ${dashboardData.liveSavings.length} medicamento${dashboardData.liveSavings.length === 1 ? "" : "s"}.`
        : `There is also cost support information available for ${dashboardData.liveSavings.length} medication${dashboardData.liveSavings.length === 1 ? "" : "s"}.`
      : "";

  if (locale === "es") {
    return [
      `Este es el resumen de atencion de ${patient.name_alias}.`,
      `La severidad actual es ${patient.severity_score} de 10, con ${escalationText}.`,
      medications.length
        ? `Los medicamentos activos incluyen ${joinList(medicationList, locale)}${medicationSuffix}.`
        : "No hay medicamentos activos registrados en este momento.",
      symptoms.length
        ? `Los sintomas activos incluyen ${symptomsText}.`
        : "No hay sintomas activos registrados en este momento.",
      appointmentText,
      lastCallText,
      messageText,
      savingsText,
    ]
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  }

  return [
    `Here is the current care summary for ${patient.name_alias}.`,
    `The current severity score is ${patient.severity_score} out of 10, with ${escalationText}.`,
    medications.length
      ? `Active medications include ${joinList(medicationList, locale)}${medicationSuffix}.`
      : "There are no active medications recorded right now.",
    symptoms.length
      ? `Active symptoms include ${symptomsText}.`
      : "There are no active symptoms logged right now.",
    appointmentText,
    lastCallText,
    messageText,
    savingsText,
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}
