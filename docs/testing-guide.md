# CareCaller.ai — Testing Guide, Setup Checklist & Deployment Reference

## Architecture Overview

```
Phone call → Vapi telephony
  └─ webhook: /api/vapi
       ├─ assistant-request  → returns inline config (transcriber + voice + custom LLM)
       ├─ call-started       → processCallStartedWebhook() → pre-cache context in call_sessions
       ├─ call-ended/report  → processEndOfCallWebhook()  → fires call.completed event
       └─ tool-calls         → buildUnsupportedToolResults()

  └─ custom LLM: /api/vapi/llm → runCallPipeline()
       ├─ Layer 1: NLP rules (~5ms)
       │    ├─ isSafetyCandidate() + isNegated()  → immediate escalation if safety + not negated
       │    ├─ extractDrugCandidates()             → RxNorm dict + phonetic + Levenshtein
       │    ├─ normalizeDose()                     → "fifty mg" → "50 mg", frequency → QD/BID
       │    └─ flagNumericAmbiguity()              → fifteen/fifty, thirteen/thirty, etc.
       ├─ Layer 2: Context enrichment (~30ms)
       │    └─ call_sessions pre-cache (meds, appointments, Supermemory)
       └─ Layer 3: Groq llama-3.1-8b-instant (only when needed)
            ├─ triggered by: low confidence, drug found, numeric ambiguity, contradiction
            └─ agent types: intake / inbound / clarification / escalation

  └─ call.completed      → post-call-processor Edge Fn (Gemini 2.5 Flash + Tavily savings)
  └─ escalation.created  → escalation-handler Edge Fn
  └─ correction.created  → correction-processor Edge Fn
  └─ appointment.updated → appointment-monitor Edge Fn

Cron jobs (Supabase pg_cron → Edge Functions):
  - calendar-sync:          every 15 min  → detect doctor calendar conflicts
  - symptom-followup:       every 1 hour  → schedule follow-up calls for severity >= 5
  - medication-enrichment:  every 6 hours → enrich medication data

STT providers (switchable via STT_PROVIDER env var):
  - "assembly-ai"  → AssemblyAI with 68-word medical wordBoost list
  - "custom"       → Modal.com fine-tuned Whisper endpoint (faster-whisper + T4 GPU)

Dashboard:  /[locale]/dashboard/[token]   (PIN-gated, Supabase realtime alerts)
Clinician:  /[locale]/clinician/[id]      (server-rendered, no auth gate)
Languages:  en / es  (next-intl, routing via /en/... and /es/...)
```

---

## Part 1 — Vapi System Prompt

### Problem with the Current Prompt

The current Vapi dashboard system prompt describes **"Riley" from Wellness Partners** — a completely different product that schedules appointments via scripted flows. This will conflict with CareCaller's behavior:

- It introduces a wrong agent identity ("Riley", "Wellness Partners")
- It has scripted conversation flows that contradict CareCaller's dynamic custom LLM responses
- It references knowledge (provider hours, fee schedules, insurance) that doesn't exist in your system

### Why the System Prompt Still Matters

Your `buildAssistantConfig()` in `/api/vapi/route.ts` returns the assistant config **inline** via `assistant-request`. This overrides the transcriber, model, and voice from the Vapi dashboard. However, Vapi **still uses the dashboard system prompt** when constructing the turn context passed to your custom LLM at `/api/vapi/llm`. It appears in the `messages` array as the first `system` role message.

Your `/api/vapi/llm` code reads only the last user message (`messages.reverse().find(m => m.role === 'user')`), so it doesn't directly use the Vapi system prompt — but it is included in Vapi's own turn-taking and interruption logic. Having a wrong system prompt causes Vapi to misinterpret the conversation context.

### Recommended System Prompt — Replace the Entire Current Content

Replace the "Riley / Wellness Partners" prompt with the following:

```
# CareCaller Voice Agent

## Identity
You are CareCaller, a compassionate AI healthcare voice agent built to support patients between their medical appointments. You are warm, calm, and concise. You never invent medical information.

## Purpose
- Conduct proactive check-ins: collect symptom updates, medication adherence reports, and side effect observations
- Answer inbound patient calls: help with medication questions, appointment status, and general health guidance
- Route appropriately: handle routine concerns directly, flag urgent issues for clinician review

## Voice & Tone
- Warm but focused — you are not a chatbot, you are a care companion
- Speak at a measured pace; confirm critical information (drug names, doses, dates) by repeating back
- Use natural contractions and occasional conversational phrases ("Let me check that for you", "I want to make sure I heard that right")
- Never rush a patient who is describing symptoms or in distress

## Conversation Flow
1. Greet the patient by first name if available; otherwise: "Hello, this is CareCaller. How are you feeling today?"
2. For check-in calls: ask structured questions — current symptoms, medication adherence, any new concerns
3. For inbound calls: identify the patient's need first, then address it
4. Always confirm drug names and dosages back to the patient before logging
5. If anything is unclear, ask one focused clarifying question — never multiple at once
6. Close with: "Is there anything else you'd like to share before we wrap up today?"

## Safety Rules
- If a patient describes chest pain, difficulty breathing, stroke symptoms, suicidal ideation, severe bleeding, seizure, or anaphylaxis — immediately advise them to call 911 and inform them that their clinician will be notified
- Never dismiss any symptom — if uncertain about severity, treat it as potentially serious
- Never recommend specific medications or dosage changes — only confirm what is already on record

## Language
- Respond in the same language the patient is speaking
- If the patient asks to switch to Spanish, switch immediately and remain in Spanish for the rest of the call
- Supported languages: English, Spanish

## Important Constraints
- You only use facts from the patient's medical record and the current conversation
- You never invent medications, diagnoses, or appointment details
- You never provide emergency medical advice beyond "call 911"
- Appointment bookings and medication changes are confirmed, not initiated, by you
```

---

## Part 2 — Environment Variables Checklist

Verify all variables are set before any test. In production, set these in your Vercel project settings. Locally, in `.env`.

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=    # same as anon key for client-side use
SUPABASE_SERVICE_ROLE_KEY=               # used for supabaseAdmin
SUPABASE_SECRET_KEY=                     # ALSO set to service role key — referenced in events.ts

# Vapi
VAPI_API_KEY=
VAPI_WEBHOOK_SECRET=                     # must exactly match what you set in Vapi dashboard
VAPI_ASSISTANT_ID=

# STT
STT_PROVIDER=assembly-ai                 # start with this; switch to "custom" for Modal test
CUSTOM_STT_URL=                          # fill in after Modal deploy
ASSEMBLYAI_API_KEY=

# Voice
ELEVENLABS_API_KEY=
ELEVENLABS_VOICE_ID=                     # leave blank for default "Rachel" (21m00Tcm4TlvDq8ikWAM)

# LLM
GROQ_API_KEY=                            # real-time pipeline (llama-3.1-8b-instant)
GEMINI_API_KEY=                          # post-call analysis (gemini-2.5-flash)

# Memory & Search
SUPERMEMORY_API_KEY=
TAVILY_API_KEY=

# App
NEXT_PUBLIC_APP_URL=                     # no trailing slash
                                         # local:      http://localhost:3000
                                         # production: https://your-app.vercel.app

# ML Training (fine-tuning only)
HF_TOKEN=                                # Hugging Face token for dataset access
```

> **Critical:** `SUPABASE_SECRET_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are both read in `src/lib/events.ts`. If either is missing, Edge Function invocations silently fail — automation jobs queue but never execute.

---

## Part 3 — Supabase Setup Checklist

### Migrations

```
□ Migration 001_schema.sql applied
    → Tables: patients, doctors, medications, calls, call_entities, call_sessions,
              patient_timeline, appointments, symptoms, escalations, corrections,
              notifications, automation_jobs
    → Seed data: Dr. Sarah Chen + Patient Demo
    → RLS enabled on patient-facing tables

□ Migration 003_cron_and_event_automation.sql applied
    → Extensions: pg_cron, pg_net, supabase_vault
    → Schema: util (get_secret, project_url, anon_key, invoke_edge_function)
    → Cron jobs: carecaller-calendar-sync, carecaller-symptom-followup,
                 carecaller-medication-enrichment
```

Verify cron jobs are running:
```sql
SELECT jobname, schedule, command FROM cron.job;
-- Should return 3 rows
```

### Vault Secrets

The cron jobs call `util.invoke_edge_function()` which reads two vault secrets. Set them in Supabase Dashboard → Vault:

| Secret Name | Value |
|---|---|
| `project_url` | Your Supabase project URL (same as `NEXT_PUBLIC_SUPABASE_URL`) |
| `anon_key` | Your Supabase anon key |

```sql
-- Verify vault secrets are accessible
SELECT util.project_url();
SELECT util.anon_key();
-- Both should return non-null values
```

### Edge Functions

All 7 must be deployed:

```bash
cd supabase

supabase functions deploy post-call-processor
supabase functions deploy appointment-monitor
supabase functions deploy calendar-sync
supabase functions deploy correction-processor
supabase functions deploy escalation-handler
supabase functions deploy medication-enrichment
supabase functions deploy symptom-followup
```

Each Edge Function needs these env vars set in Supabase Dashboard → Edge Functions → Secrets:

```
SUPABASE_URL=            (auto-injected by Supabase)
SUPABASE_SERVICE_ROLE_KEY=
GEMINI_API_KEY=          (used by post-call-processor)
TAVILY_API_KEY=          (used by post-call-processor)
```

### Realtime

Enable Realtime for these tables in Supabase Dashboard → Database → Replication:
```
□ escalations       (drives AlertBanner on dashboard)
□ appointments      (useRealtimeAppointment hook)
□ patient_timeline  (optional, for live updates)
```

---

## Part 4 — Vapi Dashboard Configuration

| Setting | Recommended Value |
|---|---|
| **Assistant Type** | Phone |
| **First Message** | `Hello, this is CareCaller. How are you feeling today?` |
| **System Prompt** | Replace with the CareCaller prompt from Part 1 above |
| **Model** | Custom LLM → URL: `https://your-app.vercel.app/api/vapi/llm` |
| **Transcriber** | Leave blank — returned dynamically via `assistant-request` webhook |
| **Voice** | Leave blank — returned dynamically via `assistant-request` webhook |
| **Silence Timeout** | 30 seconds |
| **Max Duration** | 600 seconds |
| **Background Denoising** | Enabled |
| **Allow Interruptions** | Enabled |
| **End Call Phrases** | `goodbye`, `bye`, `that's all for today`, `thank you` |
| **Recording** | Enabled (essential for reviewing test calls) |
| **Transcripts** | Enabled (sent in `end-of-call-report` webhook payload) |
| **Webhook URL** | `https://your-app.vercel.app/api/vapi` |
| **Webhook Secret** | Your `VAPI_WEBHOOK_SECRET` value |
| **Template** | Select "Blank" or "Custom LLM" — skip scheduling templates |

**Phone number:** Assign a Vapi phone number to this assistant and point inbound calls to it.

---

## Part 5 — Seed Data for Test Patient

Run this in Supabase SQL Editor. Creates patient "Alex Rivera" with a migraine history, four medications, a upcoming neurology appointment, and past timeline events.

```sql
-- ============================================================
-- CareCaller Test Patient: Alex Rivera
-- Dashboard URL: /en/dashboard/alex-demo-2024
-- PIN: 7291
-- ============================================================

-- 1. Add neurologist
INSERT INTO doctors (id, name, specialty, phone, google_calendar_id)
VALUES (
  '00000000-0000-0000-0000-000000000010',
  'Dr. Michael Torres',
  'Neurology',
  '+15550002345',
  NULL
) ON CONFLICT (id) DO NOTHING;

-- 2. Create patient
--    IMPORTANT: replace +1YOURPHONE with the actual number you will call from.
--    Vapi sends the caller's number in E.164 format (+15551234567).
--    It must match exactly what is stored here.
INSERT INTO patients (id, token, password_hash, name_alias, language, phone, severity_score)
VALUES (
  '00000000-0000-0000-0000-000000000020',
  'alex-demo-2024',
  'REPLACE_WITH_BCRYPT_HASH',  -- Generate: node -e "require('bcryptjs').hash('7291',10).then(h=>console.log(h))"
  'Alex Rivera',
  'en',
  '+1YOURPHONE',   -- <-- REPLACE THIS
  3
) ON CONFLICT (id) DO NOTHING;

-- 3. Active medications
INSERT INTO medications
  (patient_id, drug_name, drug_name_normalized, dose, frequency, start_date, source, active)
VALUES
  ('00000000-0000-0000-0000-000000000020',
   'sumatriptan', 'Sumatriptan', '50 mg',  'as needed for migraine', '2024-09-01', 'clinician_verified', true),
  ('00000000-0000-0000-0000-000000000020',
   'metoprolol',  'Metoprolol',  '25 mg',  'once daily',             '2024-06-15', 'clinician_verified', true),
  ('00000000-0000-0000-0000-000000000020',
   'sertraline',  'Sertraline',  '50 mg',  'once daily in morning',  '2024-03-01', 'clinician_verified', true),
  ('00000000-0000-0000-0000-000000000020',
   'ibuprofen',   'Ibuprofen',   '400 mg', 'as needed',              '2024-01-01', 'patient_verified',   true);

-- 4. Upcoming appointment ~3 days from now
INSERT INTO appointments (id, patient_id, doctor_id, datetime, status)
VALUES (
  '00000000-0000-0000-0000-000000000030',
  '00000000-0000-0000-0000-000000000020',
  '00000000-0000-0000-0000-000000000010',
  NOW() + INTERVAL '3 days',
  'scheduled'
) ON CONFLICT (id) DO NOTHING;

-- 5. Past timeline history (gives the agent context to work with)
INSERT INTO patient_timeline (patient_id, event_type, content, severity, source)
VALUES
  ('00000000-0000-0000-0000-000000000020',
   'call',
   '{"summary": "Patient reported mild headache rated 4/10. Taking sumatriptan as prescribed. No nausea. Adherent to metoprolol and sertraline.", "severity": 3, "callId": "demo-history-001"}',
   3, 'stt_inferred'),

  ('00000000-0000-0000-0000-000000000020',
   'symptom',
   '{"symptom": "migraine", "onset": "2025-04-10", "severity": 4, "notes": "photophobia reported, lasted approx 6 hours, sumatriptan taken"}',
   4, 'stt_inferred'),

  ('00000000-0000-0000-0000-000000000020',
   'appointment',
   '{"action": "confirmed", "doctor": "Dr. Michael Torres", "specialty": "Neurology", "notes": "Follow-up for chronic migraine management"}',
   0, 'patient_verified'),

  ('00000000-0000-0000-0000-000000000020',
   'call',
   '{"summary": "Patient reported sertraline causing mild drowsiness in the morning. Discussed timing adjustment with clinician. No other concerns.", "severity": 1, "callId": "demo-history-002"}',
   1, 'stt_inferred');

-- 6. Verify
SELECT
  p.name_alias,
  p.phone,
  p.token,
  COUNT(DISTINCT m.id) AS medications,
  COUNT(DISTINCT a.id) AS appointments,
  COUNT(DISTINCT t.id) AS timeline_events
FROM patients p
LEFT JOIN medications   m ON m.patient_id = p.id
LEFT JOIN appointments  a ON a.patient_id = p.id
LEFT JOIN patient_timeline t ON t.patient_id = p.id
WHERE p.id = '00000000-0000-0000-0000-000000000020'
GROUP BY p.name_alias, p.phone, p.token;
```

**Dashboard access:**
- URL: `/en/dashboard/alex-demo-2024`
- PIN: `7291`

**Supermemory context (run via a test script or the Node REPL — cannot be done via SQL):**

```javascript
// Run once before testing — seeds Supermemory with Alex's medical background
import { addMemory } from './src/lib/supermemory.ts'

await addMemory(
  '00000000-0000-0000-0000-000000000020',
  `Alex Rivera, 34, chronic migraine patient. Takes sumatriptan 50mg as needed,
   metoprolol 25mg once daily for heart rate, sertraline 50mg for anxiety.
   History: photophobia during attacks, migraines ~2x per month.
   Last severe attack April 2025, rated 9/10.
   Allergy: codeine (causes nausea). Prefers morning medication schedule.
   Upcoming neurology follow-up with Dr. Michael Torres.`
)
```

---

## Part 6 — Modal.com Deployment (Custom STT)

### Overview

The `stt/serve/modal_app.py` file deploys a `faster-whisper` endpoint to a GPU T4 instance on Modal.com. It:
- Downloads `whisper-small` as a base fallback at build time
- At runtime, loads a fine-tuned checkpoint from the `carecaller-stt-model` volume if present
- Accepts base64-encoded audio + optional patient medication list
- Returns transcript text + per-word confidence scores

The deployed URL replaces AssemblyAI when `STT_PROVIDER=custom`.

### Step-by-Step Deploy

```bash
# 1. Install Modal Python SDK
pip install modal

# 2. Authenticate (opens browser for OAuth)
modal setup

# 3. Smoke test locally (no GPU — uses CPU whisper-small)
cd C:/Users/presyze/Projects/ASU/carecallerai
modal run stt/serve/modal_app.py

# 4. Deploy to Modal (provisions T4 GPU, ~2-3 min first time)
modal deploy stt/serve/modal_app.py

# Modal prints your endpoint URL after deploy:
# https://your-workspace--carecaller-stt-whisperstt-transcribe.modal.run
```

### Connect to Your App

In `.env` (and Vercel project settings):
```
STT_PROVIDER=custom
CUSTOM_STT_URL=https://your-workspace--carecaller-stt-whisperstt-transcribe.modal.run
```

### Data Flow (Custom STT Path)

```
Vapi (telephony audio stream)
  └─ /api/vapi receives assistant-request
  └─ buildAssistantConfig() sees STT_PROVIDER=custom
  └─ returns { provider: "custom-transcriber", server: { url: CUSTOM_STT_URL } }
  └─ Vapi streams audio → Modal endpoint
  └─ Modal returns { transcript, words: [{word, start, end, confidence}], model }
  └─ /api/vapi/llm receives transcript + word confidences
  └─ wordConfidences extracted from body.call.transcript.words[].confidence
  └─ runCallPipeline() uses confidence scores in computeConfidence()
```

### Upload Fine-Tuned Checkpoint

After completing training in Colab (`stt/train/fine_tune.py`):

```bash
# Upload trained checkpoint to the Modal volume
modal volume put carecaller-stt-model \
  ./stt/checkpoints/whisper-telephony-medical-final \
  /finetuned

# Redeploy to pick up the checkpoint
modal deploy stt/serve/modal_app.py

# Verify it loaded (check Modal logs)
# You should see: "Loading fine-tuned model from /model/finetuned"
```

The `load_model()` method automatically uses `/model/finetuned` if it exists — otherwise it falls back to the downloaded `whisper-small` base.

---

## Part 7 — Test Scenarios

### Scenario 1: Noisy Call — Severe Migraine (Core Demo)

**Purpose:** End-to-end test of STT accuracy under noise, medical entity extraction, numeric ambiguity handling, post-call Gemini analysis, and dashboard update.

**Setup:**
- `STT_PROVIDER=assembly-ai`
- Alex Rivera's phone registered in DB
- Be in a room with background noise (TV, conversation, traffic)
- Call the Vapi phone number from Alex's registered phone

**Script to say (naturally, not robotic):**

> "Hi yeah, I've been having a really bad migraine since yesterday. I took my sumatriptan — uh, fifty milligrams — this morning but it's not really helping. The pain is like a nine out of ten right now. I have photophobia, even the phone screen is killing me. I've had some nausea too. Oh and I think I ran out of my sertraline — I haven't taken it in three days. My next appointment with Doctor Torres is in about three days I think. Also I wanted to ask — I heard metoprolol can sometimes make migraines worse, is that true?"

**What to verify:**

| Check | Where |
|---|---|
| `sumatriptan` extracted correctly (not phonetically garbled) | `call_entities` table |
| `50 mg` numeric ambiguity (fifteen vs fifty) triggers Layer 3 | `call_entities.action_taken = 'clarified'` |
| `photophobia` captured as symptom entity | `call_entities.entity_type = 'symptom'` |
| `pain 9/10` as numeric entity | `call_entities.entity_type = 'numeric'` |
| `sertraline` missed dose detected → contradiction with record | Groq response includes dose contradiction check |
| Agent asks clarifying question about "fifteen or fifty mg" | Live call — listen for clarification question |
| Post-call: severity >= 7 → `escalations` row created | `escalations` table |
| Gemini summary written to call record | `calls.summary` |
| Tavily found sumatriptan savings links | `patient_timeline.event_type = 'savings_found'` |
| Follow-up notification scheduled (4h for severity >= 7) | `notifications` table |
| Dashboard shows updated timeline, alert banner | Visit `/en/dashboard/alex-demo-2024` |

**Expected pipeline path:** Layer 1 (no safety trigger — no chest pain/stroke terms) → Layer 3 Groq triggered by: drug found + numeric ambiguity + low confidence words under noise.

---

### Scenario 2: Safety Escalation (Stroke Symptoms)

**Purpose:** Verify the fast-path safety escalation bypasses Groq entirely.

**Script:**

> "I'm having the worst headache of my life and my vision is blurry on one side. I feel like my arm is weak and my speech feels weird."

**Expected behavior:**
- `isSafetyCandidate()` triggers on `arm weakness` and `slurred speech` (both in SAFETY_TERMS list)
- `isNegated()` returns false
- Pipeline returns immediately with 911 advisory — no Groq call made
- Agent says: *"I hear that you're experiencing something concerning. I'm notifying your clinician right now. If you're in immediate danger, please call 911."*

**What to verify:**

| Check | Where |
|---|---|
| `escalations` row: severity = 9 | `escalations` table |
| `call_entities.action_taken = 'escalated'` | `call_entities` table |
| `decision_rationale = 'safety_keyword_detected_not_negated'` | `call_entities.decision_rationale` |
| `escalation-handler` edge function fired | `automation_jobs` table, `notifications` table |
| Dashboard `AlertBanner` shows red escalation (realtime) | Open dashboard during/after call |

---

### Scenario 3: Negated Safety Term (Should NOT escalate)

**Purpose:** Verify that negation detection prevents false escalations.

**Script:**

> "I don't have any chest pain. No shortness of breath either. I'm actually feeling much better than last week."

**Expected behavior:**
- `isSafetyCandidate()` triggers on `chest pain` and `shortness of breath`
- `isNegated()` returns true (matches `\bno\b` pattern)
- Fast path: no escalation
- `call_entities.action_taken = 'accepted'` or `'fast_path_high_confidence'`

---

### Scenario 4: Numeric Ambiguity Test

**Purpose:** Test acoustic confusion detection between similar-sounding dose numbers.

**Script:**

> "My doctor changed my metoprolol to, uh, fifteen milligrams — or was it fifty? I can't remember. And my sertraline is now sixty milligrams."

**Expected behavior:**
- `flagNumericAmbiguity()` triggers on `fifteen mg` / `fifty mg` pattern
- `hasNumericAmbiguity = true` → forces Layer 3 Groq call
- Contradiction: sertraline in DB is 50mg, patient says 60mg
- `contradiction.detected = true`, field = `dose`, heard = `60 mg`, record = `50 mg`
- Groq responds with clarification question: *"I heard you mention fifteen or fifty milligrams for your metoprolol — can you confirm the exact dose?"*

**What to verify:**

| Check | Where |
|---|---|
| `action_taken = 'clarified'` | `call_entities` table |
| Contradiction row logged | `call_entities` with `contradiction_detected = true` |
| Groq prompt included numeric ambiguity warning | Check via Groq dashboard or add logging |

---

### Scenario 5: Dashboard Correction → Downstream Jobs

**Purpose:** Test the patient correction flow and verify downstream memory/automation updates.

**Steps:**
1. Open dashboard at `/en/dashboard/alex-demo-2024` (PIN: 7291)
2. In the Medications section, edit Ibuprofen: change `400 mg` → `600 mg`
3. Submit the correction

**What to verify:**

| Check | Where |
|---|---|
| `corrections` row created | `corrections` table |
| `medications` row updated: `dose = '600 mg'`, `source = 'patient_verified'` | `medications` table |
| Supermemory updated with correction note | Verify via next call — Groq context includes updated dose |
| `patient_timeline` event: `event_type = 'correction'` | `patient_timeline` table |
| `automation_jobs` row for `correction.created` | `automation_jobs` table |
| `correction-processor` edge function ran | `automation_jobs.status = 'completed'` |

---

### Scenario 6: Appointment Conflict → Auto-Reschedule

**Purpose:** Test the calendar-sync + appointment-monitor cron chain.

**Steps (manually trigger in SQL editor during demo):**

```sql
-- Step 1: Flag Alex's appointment as conflicted
-- (Simulates what calendar-sync does when it detects a busy slot)
UPDATE appointments
SET conflict_detected = true, updated_at = NOW()
WHERE patient_id = '00000000-0000-0000-0000-000000000020'
  AND id = '00000000-0000-0000-0000-000000000030';

-- Step 2: Manually invoke appointment-monitor
-- (Simulates the cron job firing — safe to run anytime)
SELECT util.invoke_edge_function('appointment-monitor', '{}'::jsonb);

-- Step 3: Verify rescheduling occurred
SELECT id, datetime, status, reschedule_reason, conflict_detected
FROM appointments
WHERE id = '00000000-0000-0000-0000-000000000030';
```

**What to verify:**

| Check | Expected Value |
|---|---|
| `appointments.status` | `rescheduled` |
| `appointments.datetime` | Original time + 24 hours |
| `appointments.reschedule_reason` | `Doctor unavailable at original time` |
| `appointments.conflict_detected` | `false` (cleared after rescheduling) |
| `notifications` row | Rescheduling message for patient |
| `patient_timeline` event | `event_type = 'appointment'`, `action: 'rescheduled'` |
| Dashboard appointment shows new time | Refresh `/en/dashboard/alex-demo-2024` |

---

### Scenario 7: Reminder Call Trigger (Symptom Follow-up Cron)

**Purpose:** Demonstrate that the system auto-schedules follow-up calls for high-severity patients.

```sql
-- Step 1: Simulate a patient who had a concerning recent call
UPDATE patients
SET severity_score = 7, last_call_at = NOW() - INTERVAL '2 hours'
WHERE id = '00000000-0000-0000-0000-000000000020';

-- Step 2: Manually run the symptom-followup cron
SELECT util.invoke_edge_function('symptom-followup', jsonb_build_object('source', 'manual_test'));

-- Step 3: Verify notification was scheduled
SELECT patient_id, type, message, status, scheduled_at, triggered_by
FROM notifications
WHERE patient_id = '00000000-0000-0000-0000-000000000020'
ORDER BY created_at DESC LIMIT 5;
```

**Expected:** A new `notifications` row with `type = 'call'`, `status = 'pending'`, `scheduled_at = NOW() + 1 hour`, `triggered_by = 'symptom-followup-cron'`.

> In a production system, a separate outbound call dispatcher would poll this table and trigger a Vapi outbound call. For the demo, showing this row is sufficient to demonstrate the automation.

---

### Scenario 8: Multilingual Call (Spanish)

**Purpose:** Test the Spanish language path through the pipeline.

**Option A — Change patient language before calling:**
```sql
UPDATE patients SET language = 'es'
WHERE id = '00000000-0000-0000-0000-000000000020';
```

**Script (in Spanish):**

> "Hola, he tenido un dolor de cabeza muy fuerte desde ayer. Tomé mi sumatriptán esta mañana pero no me está ayudando. El dolor es como un nueve de diez."

**What to verify:**
- Agent responds in Spanish
- Safety response (if triggered) fires in Spanish (hardcoded in `vapi.ts`)
- Groq agent prompts use `lang === 'es'` variant
- `calls.language = 'es'` logged
- Dashboard at `/es/dashboard/alex-demo-2024` renders in Spanish

**Reset after test:**
```sql
UPDATE patients SET language = 'en'
WHERE id = '00000000-0000-0000-0000-000000000020';
```

---

### Scenario 9: Real-Time Dashboard Alert

**Purpose:** Test Supabase realtime subscription in `useRealtimeAlerts`.

**Steps:**
1. Open dashboard in browser at `/en/dashboard/alex-demo-2024`
2. In a separate tab or SQL editor, insert an escalation directly:

```sql
INSERT INTO escalations (patient_id, trigger_term, context_summary, severity, status)
VALUES (
  '00000000-0000-0000-0000-000000000020',
  'manual_test',
  'Test escalation to verify real-time dashboard alert.',
  8,
  'pending'
);
```

3. Watch the dashboard — the `AlertBanner` should update without a page refresh.

---

### Scenario 10: STT Comparison — AssemblyAI vs Custom Whisper

Run the same call twice. For each run, update `STT_PROVIDER` and redeploy/restart.

**Test Script (say verbatim, same speed, same background noise):**

> "I take warfarin five milligrams every evening. I also take gabapentin three hundred milligrams three times a day. Last week my INR was two point four. I've been feeling some peripheral neuropathy in my feet — tingling and numbness. I also started ozempic, half a milligram weekly."

**Run A:** `STT_PROVIDER=assembly-ai`
**Run B:** `STT_PROVIDER=custom` (fine-tuned Whisper on Modal)

**Comparison table to fill in after both runs:**

| Metric | AssemblyAI | Custom Whisper |
|---|---|---|
| `warfarin` transcribed correctly | | |
| `gabapentin` transcribed correctly | | |
| `300 mg` extracted correctly | | |
| `INR 2.4` as numeric entity | | |
| `peripheral neuropathy` captured | | |
| `ozempic` recognized (in WORD_BOOST / initial_prompt) | | |
| `0.5 mg` vs `half mg` normalized | | |
| Average word confidence score | | |
| Layer 3 triggered? (yes/no) | | |
| Total response latency | | |

**Key difference:** AssemblyAI uses the static `WORD_BOOST` list of 68 medical drug names. Custom Whisper uses the patient's actual medication list as `initial_prompt` at transcription time — dynamically personalized but dependent on what's in the DB.

---

## Part 8 — Additional Flows to Cover

### Post-Call Gemini Analysis (Manual Test)

You can trigger the post-call processor directly to test Gemini extraction without making a real phone call:

```sql
-- First find a completed call ID
SELECT id, patient_id, transcript FROM calls WHERE status = 'completed' LIMIT 5;

-- Then invoke the edge function manually
SELECT util.invoke_edge_function(
  'post-call-processor',
  jsonb_build_object(
    'callId',    '<call-uuid-here>',
    'patientId', '00000000-0000-0000-0000-000000000020'
  )
);
```

Verify: `calls.summary` is updated, `call_entities` rows added, `symptoms` rows added if applicable.

### Tavily Drug Savings Search

```sql
-- After a call that mentions "sumatriptan" or "warfarin"
SELECT event_type, content->>'drugName' AS drug, content->'links' AS savings_links
FROM patient_timeline
WHERE patient_id = '00000000-0000-0000-0000-000000000020'
  AND event_type = 'savings_found'
ORDER BY created_at DESC;
```

### Clinician View

Navigate to `/en/clinician/00000000-0000-0000-0000-000000000020`

Verify:
- Patient name, severity score, last call timestamp
- Timeline feed renders chronologically
- Escalation cards appear for active escalations
- Call transcript viewer shows completed calls

### Correction Processor Edge Function

After submitting a dashboard correction, verify the edge function ran:

```sql
SELECT type, status, payload, completed_at
FROM automation_jobs
WHERE type = 'correction.created'
ORDER BY created_at DESC LIMIT 3;
```

---

## Part 9 — Pre-Demo Master Checklist

```
INFRASTRUCTURE
□ Vercel deployment live: https://your-app.vercel.app
□ All env vars set in Vercel project settings
□ Supabase migrations applied: 001_schema.sql and 003_cron_and_event_automation.sql
□ All 7 Edge Functions deployed to Supabase
□ Edge Function secrets set: SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY, TAVILY_API_KEY
□ Vault secrets set: project_url, anon_key
□ 3 cron jobs registered: SELECT * FROM cron.job;
□ Realtime enabled for: escalations, appointments, patient_timeline

VAPI
□ System prompt updated (Riley/Wellness Partners → CareCaller from Part 1)
□ First message set: "Hello, this is CareCaller. How are you feeling today?"
□ Webhook URL points to Vercel: https://your-app.vercel.app/api/vapi
□ VAPI_WEBHOOK_SECRET matches between Vercel env and Vapi dashboard
□ Phone number assigned to assistant
□ Background denoising enabled
□ Recording and transcripts enabled
□ Model set to Custom LLM: https://your-app.vercel.app/api/vapi/llm

STT - ASSEMBLY AI
□ STT_PROVIDER=assembly-ai set in Vercel
□ ASSEMBLYAI_API_KEY valid and set
□ Test call completes and shows wordBoost working (check call_entities for drug names)

STT - CUSTOM WHISPER (Modal)
□ Modal CLI installed and authenticated
□ Smoke test passed: modal run stt/serve/modal_app.py
□ Endpoint deployed: modal deploy stt/serve/modal_app.py
□ CUSTOM_STT_URL set in Vercel
□ Fine-tuned checkpoint uploaded to volume (if available)
□ Test call with STT_PROVIDER=custom completes successfully

SEED DATA
□ Alex Rivera patient row created with YOUR real phone number in E.164 format
□ 4 medications seeded for Alex
□ Upcoming appointment seeded (Dr. Torres, ~3 days from now)
□ Past timeline history seeded
□ Supermemory entry added via addMemory()
□ Dashboard PIN confirmed: 7291 → /en/dashboard/alex-demo-2024

SERVICES (API key spot checks)
□ Groq: test via curl or the Groq playground
□ Gemini: test via Google AI Studio
□ Supermemory: test queryMemory() returns Alex's context
□ Tavily: test searchMedSavings('sumatriptan') returns results
□ ElevenLabs: verify voice ID is valid in ElevenLabs dashboard

DURING EACH TEST CALL
□ Watch automation_jobs table for queued jobs
□ Watch call_entities for entity extraction results
□ Watch calls table for transcript and summary after call ends
□ Watch patient_timeline for post-call entries
□ Watch notifications for follow-up scheduling
□ Watch escalations if safety scenario
□ Open dashboard in browser to see realtime updates
```

---

## Part 10 — Key Gotchas

**Phone number format.** `processCallStartedWebhook` looks up the patient by `body.message.call.customer.number`. Vapi sends numbers in E.164 format (`+15551234567`). The DB must store the same format or the session will not be created, and the pipeline runs with empty context (no meds, no memory).

**Both Supabase key env vars must be set.** `events.ts` checks `SUPABASE_SECRET_KEY ?? SUPABASE_SERVICE_ROLE_KEY`. If the primary is missing, it falls back. If both are missing, Edge Function invocations silently no-op — automation jobs queue but never execute.

**Groq is not always called.** If a test utterance has high word confidence, no drug names, and no numeric ambiguity, the pipeline returns the fast-path ACK without Groq. Use drug names and acoustically similar numbers (e.g., "fifteen milligrams") to force Layer 3.

**Cron jobs do not fire on localhost.** `util.invoke_edge_function` calls your Supabase project URL — it works in any environment. To simulate cron during a local demo, use `SELECT util.invoke_edge_function(...)` directly in the SQL editor.

**The Vapi system prompt and custom LLM coexist.** Vapi uses the system prompt for its own turn management and interruption logic. Your `/api/vapi/llm` custom LLM generates all spoken content. Both must be aligned to the same identity and behavior.

**Modal cold start.** With `container_idle_timeout=300`, the Modal container stays warm for 5 minutes after the last request. First call after a cold start may take 8–15 seconds to load the model. Subsequent calls within 5 minutes are fast (~500ms transcription). Do a warm-up call before the demo.

**Supermemory context.** Supermemory is queried once per call in `processCallStartedWebhook` and cached in `call_sessions`. If you add a memory during a call, it will not appear until the next call.

**Language switching.** Currently `language` is read from the patient's DB record at call start, not dynamically detected from speech. To test the Spanish path, update `patients.language = 'es'` before calling and restore it after.
