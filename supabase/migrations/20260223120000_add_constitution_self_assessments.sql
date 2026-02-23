-- Migration: add constitution_self_assessments
-- Stores patient-submitted questionnaire results (distinct from doctor-assessed constitution).
-- The suggested_constitution is calculated client-side from answers and scores; doctors
-- retain full authority over the official patient_care_profile.constitution column.

create table if not exists constitution_self_assessments (
  id                     uuid            primary key default gen_random_uuid(),
  patient_user_id        uuid            not null references auth.users(id) on delete cascade,
  answers                jsonb           not null,   -- { q1: "depleting", q2: "crossing", ... }
  scores                 jsonb           not null,   -- { depleting: 3, crossing: 6, hoarding: 0 }
  suggested_constitution constitution_type not null,
  created_at             timestamptz     not null default now()
);

-- Index to quickly fetch latest assessment per patient
create index if not exists idx_constitution_self_assessments_user_created
  on constitution_self_assessments (patient_user_id, created_at desc);

-- RLS
alter table constitution_self_assessments enable row level security;

do $$ begin
  -- Patient can read & insert their own rows
  create policy "self_assess_select_own" on constitution_self_assessments
    for select using (auth.uid() = patient_user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "self_assess_insert_own" on constitution_self_assessments
    for insert with check (auth.uid() = patient_user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  -- Staff can read any patient's assessments
  create policy "self_assess_select_staff" on constitution_self_assessments
    for select using (
      exists (
        select 1 from staff_roles sr
        where sr.user_id = auth.uid() and sr.is_active = true
      )
    );
exception when duplicate_object then null; end $$;
