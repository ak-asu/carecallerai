create table medication_savings (
  id uuid primary key default uuid_generate_v4(),
  patient_id uuid not null references patients(id) on delete cascade,
  medication_id uuid references medications(id) on delete cascade,
  drug_name text not null,
  context_summary text,
  tavily_query text not null,
  links jsonb not null default '[]'::jsonb,
  source text not null default 'tavily',
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index medication_savings_patient_id_idx
  on medication_savings (patient_id, fetched_at desc);

create index medication_savings_medication_id_idx
  on medication_savings (medication_id, fetched_at desc);

create unique index medication_savings_patient_medication_source_idx
  on medication_savings (patient_id, medication_id, source);

insert into medications (
  patient_id,
  drug_name,
  drug_name_normalized,
  dose,
  frequency,
  start_date,
  source,
  active,
  verified_at
)
select
  '00000000-0000-0000-0000-000000000002',
  seed.drug_name,
  seed.drug_name_normalized,
  seed.dose,
  seed.frequency,
  seed.start_date::date,
  'patient_verified',
  true,
  now()
from (
  values
    ('Metformin', 'Metformin', '500 mg', 'BID', '2025-01-10'),
    ('Lisinopril', 'Lisinopril', '10 mg', 'QD', '2025-02-03')
) as seed(drug_name, drug_name_normalized, dose, frequency, start_date)
where exists (
  select 1
  from patients
  where id = '00000000-0000-0000-0000-000000000002'
)
and not exists (
  select 1
  from medications
  where patient_id = '00000000-0000-0000-0000-000000000002'
    and drug_name_normalized = seed.drug_name_normalized
    and active = true
);
