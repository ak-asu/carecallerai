// calendar-sync: runs every 15 min via Supabase cron
// Polls Google Calendar for doctor availability changes and fires appointment.updated
// for any affected patients.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

Deno.serve(async () => {
  // Get all doctors that have a Google Calendar configured
  const { data: doctors } = await supabase
    .from('doctors')
    .select('id, name, google_calendar_id, availability_last_synced')
    .not('google_calendar_id', 'is', null)

  for (const doctor of doctors ?? []) {
    // In production: call Google Calendar API with doctor.google_calendar_id
    // to fetch free/busy or event changes since availability_last_synced.
    // For hackathon demo: detect conflict_detected flags set externally.

    // Get upcoming scheduled appointments for this doctor
    const { data: appointments } = await supabase
      .from('appointments')
      .select('id, patient_id, datetime')
      .eq('doctor_id', doctor.id)
      .eq('status', 'scheduled')
      .gt('datetime', new Date().toISOString())

    for (const appt of appointments ?? []) {
      // Demo: flag appointments in the past 24h window as conflicted
      // Real implementation: compare against Calendar busy slots
      const apptTime = new Date(appt.datetime).getTime()
      const now = Date.now()
      const isConflict = apptTime < now + 2 * 3600 * 1000 && apptTime > now // within 2h

      if (isConflict) {
        await supabase.from('appointments').update({
          conflict_detected: true,
          updated_at: new Date().toISOString(),
        }).eq('id', appt.id)

        // Log automation job for appointment-monitor to pick up
        await supabase.from('automation_jobs').insert({
          type: 'appointment.updated',
          status: 'pending',
          payload: { appointmentId: appt.id, patientId: appt.patient_id },
          triggered_by: 'calendar-sync',
        })
      }
    }

    // Update sync timestamp
    await supabase.from('doctors').update({
      availability_last_synced: new Date().toISOString(),
    }).eq('id', doctor.id)
  }

  return new Response('ok')
})
