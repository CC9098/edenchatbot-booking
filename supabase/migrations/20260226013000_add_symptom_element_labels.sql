-- ============================================================
-- Symptom element labels (water / wind / thunder)
-- Date: 2026-02-26
-- Purpose:
-- 1) store patient-friendly cue answers
-- 2) store system suggested element label and scores
-- 3) allow doctor review override
-- ============================================================

alter table if exists public.symptom_logs
  add column if not exists element_traits jsonb not null default '{}'::jsonb,
  add column if not exists element_score_water smallint not null default 0,
  add column if not exists element_score_wind smallint not null default 0,
  add column if not exists element_score_thunder smallint not null default 0,
  add column if not exists element_suggested_label text not null default 'undetermined',
  add column if not exists element_review_label text,
  add column if not exists element_reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists element_reviewed_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'symptom_logs_element_score_water_range'
  ) then
    alter table public.symptom_logs
      add constraint symptom_logs_element_score_water_range
      check (element_score_water >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'symptom_logs_element_score_wind_range'
  ) then
    alter table public.symptom_logs
      add constraint symptom_logs_element_score_wind_range
      check (element_score_wind >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'symptom_logs_element_score_thunder_range'
  ) then
    alter table public.symptom_logs
      add constraint symptom_logs_element_score_thunder_range
      check (element_score_thunder >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'symptom_logs_element_suggested_label_check'
  ) then
    alter table public.symptom_logs
      add constraint symptom_logs_element_suggested_label_check
      check (element_suggested_label in ('water', 'wind', 'thunder', 'undetermined'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'symptom_logs_element_review_label_check'
  ) then
    alter table public.symptom_logs
      add constraint symptom_logs_element_review_label_check
      check (
        element_review_label is null
        or element_review_label in ('water', 'wind', 'thunder', 'undetermined')
      );
  end if;
end $$;

create index if not exists idx_symptom_logs_patient_element
  on public.symptom_logs (patient_user_id, element_suggested_label, started_at desc);

comment on column public.symptom_logs.element_traits is
  'User-facing quick cue answers, e.g. {"cue":"water","source":"chat_quick_question_v1"}.';
comment on column public.symptom_logs.element_score_water is
  'Water score for this symptom entry (severity weighted).';
comment on column public.symptom_logs.element_score_wind is
  'Wind score for this symptom entry (severity weighted).';
comment on column public.symptom_logs.element_score_thunder is
  'Thunder score for this symptom entry (severity weighted).';
comment on column public.symptom_logs.element_suggested_label is
  'System suggested element label from quick-cue scoring.';
comment on column public.symptom_logs.element_review_label is
  'Doctor-reviewed element label override.';
