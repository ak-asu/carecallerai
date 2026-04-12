// Run with: npx tsx scripts/seed.ts
// Sets demo patient PIN to 1234 and seeds medications + appointment for demo
import bcrypt from 'bcryptjs'
import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const hash = await bcrypt.hash('1234', 10)

// Update demo patient password_hash
const { error: patientErr } = await supabase
  .from('patients')
  .update({ password_hash: hash })
  .eq('token', 'demo-patient-token-abc123')

if (patientErr) {
  console.error('Patient update failed:', patientErr.message)
  process.exit(1)
}

// Seed demo medications
await supabase.from('medications').upsert([
  {
    patient_id: '00000000-0000-0000-0000-000000000002',
    drug_name: 'Warfarin',
    drug_name_normalized: 'Warfarin',
    dose: '5 mg',
    frequency: 'QD',
    source: 'clinician_verified',
    active: true,
  },
  {
    patient_id: '00000000-0000-0000-0000-000000000002',
    drug_name: 'Lisinopril',
    drug_name_normalized: 'Lisinopril',
    dose: '10 mg',
    frequency: 'QD',
    source: 'clinician_verified',
    active: true,
  },
  {
    patient_id: '00000000-0000-0000-0000-000000000002',
    drug_name: 'Metoprolol',
    drug_name_normalized: 'Metoprolol',
    dose: '25 mg',
    frequency: 'BID',
    source: 'clinician_verified',
    active: true,
  },
])

// Seed demo appointment
await supabase.from('appointments').upsert([
  {
    patient_id: '00000000-0000-0000-0000-000000000002',
    doctor_id: '00000000-0000-0000-0000-000000000001',
    datetime: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(), // 7 days from now
    status: 'scheduled',
  },
])

// Seed a demo call + timeline entry so the dashboard has content
const { data: call } = await supabase.from('calls').insert({
  patient_id: '00000000-0000-0000-0000-000000000002',
  vapi_call_id: 'demo-call-001',
  type: 'outbound',
  status: 'completed',
  intent: 'post_discharge_checkin',
  severity_score: 3,
  transcript: 'Agent: Hi, this is CareCaller. How are you feeling today?\nPatient: I feel okay, a bit tired. I took my warfarin this morning.\nAgent: Good. Any shortness of breath or chest pain?\nPatient: No, nothing like that.\nAgent: Great. I\'ll note your adherence. Take care!',
  summary: 'Patient reports feeling well with mild fatigue. Confirmed warfarin adherence. No concerning symptoms reported. Severity score 3.',
  started_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
  ended_at: new Date(Date.now() - 2 * 3600 * 1000 + 300000).toISOString(),
  language: 'en',
}).select().single()

if (call) {
  await supabase.from('patient_timeline').insert({
    patient_id: '00000000-0000-0000-0000-000000000002',
    event_type: 'call',
    content: { summary: call.summary, severity: 3, callId: call.id },
    severity: 3,
    flagged: false,
    source: 'stt_inferred',
  })
}

console.log('✓ Seed complete. Demo PIN: 1234')
console.log('✓ Dashboard: /en/dashboard/demo-patient-token-abc123')
console.log('✓ Clinician:  /en/clinician/00000000-0000-0000-0000-000000000002')
