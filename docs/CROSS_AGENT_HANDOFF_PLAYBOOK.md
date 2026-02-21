# Cross-Agent Handoff Playbook

Last updated: 2026-02-21

## Purpose

This document defines role boundaries between two AI environments:

1. Cloud Code mobile/web app (can access project files and git, but may not have Supabase MCP)
2. ChatGPT developer mode with Supabase MCP (can access Supabase, but may not have project filesystem/git)

Use this as the standard operating guide for handoff.

## Agent Role A: Cloud Code Mobile/Web

### Identity

- Agent name: Cloud Code Mobile
- Primary scope: project codebase changes, git workflow, deploy flow
- Expected limitation: no direct Supabase MCP visibility in some mobile contexts

### Can Do

- Read and edit project files
- Run tests/lint/typecheck
- Commit and push git changes
- Prepare SQL migration files in repo

### Cannot Do (in limited context)

- Query Supabase tables directly via MCP
- Inspect live Supabase rows without a DB bridge

### Required Behavior When Blocked

When Supabase access is unavailable, reply with this pattern:

- "I cannot directly access Supabase MCP in this runtime. Please run the SQL/query in ChatGPT MCP mode and return results."
- "I will continue with code-side work and generate exact SQL for the DB-side step."

### Handoff Package to ChatGPT MCP

Always pass:

1. Goal (what DB change or lookup is needed)
2. Exact SQL (copy-paste ready)
3. Expected output format (rows, columns, JSON)
4. Safety constraints (no destructive operation unless approved)
5. Return requirement (paste result rows and execution status)

## Agent Role B: ChatGPT + Supabase MCP

### Identity

- Agent name: ChatGPT Supabase MCP
- Primary scope: live database inspection and mutation through MCP
- Expected limitation: no direct local git/project filesystem in some sessions

### Can Do

- Inspect table schemas and row data
- Run SQL queries and migrations
- Validate RLS/policy/data consistency

### Cannot Do (in limited context)

- Edit local repository files directly
- Commit/push code changes in git

### Required Behavior When Blocked

When project file access is unavailable, reply with this pattern:

- "I can access Supabase MCP but cannot modify your local repo files in this runtime."
- "Please ask Cloud Code to apply code/file changes; I will provide DB outputs and SQL guidance."

### Handoff Package to Cloud Code Mobile

Always pass:

1. DB result summary (what was found/changed)
2. SQL already executed (for audit trail)
3. SQL still needed in migration file (if any)
4. Code touchpoints likely impacted (API routes/services/types)
5. Verification checklist after code sync

## Shared Project Architecture Snapshot

Use this quick map when the receiving agent cannot inspect full code context.

### Stack

- Next.js 14 (App Router) + TypeScript
- Tailwind + shadcn/ui
- Supabase (auth + app data)
- Google Calendar/Gmail integrations
- Gemini chat routes (`/api/chat`, `/api/chat/v2`)

### High-Impact Paths

- Chat v2: `app/api/chat/v2/route.ts`
- Booking API: `app/api/booking/route.ts`
- Availability API: `app/api/availability/route.ts`
- Calendar integration: `lib/google-calendar.ts`
- Booking helpers: `lib/booking-helpers.ts`
- Content service: `lib/content-service.ts`
- Supabase migrations: `supabase/migrations/*.sql`

### Core Tables

- `booking_intake`
- `chat_sessions`, `chat_messages`, `chat_request_logs`
- `profiles`, `staff_roles`
- `knowledge_docs`, `chat_prompt_settings`
- content tables: `articles`, `courses`, `course_modules`, `course_lessons`

## Operational Rule

If a task requires both code and DB changes:

1. Cloud Code prepares/updates migration SQL in repo.
2. ChatGPT MCP executes or validates SQL on Supabase.
3. Cloud Code syncs final migration files, tests, and git push.
4. Both sides return explicit done-state and remaining risks.
