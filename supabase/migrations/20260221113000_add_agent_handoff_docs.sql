-- ============================================================
-- Agent Handoff Docs
-- Date: 2026-02-21
-- Purpose: Store cross-agent identity/capability docs for MCP-assisted handoff
-- ============================================================

create table if not exists public.agent_handoff_docs (
  id uuid primary key default gen_random_uuid(),
  agent text not null check (agent in ('cloud_code_mobile', 'chatgpt_supabase_mcp', 'shared')),
  doc_key text not null,
  title text not null,
  content_md text not null,
  tags text[] not null default '{}'::text[],
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agent, doc_key)
);

create index if not exists idx_agent_handoff_docs_agent_active_sort
  on public.agent_handoff_docs(agent, is_active, sort_order);

create index if not exists idx_agent_handoff_docs_tags_gin
  on public.agent_handoff_docs using gin(tags);

alter table public.agent_handoff_docs enable row level security;

do $$ begin
  create policy "agent_handoff_docs_select_staff"
    on public.agent_handoff_docs for select
    using (is_staff(auth.uid()) or is_admin(auth.uid()));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "agent_handoff_docs_insert_staff"
    on public.agent_handoff_docs for insert
    with check (is_staff(auth.uid()) or is_admin(auth.uid()));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "agent_handoff_docs_update_staff"
    on public.agent_handoff_docs for update
    using (is_staff(auth.uid()) or is_admin(auth.uid()))
    with check (is_staff(auth.uid()) or is_admin(auth.uid()));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "agent_handoff_docs_delete_admin"
    on public.agent_handoff_docs for delete
    using (is_admin(auth.uid()));
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger trg_agent_handoff_docs_updated_at
    before update on public.agent_handoff_docs
    for each row execute function update_updated_at();
exception when duplicate_object then null; end $$;

insert into public.agent_handoff_docs (agent, doc_key, title, content_md, tags, sort_order)
values
(
  'cloud_code_mobile',
  'role_and_handoff',
  'Cloud Code Mobile Role and Handoff Rules',
  $$# Cloud Code Mobile

## Capabilities
- Can read/edit repo files
- Can run lint/typecheck/tests
- Can commit/push code

## Typical Limitation
- Supabase MCP may be unavailable in mobile/web runtime

## Required Response Pattern When Blocked
- "I cannot access Supabase MCP in this runtime."
- "Please run the SQL in ChatGPT MCP mode and return results."
- "I will continue with code-side updates and provide exact SQL."

## Handoff Checklist to ChatGPT MCP
1. Goal
2. Exact SQL
3. Expected result format
4. Safety constraints
5. Return-output requirements
$$,
  array['handoff','cloud_code','mcp_limit'],
  10
),
(
  'chatgpt_supabase_mcp',
  'role_and_handoff',
  'ChatGPT Supabase MCP Role and Handoff Rules',
  $$# ChatGPT + Supabase MCP

## Capabilities
- Can inspect schema/data
- Can run SQL and migrations
- Can verify RLS/policies

## Typical Limitation
- No local git/project filesystem in some sessions

## Required Response Pattern When Blocked
- "I can access Supabase MCP but cannot modify local repo files in this runtime."
- "Please ask Cloud Code to apply code changes."

## Handoff Checklist to Cloud Code
1. DB result summary
2. SQL executed
3. Remaining SQL for migration file
4. Affected code touchpoints
5. Verification checklist
$$,
  array['handoff','chatgpt','supabase_mcp'],
  20
),
(
  'shared',
  'project_architecture_snapshot',
  'EdenChatbotBooking Architecture Snapshot',
  $$# Project Snapshot

## Stack
- Next.js 14 App Router + TypeScript
- Supabase + Google Calendar + Gmail + Gemini

## Critical Paths
- app/api/chat/v2/route.ts
- app/api/booking/route.ts
- app/api/availability/route.ts
- lib/google-calendar.ts
- lib/booking-helpers.ts
- lib/content-service.ts
- supabase/migrations/*.sql

## Core Tables
- booking_intake
- chat_sessions
- chat_messages
- chat_request_logs
- knowledge_docs
- chat_prompt_settings
- articles
- courses
- course_modules
- course_lessons
$$,
  array['architecture','shared_context','project_map'],
  30
)
on conflict (agent, doc_key)
do update set
  title = excluded.title,
  content_md = excluded.content_md,
  tags = excluded.tags,
  sort_order = excluded.sort_order,
  is_active = true,
  updated_at = now();
