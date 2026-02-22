-- ============================================================
-- Symptom Resolution Details
-- Date: 2026-02-22
-- Purpose: Store how a symptom improved and how long it took
-- ============================================================

alter table if exists public.symptom_logs
  add column if not exists resolution_method text,
  add column if not exists resolution_note text,
  add column if not exists resolution_days smallint;

do $$
begin
  alter table public.symptom_logs
    add constraint symptom_logs_resolution_days_range
    check (resolution_days is null or resolution_days between 0 and 365);
exception
  when duplicate_object then null;
end $$;

comment on column public.symptom_logs.resolution_method is
  'Patient-reported method that helped symptom improve (e.g. rest, ginger tea, hydration).';

comment on column public.symptom_logs.resolution_note is
  'Optional free-text detail about how symptom improved.';

comment on column public.symptom_logs.resolution_days is
  'Approximate number of days to symptom improvement.';
