import { supabaseAdmin } from "@/lib/supabase";
import { TimelineFeed } from "@/components/clinician/TimelineFeed";
import { EscalationCard } from "@/components/clinician/EscalationCard";
import { CallTranscriptView } from "@/components/clinician/CallTranscriptView";

export default async function ClinicianPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id } = await params;

  const [patientRes, timelineRes, escalationsRes, callsRes] = await Promise.all(
    [
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
    ],
  );

  const patient = patientRes.data;

  if (!patient)
    return <div className="p-8 text-white/50">Patient not found</div>;

  return (
    <div className="min-h-screen p-4 md:p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">
          {patient.name_alias}
        </h1>
        <p className="text-sm text-white/40">
          Severity: {patient.severity_score}/10 · Last call:{" "}
          {patient.last_call_at
            ? new Date(patient.last_call_at).toLocaleString()
            : "never"}
        </p>
      </div>

      {(escalationsRes.data?.length ?? 0) > 0 && (
        <section className="mb-6">
          <h2 className="mb-3 text-sm font-medium text-red-400 uppercase tracking-wider">
            Active Escalations
          </h2>
          <div className="flex flex-col gap-2">
            {escalationsRes.data!.map((e) => (
              <EscalationCard key={e.id} escalation={e} />
            ))}
          </div>
        </section>
      )}

      <section className="mb-6">
        <h2 className="mb-3 text-sm font-medium text-white/50 uppercase tracking-wider">
          Patient Timeline
        </h2>
        <TimelineFeed events={timelineRes.data ?? []} />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-white/50 uppercase tracking-wider">
          Recent Calls
        </h2>
        <div className="flex flex-col gap-4">
          {(callsRes.data ?? []).map((call) => (
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
