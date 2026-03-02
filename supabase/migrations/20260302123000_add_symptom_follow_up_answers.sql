-- ============================================================
-- Symptom follow-up answers
-- Date: 2026-03-02
-- Purpose:
-- 1) store doctor-entered follow-up answers from AI question cards
-- 2) support 0-10 symptom trend charts on patient profile
-- ============================================================

create table if not exists public.symptom_follow_up_answers (
  id uuid primary key default gen_random_uuid(),
  patient_user_id uuid not null references auth.users(id) on delete cascade,
  symptom_key text not null,
  symptom_label text not null,
  question_text text not null,
  answer_type text not null,
  answer_value_text text not null,
  answer_value_number smallint,
  source text not null default 'doctor_question_card',
  recorded_by uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  asked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint symptom_follow_up_answers_answer_type_check
    check (answer_type in ('yes_no', 'scale_0_10', 'trend', 'frequency', 'free_text')),
  constraint symptom_follow_up_answers_answer_value_number_range
    check (answer_value_number is null or (answer_value_number >= 0 and answer_value_number <= 10))
);

create index if not exists idx_symptom_follow_up_answers_patient_symptom
  on public.symptom_follow_up_answers (patient_user_id, symptom_key, asked_at desc);

create index if not exists idx_symptom_follow_up_answers_patient_asked
  on public.symptom_follow_up_answers (patient_user_id, asked_at desc);

do $$ begin
  create trigger trg_symptom_follow_up_answers_updated_at
    before update on public.symptom_follow_up_answers
    for each row execute function update_updated_at();
exception when duplicate_object then null; end $$;

alter table public.symptom_follow_up_answers enable row level security;

do $$ begin
  create policy "symptom_follow_up_answers_select_own"
    on public.symptom_follow_up_answers for select
    using (auth.uid() = patient_user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "symptom_follow_up_answers_select_staff"
    on public.symptom_follow_up_answers for select
    using (is_staff(auth.uid()) and staff_can_access_patient(auth.uid(), patient_user_id));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "symptom_follow_up_answers_insert_staff"
    on public.symptom_follow_up_answers for insert
    with check (is_staff(auth.uid()) and staff_can_access_patient(auth.uid(), patient_user_id));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "symptom_follow_up_answers_update_staff"
    on public.symptom_follow_up_answers for update
    using (is_staff(auth.uid()) and staff_can_access_patient(auth.uid(), patient_user_id))
    with check (is_staff(auth.uid()) and staff_can_access_patient(auth.uid(), patient_user_id));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "symptom_follow_up_answers_admin_all"
    on public.symptom_follow_up_answers for all
    using (is_admin(auth.uid()));
exception when duplicate_object then null; end $$;

comment on table public.symptom_follow_up_answers is
  'Structured doctor follow-up answers captured from AI question cards.';
comment on column public.symptom_follow_up_answers.answer_value_number is
  'Numeric follow-up score, usually 0-10, used for symptom trend charts.';
comment on column public.symptom_follow_up_answers.metadata is
  'Optional context such as question rationale, note, suggestion id, and source screen.';
