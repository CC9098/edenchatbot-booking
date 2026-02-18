# CLAUDE_CONTEXT

Last updated: 2026-02-18

## TL;DR

This is the single-file AI quick context for this repo.
Default import this file first.

If deeper detail is needed, jump to source docs:
- Product/page/data map: `docs/WEBSITE_ARCHITECTURE_MAP.md`
- Technical layers: `ARCHITECTURE.md`
- Run/deploy/env: `README.md`

## System Snapshot

- Stack: Next.js 14 + TypeScript + Supabase + Gemini + Google Calendar + Gmail
- Core flow: Content -> AI chat -> Booking -> Email
- Primary timezone: `Asia/Hong_Kong`
- Main APIs:
  - `POST /api/chat`
  - `POST /api/chat/v2`
  - `POST /api/availability`
  - `POST|GET|DELETE|PATCH /api/booking`

## Do-Not-Break Rules

1. Timezone must stay Hong Kong end-to-end in availability and booking.
2. Never hardcode localhost links in email/action URLs (respect `BASE_URL` logic).
3. In chat v2 B-mode, booking claims must come from real function-call success.
4. Keep private/patient data user-scoped (RLS-safe behavior).
5. Prefer targeted edits; avoid broad refactor unless requested.

## Quick "Change X -> Edit Y"

- Chat v2 behavior / mode router / tools:
  - `app/api/chat/v2/route.ts`
  - `lib/booking-conversation-helpers.ts`
  - `lib/symptom-conversation-helpers.ts`
- Widget / legacy chat:
  - `components/ChatWidget.tsx`
  - `app/api/chat/route.ts`
- Booking lifecycle:
  - `app/api/availability/route.ts`
  - `app/api/booking/route.ts`
  - `lib/google-calendar.ts`
  - `lib/booking-helpers.ts`
- Email templates & sending:
  - `lib/gmail.ts`
  - `lib/public-url.ts`
- Content read paths:
  - `lib/content-service.ts`
  - `app/articles/*`, `app/courses/*`
  - `app/api/articles/*`, `app/api/courses/*`

## Core Tables (Mental Model)

- Booking: `doctors`, `doctor_schedules`, `holidays`, `booking_intake`
- Chat/care: `chat_sessions`, `chat_messages`, `chat_request_logs`, `patient_care_profile`, `care_instructions`, `follow_up_plans`, `symptom_logs`
- Content: `articles`, `courses`, `course_modules`, `course_lessons`, `user_lesson_progress`

Schema references:
- `supabase/migrations/20260214000000_mvp_v1_schema.sql`
- `supabase/migrations/20260216204500_content_unification_phase1.sql`
- `supabase/migrations/20260217093000_add_booking_intake.sql`

## Minimum Verify Before Push

1. `npm run typecheck`
2. `npm run lint`
3. If booking changed: verify slot check -> create/cancel/reschedule -> intake sync
4. If chat v2 changed: verify mode + function-calling + login-guarded tools
5. If content changed: verify published-only filtering and slug lookup

## Boundaries

- Work only in `EdenChatbotBooking/`
- Do not touch legacy `EDENCHATBOT/` unless explicitly requested
