# CareCaller AI — Design Spec
**Date:** 2026-04-11  
**Scope:** Hackathon build (20h budget)  
**Stack:** Next.js · HeroUI · Tailwind 4 · Supabase · Vapi · AssemblyAI · ElevenLabs · Groq · Gemini · Supermemory · Tavily  
**Languages:** English + Spanish (next-intl)  
**Deploy:** Vercel

---

## 1. Product Vision

CareCaller is an AI voice agent that owns patient care between appointments. It calls patients to check in, collects symptom and adherence data, handles inbound requests (refills, scheduling, questions), routes to staff only when it matters, and builds a patient timeline for clinicians.

The only user-facing surfaces are:
1. **The phone call** — where all interaction happens
2. **A token-gated patient dashboard** — for post-call review and corrections

---

## 2. Final Stack

| Layer | Service | Free Tier |
|---|---|---|
| Telephony | Vapi | $10 credits |
| STT primary | AssemblyAI Medical | 100 hrs/mo |
| STT | AssemblyAI Medical (word-level confidence scores) | 100 hrs/mo |
| TTS | ElevenLabs | 10K chars/mo |
| Agent brain (in-call) | Groq + Llama 3.1 8B | Free |
| Agent brain (post-call) | Gemini 2.0 Flash | Free |
| RAG / patient memory | Supermemory | 1M tokens + 10K queries/mo |
| Database | Supabase (Postgres + Realtime + Edge Functions) | Free |
| Background jobs | Supabase Edge Functions | 500K invocations/mo |
| Web search | Tavily | 1K searches/mo |
| Frontend | Next.js 15 + HeroUI + Tailwind 4 | Free |
| Deploy | Vercel | Free |
| i18n | next-intl | Free |

---

## 3. Architecture

### 3.1 Real-Time Call Pipeline

Every patient utterance flows through three tiers. Which tier fires depends on confidence and risk.

```
Patient call
  → Vapi (telephony, turn detection, STT config, TTS config)
    → AssemblyAI Medical STT → streaming transcript + per-word confidence scores
    → POST /api/vapi/chat  (Next.js Edge Runtime)

        [Layer 1 — Rules, ~5ms]
        - Regex: dose normalization, date parsing
        - RxNorm dict: drug name candidate extraction
        - Safety keyword scan → tag CANDIDATE_ESCALATION (high recall, not final)
        - Compute entity confidence: avg(word confidences) × dict_match_score
        - Assign initial confidence per entity

        [Layer 2 — Context enrichment, parallel ~30ms]
        - Read call context from Supabase call_sessions (pre-fetched on call_started)
        - Compare extracted entities vs. verified med list
        - Contradiction check: "warfarin 100mg" vs. record "5mg"
        - Negation regex: "I don't have", "no longer", "stopped" → clear false flags
        - Entity source tagged: stt_inferred

        [Layer 3 — Groq structured reasoning, only when needed, ~200ms]
        Triggers: confidence < 0.85 OR CANDIDATE_ESCALATION OR contradiction
        - Single Groq call, structured JSON output:
          { entities, contradiction, safety_trigger, action, response_text }
        - Grounded strictly on: transcript + cached meds + Supermemory context
        - NEVER invents medications, doses, or diagnoses
        - Returns one of: ACCEPT | CLARIFY | PROPOSE_ALTERNATIVES | ESCALATE | HUMAN_REVIEW

        → Save decision log to Supabase (always)
        → Return response_text to Vapi
    → ElevenLabs TTS → spoken reply to patient
```

**Latency targets:**
- Fast path (Layer 1+2 only): ~200ms pipeline
- Medium path (+ Layer 3): ~400ms pipeline
- All + ElevenLabs first audio (~200ms): 400–600ms perceived

### 3.2 Call Context Pre-Cache

On `call_started` webhook (fires before patient speaks):

```typescript
// Fires on /api/vapi/call-started (Edge Runtime)
const [memory, meds, appointments] = await Promise.all([
  supermemory.query(patientId, "medications symptoms history"),
  supabase.from("medications").select("*").eq("patient_id", id),
  supabase.from("appointments").select("*").eq("patient_id", id),
])
// Written to call_sessions table (Supabase) keyed by call_id
// Edge Runtime is stateless — cannot use in-memory storage
await supabase.from("call_sessions").insert({
  call_id, patient_id, context: { memory, meds, appointments }, created_at: now
})
```

`call_sessions` is added to the DB schema. Each turn reads from it with a single indexed lookup. Row deleted on `call_ended`. Saves ~150ms per turn vs live Supermemory + Supabase queries.

### 3.3 Four Agent Personas (Groq prompt configs)

| Agent | Trigger | Behavior |
|---|---|---|
| **Intake** | Outbound call | Structured check-in: symptoms, meds, adherence. Scored questions. |
| **Inbound** | Patient calls in | Refills, scheduling, "what should I do". Reads calendar + meds. |
| **Clarification** | Confidence < 0.85 | Targeted question or proposes 2–3 alternatives from patient med list. |
| **Escalation** | Safety trigger confirmed | Emergency instructions. Flags clinician. Can trigger urgent outbound. |

All share the same Groq client, same structured output schema, same cache. Only system prompt differs.

### 3.4 Post-Call Pipeline (async)

```
call_ended webhook → POST /api/vapi/end-of-call (Serverless)
  → invoke Supabase Edge Function: post_call_processor
      → Gemini 2.0 Flash: summarize transcript, severity score 0–10
      → HuggingFace Inference API (parallel, latency fine here):
          d4data/biomedical-ner-all → deep NER on full transcript
          bvanaken/CORe-clinical-diagnosis-negation-detection → negation pass
      → Update Supabase: symptoms, medications, patient_timeline, severity_score
      → Supermemory: store enriched call memory
      → Tavily: savings search for any new/changed medications
      → severity_router: score 1–3 nothing, 4–6 schedule followup 24h,
                          7–8 followup 4h + clinician alert, 9–10 immediate escalation
```

---

## 4. Event-Driven Automation

Every meaningful DB change fires a downstream event. No polling inside the call pipeline.

```
call.completed         → post_call_processor
escalation.created     → escalation_handler (notify clinician, push dashboard alert)
correction.created     → correction_processor
  (patient fixes dashboard) → update Supabase, Supermemory, re-score severity,
                              refresh Tavily savings if med changed,
                              check appointment conflicts if appt changed
appointment.updated    → appointment_monitor
  → check Google Calendar for doctor availability
  → if conflict: auto-reschedule + trigger Vapi outbound notify + Realtime dashboard update
doctor.availability_changed → scan all upcoming appointments for this doctor
  → batch fire appointment.updated per affected patient
patients.severity_score updated → severity_router decides follow-up urgency
```

**Cron jobs (Supabase Edge Functions):**

| Job | Schedule | What it does |
|---|---|---|
| `calendar_sync` | Every 15 min | Poll Google Calendar, diff against last sync, fire availability_changed |
| `symptom_followup` | Every 1 hr | Find unacknowledged severity ≥ 5 → trigger follow-up call |
| `medication_enrichment` | Every 6 hr | Refresh Tavily savings cards for active meds |
| `proactive_checkin` | Daily 8am | Schedule outbound calls for patients due for check-in |

---

## 5. Database Schema

```sql
patients         id, token, password_hash, name_alias, language, phone,
                 severity_score, created_at, last_call_at

call_sessions    id, call_id, patient_id, context (jsonb), created_at
                 ← temporary cache, deleted on call_ended

medications      id, patient_id, drug_name, drug_name_normalized,
                 dose, frequency, start_date, end_date,
                 source, active, verified_at

calls            id, patient_id, vapi_call_id, type, status, intent,
                 severity_score, transcript, summary,
                 started_at, ended_at, language

call_entities    id, call_id, patient_id, entity_type, value_raw,
                 value_normalized, confidence, negated, contradiction_detected,
                 action_taken, source, decision_rationale, created_at

patient_timeline id, patient_id, event_type, content (jsonb),
                 severity, flagged, source, created_at

appointments     id, patient_id, doctor_id, datetime, status,
                 reschedule_reason, conflict_detected,
                 google_calendar_event_id, created_at, updated_at

doctors          id, name, specialty, phone,
                 google_calendar_id, availability_last_synced

symptoms         id, patient_id, call_id, symptom_name, severity,
                 onset_date, resolved, flagged_to_clinician

escalations      id, patient_id, call_id, trigger_term,
                 context_summary, severity, status,
                 clinician_notified_at, created_at

corrections      id, patient_id, entity_type, old_value, new_value,
                 corrected_by, corrected_at, source_call_id, applied_to_memory

notifications    id, patient_id, type, message, language,
                 status, scheduled_at, sent_at, triggered_by

automation_jobs  id, type, status, payload (jsonb), result (jsonb),
                 triggered_by, created_at, completed_at
```

---

## 6. Project File Structure

Simple, flat, no over-abstraction. One file per responsibility.

```
carecallerai/
├── src/
│   ├── app/
│   │   ├── [locale]/
│   │   │   ├── layout.tsx              ← HeroUI provider, next-intl
│   │   │   ├── page.tsx                ← landing / demo page
│   │   │   ├── dashboard/[token]/page.tsx   ← patient dashboard
│   │   │   └── clinician/[id]/page.tsx      ← clinician timeline
│   │   └── api/
│   │       ├── vapi/
│   │       │   ├── chat/route.ts       ← Edge Runtime
│   │       │   ├── call-started/route.ts ← Edge Runtime
│   │       │   └── end-of-call/route.ts
│   │       ├── dashboard/
│   │       │   ├── [token]/route.ts
│   │       │   └── correction/route.ts
│   │       └── appointments/route.ts
│   │
│   ├── components/
│   │   ├── ui/                         ← glass primitives
│   │   │   ├── GlassCard.tsx
│   │   │   ├── GlassButton.tsx
│   │   │   ├── GlassBadge.tsx
│   │   │   └── SourceTag.tsx
│   │   ├── dashboard/
│   │   │   ├── CallSummarySection.tsx
│   │   │   ├── EntityCard.tsx
│   │   │   ├── MedicationSection.tsx
│   │   │   ├── AppointmentSection.tsx
│   │   │   ├── AlertBanner.tsx
│   │   │   ├── TimelineSection.tsx
│   │   │   ├── CorrectionModal.tsx
│   │   │   └── SavingsCard.tsx
│   │   ├── clinician/
│   │   │   ├── TimelineFeed.tsx
│   │   │   ├── EscalationCard.tsx
│   │   │   └── CallTranscriptView.tsx
│   │   └── shared/
│   │       ├── PinGate.tsx
│   │       ├── LanguageSwitcher.tsx
│   │       └── LiveBadge.tsx
│   │
│   ├── lib/
│   │   ├── supabase.ts                 ← server + browser client
│   │   ├── vapi.ts                     ← Vapi SDK + chat handler
│   │   ├── groq.ts                     ← structured entity extraction
│   │   ├── gemini.ts                   ← post-call summary
│   │   ├── supermemory.ts              ← add/query patient memories
│   │   ├── tavily.ts                   ← medication savings search
│   │   ├── nlp.ts                      ← rules, dose norm, RxNorm dict, confidence
│   │   └── events.ts                   ← fire automation events to Supabase
│   │
│   ├── hooks/
│   │   ├── useRealtimeAppointment.ts
│   │   └── useRealtimeAlerts.ts
│   │
│   └── types.ts                        ← all shared types in one file
│
├── messages/
│   ├── en.json
│   └── es.json
│
├── supabase/
│   ├── migrations/001_schema.sql
│   └── functions/
│       ├── post-call-processor/index.ts
│       ├── appointment-monitor/index.ts
│       ├── symptom-followup/index.ts
│       ├── medication-enrichment/index.ts
│       └── calendar-sync/index.ts
│
└── public/
```

---

## 7. UI Design System

**Style:** Minimal glassmorphism, CareCaller blue palette, dark navy base.

```
Background:   #050C1A
Glass panel:  rgba(8, 25, 60, 0.55) + backdrop-blur-xl
Glass border: rgba(59, 130, 246, 0.12)
Primary:      #3B82F6  (blue-500)
Accent:       #06B6D4  (cyan-500) — live states, call activity
Danger:       #EF4444  — escalations, critical
Warning:      #F59E0B  — needs review, low confidence
Success:      #10B981  — confirmed, verified
Text:         #F8FAFC / rgba(248,250,252,0.55)
```

**EntityCard confidence border:**
- Green left border → confidence ≥ 0.85, verified
- Amber left border → confidence 0.5–0.85, needs review
- Red left border   → contradiction detected

**Alert severity:**
- Score 4–6: amber banner "follow-up scheduled"
- Score 7–8: pulsing red border "staff will contact you"
- Score 9–10: full red glass panel + emergency contact + 911 instruction

**Realtime:** Supabase Realtime subscriptions on `appointments` and `escalations` tables — dashboard updates in place without refresh. `LiveBadge` pulses briefly on update.

---

## 8. i18n

- `next-intl` with `[locale]` routing segment
- Locales: `en`, `es`
- Patient language stored in `patients.language`, drives:
  - Dashboard UI locale
  - ElevenLabs voice selection
  - Groq system prompt language
  - Clarification question language
- All UI strings in `messages/en.json` and `messages/es.json`

---

## 9. Security (hackathon scope)

- Patient dashboard: tokenized URL (`/dashboard/[token]`) + bcrypt PIN check
- No real PHI — demo uses name aliases and synthetic data
- All API keys in environment variables (`.env.local`, Vercel env)
- Supabase RLS policies on all tables (patient can only read their own rows)
- HTTPS enforced by Vercel

---

## 10. Accuracy + Safety Guarantees

| Requirement | Mechanism |
|---|---|
| False positive safety triggers | Negation regex pre-check + Groq context validation before escalation |
| Hallucination prevention | Groq grounded on retrieved facts only. System prompt: never invent. |
| Drug name false matches | RxNorm dict + phonetic correction + patient history context bias |
| Contradiction detection | Layer 2 compares utterance vs. verified Supabase record |
| Source traceability | Every entity lifecycle: stt_inferred → context_enriched → patient_verified → clinician_verified |
| Audit trail | Full decision log per entity per turn in `call_entities` table |
| No autonomous medication changes | Hard rule: med changes always → HUMAN_REVIEW |
| No speech enhancement | Not applied (per research: can degrade WER on modern ASR) |
| Patient corrections feed future calls | Dashboard fix → Supermemory update → smarter next call |

---

## 11. Demo Scenarios

**Scenario 1 — Outbound post-discharge check-in:**
CareCaller calls patient, asks about symptoms and meds, detects "worsening shortness of breath", runs escalation path, flags clinician, pushes alert to dashboard.

**Scenario 2 — Inbound refill request:**
Patient calls, says "I need a refill for Lexapro ten milligrams." Agent verifies, normalizes to "Lexapro 10 mg", confirms with patient, logs to timeline.

**Scenario 3 — Doctor reschedules:**
Doctor updates Google Calendar. Cron job detects conflict, auto-reschedules appointment, triggers Vapi outbound call to notify patient in their language, dashboard updates in realtime.

**Scenario 4 — Patient corrects dashboard:**
Patient sees "Warfarin 100 mg" (STT error), clicks Fix, enters "5 mg". Correction stored as patient_verified, Supermemory updated, next call references correct dose.
