# CareCaller AI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build CareCaller AI — a voice agent for healthcare that calls patients, processes speech with a 3-layer NLP pipeline, and surfaces a real-time patient dashboard.

**Architecture:** Next.js App Router with HeroUI + Tailwind 4 frontend. Vapi handles telephony and calls our `/api/vapi/chat` Edge Route as a custom LLM server. AssemblyAI Medical STT, Groq + Llama 3.1 8B for real-time reasoning, Gemini 2.0 Flash for post-call summaries. Supabase for DB + Edge Functions (cron jobs + async processing). Supermemory for patient RAG. Tavily for medication savings search. next-intl for EN/ES.

**Tech Stack:** Next.js 15, HeroUI, Tailwind 4, TypeScript, Supabase, Vapi, AssemblyAI, ElevenLabs, Groq SDK, Google Generative AI SDK, Supermemory, Tavily, next-intl, bcryptjs, Vercel

---

## File Map

```
src/
  app/
    [locale]/
      layout.tsx                  ← HeroUI provider + next-intl
      page.tsx                    ← landing/demo page
      dashboard/[token]/page.tsx  ← patient dashboard
      clinician/[id]/page.tsx     ← clinician timeline
    api/
      vapi/
        chat/route.ts             ← Edge, custom LLM endpoint for Vapi
        call-started/route.ts     ← Edge, pre-cache patient context
        end-of-call/route.ts      ← async, trigger post-call processing
      dashboard/
        [token]/route.ts          ← fetch dashboard data + verify PIN
        correction/route.ts       ← patient submits correction
      appointments/route.ts       ← confirm/change appointment
  components/
    ui/
      GlassCard.tsx               ← base glass panel
      GlassButton.tsx             ← primary/secondary actions
      GlassBadge.tsx              ← status badges
      SourceTag.tsx               ← stt_inferred|verified|etc
    dashboard/
      AlertBanner.tsx             ← severity-based alert
      AppointmentSection.tsx      ← upcoming appts + realtime
      CallSummarySection.tsx      ← last call overview
      CorrectionModal.tsx         ← fix entity flow
      EntityCard.tsx              ← med/symptom with confirm/fix
      MedicationSection.tsx       ← meds + savings cards
      SavingsCard.tsx             ← Tavily savings info
      TimelineSection.tsx         ← recent events
    clinician/
      CallTranscriptView.tsx      ← transcript + highlighted entities
      EscalationCard.tsx          ← flagged escalations
      TimelineFeed.tsx            ← chronological patient events
    shared/
      LanguageSwitcher.tsx        ← EN/ES toggle
      LiveBadge.tsx               ← pulsing live indicator
      PinGate.tsx                 ← PIN prompt before dashboard
  hooks/
    useRealtimeAlerts.ts          ← Supabase Realtime on escalations
    useRealtimeAppointment.ts     ← Supabase Realtime on appointments
  lib/
    events.ts                     ← fire automation events to Supabase
    gemini.ts                     ← post-call transcript summary
    groq.ts                       ← structured entity extraction + agent prompts
    nlp.ts                        ← rules, dose norm, RxNorm dict, confidence
    supabase.ts                   ← server + browser Supabase clients
    supermemory.ts                ← add/query patient memories
    tavily.ts                     ← medication savings search
    vapi.ts                       ← Vapi pipeline orchestrator (layers 1-3)
  types.ts                        ← all shared TypeScript types
messages/
  en.json
  es.json
supabase/
  migrations/001_schema.sql
  functions/
    post-call-processor/index.ts
    appointment-monitor/index.ts
    symptom-followup/index.ts
    medication-enrichment/index.ts
```

---

## Task 1: Initialize Project

**Files:**
- Create: project root (via CLI)
- Modify: `package.json`, `src/app/globals.css`, `.env.local`

- [ ] **Step 1: Scaffold with HeroUI CLI**

Run inside `C:\Users\presyze\Projects\ASU\carecallerai`:
```bash
npx heroui-cli@latest init -t app .
```
Select: TypeScript, App Router, src/ directory, Tailwind when prompted.

- [ ] **Step 2: Install additional dependencies**

```bash
npm install next-intl @supabase/supabase-js groq-sdk @google/generative-ai bcryptjs
npm install @types/bcryptjs --save-dev
npm install vitest @vitejs/plugin-react --save-dev
```

- [ ] **Step 3: Replace `src/app/globals.css` with Tailwind 4 theme**

```css
@import "tailwindcss";

@theme {
  --color-navy-950: #050C1A;
  --color-navy-900: #080F20;
  --color-navy-800: #0D1730;
  --color-brand: #3B82F6;
  --color-brand-dark: #1D4ED8;
  --color-teal: #06B6D4;
}

body {
  background-color: #050C1A;
  color: #F8FAFC;
  font-family: var(--font-sans);
}
```

- [ ] **Step 4: Create `.env.local`**

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Vapi
VAPI_API_KEY=
VAPI_WEBHOOK_SECRET=

# AssemblyAI
ASSEMBLYAI_API_KEY=

# ElevenLabs
ELEVENLABS_API_KEY=

# Groq
GROQ_API_KEY=

# Gemini
GEMINI_API_KEY=

# Supermemory
SUPERMEMORY_API_KEY=

# Tavily
TAVILY_API_KEY=
```

- [ ] **Step 5: Add vitest config — create `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
})
```

- [ ] **Step 6: Verify dev server starts**

```bash
npm run dev
```
Expected: app running at http://localhost:3000 with HeroUI default page.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: initialize project with HeroUI, Tailwind 4, dependencies"
```

---

## Task 2: Types + Supabase Schema

**Files:**
- Create: `src/types.ts`
- Create: `supabase/migrations/001_schema.sql`
- Create: `src/lib/supabase.ts`

- [ ] **Step 1: Create `src/types.ts`**

```typescript
export type Language = 'en' | 'es'
export type EntitySource = 'stt_inferred' | 'context_enriched' | 'patient_verified' | 'clinician_verified'
export type EntityType = 'drug' | 'dose' | 'symptom' | 'date' | 'appointment'
export type ActionTaken = 'accepted' | 'clarified' | 'escalated' | 'human_review' | 'propose_alternatives'
export type CallType = 'inbound' | 'outbound'
export type CallStatus = 'scheduled' | 'in_progress' | 'completed' | 'failed'
export type AppointmentStatus = 'scheduled' | 'confirmed' | 'rescheduled' | 'cancelled'
export type EscalationStatus = 'pending' | 'acknowledged' | 'resolved'

export interface Patient {
  id: string
  token: string
  name_alias: string
  language: Language
  phone: string
  severity_score: number
  created_at: string
  last_call_at: string | null
}

export interface Medication {
  id: string
  patient_id: string
  drug_name: string
  drug_name_normalized: string
  dose: string
  frequency: string
  start_date: string
  end_date: string | null
  source: EntitySource
  active: boolean
  verified_at: string | null
}

export interface Appointment {
  id: string
  patient_id: string
  doctor_id: string
  datetime: string
  status: AppointmentStatus
  reschedule_reason: string | null
  conflict_detected: boolean
  google_calendar_event_id: string | null
  updated_at: string
}

export interface Doctor {
  id: string
  name: string
  specialty: string
  phone: string
  google_calendar_id: string | null
  availability_last_synced: string | null
}

export interface Call {
  id: string
  patient_id: string
  vapi_call_id: string
  type: CallType
  status: CallStatus
  intent: string
  severity_score: number
  transcript: string | null
  summary: string | null
  started_at: string
  ended_at: string | null
  language: Language
}

export interface CallSession {
  call_id: string
  patient_id: string
  context: {
    memory: string
    meds: Medication[]
    appointments: Appointment[]
  }
  created_at: string
}

export interface ExtractedEntity {
  type: EntityType
  value_raw: string
  value_normalized: string
  confidence: number
  negated: boolean
  source: EntitySource
}

export interface GroqExtractionResult {
  entities: ExtractedEntity[]
  contradiction: { detected: boolean; field?: string; heard?: string; record?: string }
  safety_trigger: { detected: boolean; term?: string; negated?: boolean }
  action: ActionTaken
  clarification_text: string | null
  response_text: string
}

export interface TimelineEvent {
  id: string
  patient_id: string
  event_type: string
  content: Record<string, unknown>
  severity: number
  flagged: boolean
  source: EntitySource
  created_at: string
}

export interface Escalation {
  id: string
  patient_id: string
  call_id: string
  trigger_term: string
  context_summary: string
  severity: number
  status: EscalationStatus
  clinician_notified_at: string | null
  created_at: string
}
```

- [ ] **Step 2: Create `supabase/migrations/001_schema.sql`**

```sql
-- Enable extensions
create extension if not exists "uuid-ossp";
create extension if not exists pg_net;
create extension if not exists pg_cron;

-- Patients
create table patients (
  id uuid primary key default uuid_generate_v4(),
  token text unique not null,
  password_hash text not null,
  name_alias text not null,
  language text not null default 'en',
  phone text,
  severity_score int not null default 0,
  created_at timestamptz default now(),
  last_call_at timestamptz
);

-- Doctors
create table doctors (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  specialty text,
  phone text,
  google_calendar_id text,
  availability_last_synced timestamptz
);

-- Medications
create table medications (
  id uuid primary key default uuid_generate_v4(),
  patient_id uuid references patients(id) on delete cascade,
  drug_name text not null,
  drug_name_normalized text,
  dose text,
  frequency text,
  start_date date,
  end_date date,
  source text not null default 'stt_inferred',
  active boolean default true,
  verified_at timestamptz
);

-- Calls
create table calls (
  id uuid primary key default uuid_generate_v4(),
  patient_id uuid references patients(id) on delete cascade,
  vapi_call_id text unique,
  type text not null,
  status text not null default 'scheduled',
  intent text,
  severity_score int default 0,
  transcript text,
  summary text,
  started_at timestamptz default now(),
  ended_at timestamptz,
  language text default 'en'
);

-- Call entities (decision log)
create table call_entities (
  id uuid primary key default uuid_generate_v4(),
  call_id uuid references calls(id) on delete cascade,
  patient_id uuid references patients(id) on delete cascade,
  entity_type text,
  value_raw text,
  value_normalized text,
  confidence float,
  negated boolean default false,
  contradiction_detected boolean default false,
  action_taken text,
  source text default 'stt_inferred',
  decision_rationale text,
  created_at timestamptz default now()
);

-- Call sessions (pre-cache, ephemeral)
create table call_sessions (
  call_id text primary key,
  patient_id uuid references patients(id) on delete cascade,
  context jsonb not null,
  created_at timestamptz default now()
);

-- Patient timeline
create table patient_timeline (
  id uuid primary key default uuid_generate_v4(),
  patient_id uuid references patients(id) on delete cascade,
  event_type text not null,
  content jsonb default '{}',
  severity int default 0,
  flagged boolean default false,
  source text default 'stt_inferred',
  created_at timestamptz default now()
);

-- Appointments
create table appointments (
  id uuid primary key default uuid_generate_v4(),
  patient_id uuid references patients(id) on delete cascade,
  doctor_id uuid references doctors(id),
  datetime timestamptz not null,
  status text default 'scheduled',
  reschedule_reason text,
  conflict_detected boolean default false,
  google_calendar_event_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Symptoms
create table symptoms (
  id uuid primary key default uuid_generate_v4(),
  patient_id uuid references patients(id) on delete cascade,
  call_id uuid references calls(id),
  symptom_name text not null,
  severity int default 0,
  onset_date date,
  resolved boolean default false,
  flagged_to_clinician boolean default false
);

-- Escalations
create table escalations (
  id uuid primary key default uuid_generate_v4(),
  patient_id uuid references patients(id) on delete cascade,
  call_id uuid references calls(id),
  trigger_term text,
  context_summary text,
  severity int default 8,
  status text default 'pending',
  clinician_notified_at timestamptz,
  created_at timestamptz default now()
);

-- Corrections
create table corrections (
  id uuid primary key default uuid_generate_v4(),
  patient_id uuid references patients(id) on delete cascade,
  entity_type text not null,
  old_value text,
  new_value text not null,
  corrected_by text default 'patient',
  corrected_at timestamptz default now(),
  source_call_id uuid references calls(id),
  applied_to_memory boolean default false
);

-- Notifications
create table notifications (
  id uuid primary key default uuid_generate_v4(),
  patient_id uuid references patients(id) on delete cascade,
  type text not null,
  message text not null,
  language text default 'en',
  status text default 'pending',
  scheduled_at timestamptz,
  sent_at timestamptz,
  triggered_by text
);

-- Automation jobs
create table automation_jobs (
  id uuid primary key default uuid_generate_v4(),
  type text not null,
  status text default 'pending',
  payload jsonb default '{}',
  result jsonb,
  triggered_by text,
  created_at timestamptz default now(),
  completed_at timestamptz
);

-- RLS: patients can only read their own data
alter table patients enable row level security;
alter table medications enable row level security;
alter table appointments enable row level security;
alter table patient_timeline enable row level security;
alter table symptoms enable row level security;
alter table escalations enable row level security;
alter table corrections enable row level security;

-- Insert seed data for demo
insert into doctors (id, name, specialty, phone)
values ('00000000-0000-0000-0000-000000000001', 'Dr. Sarah Chen', 'Internal Medicine', '+15550001234');

insert into patients (id, token, password_hash, name_alias, language, phone, severity_score)
values (
  '00000000-0000-0000-0000-000000000002',
  'demo-patient-token-abc123',
  '$2b$10$placeholder', -- replace with real bcrypt hash in seed script
  'Patient Demo',
  'en',
  '+15550005678',
  3
);
```

- [ ] **Step 3: Run the migration**

In Supabase dashboard → SQL Editor → paste and run `001_schema.sql`.
Or via CLI: `supabase db push`

- [ ] **Step 4: Create `src/lib/supabase.ts`**

```typescript
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const service = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Browser client (respects RLS)
export const supabaseBrowser = createClient(url, anon)

// Server/admin client (bypasses RLS — use only in API routes and Edge Functions)
export const supabaseAdmin = createClient(url, service, {
  auth: { persistSession: false },
})
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add types, Supabase schema, and client"
```

---

## Task 3: i18n Setup

**Files:**
- Create: `src/i18n/routing.ts`, `src/i18n/request.ts`
- Create: `middleware.ts`
- Create: `messages/en.json`, `messages/es.json`
- Modify: `src/app/[locale]/layout.tsx`

- [ ] **Step 1: Create `src/i18n/routing.ts`**

```typescript
import { defineRouting } from 'next-intl/routing'

export const routing = defineRouting({
  locales: ['en', 'es'],
  defaultLocale: 'en',
})
```

- [ ] **Step 2: Create `src/i18n/request.ts`**

```typescript
import { getRequestConfig } from 'next-intl/server'
import { routing } from './routing'

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale
  if (!locale || !routing.locales.includes(locale as 'en' | 'es')) {
    locale = routing.defaultLocale
  }
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  }
})
```

- [ ] **Step 3: Create `middleware.ts` (project root)**

```typescript
import createMiddleware from 'next-intl/middleware'
import { routing } from './src/i18n/routing'

export default createMiddleware(routing)

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
}
```

- [ ] **Step 4: Create `messages/en.json`**

```json
{
  "dashboard": {
    "title": "Your Care Summary",
    "lastCall": "From your last call",
    "medications": "Your Medications",
    "appointments": "Upcoming Appointments",
    "alerts": "Important Alerts",
    "timeline": "Recent Activity",
    "confirm": "Confirm",
    "fix": "Fix",
    "noData": "No data yet",
    "loading": "Loading...",
    "savings": "Cost savings info",
    "emergency": "If you feel unsafe, call 911 immediately",
    "staffWillContact": "A staff member will contact you soon",
    "followUpScheduled": "A follow-up has been scheduled",
    "source": {
      "stt_inferred": "system inferred",
      "context_enriched": "context matched",
      "patient_verified": "you confirmed",
      "clinician_verified": "doctor verified"
    }
  },
  "pin": {
    "title": "Enter your PIN to continue",
    "placeholder": "PIN",
    "submit": "Continue",
    "error": "Incorrect PIN. Please try again."
  },
  "clinician": {
    "title": "Patient Timeline",
    "escalations": "Active Escalations",
    "transcript": "Call Transcript"
  }
}
```

- [ ] **Step 5: Create `messages/es.json`**

```json
{
  "dashboard": {
    "title": "Tu Resumen de Atención",
    "lastCall": "De tu última llamada",
    "medications": "Tus Medicamentos",
    "appointments": "Próximas Citas",
    "alerts": "Alertas Importantes",
    "timeline": "Actividad Reciente",
    "confirm": "Confirmar",
    "fix": "Corregir",
    "noData": "Sin datos aún",
    "loading": "Cargando...",
    "savings": "Información de ahorro",
    "emergency": "Si no se siente seguro, llame al 911 inmediatamente",
    "staffWillContact": "Un miembro del personal se pondrá en contacto pronto",
    "followUpScheduled": "Se ha programado un seguimiento",
    "source": {
      "stt_inferred": "inferido por sistema",
      "context_enriched": "coincidencia contextual",
      "patient_verified": "confirmado por ti",
      "clinician_verified": "verificado por médico"
    }
  },
  "pin": {
    "title": "Ingresa tu PIN para continuar",
    "placeholder": "PIN",
    "submit": "Continuar",
    "error": "PIN incorrecto. Inténtalo de nuevo."
  },
  "clinician": {
    "title": "Historial del Paciente",
    "escalations": "Escalaciones Activas",
    "transcript": "Transcripción de Llamada"
  }
}
```

- [ ] **Step 6: Update `src/app/[locale]/layout.tsx`**

```tsx
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { HeroUIProvider } from '@heroui/react'

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const messages = await getMessages()

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider messages={messages}>
          <HeroUIProvider>
            {children}
          </HeroUIProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add next-intl i18n with EN and ES"
```

---

## Task 4: NLP Layer

**Files:**
- Create: `src/lib/nlp.ts`
- Create: `src/lib/nlp.test.ts`

- [ ] **Step 1: Write failing tests — create `src/lib/nlp.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import { normalizeDose, isNegated, isSafetyCandidate, computeConfidence, extractDrugCandidates } from './nlp'

describe('normalizeDose', () => {
  it('converts text numbers to digits', () => {
    expect(normalizeDose('ten milligrams')).toBe('10 mg')
    expect(normalizeDose('five milligrams once a day')).toBe('5 mg QD')
    expect(normalizeDose('twenty mg twice daily')).toBe('20 mg BID')
    expect(normalizeDose('10mg')).toBe('10 mg')
  })
})

describe('isNegated', () => {
  it('detects negation patterns', () => {
    expect(isNegated("I don't have chest pain")).toBe(true)
    expect(isNegated("I no longer take Lexapro")).toBe(true)
    expect(isNegated("I stopped taking metoprolol")).toBe(true)
    expect(isNegated("I have chest pain")).toBe(false)
    expect(isNegated("I am taking Lexapro")).toBe(false)
  })
})

describe('isSafetyCandidate', () => {
  it('flags high-risk phrases', () => {
    expect(isSafetyCandidate("I have chest pain")).toBe(true)
    expect(isSafetyCandidate("I can't breathe")).toBe(true)
    expect(isSafetyCandidate("I want to hurt myself")).toBe(true)
    expect(isSafetyCandidate("I feel a bit tired")).toBe(false)
  })
})

describe('extractDrugCandidates', () => {
  it('finds known drug names', () => {
    const result = extractDrugCandidates("I take lexapro and metoprolol")
    expect(result).toContain('Lexapro')
    expect(result).toContain('Metoprolol')
  })
})
```

- [ ] **Step 2: Run to confirm failure**

```bash
npx vitest run src/lib/nlp.test.ts
```
Expected: FAIL — `nlp.ts` not found.

- [ ] **Step 3: Create `src/lib/nlp.ts`**

```typescript
// RxNorm-style drug dictionary (subset for demo — extend as needed)
const DRUG_DICT: Record<string, string> = {
  lexapro: 'Lexapro', escitalopram: 'Escitalopram',
  metoprolol: 'Metoprolol', lopressor: 'Metoprolol',
  lisinopril: 'Lisinopril', zestril: 'Lisinopril',
  warfarin: 'Warfarin', coumadin: 'Warfarin',
  amlodipine: 'Amlodipine', norvasc: 'Amlodipine',
  lasix: 'Furosemide', furosemide: 'Furosemide',
  metformin: 'Metformin', glucophage: 'Metformin',
  atorvastatin: 'Atorvastatin', lipitor: 'Atorvastatin',
  omeprazole: 'Omeprazole', prilosec: 'Omeprazole',
  sertraline: 'Sertraline', zoloft: 'Sertraline',
  gabapentin: 'Gabapentin', neurontin: 'Gabapentin',
}

const TEXT_NUMBERS: Record<string, string> = {
  one: '1', two: '2', three: '3', four: '4', five: '5',
  six: '6', seven: '7', eight: '8', nine: '9', ten: '10',
  fifteen: '15', twenty: '20', twenty-five: '25', thirty: '30',
  forty: '40', fifty: '50', hundred: '100',
}

const FREQUENCY_MAP: Record<string, string> = {
  'once a day': 'QD', 'once daily': 'QD', 'one time a day': 'QD',
  'twice a day': 'BID', 'twice daily': 'BID', 'two times a day': 'BID',
  'three times a day': 'TID', 'thrice daily': 'TID',
  'four times a day': 'QID',
  'every night': 'QHS', 'at bedtime': 'QHS',
}

const SAFETY_TERMS = [
  'chest pain', 'chest tightness', 'shortness of breath', "can't breathe",
  'cannot breathe', 'difficulty breathing', 'stroke', 'facial drooping',
  'arm weakness', 'slurred speech', 'suicidal', 'want to die', 'hurt myself',
  'kill myself', 'allergic reaction', 'anaphylaxis', 'severe bleeding',
  'unconscious', 'seizure', 'heart attack',
]

const NEGATION_PATTERNS = [
  /\bno longer\b/i, /\bdon'?t have\b/i, /\bdo not have\b/i,
  /\bstopped? taking\b/i, /\bstopped?\b/i, /\bnot taking\b/i,
  /\bnever had\b/i, /\bwithout\b/i, /\bdenies?\b/i,
  /\bno\s+(chest|pain|breath|symptom)/i,
]

export function normalizeDose(text: string): string {
  let result = text.toLowerCase()

  // Replace text numbers
  for (const [word, num] of Object.entries(TEXT_NUMBERS)) {
    result = result.replace(new RegExp(`\\b${word}\\b`, 'gi'), num)
  }

  // Normalize units
  result = result
    .replace(/milligrams?/gi, 'mg')
    .replace(/micrograms?/gi, 'mcg')
    .replace(/milliliters?/gi, 'mL')
    .replace(/units?/gi, 'units')
    .replace(/(\d)\s*mg/gi, '$1 mg')

  // Normalize frequency
  for (const [phrase, abbr] of Object.entries(FREQUENCY_MAP)) {
    result = result.replace(new RegExp(phrase, 'gi'), abbr)
  }

  return result.trim()
}

export function isNegated(text: string): boolean {
  return NEGATION_PATTERNS.some((pattern) => pattern.test(text))
}

export function isSafetyCandidate(text: string): boolean {
  const lower = text.toLowerCase()
  return SAFETY_TERMS.some((term) => lower.includes(term))
}

export function extractDrugCandidates(text: string): string[] {
  const lower = text.toLowerCase()
  const found: string[] = []
  for (const [key, normalized] of Object.entries(DRUG_DICT)) {
    if (lower.includes(key) && !found.includes(normalized)) {
      found.push(normalized)
    }
  }
  return found
}

export function normalizeDrugName(raw: string): string {
  return DRUG_DICT[raw.toLowerCase()] ?? raw
}

// Confidence: average of word STT confidences, boosted if drug found in dict
export function computeConfidence(
  wordConfidences: number[],
  foundInDict: boolean
): number {
  const avg = wordConfidences.length > 0
    ? wordConfidences.reduce((a, b) => a + b, 0) / wordConfidences.length
    : 0.5
  return Math.min(1, foundInDict ? avg + 0.15 : avg)
}
```

- [ ] **Step 4: Fix the `twenty-five` key (hyphens aren't valid in object literals)**

Replace in `TEXT_NUMBERS`:
```typescript
'twenty-five': '25',
```
with:
```typescript
'twentyfive': '25',
```

- [ ] **Step 5: Run tests**

```bash
npx vitest run src/lib/nlp.test.ts
```
Expected: All PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/nlp.ts src/lib/nlp.test.ts
git commit -m "feat: add NLP layer with dose normalization, negation, safety detection"
```

---

## Task 5: Groq + Supermemory + Tavily Integrations

**Files:**
- Create: `src/lib/groq.ts`
- Create: `src/lib/supermemory.ts`
- Create: `src/lib/tavily.ts`

- [ ] **Step 1: Create `src/lib/groq.ts`**

```typescript
import Groq from 'groq-sdk'
import type { GroqExtractionResult } from '@/types'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! })

const AGENT_PROMPTS = {
  intake: (lang: string) => `You are CareCaller, a compassionate healthcare voice agent conducting a patient check-in${lang === 'es' ? ' in Spanish' : ''}. Ask structured questions about symptoms, medications, and adherence. Be warm but concise. You ONLY use facts from the transcript and provided patient records. NEVER invent medications or diagnoses.`,
  inbound: (lang: string) => `You are CareCaller, a helpful healthcare voice agent handling an inbound patient call${lang === 'es' ? ' in Spanish' : ''}. Help with refill requests, scheduling questions, and general guidance. You ONLY use facts from the transcript and provided patient records. NEVER invent medications or clinical information.`,
  clarification: (lang: string) => `You are CareCaller${lang === 'es' ? ' responding in Spanish' : ''}. You need to clarify something you didn't fully understand. Ask one clear, focused question. Offer alternatives only from the patient's known medication list.`,
  escalation: (lang: string) => `You are CareCaller${lang === 'es' ? ' responding in Spanish' : ''}. You have detected a potentially urgent health concern. Calmly provide emergency guidance and inform the patient that a clinician will be notified. If life-threatening, advise calling 911.`,
}

export async function extractAndRespond(params: {
  transcript: string
  agentType: keyof typeof AGENT_PROMPTS
  language: string
  verifiedMeds: Array<{ drug_name_normalized: string; dose: string }>
  supermemoryContext: string
  flaggedEntities: string[]
  contradiction: { detected: boolean; field?: string; heard?: string; record?: string }
}): Promise<GroqExtractionResult> {
  const { transcript, agentType, language, verifiedMeds, supermemoryContext, flaggedEntities, contradiction } = params

  const systemPrompt = AGENT_PROMPTS[agentType](language)
  const medsContext = verifiedMeds.map((m) => `${m.drug_name_normalized} ${m.dose}`).join(', ')

  const userPrompt = `
Patient's verified medications: ${medsContext || 'none on file'}
Prior context from memory: ${supermemoryContext || 'none'}
${contradiction.detected ? `CONTRADICTION DETECTED: Patient said "${contradiction.heard}" but record shows "${contradiction.record}" for ${contradiction.field}` : ''}
${flaggedEntities.length ? `LOW CONFIDENCE ENTITIES needing clarification: ${flaggedEntities.join(', ')}` : ''}

Patient's latest utterance: "${transcript}"

Respond ONLY with valid JSON matching this exact structure:
{
  "entities": [{"type": "drug|dose|symptom|date|appointment", "value_raw": "", "value_normalized": "", "confidence": 0.0, "negated": false, "source": "stt_inferred"}],
  "contradiction": {"detected": false, "field": "", "heard": "", "record": ""},
  "safety_trigger": {"detected": false, "term": "", "negated": false},
  "action": "accepted|clarified|escalated|human_review|propose_alternatives",
  "clarification_text": null,
  "response_text": "Your spoken response to the patient"
}
Rules: Never invent medications. If unsure, set action to "clarified" and ask. If safety trigger is negated ("no chest pain"), set safety_trigger.detected = false.`

  const completion = await groq.chat.completions.create({
    model: 'llama-3.1-8b-instant',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.1,
    max_tokens: 512,
  })

  const raw = completion.choices[0]?.message?.content ?? '{}'
  return JSON.parse(raw) as GroqExtractionResult
}
```

- [ ] **Step 2: Create `src/lib/supermemory.ts`**

```typescript
const BASE_URL = 'https://api.supermemory.ai/v3'
const headers = () => ({
  Authorization: `Bearer ${process.env.SUPERMEMORY_API_KEY!}`,
  'Content-Type': 'application/json',
})

export async function addMemory(patientId: string, content: string): Promise<void> {
  await fetch(`${BASE_URL}/memories`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ content, metadata: { patientId } }),
  })
}

export async function queryMemory(patientId: string, query: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/search`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ q: query, metadata: { patientId }, limit: 5 }),
  })
  if (!res.ok) return ''
  const data = await res.json()
  return (data.results ?? []).map((r: { content: string }) => r.content).join('\n')
}
```

- [ ] **Step 3: Create `src/lib/tavily.ts`**

```typescript
const TAVILY_URL = 'https://api.tavily.com/search'

export async function searchMedSavings(drugName: string): Promise<string[]> {
  try {
    const res = await fetch(TAVILY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY!,
        query: `${drugName} patient savings program coupon discount GoodRx`,
        search_depth: 'basic',
        max_results: 3,
        include_domains: ['goodrx.com', 'rxsaver.com', 'needymeds.org', 'pparx.org'],
      }),
    })
    if (!res.ok) return []
    const data = await res.json()
    return (data.results ?? []).map((r: { url: string; title: string }) => `${r.title}: ${r.url}`)
  } catch {
    return []
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/groq.ts src/lib/supermemory.ts src/lib/tavily.ts
git commit -m "feat: add Groq, Supermemory, and Tavily integrations"
```

---

## Task 6: Gemini + Events Dispatcher

**Files:**
- Create: `src/lib/gemini.ts`
- Create: `src/lib/events.ts`

- [ ] **Step 1: Create `src/lib/gemini.ts`**

```typescript
import { GoogleGenerativeAI } from '@google/generative-ai'

const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
const model = genai.getGenerativeModel({ model: 'gemini-2.0-flash' })

export async function summarizeCall(transcript: string, language: string): Promise<{
  summary: string
  severity: number
  symptoms: string[]
  medicationChanges: string[]
  followUpRequired: boolean
}> {
  const prompt = `You are a clinical documentation assistant. Analyze this patient call transcript and return ONLY valid JSON.

Transcript: "${transcript}"

Return:
{
  "summary": "2-3 sentence clinical summary",
  "severity": 0-10,
  "symptoms": ["list of reported symptoms"],
  "medicationChanges": ["list of any medication changes mentioned"],
  "followUpRequired": true/false
}

Severity scale: 0=no concerns, 5=moderate (follow up within 24h), 8=urgent (follow up within 4h), 10=emergency.
Be conservative — only escalate severity if clearly warranted by the transcript.`

  const result = await model.generateContent(prompt)
  const text = result.response.text().replace(/```json\n?|\n?```/g, '').trim()
  return JSON.parse(text)
}
```

- [ ] **Step 2: Create `src/lib/events.ts`**

```typescript
import { supabaseAdmin } from './supabase'

export type AutomationEvent =
  | { type: 'call.completed'; callId: string; patientId: string }
  | { type: 'escalation.created'; patientId: string; callId: string; severity: number }
  | { type: 'correction.created'; patientId: string; correctionId: string }
  | { type: 'appointment.updated'; appointmentId: string; patientId: string }

export async function fireEvent(event: AutomationEvent): Promise<void> {
  await supabaseAdmin.from('automation_jobs').insert({
    type: event.type,
    status: 'pending',
    payload: event,
    triggered_by: event.type,
  })

  // For immediate events, invoke the relevant Edge Function
  if (event.type === 'call.completed') {
    await invokeEdgeFunction('post-call-processor', event)
  } else if (event.type === 'escalation.created') {
    await invokeEdgeFunction('appointment-monitor', event)
  }
}

async function invokeEdgeFunction(name: string, payload: unknown): Promise<void> {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/${name}`
  await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  }).catch(() => {}) // fire-and-forget
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/gemini.ts src/lib/events.ts
git commit -m "feat: add Gemini post-call summary and events dispatcher"
```

---

## Task 7: Vapi Pipeline (core voice backend)

**Files:**
- Create: `src/lib/vapi.ts`
- Create: `src/app/api/vapi/call-started/route.ts`
- Create: `src/app/api/vapi/chat/route.ts`
- Create: `src/app/api/vapi/end-of-call/route.ts`

- [ ] **Step 1: Create `src/lib/vapi.ts`** — the 3-layer pipeline orchestrator

```typescript
import { isSafetyCandidate, isNegated, extractDrugCandidates, normalizeDose, normalizeDrugName, computeConfidence } from './nlp'
import { extractAndRespond } from './groq'
import { supabaseAdmin } from './supabase'
import { fireEvent } from './events'
import type { GroqExtractionResult, Medication, Appointment } from '@/types'

const CONFIDENCE_THRESHOLD = 0.85

export async function runCallPipeline(params: {
  transcript: string
  callId: string
  patientId: string
  language: string
  callType: 'inbound' | 'outbound'
  wordConfidences?: number[]
}): Promise<{ responseText: string; action: string }> {
  const { transcript, callId, patientId, language, callType, wordConfidences = [] } = params

  // --- Layer 1: Rules (~5ms) ---
  const isSafety = isSafetyCandidate(transcript)
  const negated = isNegated(transcript)
  const drugCandidates = extractDrugCandidates(transcript)
  const normalizedDose = normalizeDose(transcript)
  const entityConfidence = computeConfidence(wordConfidences, drugCandidates.length > 0)

  // If safety keyword and NOT negated → immediate escalation (no LLM needed)
  if (isSafety && !negated) {
    const safetyResponse = language === 'es'
      ? 'Escucho que está experimentando algo preocupante. Estoy notificando a su médico ahora mismo. Si está en peligro inmediato, por favor llame al 911.'
      : 'I hear that you\'re experiencing something concerning. I\'m notifying your clinician right now. If you\'re in immediate danger, please call 911.'

    await logDecision(callId, patientId, transcript, 'escalated', 'safety_keyword_detected_not_negated', entityConfidence)
    await fireEvent({ type: 'escalation.created', patientId, callId, severity: 9 })
    return { responseText: safetyResponse, action: 'escalated' }
  }

  // --- Layer 2: Context enrichment from pre-cache (~30ms) ---
  const { data: session } = await supabaseAdmin
    .from('call_sessions')
    .select('context')
    .eq('call_id', callId)
    .single()

  const meds: Medication[] = session?.context?.meds ?? []
  const appointments: Appointment[] = session?.context?.appointments ?? []
  const supermemoryContext: string = session?.context?.memory ?? ''

  // Contradiction check
  const contradiction = detectContradiction(transcript, meds)

  // Determine if Layer 3 needed
  const needsGroq = entityConfidence < CONFIDENCE_THRESHOLD || contradiction.detected || drugCandidates.length > 0

  let result: GroqExtractionResult

  if (!needsGroq) {
    // Fast path: generate simple dialog response without full Groq NER
    const fastCompletion = await extractAndRespond({
      transcript,
      agentType: callType === 'outbound' ? 'intake' : 'inbound',
      language,
      verifiedMeds: meds.map((m) => ({ drug_name_normalized: m.drug_name_normalized, dose: m.dose })),
      supermemoryContext,
      flaggedEntities: [],
      contradiction: { detected: false },
    })
    result = fastCompletion
  } else {
    // --- Layer 3: Groq reasoning ---
    const agentType = contradiction.detected
      ? 'clarification'
      : callType === 'outbound'
        ? 'intake'
        : 'inbound'

    result = await extractAndRespond({
      transcript,
      agentType,
      language,
      verifiedMeds: meds.map((m) => ({ drug_name_normalized: m.drug_name_normalized, dose: m.dose })),
      supermemoryContext,
      flaggedEntities: drugCandidates,
      contradiction,
    })
  }

  await logDecision(callId, patientId, transcript, result.action, result.clarification_text ?? '', entityConfidence)

  return { responseText: result.response_text, action: result.action }
}

function detectContradiction(
  transcript: string,
  meds: Medication[]
): { detected: boolean; field?: string; heard?: string; record?: string } {
  const lower = transcript.toLowerCase()
  for (const med of meds) {
    if (lower.includes(med.drug_name_normalized.toLowerCase())) {
      // Basic dose contradiction: heard a dose that doesn't match record
      const doseMatch = lower.match(/(\d+)\s*mg/)
      if (doseMatch && med.dose) {
        const heardDose = doseMatch[0]
        const recordDose = med.dose
        if (!recordDose.includes(heardDose)) {
          return { detected: true, field: 'dose', heard: heardDose, record: recordDose }
        }
      }
    }
  }
  return { detected: false }
}

async function logDecision(
  callId: string,
  patientId: string,
  transcript: string,
  action: string,
  rationale: string,
  confidence: number
): Promise<void> {
  await supabaseAdmin.from('call_entities').insert({
    call_id: callId,
    patient_id: patientId,
    entity_type: 'utterance',
    value_raw: transcript,
    value_normalized: transcript,
    confidence,
    action_taken: action,
    source: 'stt_inferred',
    decision_rationale: rationale,
  })
}
```

- [ ] **Step 2: Create `src/app/api/vapi/call-started/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { queryMemory } from '@/lib/supermemory'

export const runtime = 'edge'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const callId: string = body.message?.call?.id ?? body.call?.id
  const patientPhone: string = body.message?.call?.customer?.number ?? ''

  if (!callId) return NextResponse.json({ ok: false }, { status: 400 })

  // Look up patient by phone
  const { data: patient } = await supabaseAdmin
    .from('patients')
    .select('id, language')
    .eq('phone', patientPhone)
    .single()

  if (!patient) return NextResponse.json({ ok: true })

  // Pre-fetch context in parallel
  const [memory, medsRes, apptsRes] = await Promise.all([
    queryMemory(patient.id, 'medications symptoms history appointments'),
    supabaseAdmin.from('medications').select('*').eq('patient_id', patient.id).eq('active', true),
    supabaseAdmin.from('appointments').select('*').eq('patient_id', patient.id).eq('status', 'scheduled'),
  ])

  // Cache in call_sessions
  await supabaseAdmin.from('call_sessions').upsert({
    call_id: callId,
    patient_id: patient.id,
    context: {
      memory: memory ?? '',
      meds: medsRes.data ?? [],
      appointments: apptsRes.data ?? [],
    },
  })

  // Create call record
  await supabaseAdmin.from('calls').insert({
    patient_id: patient.id,
    vapi_call_id: callId,
    type: 'inbound',
    status: 'in_progress',
    language: patient.language,
    started_at: new Date().toISOString(),
  })

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Create `src/app/api/vapi/chat/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { runCallPipeline } from '@/lib/vapi'

export const runtime = 'edge'

export async function POST(req: NextRequest) {
  const body = await req.json()

  // Vapi sends OpenAI-compatible messages array
  const messages: Array<{ role: string; content: string }> = body.messages ?? []
  const callId: string = body.call?.id ?? ''
  const patientPhone: string = body.call?.customer?.number ?? ''

  // Get last user message
  const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')
  const transcript = lastUserMsg?.content ?? ''

  if (!transcript || !callId) {
    return NextResponse.json({
      id: `chatcmpl-${Date.now()}`,
      object: 'chat.completion',
      choices: [{ message: { role: 'assistant', content: 'Hello, how can I help you today?' }, finish_reason: 'stop', index: 0 }],
    })
  }

  // Get patient from session cache
  const { data: session } = await supabaseAdmin
    .from('call_sessions')
    .select('patient_id')
    .eq('call_id', callId)
    .single()

  const { data: patient } = session?.patient_id
    ? await supabaseAdmin.from('patients').select('id, language').eq('id', session.patient_id).single()
    : { data: null }

  const { responseText } = await runCallPipeline({
    transcript,
    callId,
    patientId: patient?.id ?? '',
    language: patient?.language ?? 'en',
    callType: 'inbound',
    wordConfidences: body.call?.transcript?.words?.map((w: { confidence: number }) => w.confidence) ?? [],
  })

  // Return OpenAI-compatible response
  return NextResponse.json({
    id: `chatcmpl-${Date.now()}`,
    object: 'chat.completion',
    choices: [{ message: { role: 'assistant', content: responseText }, finish_reason: 'stop', index: 0 }],
  })
}
```

- [ ] **Step 4: Create `src/app/api/vapi/end-of-call/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { fireEvent } from '@/lib/events'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const callId: string = body.message?.call?.id ?? body.call?.id
  const transcript: string = body.message?.artifact?.transcript ?? ''

  if (!callId) return NextResponse.json({ ok: false }, { status: 400 })

  // Get call record
  const { data: call } = await supabaseAdmin
    .from('calls')
    .select('id, patient_id')
    .eq('vapi_call_id', callId)
    .single()

  if (!call) return NextResponse.json({ ok: true })

  // Update call status + store transcript
  await supabaseAdmin.from('calls').update({
    status: 'completed',
    transcript,
    ended_at: new Date().toISOString(),
  }).eq('vapi_call_id', callId)

  // Clean up session cache
  await supabaseAdmin.from('call_sessions').delete().eq('call_id', callId)

  // Fire post-call processing
  await fireEvent({ type: 'call.completed', callId: call.id, patientId: call.patient_id })

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/vapi.ts src/app/api/vapi/
git commit -m "feat: add Vapi 3-layer pipeline and webhook handlers"
```

---

## Task 8: Supabase Edge Functions

**Files:**
- Create: `supabase/functions/post-call-processor/index.ts`
- Create: `supabase/functions/appointment-monitor/index.ts`
- Create: `supabase/functions/symptom-followup/index.ts`
- Create: `supabase/functions/medication-enrichment/index.ts`

- [ ] **Step 1: Create `supabase/functions/post-call-processor/index.ts`**

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

Deno.serve(async (req) => {
  const { callId, patientId } = await req.json()

  const { data: call } = await supabase.from('calls').select('transcript, language').eq('id', callId).single()
  if (!call?.transcript) return new Response('ok')

  // Gemini summary
  const genai = new GoogleGenerativeAI(Deno.env.get('GEMINI_API_KEY')!)
  const model = genai.getGenerativeModel({ model: 'gemini-2.0-flash' })
  const prompt = `Analyze this patient call transcript. Return JSON only:
{"summary":"2-3 sentence clinical summary","severity":0-10,"symptoms":["list"],"medicationChanges":["list"],"followUpRequired":true/false}
Transcript: "${call.transcript}"`

  const result = await model.generateContent(prompt)
  const text = result.response.text().replace(/\`\`\`json\n?|\n?\`\`\`/g, '').trim()
  const parsed = JSON.parse(text)

  // Update call with summary and severity
  await supabase.from('calls').update({
    summary: parsed.summary,
    severity_score: parsed.severity,
  }).eq('id', callId)

  // Update patient severity
  await supabase.from('patients').update({ severity_score: parsed.severity, last_call_at: new Date().toISOString() }).eq('id', patientId)

  // Add timeline entry
  await supabase.from('patient_timeline').insert({
    patient_id: patientId,
    event_type: 'call',
    content: { summary: parsed.summary, severity: parsed.severity, callId },
    severity: parsed.severity,
    flagged: parsed.severity >= 7,
    source: 'stt_inferred',
  })

  // Insert symptoms
  for (const symptom of parsed.symptoms ?? []) {
    await supabase.from('symptoms').insert({
      patient_id: patientId,
      call_id: callId,
      symptom_name: symptom,
      severity: parsed.severity,
    })
  }

  // Schedule follow-up based on severity
  if (parsed.severity >= 4) {
    const hoursUntilFollowup = parsed.severity >= 7 ? 4 : 24
    const scheduledAt = new Date(Date.now() + hoursUntilFollowup * 3600 * 1000).toISOString()
    await supabase.from('notifications').insert({
      patient_id: patientId,
      type: 'call',
      message: 'CareCaller follow-up scheduled based on your recent symptoms.',
      language: call.language,
      status: 'pending',
      scheduled_at: scheduledAt,
      triggered_by: `call.completed:${callId}`,
    })
  }

  // Immediate escalation
  if (parsed.severity >= 7) {
    await supabase.from('escalations').insert({
      patient_id: patientId,
      call_id: callId,
      trigger_term: 'high_severity_post_call',
      context_summary: parsed.summary,
      severity: parsed.severity,
      status: 'pending',
    })
  }

  return new Response('ok')
})
```

- [ ] **Step 2: Create `supabase/functions/appointment-monitor/index.ts`**

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

Deno.serve(async () => {
  // Get all upcoming appointments
  const { data: appointments } = await supabase
    .from('appointments')
    .select('*, patients(language, phone), doctors(name)')
    .eq('status', 'scheduled')
    .gt('datetime', new Date().toISOString())

  for (const appt of appointments ?? []) {
    // In a real system: check Google Calendar API for doctor availability
    // For demo: check if conflict_detected flag was set by an external trigger
    if (appt.conflict_detected) {
      // Find next slot (mock: add 24h)
      const newDatetime = new Date(new Date(appt.datetime).getTime() + 24 * 3600 * 1000).toISOString()

      await supabase.from('appointments').update({
        datetime: newDatetime,
        status: 'rescheduled',
        reschedule_reason: 'Doctor unavailable at original time',
        conflict_detected: false,
        updated_at: new Date().toISOString(),
      }).eq('id', appt.id)

      await supabase.from('notifications').insert({
        patient_id: appt.patient_id,
        type: 'call',
        message: `Your appointment with ${appt.doctors?.name} has been rescheduled to ${new Date(newDatetime).toLocaleString()}.`,
        language: appt.patients?.language ?? 'en',
        status: 'pending',
        triggered_by: `appointment.conflict:${appt.id}`,
      })

      await supabase.from('patient_timeline').insert({
        patient_id: appt.patient_id,
        event_type: 'appointment',
        content: { action: 'rescheduled', newDatetime, doctorName: appt.doctors?.name },
        severity: 1,
        source: 'stt_inferred',
      })
    }
  }

  return new Response('ok')
})
```

- [ ] **Step 3: Create `supabase/functions/symptom-followup/index.ts`**

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

Deno.serve(async () => {
  const cutoff = new Date(Date.now() - 24 * 3600 * 1000).toISOString()

  const { data: patients } = await supabase
    .from('patients')
    .select('id, language, severity_score')
    .gte('severity_score', 5)
    .gte('last_call_at', cutoff)

  for (const patient of patients ?? []) {
    const { data: pending } = await supabase
      .from('notifications')
      .select('id')
      .eq('patient_id', patient.id)
      .eq('status', 'pending')
      .eq('type', 'call')
      .limit(1)

    if (!pending?.length) {
      await supabase.from('notifications').insert({
        patient_id: patient.id,
        type: 'call',
        message: 'CareCaller would like to follow up on your recent symptoms.',
        language: patient.language,
        status: 'pending',
        scheduled_at: new Date(Date.now() + 3600 * 1000).toISOString(),
        triggered_by: 'symptom-followup-cron',
      })
    }
  }

  return new Response('ok')
})
```

- [ ] **Step 4: Create `supabase/functions/medication-enrichment/index.ts`**

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const TAVILY_URL = 'https://api.tavily.com/search'

Deno.serve(async () => {
  const { data: meds } = await supabase.from('medications').select('id, patient_id, drug_name_normalized').eq('active', true)

  for (const med of meds ?? []) {
    const res = await fetch(TAVILY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: Deno.env.get('TAVILY_API_KEY'),
        query: `${med.drug_name_normalized} patient savings program coupon GoodRx`,
        search_depth: 'basic',
        max_results: 2,
        include_domains: ['goodrx.com', 'needymeds.org', 'pparx.org'],
      }),
    })

    if (!res.ok) continue
    const data = await res.json()
    const links = (data.results ?? []).map((r: { url: string; title: string }) => ({ url: r.url, title: r.title }))

    await supabase.from('patient_timeline').insert({
      patient_id: med.patient_id,
      event_type: 'savings_found',
      content: { drugName: med.drug_name_normalized, links },
      severity: 0,
      source: 'stt_inferred',
    })
  }

  return new Response('ok')
})
```

- [ ] **Step 5: Deploy Edge Functions**

```bash
supabase functions deploy post-call-processor
supabase functions deploy appointment-monitor
supabase functions deploy symptom-followup
supabase functions deploy medication-enrichment
```

- [ ] **Step 6: Set Edge Function secrets**

```bash
supabase secrets set GEMINI_API_KEY=your_key
supabase secrets set TAVILY_API_KEY=your_key
```

- [ ] **Step 7: Commit**

```bash
git add supabase/
git commit -m "feat: add Supabase Edge Functions for post-call, appointments, followups"
```

---

## Task 9: Dashboard API Routes

**Files:**
- Create: `src/app/api/dashboard/[token]/route.ts`
- Create: `src/app/api/dashboard/correction/route.ts`
- Create: `src/app/api/appointments/route.ts`

- [ ] **Step 1: Create `src/app/api/dashboard/[token]/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import bcrypt from 'bcryptjs'

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const { pin } = await req.json()

  const { data: patient } = await supabaseAdmin
    .from('patients')
    .select('*')
    .eq('token', token)
    .single()

  if (!patient) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const valid = await bcrypt.compare(String(pin), patient.password_hash)
  if (!valid) return NextResponse.json({ error: 'invalid_pin' }, { status: 401 })

  // Fetch all dashboard data
  const [medsRes, apptsRes, timelineRes, escalationsRes, lastCallRes] = await Promise.all([
    supabaseAdmin.from('medications').select('*').eq('patient_id', patient.id).eq('active', true),
    supabaseAdmin.from('appointments').select('*, doctors(name, specialty)').eq('patient_id', patient.id).gte('datetime', new Date().toISOString()).order('datetime').limit(3),
    supabaseAdmin.from('patient_timeline').select('*').eq('patient_id', patient.id).order('created_at', { ascending: false }).limit(10),
    supabaseAdmin.from('escalations').select('*').eq('patient_id', patient.id).eq('status', 'pending'),
    supabaseAdmin.from('calls').select('id, summary, severity_score, ended_at').eq('patient_id', patient.id).eq('status', 'completed').order('ended_at', { ascending: false }).limit(1),
  ])

  return NextResponse.json({
    patient: { id: patient.id, name_alias: patient.name_alias, language: patient.language, severity_score: patient.severity_score },
    medications: medsRes.data ?? [],
    appointments: apptsRes.data ?? [],
    timeline: timelineRes.data ?? [],
    escalations: escalationsRes.data ?? [],
    lastCall: lastCallRes.data?.[0] ?? null,
  })
}
```

- [ ] **Step 2: Create `src/app/api/dashboard/correction/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { addMemory } from '@/lib/supermemory'
import { fireEvent } from '@/lib/events'

export async function POST(req: NextRequest) {
  const { patientId, entityType, oldValue, newValue, sourceCallId } = await req.json()

  if (!patientId || !entityType || !newValue) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 })
  }

  // Save correction
  const { data: correction } = await supabaseAdmin.from('corrections').insert({
    patient_id: patientId,
    entity_type: entityType,
    old_value: oldValue,
    new_value: newValue,
    corrected_by: 'patient',
    source_call_id: sourceCallId ?? null,
  }).select().single()

  // Update medications if it's a drug correction
  if (entityType === 'drug' || entityType === 'dose') {
    await supabaseAdmin.from('medications')
      .update({ drug_name: newValue, source: 'patient_verified', verified_at: new Date().toISOString() })
      .eq('patient_id', patientId)
      .eq('drug_name', oldValue)
  }

  // Update Supermemory so next call knows
  await addMemory(patientId, `Patient corrected ${entityType}: "${oldValue}" → "${newValue}" on ${new Date().toISOString()}`)

  // Add timeline event
  await supabaseAdmin.from('patient_timeline').insert({
    patient_id: patientId,
    event_type: 'correction',
    content: { entityType, oldValue, newValue },
    severity: 0,
    source: 'patient_verified',
  })

  // Fire event for downstream automation
  await fireEvent({ type: 'correction.created', patientId, correctionId: correction?.id ?? '' })

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Create `src/app/api/appointments/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { fireEvent } from '@/lib/events'

export async function PATCH(req: NextRequest) {
  const { appointmentId, patientId, action } = await req.json()
  // action: 'confirm' | 'request_change'

  if (action === 'confirm') {
    await supabaseAdmin.from('appointments').update({
      status: 'confirmed',
      updated_at: new Date().toISOString(),
    }).eq('id', appointmentId)

    await supabaseAdmin.from('patient_timeline').insert({
      patient_id: patientId,
      event_type: 'appointment',
      content: { action: 'confirmed', appointmentId },
      severity: 0,
      source: 'patient_verified',
    })
  } else {
    await supabaseAdmin.from('appointments').update({
      conflict_detected: true,
      updated_at: new Date().toISOString(),
    }).eq('id', appointmentId)

    await fireEvent({ type: 'appointment.updated', appointmentId, patientId })
  }

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/dashboard/ src/app/api/appointments/
git commit -m "feat: add dashboard and correction API routes"
```

---

## Task 10: Glass UI Primitives

**Files:**
- Create: `src/components/ui/GlassCard.tsx`
- Create: `src/components/ui/GlassButton.tsx`
- Create: `src/components/ui/GlassBadge.tsx`
- Create: `src/components/ui/SourceTag.tsx`

- [ ] **Step 1: Create `src/components/ui/GlassCard.tsx`**

```tsx
import { cn } from '@heroui/react'

interface GlassCardProps {
  children: React.ReactNode
  className?: string
  glow?: boolean
}

export function GlassCard({ children, className, glow }: GlassCardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-blue-500/10 backdrop-blur-xl',
        'bg-[rgba(8,25,60,0.55)] p-5',
        'transition-all duration-300',
        glow && 'shadow-[0_0_40px_rgba(59,130,246,0.12)] border-blue-500/20',
        className
      )}
    >
      {children}
    </div>
  )
}
```

- [ ] **Step 2: Create `src/components/ui/GlassButton.tsx`**

```tsx
import { Button } from '@heroui/react'
import { cn } from '@heroui/react'

interface GlassButtonProps {
  children: React.ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'danger' | 'success'
  className?: string
  disabled?: boolean
  type?: 'button' | 'submit'
}

const variants = {
  primary: 'bg-blue-500/20 hover:bg-blue-500/30 border-blue-500/30 text-blue-300',
  secondary: 'bg-white/5 hover:bg-white/10 border-white/10 text-white/70',
  danger: 'bg-red-500/20 hover:bg-red-500/30 border-red-500/30 text-red-300',
  success: 'bg-emerald-500/20 hover:bg-emerald-500/30 border-emerald-500/30 text-emerald-300',
}

export function GlassButton({ children, onClick, variant = 'primary', className, disabled, type = 'button' }: GlassButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'rounded-xl border px-4 py-2 text-sm font-medium',
        'backdrop-blur-sm transition-all duration-200',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        variants[variant],
        className
      )}
    >
      {children}
    </button>
  )
}
```

- [ ] **Step 3: Create `src/components/ui/GlassBadge.tsx`**

```tsx
import { cn } from '@heroui/react'

interface GlassBadgeProps {
  children: React.ReactNode
  color?: 'blue' | 'emerald' | 'amber' | 'red' | 'purple' | 'cyan'
  className?: string
}

const colors = {
  blue: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  emerald: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  amber: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  red: 'bg-red-500/20 text-red-300 border-red-500/30',
  purple: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  cyan: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
}

export function GlassBadge({ children, color = 'blue', className }: GlassBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
        colors[color],
        className
      )}
    >
      {children}
    </span>
  )
}
```

- [ ] **Step 4: Create `src/components/ui/SourceTag.tsx`**

```tsx
import { GlassBadge } from './GlassBadge'
import type { EntitySource } from '@/types'

const config: Record<EntitySource, { label: string; labelEs: string; color: 'blue' | 'emerald' | 'purple' | 'cyan' }> = {
  stt_inferred: { label: 'system inferred', labelEs: 'inferido', color: 'blue' },
  context_enriched: { label: 'context matched', labelEs: 'coincidencia', color: 'cyan' },
  patient_verified: { label: 'you confirmed', labelEs: 'confirmado', color: 'emerald' },
  clinician_verified: { label: 'doctor verified', labelEs: 'médico verificó', color: 'purple' },
}

export function SourceTag({ source, locale = 'en' }: { source: EntitySource; locale?: string }) {
  const { label, labelEs, color } = config[source]
  return <GlassBadge color={color}>{locale === 'es' ? labelEs : label}</GlassBadge>
}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/
git commit -m "feat: add glass UI primitives"
```

---

## Task 11: Shared Components + Realtime Hooks

**Files:**
- Create: `src/components/shared/PinGate.tsx`
- Create: `src/components/shared/LanguageSwitcher.tsx`
- Create: `src/components/shared/LiveBadge.tsx`
- Create: `src/hooks/useRealtimeAppointment.ts`
- Create: `src/hooks/useRealtimeAlerts.ts`

- [ ] **Step 1: Create `src/components/shared/PinGate.tsx`**

```tsx
'use client'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { GlassCard } from '@/components/ui/GlassCard'
import { GlassButton } from '@/components/ui/GlassButton'

interface PinGateProps {
  token: string
  onVerified: (data: unknown) => void
}

export function PinGate({ token, onVerified }: PinGateProps) {
  const t = useTranslations('pin')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await fetch(`/api/dashboard/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
    })
    if (res.ok) {
      const data = await res.json()
      onVerified(data)
    } else {
      setError(t('error'))
    }
    setLoading(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <GlassCard className="w-full max-w-sm">
        <h1 className="mb-6 text-center text-lg font-medium text-white/80">{t('title')}</h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder={t('placeholder')}
            className="rounded-xl border border-blue-500/20 bg-blue-950/30 px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50"
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <GlassButton type="submit" disabled={loading || !pin}>
            {loading ? '...' : t('submit')}
          </GlassButton>
        </form>
      </GlassCard>
    </div>
  )
}
```

- [ ] **Step 2: Create `src/components/shared/LiveBadge.tsx`**

```tsx
export function LiveBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-cyan-400">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400" />
      live
    </span>
  )
}
```

- [ ] **Step 3: Create `src/components/shared/LanguageSwitcher.tsx`**

```tsx
'use client'
import { useRouter, usePathname } from 'next/navigation'

export function LanguageSwitcher({ currentLocale }: { currentLocale: string }) {
  const router = useRouter()
  const pathname = usePathname()

  function switchLocale(locale: string) {
    const newPath = pathname.replace(`/${currentLocale}`, `/${locale}`)
    router.push(newPath)
  }

  return (
    <div className="flex gap-2">
      {['en', 'es'].map((locale) => (
        <button
          key={locale}
          onClick={() => switchLocale(locale)}
          className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
            locale === currentLocale
              ? 'bg-blue-500/30 text-blue-300 border border-blue-500/40'
              : 'text-white/40 hover:text-white/70'
          }`}
        >
          {locale.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Create `src/hooks/useRealtimeAppointment.ts`**

```typescript
'use client'
import { useEffect, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase'
import type { Appointment } from '@/types'

export function useRealtimeAppointment(patientId: string, initial: Appointment[]) {
  const [appointments, setAppointments] = useState<Appointment[]>(initial)

  useEffect(() => {
    if (!patientId) return
    const channel = supabaseBrowser
      .channel(`appointments:${patientId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'appointments',
        filter: `patient_id=eq.${patientId}`,
      }, (payload) => {
        setAppointments((prev) => {
          const updated = payload.new as Appointment
          const exists = prev.find((a) => a.id === updated.id)
          return exists ? prev.map((a) => a.id === updated.id ? updated : a) : [...prev, updated]
        })
      })
      .subscribe()

    return () => { supabaseBrowser.removeChannel(channel) }
  }, [patientId])

  return appointments
}
```

- [ ] **Step 5: Create `src/hooks/useRealtimeAlerts.ts`**

```typescript
'use client'
import { useEffect, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase'
import type { Escalation } from '@/types'

export function useRealtimeAlerts(patientId: string, initial: Escalation[]) {
  const [escalations, setEscalations] = useState<Escalation[]>(initial)

  useEffect(() => {
    if (!patientId) return
    const channel = supabaseBrowser
      .channel(`escalations:${patientId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'escalations',
        filter: `patient_id=eq.${patientId}`,
      }, (payload) => {
        setEscalations((prev) => [...prev, payload.new as Escalation])
      })
      .subscribe()

    return () => { supabaseBrowser.removeChannel(channel) }
  }, [patientId])

  return escalations
}
```

- [ ] **Step 6: Commit**

```bash
git add src/components/shared/ src/hooks/
git commit -m "feat: add shared components and realtime hooks"
```

---

## Task 12: Dashboard Components

**Files:**
- Create: `src/components/dashboard/AlertBanner.tsx`
- Create: `src/components/dashboard/EntityCard.tsx`
- Create: `src/components/dashboard/CallSummarySection.tsx`
- Create: `src/components/dashboard/MedicationSection.tsx`
- Create: `src/components/dashboard/AppointmentSection.tsx`
- Create: `src/components/dashboard/TimelineSection.tsx`
- Create: `src/components/dashboard/CorrectionModal.tsx`
- Create: `src/components/dashboard/SavingsCard.tsx`

- [ ] **Step 1: Create `src/components/dashboard/AlertBanner.tsx`**

```tsx
import { useTranslations } from 'next-intl'
import type { Escalation } from '@/types'

export function AlertBanner({ escalations, severity }: { escalations: Escalation[]; severity: number }) {
  const t = useTranslations('dashboard')
  if (!escalations.length && severity < 4) return null

  const isEmergency = severity >= 9
  const isUrgent = severity >= 7

  return (
    <div
      className={`rounded-2xl border p-4 ${
        isEmergency
          ? 'border-red-500/40 bg-red-950/40 text-red-200'
          : isUrgent
          ? 'animate-pulse border-red-500/30 bg-red-950/30 text-red-300'
          : 'border-amber-500/30 bg-amber-950/30 text-amber-300'
      }`}
    >
      <p className="font-medium">
        {isEmergency ? t('emergency') : isUrgent ? t('staffWillContact') : t('followUpScheduled')}
      </p>
      {isEmergency && (
        <p className="mt-1 text-sm opacity-80">Call 911 / Llame al 911</p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create `src/components/dashboard/EntityCard.tsx`**

```tsx
'use client'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { GlassCard } from '@/components/ui/GlassCard'
import { GlassButton } from '@/components/ui/GlassButton'
import { SourceTag } from '@/components/ui/SourceTag'
import { CorrectionModal } from './CorrectionModal'
import type { EntitySource } from '@/types'

interface EntityCardProps {
  label: string
  value: string
  confidence: number
  source: EntitySource
  entityType: string
  patientId: string
  callId?: string
  locale?: string
}

const borderByConfidence = (c: number, contradiction: boolean) =>
  contradiction ? 'border-l-4 border-l-red-500' : c >= 0.85 ? 'border-l-4 border-l-emerald-500' : 'border-l-4 border-l-amber-500'

export function EntityCard({ label, value, confidence, source, entityType, patientId, callId, locale = 'en' }: EntityCardProps) {
  const t = useTranslations('dashboard')
  const [showModal, setShowModal] = useState(false)
  const [confirmed, setConfirmed] = useState(source === 'patient_verified' || source === 'clinician_verified')
  const contradiction = confidence < 0.4

  async function handleConfirm() {
    await fetch('/api/dashboard/correction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId, entityType, oldValue: value, newValue: value, sourceCallId: callId }),
    })
    setConfirmed(true)
  }

  return (
    <>
      <GlassCard className={`flex items-center justify-between gap-3 ${borderByConfidence(confidence, contradiction)}`}>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-white/40 uppercase tracking-wider">{label}</p>
          <p className="mt-0.5 font-medium text-white truncate">{value}</p>
          <div className="mt-1.5">
            <SourceTag source={confirmed ? 'patient_verified' : source} locale={locale} />
          </div>
        </div>
        {!confirmed && (
          <div className="flex gap-2 shrink-0">
            <GlassButton variant="success" onClick={handleConfirm}>{t('confirm')}</GlassButton>
            <GlassButton variant="secondary" onClick={() => setShowModal(true)}>{t('fix')}</GlassButton>
          </div>
        )}
        {confirmed && <span className="text-emerald-400 text-lg">✓</span>}
      </GlassCard>
      {showModal && (
        <CorrectionModal
          label={label}
          currentValue={value}
          entityType={entityType}
          patientId={patientId}
          callId={callId}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); setConfirmed(true) }}
        />
      )}
    </>
  )
}
```

- [ ] **Step 3: Create `src/components/dashboard/CorrectionModal.tsx`**

```tsx
'use client'
import { useState } from 'react'
import { GlassCard } from '@/components/ui/GlassCard'
import { GlassButton } from '@/components/ui/GlassButton'

interface CorrectionModalProps {
  label: string
  currentValue: string
  entityType: string
  patientId: string
  callId?: string
  onClose: () => void
  onSaved: () => void
}

export function CorrectionModal({ label, currentValue, entityType, patientId, callId, onClose, onSaved }: CorrectionModalProps) {
  const [newValue, setNewValue] = useState(currentValue)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    await fetch('/api/dashboard/correction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId, entityType, oldValue: currentValue, newValue, sourceCallId: callId }),
    })
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <GlassCard className="w-full max-w-md">
        <h3 className="mb-4 font-medium text-white">Correct {label}</h3>
        <input
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          className="w-full rounded-xl border border-blue-500/20 bg-blue-950/30 px-4 py-2.5 text-white focus:outline-none focus:border-blue-500/50"
        />
        <div className="mt-4 flex justify-end gap-2">
          <GlassButton variant="secondary" onClick={onClose}>Cancel</GlassButton>
          <GlassButton variant="success" onClick={handleSave} disabled={saving || !newValue}>{saving ? 'Saving...' : 'Save'}</GlassButton>
        </div>
      </GlassCard>
    </div>
  )
}
```

- [ ] **Step 4: Create `src/components/dashboard/CallSummarySection.tsx`**

```tsx
import { useTranslations } from 'next-intl'
import { GlassCard } from '@/components/ui/GlassCard'

interface CallSummarySectionProps {
  lastCall: { summary: string; severity_score: number; ended_at: string } | null
}

export function CallSummarySection({ lastCall }: CallSummarySectionProps) {
  const t = useTranslations('dashboard')
  if (!lastCall) return null

  return (
    <GlassCard>
      <p className="text-xs text-white/40 uppercase tracking-wider mb-2">{t('lastCall')}</p>
      <p className="text-white/80 text-sm leading-relaxed">{lastCall.summary}</p>
      <p className="mt-2 text-xs text-white/30">{new Date(lastCall.ended_at).toLocaleString()}</p>
    </GlassCard>
  )
}
```

- [ ] **Step 5: Create `src/components/dashboard/MedicationSection.tsx`**

```tsx
import { useTranslations } from 'next-intl'
import { EntityCard } from './EntityCard'
import type { Medication } from '@/types'

interface MedicationSectionProps {
  medications: Medication[]
  patientId: string
  locale?: string
}

export function MedicationSection({ medications, patientId, locale }: MedicationSectionProps) {
  const t = useTranslations('dashboard')
  if (!medications.length) return null

  return (
    <section>
      <h2 className="mb-3 text-sm font-medium text-white/50 uppercase tracking-wider">{t('medications')}</h2>
      <div className="flex flex-col gap-2">
        {medications.map((med) => (
          <EntityCard
            key={med.id}
            label={`${med.drug_name_normalized} · ${med.frequency}`}
            value={med.dose}
            confidence={1}
            source={med.source as any}
            entityType="drug"
            patientId={patientId}
            locale={locale}
          />
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 6: Create `src/components/dashboard/AppointmentSection.tsx`**

```tsx
'use client'
import { useTranslations } from 'next-intl'
import { GlassCard } from '@/components/ui/GlassCard'
import { GlassBadge } from '@/components/ui/GlassBadge'
import { GlassButton } from '@/components/ui/GlassButton'
import { LiveBadge } from '@/components/shared/LiveBadge'
import { useRealtimeAppointment } from '@/hooks/useRealtimeAppointment'
import type { Appointment } from '@/types'

const statusColor = {
  scheduled: 'blue', confirmed: 'emerald', rescheduled: 'amber', cancelled: 'red',
} as const

export function AppointmentSection({ appointments: initial, patientId }: { appointments: Appointment[]; patientId: string }) {
  const t = useTranslations('dashboard')
  const appointments = useRealtimeAppointment(patientId, initial)

  if (!appointments.length) return null

  async function handleAction(id: string, action: 'confirm' | 'request_change') {
    await fetch('/api/appointments', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appointmentId: id, patientId, action }),
    })
  }

  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-sm font-medium text-white/50 uppercase tracking-wider">{t('appointments')}</h2>
        <LiveBadge />
      </div>
      <div className="flex flex-col gap-2">
        {appointments.map((appt) => (
          <GlassCard key={appt.id} className="flex items-center justify-between gap-3">
            <div>
              <p className="font-medium text-white">{new Date(appt.datetime).toLocaleString()}</p>
              {appt.reschedule_reason && <p className="text-xs text-amber-300 mt-0.5">{appt.reschedule_reason}</p>}
              <div className="mt-1">
                <GlassBadge color={statusColor[appt.status]}>{appt.status}</GlassBadge>
              </div>
            </div>
            {appt.status === 'scheduled' && (
              <div className="flex gap-2 shrink-0">
                <GlassButton variant="success" onClick={() => handleAction(appt.id, 'confirm')}>{t('confirm')}</GlassButton>
                <GlassButton variant="secondary" onClick={() => handleAction(appt.id, 'request_change')}>{t('fix')}</GlassButton>
              </div>
            )}
          </GlassCard>
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 7: Create `src/components/dashboard/TimelineSection.tsx`**

```tsx
import { useTranslations } from 'next-intl'
import { GlassCard } from '@/components/ui/GlassCard'
import { GlassBadge } from '@/components/ui/GlassBadge'
import type { TimelineEvent } from '@/types'

const eventColor = {
  call: 'blue', correction: 'emerald', appointment: 'cyan',
  symptom_report: 'amber', escalation: 'red', savings_found: 'purple',
} as const

export function TimelineSection({ events }: { events: TimelineEvent[] }) {
  const t = useTranslations('dashboard')
  if (!events.length) return null

  return (
    <section>
      <h2 className="mb-3 text-sm font-medium text-white/50 uppercase tracking-wider">{t('timeline')}</h2>
      <div className="flex flex-col gap-2">
        {events.map((event) => (
          <GlassCard key={event.id} className="flex items-start gap-3">
            <GlassBadge color={eventColor[event.event_type as keyof typeof eventColor] ?? 'blue'}>
              {event.event_type.replace('_', ' ')}
            </GlassBadge>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white/70 truncate">
                {typeof event.content === 'object' && event.content !== null
                  ? (event.content as any).summary ?? JSON.stringify(event.content).slice(0, 80)
                  : String(event.content)}
              </p>
              <p className="text-xs text-white/30 mt-0.5">{new Date(event.created_at).toLocaleString()}</p>
            </div>
          </GlassCard>
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 8: Create `src/components/dashboard/SavingsCard.tsx`**

```tsx
import { GlassCard } from '@/components/ui/GlassCard'
import { useTranslations } from 'next-intl'

export function SavingsCard({ drugName, links }: { drugName: string; links: { url: string; title: string }[] }) {
  const t = useTranslations('dashboard')
  if (!links.length) return null

  return (
    <GlassCard className="border-purple-500/10">
      <p className="text-xs text-white/40 uppercase tracking-wider mb-2">{t('savings')} — {drugName}</p>
      <div className="flex flex-col gap-1.5">
        {links.map((link) => (
          <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer"
            className="text-sm text-blue-400 hover:text-blue-300 underline underline-offset-2 truncate">
            {link.title}
          </a>
        ))}
      </div>
    </GlassCard>
  )
}
```

- [ ] **Step 9: Commit**

```bash
git add src/components/dashboard/
git commit -m "feat: add dashboard components"
```

---

## Task 13: Patient Dashboard Page

**Files:**
- Create: `src/app/[locale]/dashboard/[token]/page.tsx`

- [ ] **Step 1: Create `src/app/[locale]/dashboard/[token]/page.tsx`**

```tsx
'use client'
import { useState } from 'react'
import { useParams } from 'next/navigation'
import { PinGate } from '@/components/shared/PinGate'
import { LanguageSwitcher } from '@/components/shared/LanguageSwitcher'
import { AlertBanner } from '@/components/dashboard/AlertBanner'
import { CallSummarySection } from '@/components/dashboard/CallSummarySection'
import { MedicationSection } from '@/components/dashboard/MedicationSection'
import { AppointmentSection } from '@/components/dashboard/AppointmentSection'
import { TimelineSection } from '@/components/dashboard/TimelineSection'
import { useRealtimeAlerts } from '@/hooks/useRealtimeAlerts'
import { useTranslations } from 'next-intl'

export default function DashboardPage() {
  const params = useParams()
  const token = params.token as string
  const locale = params.locale as string
  const t = useTranslations('dashboard')
  const [data, setData] = useState<any>(null)

  const escalations = useRealtimeAlerts(data?.patient?.id ?? '', data?.escalations ?? [])

  if (!data) {
    return <PinGate token={token} onVerified={setData} />
  }

  const { patient, medications, appointments, timeline, lastCall } = data

  return (
    <div className="min-h-screen p-4 md:p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">{t('title')}</h1>
          <p className="text-sm text-white/40">{patient.name_alias}</p>
        </div>
        <LanguageSwitcher currentLocale={locale} />
      </div>

      {/* Alert banner — only when active escalations or high severity */}
      <div className="mb-4">
        <AlertBanner escalations={escalations} severity={patient.severity_score} />
      </div>

      <div className="flex flex-col gap-6">
        <CallSummarySection lastCall={lastCall} />
        <MedicationSection medications={medications} patientId={patient.id} locale={locale} />
        <AppointmentSection appointments={appointments} patientId={patient.id} />
        <TimelineSection events={timeline} />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify dashboard renders**

Start dev server: `npm run dev`
Navigate to `http://localhost:3000/en/dashboard/demo-patient-token-abc123`
Expected: PIN gate renders with glassmorphism styling.

- [ ] **Step 3: Commit**

```bash
git add src/app/[locale]/dashboard/
git commit -m "feat: add patient dashboard page"
```

---

## Task 14: Clinician View

**Files:**
- Create: `src/components/clinician/TimelineFeed.tsx`
- Create: `src/components/clinician/EscalationCard.tsx`
- Create: `src/components/clinician/CallTranscriptView.tsx`
- Create: `src/app/[locale]/clinician/[id]/page.tsx`

- [ ] **Step 1: Create `src/components/clinician/EscalationCard.tsx`**

```tsx
import { GlassCard } from '@/components/ui/GlassCard'
import { GlassBadge } from '@/components/ui/GlassBadge'
import type { Escalation } from '@/types'

export function EscalationCard({ escalation }: { escalation: Escalation }) {
  return (
    <GlassCard className="border-red-500/20" glow>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <GlassBadge color="red">Severity {escalation.severity}</GlassBadge>
            <GlassBadge color={escalation.status === 'pending' ? 'amber' : 'emerald'}>{escalation.status}</GlassBadge>
          </div>
          <p className="text-sm text-white/70">{escalation.context_summary}</p>
          <p className="text-xs text-white/30 mt-1">Trigger: {escalation.trigger_term}</p>
          <p className="text-xs text-white/30">{new Date(escalation.created_at).toLocaleString()}</p>
        </div>
      </div>
    </GlassCard>
  )
}
```

- [ ] **Step 2: Create `src/components/clinician/TimelineFeed.tsx`**

```tsx
import { GlassCard } from '@/components/ui/GlassCard'
import { GlassBadge } from '@/components/ui/GlassBadge'
import type { TimelineEvent } from '@/types'

export function TimelineFeed({ events }: { events: TimelineEvent[] }) {
  return (
    <div className="flex flex-col gap-2">
      {events.map((event) => (
        <GlassCard key={event.id} className={event.flagged ? 'border-red-500/20' : ''}>
          <div className="flex items-start gap-3">
            <GlassBadge color={event.flagged ? 'red' : 'blue'}>{event.event_type.replace('_', ' ')}</GlassBadge>
            <div className="flex-1">
              <p className="text-sm text-white/70">{(event.content as any)?.summary ?? JSON.stringify(event.content).slice(0, 120)}</p>
              <p className="text-xs text-white/30 mt-0.5">{new Date(event.created_at).toLocaleString()}</p>
            </div>
            {event.severity > 0 && <span className="text-xs text-white/40">sev {event.severity}</span>}
          </div>
        </GlassCard>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Create `src/components/clinician/CallTranscriptView.tsx`**

```tsx
import { GlassCard } from '@/components/ui/GlassCard'

export function CallTranscriptView({ transcript, summary }: { transcript: string; summary: string }) {
  return (
    <GlassCard>
      {summary && (
        <div className="mb-3 p-3 rounded-xl bg-blue-500/10 border border-blue-500/10">
          <p className="text-xs text-blue-300 uppercase tracking-wider mb-1">AI Summary</p>
          <p className="text-sm text-white/80">{summary}</p>
        </div>
      )}
      <p className="text-xs text-white/40 uppercase tracking-wider mb-2">Full Transcript</p>
      <p className="text-sm text-white/60 whitespace-pre-wrap leading-relaxed">{transcript}</p>
    </GlassCard>
  )
}
```

- [ ] **Step 4: Create `src/app/[locale]/clinician/[id]/page.tsx`**

```tsx
import { supabaseAdmin } from '@/lib/supabase'
import { TimelineFeed } from '@/components/clinician/TimelineFeed'
import { EscalationCard } from '@/components/clinician/EscalationCard'
import { CallTranscriptView } from '@/components/clinician/CallTranscriptView'

export default async function ClinicianPage({ params }: { params: Promise<{ id: string; locale: string }> }) {
  const { id } = await params

  const [patientRes, timelineRes, escalationsRes, callsRes] = await Promise.all([
    supabaseAdmin.from('patients').select('*').eq('id', id).single(),
    supabaseAdmin.from('patient_timeline').select('*').eq('patient_id', id).order('created_at', { ascending: false }).limit(20),
    supabaseAdmin.from('escalations').select('*').eq('patient_id', id).order('created_at', { ascending: false }),
    supabaseAdmin.from('calls').select('*').eq('patient_id', id).eq('status', 'completed').order('ended_at', { ascending: false }).limit(5),
  ])

  const patient = patientRes.data
  if (!patient) return <div className="p-8 text-white/50">Patient not found</div>

  return (
    <div className="min-h-screen p-4 md:p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">{patient.name_alias}</h1>
        <p className="text-sm text-white/40">Severity: {patient.severity_score}/10 · Last call: {patient.last_call_at ? new Date(patient.last_call_at).toLocaleString() : 'never'}</p>
      </div>

      {(escalationsRes.data?.length ?? 0) > 0 && (
        <section className="mb-6">
          <h2 className="mb-3 text-sm font-medium text-red-400 uppercase tracking-wider">Active Escalations</h2>
          <div className="flex flex-col gap-2">
            {escalationsRes.data!.map((e) => <EscalationCard key={e.id} escalation={e} />)}
          </div>
        </section>
      )}

      <section className="mb-6">
        <h2 className="mb-3 text-sm font-medium text-white/50 uppercase tracking-wider">Patient Timeline</h2>
        <TimelineFeed events={timelineRes.data ?? []} />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-white/50 uppercase tracking-wider">Recent Calls</h2>
        <div className="flex flex-col gap-4">
          {(callsRes.data ?? []).map((call) => (
            <CallTranscriptView key={call.id} transcript={call.transcript ?? ''} summary={call.summary ?? ''} />
          ))}
        </div>
      </section>
    </div>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/clinician/ src/app/[locale]/clinician/
git commit -m "feat: add clinician timeline view"
```

---

## Task 15: Landing Page + Vapi Assistant Config

**Files:**
- Create: `src/app/[locale]/page.tsx`

- [ ] **Step 1: Create `src/app/[locale]/page.tsx`**

```tsx
import { GlassCard } from '@/components/ui/GlassCard'
import { GlassBadge } from '@/components/ui/GlassBadge'
import Link from 'next/link'

export default function LandingPage({ params }: { params: { locale: string } }) {
  const { locale } = params

  const features = [
    { icon: '📞', title: 'Proactive Check-ins', desc: 'Outbound calls for symptom collection and adherence tracking' },
    { icon: '🏥', title: 'Inbound Requests', desc: 'Handles refills, scheduling, and patient questions autonomously' },
    { icon: '🧠', title: '3-Layer NLP Pipeline', desc: 'Rules + context enrichment + Groq reasoning for high accuracy' },
    { icon: '🔴', title: 'Smart Escalation', desc: 'Safety triggers with negation detection — no false alarms' },
    { icon: '📊', title: 'Patient Dashboard', desc: 'Real-time corrections feed back into the next call' },
    { icon: '🔁', title: 'Event-Driven Automation', desc: 'Doctor changes, severity scores, and corrections trigger smart workflows' },
  ]

  return (
    <div className="min-h-screen p-6 max-w-4xl mx-auto">
      {/* Hero */}
      <div className="py-16 text-center">
        <GlassBadge color="cyan" className="mb-4">Healthcare Voice AI</GlassBadge>
        <h1 className="text-4xl font-bold text-white mb-4">
          CareCaller <span className="text-blue-400">AI</span>
        </h1>
        <p className="text-lg text-white/60 max-w-xl mx-auto">
          Owns what happens between appointments. Calls patients, understands them accurately, acts intelligently.
        </p>
        <div className="mt-8 flex gap-3 justify-center">
          <Link href={`/${locale}/dashboard/demo-patient-token-abc123`}
            className="rounded-xl bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 text-blue-300 px-6 py-2.5 text-sm font-medium transition-colors">
            View Patient Dashboard →
          </Link>
          <Link href={`/${locale}/clinician/00000000-0000-0000-0000-000000000002`}
            className="rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 px-6 py-2.5 text-sm font-medium transition-colors">
            View Clinician View
          </Link>
        </div>
      </div>

      {/* Features */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-12">
        {features.map((f) => (
          <GlassCard key={f.title}>
            <span className="text-2xl">{f.icon}</span>
            <h3 className="mt-2 font-medium text-white">{f.title}</h3>
            <p className="mt-1 text-sm text-white/50">{f.desc}</p>
          </GlassCard>
        ))}
      </div>

      {/* Pipeline */}
      <GlassCard glow>
        <h2 className="font-medium text-white mb-4">Real-Time Pipeline</h2>
        <div className="flex flex-wrap items-center gap-2 text-sm text-white/60">
          {['Vapi Telephony', '→', 'AssemblyAI Medical STT', '→', 'Layer 1: Rules', '→', 'Layer 2: Context', '→', 'Layer 3: Groq', '→', 'ElevenLabs TTS'].map((step) => (
            <span key={step} className={step === '→' ? 'text-blue-500' : 'px-2.5 py-1 rounded-lg bg-white/5 border border-white/10'}>
              {step}
            </span>
          ))}
        </div>
      </GlassCard>
    </div>
  )
}
```

- [ ] **Step 2: Configure Vapi assistant**

In the Vapi dashboard (app.vapi.ai):
1. Create a new Assistant
2. Set **Model** → Custom LLM → URL: `https://your-vercel-url.vercel.app/api/vapi/chat`
3. Set **Voice** → ElevenLabs → choose a voice
4. Set **Transcriber** → AssemblyAI → enable Medical model
5. Set **Server URL** (webhooks) → `https://your-vercel-url.vercel.app/api/vapi`
6. Set **Server URL Secret** → paste into `VAPI_WEBHOOK_SECRET` in `.env.local`

- [ ] **Step 3: Final verification**

```bash
npm run dev
```
Open http://localhost:3000 — verify landing page renders.
Open http://localhost:3000/en/dashboard/demo-patient-token-abc123 — verify PIN gate renders.

- [ ] **Step 4: Deploy to Vercel**

```bash
npx vercel --prod
```
Set all `.env.local` values in Vercel dashboard → Settings → Environment Variables.

- [ ] **Step 5: Final commit**

```bash
git add src/app/[locale]/page.tsx
git commit -m "feat: add landing page and complete CareCaller hackathon build"
```

---

## Seed Script (run once for demo)

To create a demo patient with PIN `1234`:

```typescript
// scripts/seed.ts — run with: npx tsx scripts/seed.ts
import bcrypt from 'bcryptjs'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const hash = await bcrypt.hash('1234', 10)
await supabase.from('patients').update({ password_hash: hash }).eq('token', 'demo-patient-token-abc123')
console.log('Seed complete. PIN: 1234')
```

```bash
npx tsx scripts/seed.ts
```
