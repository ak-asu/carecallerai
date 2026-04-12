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
  '$2b$10$yopof/0XQ2dRl8NvPfupgeYVk42/0obvaehg6SD4dLJlASPjbJrii', -- node -e "const b = require('bcryptjs'); b.hash('7291', 10).then(h => console.log(h));"
  'Patient Demo',
  'en',
  '+15550005678',
  3
);
