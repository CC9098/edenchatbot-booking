-- ============================================================
-- Symptom Logs Feature
-- Date: 2026-02-16
-- Purpose: Enable patients to log symptoms via chatbot
--          and doctors to view symptom history
-- ============================================================

-- ============================================================
-- 1) CREATE ENUM FOR SYMPTOM STATUS
-- ============================================================

-- symptom_status: active | resolved | recurring
do $$ begin
  create type symptom_status as enum ('active', 'resolved', 'recurring');
exception when duplicate_object then null; end $$;

-- ============================================================
-- 2) CREATE symptom_logs TABLE
-- ============================================================

create table if not exists symptom_logs (
  id                uuid primary key default gen_random_uuid(),
  patient_user_id   uuid not null references auth.users(id) on delete cascade,
  category          text not null,                              -- 例如 '頭痛','經期','失眠','胃脹','腰痛'
  description       text,                                       -- 症狀詳細描述（用戶原話或摘要）
  severity          smallint check (severity between 1 and 5),  -- 1=輕微 5=嚴重
  status            symptom_status not null default 'active',
  started_at        date not null,                              -- 症狀開始日期
  ended_at          date,                                       -- NULL = 仍然持續
  logged_via        text not null default 'chat',               -- 'chat' | 'manual'
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ============================================================
-- 3) CREATE INDEXES
-- ============================================================

-- Index for patient queries (filter by status and date)
create index if not exists idx_symptom_logs_patient
  on symptom_logs (patient_user_id, status, started_at desc);

-- Index for category-based queries
create index if not exists idx_symptom_logs_category
  on symptom_logs (patient_user_id, category, started_at desc);

-- ============================================================
-- 4) AUTO-UPDATE updated_at TRIGGER
-- ============================================================

-- Reuse existing update_updated_at() function
do $$ begin
  create trigger trg_symptom_logs_updated_at before update on symptom_logs
    for each row execute function update_updated_at();
exception when duplicate_object then null; end $$;

-- ============================================================
-- 5) ROW LEVEL SECURITY
-- ============================================================

alter table symptom_logs enable row level security;

-- Patient can select their own symptoms
do $$ begin
  create policy "symptom_logs_select_own" on symptom_logs for select
    using (auth.uid() = patient_user_id);
exception when duplicate_object then null; end $$;

-- Patient can insert their own symptoms
do $$ begin
  create policy "symptom_logs_insert_own" on symptom_logs for insert
    with check (auth.uid() = patient_user_id);
exception when duplicate_object then null; end $$;

-- Patient can update their own symptoms
do $$ begin
  create policy "symptom_logs_update_own" on symptom_logs for update
    using (auth.uid() = patient_user_id);
exception when duplicate_object then null; end $$;

-- Patient can delete their own symptoms
do $$ begin
  create policy "symptom_logs_delete_own" on symptom_logs for delete
    using (auth.uid() = patient_user_id);
exception when duplicate_object then null; end $$;

-- Staff can select symptoms for patients in their care team
do $$ begin
  create policy "symptom_logs_select_staff" on symptom_logs for select
    using (is_staff(auth.uid()) and staff_can_access_patient(auth.uid(), patient_user_id));
exception when duplicate_object then null; end $$;

-- Admin has full access
do $$ begin
  create policy "symptom_logs_admin_all" on symptom_logs for all
    using (is_admin(auth.uid()));
exception when duplicate_object then null; end $$;

-- ============================================================
-- NOTES
-- ============================================================
-- This migration depends on:
-- - update_updated_at() function (from 20260214000000_mvp_v1_schema.sql)
-- - is_staff(), is_admin(), staff_can_access_patient() functions (from same)
-- - auth.users table (Supabase built-in)
-- - patient_care_team table (for staff access control)
