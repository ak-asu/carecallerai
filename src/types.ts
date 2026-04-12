import type { SVGProps } from "react";

export type Language = "en" | "es";
export type EntitySource =
  | "stt_inferred"
  | "context_enriched"
  | "patient_verified"
  | "clinician_verified";
export type EntityType = "drug" | "dose" | "symptom" | "date" | "appointment";
export type ActionTaken =
  | "accepted"
  | "clarified"
  | "escalated"
  | "human_review"
  | "propose_alternatives";
export type CallType = "inbound" | "outbound";
export type CallStatus = "scheduled" | "in_progress" | "completed" | "failed";
export type AppointmentStatus =
  | "scheduled"
  | "confirmed"
  | "rescheduled"
  | "cancelled";
export type EscalationStatus = "pending" | "acknowledged" | "resolved";
export type IconSvgProps = SVGProps<SVGSVGElement> & {
  size?: number;
};

export interface Patient {
  id: string;
  token: string;
  name_alias: string;
  language: Language;
  phone: string;
  severity_score: number;
  created_at: string;
  last_call_at: string | null;
}

export interface Medication {
  id: string;
  patient_id: string;
  drug_name: string;
  drug_name_normalized: string;
  dose: string;
  frequency: string;
  start_date: string;
  end_date: string | null;
  source: EntitySource;
  active: boolean;
  verified_at: string | null;
}

export interface SavingsLink {
  title: string;
  url: string;
  summary?: string | null;
  source?: string | null;
}

export interface MedicationSavings {
  medicationId?: string | null;
  drugName: string;
  contextSummary?: string | null;
  query?: string | null;
  links: SavingsLink[];
  fetchedAt: string | null;
  source: "tavily" | "timeline" | "stored";
}

export interface Appointment {
  id: string;
  patient_id: string;
  doctor_id: string;
  datetime: string;
  status: AppointmentStatus;
  reschedule_reason: string | null;
  conflict_detected: boolean;
  google_calendar_event_id: string | null;
  updated_at: string;
}

export interface AppointmentWithDoctor extends Appointment {
  doctors: { name: string; specialty: string } | null;
}

export interface Doctor {
  id: string;
  name: string;
  specialty: string;
  phone: string;
  google_calendar_id: string | null;
  availability_last_synced: string | null;
  location_miles?: number | null;
}

export interface RecommendedAppointmentSlot {
  id: string;
  starts_at: string;
  ends_at: string;
}

export interface DoctorRecommendation {
  schedule_id: string;
  doctor_id: string | null;
  doctor_name: string;
  specialty: string;
  google_calendar_id: string;
  distance_miles: number;
  matched_symptoms: string[];
  next_available_at: string | null;
  slots: RecommendedAppointmentSlot[];
}

export interface Call {
  id: string;
  patient_id: string;
  vapi_call_id: string;
  type: CallType;
  status: CallStatus;
  intent: string;
  severity_score: number;
  transcript: string | null;
  summary: string | null;
  started_at: string;
  ended_at: string | null;
  language: Language;
}

export interface CallSession {
  call_id: string;
  patient_id: string;
  context: {
    memory: string;
    meds: Medication[];
    appointments: Appointment[];
  };
  created_at: string;
}

export interface ExtractedEntity {
  type: EntityType;
  value_raw: string;
  value_normalized: string;
  confidence: number;
  negated: boolean;
  source: EntitySource;
}

export interface GroqExtractionResult {
  entities: ExtractedEntity[];
  contradiction: {
    detected: boolean;
    field?: string;
    heard?: string;
    record?: string;
  };
  safety_trigger: { detected: boolean; term?: string; negated?: boolean };
  action: ActionTaken;
  clarification_text: string | null;
  response_text: string;
}

export interface TimelineEvent {
  id: string;
  patient_id: string;
  event_type: string;
  content: Record<string, unknown>;
  severity: number;
  flagged: boolean;
  source: EntitySource;
  created_at: string;
}

export interface Escalation {
  id: string;
  patient_id: string;
  call_id: string;
  trigger_term: string;
  context_summary: string;
  severity: number;
  status: EscalationStatus;
  clinician_notified_at: string | null;
  created_at: string;
}

export interface Symptom {
  id: string;
  patient_id: string | null;
  call_id: string | null;
  symptom_name: string;
  severity: number | null;
  onset_date: string | null;
  resolved: boolean | null;
  flagged_to_clinician: boolean | null;
}
