-- ============================================================
-- MVP v1 Incremental Migration
-- Aligned with: docs/MVP_V1_INTEGRATION_NOTES.md
-- Strategy: ALTER existing tables + CREATE missing tables
-- Preserves existing data (profiles:3, chat_messages:93,
--   knowledge_docs:188, chat_sessions:20, etc.)
-- Date: 2026-02-14
-- ============================================================

-- 0) Extensions
create extension if not exists "pgcrypto";

-- ============================================================
-- 1) CREATE MISSING ENUMS
-- (constitution_type already exists)
-- ============================================================

-- Check existing constitution_type values and add if needed
do $$
begin
  -- Ensure constitution_type has all contract values
  begin alter type constitution_type add value if not exists 'depleting'; exception when others then null; end;
  begin alter type constitution_type add value if not exists 'crossing'; exception when others then null; end;
  begin alter type constitution_type add value if not exists 'hoarding'; exception when others then null; end;
  begin alter type constitution_type add value if not exists 'mixed'; exception when others then null; end;
  begin alter type constitution_type add value if not exists 'unknown'; exception when others then null; end;
end $$;

-- instruction_type: diet_avoid | diet_recommend | lifestyle | warning | medication_note
do $$ begin create type instruction_type as enum ('diet_avoid','diet_recommend','lifestyle','warning','medication_note'); exception when duplicate_object then null; end $$;

-- instruction_status: active | paused | done
do $$ begin create type instruction_status as enum ('active','paused','done'); exception when duplicate_object then null; end $$;

-- follow_up_status: pending | booked | done | overdue | cancelled
do $$ begin create type follow_up_status as enum ('pending','booked','done','overdue','cancelled'); exception when duplicate_object then null; end $$;

-- staff_role: doctor | assistant | admin
do $$ begin create type staff_role as enum ('doctor','assistant','admin'); exception when duplicate_object then null; end $$;

-- chat_mode: G1 | G2 | G3 | B
do $$ begin create type chat_mode as enum ('G1','G2','G3','B'); exception when duplicate_object then null; end $$;

-- ============================================================
-- 2) ALTER EXISTING TABLES (add missing columns)
-- ============================================================

-- 2.1 profiles: add phone (contract requires it)
-- Existing: id(uuid PK→auth.users), display_name, avatar_path,
--   constitution_type, locale, timezone, created_at, updated_at
-- Contract field "user_id" maps to existing "id"
alter table profiles add column if not exists phone text;

-- 2.2 chat_sessions: add updated_at
-- Existing: session_id(text), type, created_at, last_seen_at, user_id, title
alter table chat_sessions add column if not exists updated_at timestamptz not null default now();

-- 2.3 chat_messages: add mode column
-- Existing: id, session_id(text), role, content_text, client_message_id, created_at, user_id
alter table chat_messages add column if not exists mode text;

-- 2.4 chat_request_logs: add missing contract columns
-- Existing: id, session_id(text), type, model_id, model_gear, prompt_source,
--   prompt_variant, knowledge_sources, knowledge_chars, knowledge_injected,
--   latest_user_text, response_gear, user_id, created_at
alter table chat_request_logs add column if not exists prompt_tokens integer;
alter table chat_request_logs add column if not exists completion_tokens integer;
alter table chat_request_logs add column if not exists duration_ms integer;
alter table chat_request_logs add column if not exists error text;

-- 2.5 knowledge_docs: add sort_order, rename enabled→is_active via new column
-- Existing: id, type, title, content_md, enabled, created_at, updated_at
alter table knowledge_docs add column if not exists sort_order integer not null default 0;
-- Add is_active mirroring enabled (keep both for backward compat during transition)
alter table knowledge_docs add column if not exists is_active boolean not null default true;
-- Sync is_active from enabled for existing rows
update knowledge_docs set is_active = enabled where is_active != enabled;

-- 2.6 chat_prompt_settings: add contract columns
-- Existing: type, enabled, variant, extra_instructions_md, prompt_md, model_gear,
--   gear_g1_md, gear_g2_md, gear_g3_md, updated_at
-- Contract: chat_type, mode, system_prompt, is_active
-- Keep existing columns (used by current chatbot), add contract columns
alter table chat_prompt_settings add column if not exists system_prompt text;
alter table chat_prompt_settings add column if not exists is_active boolean not null default true;
-- Sync is_active from enabled
update chat_prompt_settings set is_active = enabled where is_active != enabled;

-- ============================================================
-- 3) CREATE NEW TABLES (care, booking, audit)
-- ============================================================

-- 3.1 staff_roles
create table if not exists staff_roles (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  role        staff_role not null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- 3.2 patient_care_team
create table if not exists patient_care_team (
  patient_user_id  uuid not null references auth.users(id) on delete cascade,
  staff_user_id    uuid not null references auth.users(id) on delete cascade,
  team_role        text not null,
  is_primary       boolean not null default false,
  created_at       timestamptz not null default now(),
  primary key (patient_user_id, staff_user_id)
);

-- 3.3 patient_care_profile
create table if not exists patient_care_profile (
  patient_user_id   uuid primary key references auth.users(id) on delete cascade,
  constitution      constitution_type not null default 'unknown',
  constitution_note text,
  last_visit_at     timestamptz,
  updated_by        uuid references auth.users(id),
  updated_at        timestamptz not null default now()
);

-- 3.4 care_instructions
create table if not exists care_instructions (
  id                uuid primary key default gen_random_uuid(),
  patient_user_id   uuid not null references auth.users(id) on delete cascade,
  instruction_type  instruction_type not null,
  title             text not null,
  content_md        text not null,
  status            instruction_status not null default 'active',
  start_date        date,
  end_date          date,
  created_by        uuid not null references auth.users(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- 3.5 follow_up_plans
create table if not exists follow_up_plans (
  id                uuid primary key default gen_random_uuid(),
  patient_user_id   uuid not null references auth.users(id) on delete cascade,
  suggested_date    date not null,
  reason            text,
  status            follow_up_status not null default 'pending',
  linked_booking_id text,
  created_by        uuid not null references auth.users(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- 3.6 audit_logs
create table if not exists audit_logs (
  id                uuid primary key default gen_random_uuid(),
  actor_user_id     uuid not null references auth.users(id),
  patient_user_id   uuid references auth.users(id),
  entity            text not null,
  entity_id         text,
  action            text not null,
  before_json       jsonb,
  after_json        jsonb,
  created_at        timestamptz not null default now()
);

-- 3.7 doctors (booking - from existing Neon schema)
create table if not exists doctors (
  id          text primary key,
  name        text not null,
  name_zh     text not null,
  title       text not null,
  title_zh    text not null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- 3.8 doctor_schedules
create table if not exists doctor_schedules (
  id          uuid primary key default gen_random_uuid(),
  doctor_id   text not null references doctors(id),
  clinic_id   text not null,
  calendar_id text not null,
  is_active   boolean not null default true,
  schedule    jsonb not null,
  created_at  timestamptz not null default now()
);

-- 3.9 holidays
create table if not exists holidays (
  id            uuid primary key default gen_random_uuid(),
  doctor_id     text references doctors(id),
  clinic_id     text,
  holiday_date  date not null,
  reason        text,
  created_at    timestamptz not null default now()
);

-- 3.10 intake_questions
create table if not exists intake_questions (
  id            uuid primary key default gen_random_uuid(),
  visit_type    text not null,
  question_key  text not null,
  label_en      text not null,
  label_zh      text not null,
  field_type    text not null,
  required      boolean not null default false,
  options       jsonb,
  sort_order    integer not null default 0,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

-- ============================================================
-- 4) INDEXES (Section 3.3 of contract)
-- ============================================================

create index if not exists idx_care_instructions_patient
  on care_instructions (patient_user_id, status, start_date, end_date);

create index if not exists idx_follow_up_plans_patient
  on follow_up_plans (patient_user_id, status, suggested_date);

create index if not exists idx_patient_care_team_staff
  on patient_care_team (staff_user_id);

create index if not exists idx_audit_logs_patient
  on audit_logs (patient_user_id, created_at desc);

-- chat_messages index: session_id is text in existing schema
create index if not exists idx_chat_messages_session
  on chat_messages (session_id, created_at);

-- ============================================================
-- 5) ROW LEVEL SECURITY
-- ============================================================

-- Enable RLS on all new tables
alter table staff_roles enable row level security;
alter table patient_care_team enable row level security;
alter table patient_care_profile enable row level security;
alter table care_instructions enable row level security;
alter table follow_up_plans enable row level security;
alter table audit_logs enable row level security;
alter table doctors enable row level security;
alter table doctor_schedules enable row level security;
alter table holidays enable row level security;
alter table intake_questions enable row level security;

-- Enable RLS on existing tables (if not already)
alter table profiles enable row level security;
alter table chat_sessions enable row level security;
alter table chat_messages enable row level security;
alter table chat_request_logs enable row level security;
alter table knowledge_docs enable row level security;
alter table chat_prompt_settings enable row level security;

-- ---- Helper Functions ----

create or replace function is_staff(uid uuid)
returns boolean
language sql security definer stable
as $$
  select exists (
    select 1 from staff_roles where user_id = uid and is_active = true
  );
$$;

create or replace function is_admin(uid uuid)
returns boolean
language sql security definer stable
as $$
  select exists (
    select 1 from staff_roles where user_id = uid and role = 'admin' and is_active = true
  );
$$;

create or replace function staff_can_access_patient(staff_uid uuid, patient_uid uuid)
returns boolean
language sql security definer stable
as $$
  select exists (
    select 1 from patient_care_team
    where staff_user_id = staff_uid and patient_user_id = patient_uid
  );
$$;

-- ---- profiles ----
do $$ begin
  create policy "profiles_select_own" on profiles for select using (auth.uid() = id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "profiles_update_own" on profiles for update using (auth.uid() = id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "profiles_insert_own" on profiles for insert with check (auth.uid() = id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "profiles_select_staff" on profiles for select
    using (is_staff(auth.uid()) and staff_can_access_patient(auth.uid(), id));
exception when duplicate_object then null; end $$;

-- ---- staff_roles ----
do $$ begin
  create policy "staff_roles_select_own" on staff_roles for select using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "staff_roles_admin_all" on staff_roles for all using (is_admin(auth.uid()));
exception when duplicate_object then null; end $$;

-- ---- patient_care_team ----
do $$ begin
  create policy "care_team_select_staff" on patient_care_team for select using (auth.uid() = staff_user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "care_team_select_patient" on patient_care_team for select using (auth.uid() = patient_user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "care_team_admin_all" on patient_care_team for all using (is_admin(auth.uid()));
exception when duplicate_object then null; end $$;

-- ---- patient_care_profile ----
do $$ begin
  create policy "care_profile_select_own" on patient_care_profile for select using (auth.uid() = patient_user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "care_profile_select_staff" on patient_care_profile for select
    using (is_staff(auth.uid()) and staff_can_access_patient(auth.uid(), patient_user_id));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "care_profile_update_staff" on patient_care_profile for update
    using (is_staff(auth.uid()) and staff_can_access_patient(auth.uid(), patient_user_id));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "care_profile_insert_staff" on patient_care_profile for insert
    with check (is_staff(auth.uid()) and staff_can_access_patient(auth.uid(), patient_user_id));
exception when duplicate_object then null; end $$;

-- ---- care_instructions ----
do $$ begin
  create policy "instructions_select_own" on care_instructions for select
    using (auth.uid() = patient_user_id and status = 'active');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "instructions_select_staff" on care_instructions for select
    using (is_staff(auth.uid()) and staff_can_access_patient(auth.uid(), patient_user_id));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "instructions_insert_staff" on care_instructions for insert
    with check (is_staff(auth.uid()) and staff_can_access_patient(auth.uid(), patient_user_id));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "instructions_update_staff" on care_instructions for update
    using (is_staff(auth.uid()) and staff_can_access_patient(auth.uid(), patient_user_id));
exception when duplicate_object then null; end $$;

-- ---- follow_up_plans ----
do $$ begin
  create policy "follow_ups_select_own" on follow_up_plans for select using (auth.uid() = patient_user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "follow_ups_select_staff" on follow_up_plans for select
    using (is_staff(auth.uid()) and staff_can_access_patient(auth.uid(), patient_user_id));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "follow_ups_insert_staff" on follow_up_plans for insert
    with check (is_staff(auth.uid()) and staff_can_access_patient(auth.uid(), patient_user_id));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "follow_ups_update_staff" on follow_up_plans for update
    using (is_staff(auth.uid()) and staff_can_access_patient(auth.uid(), patient_user_id));
exception when duplicate_object then null; end $$;

-- ---- audit_logs ----
do $$ begin
  create policy "audit_logs_select_staff" on audit_logs for select
    using (is_staff(auth.uid()) and staff_can_access_patient(auth.uid(), patient_user_id));
exception when duplicate_object then null; end $$;

-- ---- chat_sessions ----
do $$ begin
  create policy "chat_sessions_select_own" on chat_sessions for select using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "chat_sessions_insert_own" on chat_sessions for insert with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "chat_sessions_update_own" on chat_sessions for update using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

-- ---- chat_messages ----
do $$ begin
  create policy "chat_messages_select_own" on chat_messages for select
    using (exists (select 1 from chat_sessions cs where cs.session_id = chat_messages.session_id and cs.user_id = auth.uid()));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "chat_messages_insert_own" on chat_messages for insert
    with check (exists (select 1 from chat_sessions cs where cs.session_id = chat_messages.session_id and cs.user_id = auth.uid()));
exception when duplicate_object then null; end $$;

-- ---- chat_request_logs ----
do $$ begin
  create policy "chat_request_logs_select_own" on chat_request_logs for select using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

-- ---- knowledge_docs (public read) ----
do $$ begin
  create policy "knowledge_docs_select_all" on knowledge_docs for select using (is_active = true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "knowledge_docs_admin_all" on knowledge_docs for all using (is_admin(auth.uid()));
exception when duplicate_object then null; end $$;

-- ---- chat_prompt_settings (public read) ----
do $$ begin
  create policy "prompt_settings_select_all" on chat_prompt_settings for select using (is_active = true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "prompt_settings_admin_all" on chat_prompt_settings for all using (is_admin(auth.uid()));
exception when duplicate_object then null; end $$;

-- ---- doctors (public read) ----
do $$ begin
  create policy "doctors_select_all" on doctors for select using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "doctors_admin_all" on doctors for all using (is_admin(auth.uid()));
exception when duplicate_object then null; end $$;

-- ---- doctor_schedules (public read active) ----
do $$ begin
  create policy "schedules_select_all" on doctor_schedules for select using (is_active = true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "schedules_admin_all" on doctor_schedules for all using (is_admin(auth.uid()));
exception when duplicate_object then null; end $$;

-- ---- holidays (public read) ----
do $$ begin
  create policy "holidays_select_all" on holidays for select using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "holidays_admin_all" on holidays for all using (is_admin(auth.uid()));
exception when duplicate_object then null; end $$;

-- ---- intake_questions (public read active) ----
do $$ begin
  create policy "intake_select_all" on intake_questions for select using (is_active = true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "intake_admin_all" on intake_questions for all using (is_admin(auth.uid()));
exception when duplicate_object then null; end $$;

-- ============================================================
-- 6) AUTO-UPDATE updated_at TRIGGERS
-- ============================================================

create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Only create triggers if they don't already exist
do $$ begin
  create trigger trg_profiles_updated_at before update on profiles
    for each row execute function update_updated_at();
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger trg_patient_care_profile_updated_at before update on patient_care_profile
    for each row execute function update_updated_at();
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger trg_care_instructions_updated_at before update on care_instructions
    for each row execute function update_updated_at();
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger trg_follow_up_plans_updated_at before update on follow_up_plans
    for each row execute function update_updated_at();
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger trg_chat_sessions_updated_at before update on chat_sessions
    for each row execute function update_updated_at();
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger trg_knowledge_docs_updated_at before update on knowledge_docs
    for each row execute function update_updated_at();
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger trg_chat_prompt_settings_updated_at before update on chat_prompt_settings
    for each row execute function update_updated_at();
exception when duplicate_object then null; end $$;

-- ============================================================
-- 7) FIELD MAPPING NOTES (for developers)
-- ============================================================
-- profiles.id = contract's "user_id" (existing PK, not renamed)
-- profiles.avatar_path = kept (not in contract, but useful)
-- profiles.timezone = kept (not in contract, but useful)
-- profiles.constitution_type = kept (also in patient_care_profile.constitution)
-- chat_sessions.session_id = text PK (existing, contract uses uuid)
-- chat_messages.content_text = existing col (contract says "content")
-- chat_messages.session_id = text FK (existing, contract uses uuid)
-- knowledge_docs.enabled = existing col, is_active added for contract compat
-- chat_prompt_settings.enabled = existing col, is_active added for contract compat
