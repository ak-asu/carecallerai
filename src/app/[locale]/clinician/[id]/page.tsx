import type {
  AppointmentWithDoctor,
  Call,
  Doctor,
  Escalation,
  Patient,
  TimelineEvent,
} from "@/types";

import { supabaseAdmin } from "@/lib/supabase";
import { TimelineFeed } from "@/components/clinician/TimelineFeed";
import { EscalationCard } from "@/components/clinician/EscalationCard";
import { CallTranscriptView } from "@/components/clinician/CallTranscriptView";
import { DoctorPanel } from "@/components/clinician/DoctorPanel";
import { AppointmentEditor } from "@/components/clinician/AppointmentEditor";
import { PatientMessages } from "@/components/clinician/PatientMessages";
import { GlassBadge } from "@/components/ui/GlassBadge";

function severityColor(score: number): "red" | "amber" | "emerald" {
  if (score >= 7) return "red";
  if (score >= 4) return "amber";

  return "emerald";
}

interface PatientMessage {
  id: string;
  message: string;
  status: string;
  created_at: string;
}

export default async function ClinicianPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id } = await params;

  const [
    patientRes,
    timelineRes,
    escalationsRes,
    callsRes,
    apptsRes,
    messagesRes,
  ] = await Promise.all([
    supabaseAdmin.from("patients").select("*").eq("id", id).single(),
    supabaseAdmin
      .from("patient_timeline")
      .select("*")
      .eq("patient_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabaseAdmin
      .from("escalations")
      .select("*")
      .eq("patient_id", id)
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("calls")
      .select("*")
      .eq("patient_id", id)
      .eq("status", "completed")
      .order("ended_at", { ascending: false })
      .limit(5),
    supabaseAdmin
      .from("appointments")
      .select("*, doctors(*)")
      .eq("patient_id", id)
      .order("datetime"),
    supabaseAdmin
      .from("notifications")
      .select("id, message, status, created_at")
      .eq("patient_id", id)
      .eq("type", "patient_message")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const patient = patientRes.data as Patient | null;
  const timeline = (timelineRes.data ?? []) as TimelineEvent[];
  const escalations = (escalationsRes.data ?? []) as Escalation[];
  const calls = (callsRes.data ?? []) as Call[];
  const appointments = (apptsRes.data ?? []) as AppointmentWithDoctor[];
  const messages = (messagesRes.data ?? []) as PatientMessage[];

  // Deduplicate doctors by id
  const doctorMap = new Map<string, Doctor>();

  for (const appt of appointments) {
    if (appt.doctors && appt.doctor_id && !doctorMap.has(appt.doctor_id)) {
      doctorMap.set(appt.doctor_id, appt.doctors as unknown as Doctor);
    }
  }
  const doctors = Array.from(doctorMap.values());

  if (!patient)
    return <div className="p-8 text-white/50">Patient not found</div>;

  return (
    <div className="min-h-screen p-4 md:p-6 max-w-3xl mx-auto">
      {/* Patient header */}
      <div className="mb-6 flex items-start gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white">
            {patient.name_alias}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <GlassBadge color={severityColor(patient.severity_score)}>
              Severity {patient.severity_score}/10
            </GlassBadge>
            <span className="text-sm text-white/40">
              Last call:{" "}
              {patient.last_call_at
                ? new Date(patient.last_call_at).toLocaleString()
                : "never"}
            </span>
          </div>
        </div>
      </div>

      {/* Associated doctors */}
      <DoctorPanel doctors={doctors} />

      {/* Active escalations */}
      {escalations.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-3 text-sm font-medium text-red-400 uppercase tracking-wider">
            Active Escalations
          </h2>
          <div className="flex flex-col gap-2">
            {escalations.map((e) => (
              <EscalationCard key={e.id} escalation={e} />
            ))}
          </div>
        </section>
      )}

      {/* Appointment editor */}
      <AppointmentEditor appointments={appointments} patientId={id} />

      {/* Patient messages */}
      <PatientMessages messages={messages} />

      {/* Timeline */}
      <section className="mb-6">
        <h2 className="mb-3 text-sm font-medium text-white/50 uppercase tracking-wider">
          Patient Timeline
        </h2>
        <TimelineFeed events={timeline} />
      </section>

      {/* Recent calls */}
      <section>
        <h2 className="mb-3 text-sm font-medium text-white/50 uppercase tracking-wider">
          Recent Calls
        </h2>
        <div className="flex flex-col gap-4">
          {calls.map((call) => (
            <CallTranscriptView
              key={call.id}
              summary={call.summary ?? ""}
              transcript={call.transcript ?? ""}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
