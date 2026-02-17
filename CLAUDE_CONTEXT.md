# CLAUDE_CONTEXT

Last updated: 2026-02-17

## 1) Purpose (AI Quick-Action Layer)

This file is the **execution cheat sheet for AI coding agents**.
It does not replace:
- `README.md` (project onboarding/run/deploy)
- `ARCHITECTURE.md` (technical layers)
- `docs/WEBSITE_ARCHITECTURE_MAP.md` (page/data maps)

Use this file first when you need to decide:
- where to change code
- what must not break
- how to verify safely before push

## 2) Project Snapshot

- Project: EdenChatbotBooking (Next.js 14 App Router + TypeScript)
- Domain flow: Content -> AI Chat -> Booking -> Email confirmation
- Main integrations:
  - Gemini (`/api/chat`, `/api/chat/v2`)
  - Google Calendar (availability + booking event CRUD)
  - Gmail (confirmation/cancel/reminder/consultation emails)
  - Supabase (auth, content, care context, booking intake)
- Primary timezone: `Asia/Hong_Kong`

## 3) High-Risk Rules (Do Not Break)

1. **Timezone correctness**
- Booking availability and booking creation are Hong Kong time.
- Keep timezone conversions consistent in `app/api/availability/route.ts` and `app/api/booking/route.ts`.

2. **Public URL correctness**
- Do not hardcode localhost for emails or action links.
- Use base URL resolution logic (`BASE_URL` first).

3. **B-mode booking integrity (`/api/chat/v2`)**
- Assistant must call tools for real booking actions.
- Never claim booking success without successful function call result.
- Required booking intake fields must stay enforced.

4. **RLS and user scope**
- Patient/private endpoints must remain user-scoped.
- Do not bypass RLS logic unless explicitly using service-role server code.

## 4) Fast Routing: “I need to change X”

### A) Chat behavior / mode routing / function-calling
- `app/api/chat/v2/route.ts`
- `lib/booking-conversation-helpers.ts`
- `lib/symptom-conversation-helpers.ts`

### B) Legacy/simple widget chat response
- `app/api/chat/route.ts`
- `components/ChatWidget.tsx`

### C) Booking flow (availability, create, cancel, reschedule)
- `app/api/availability/route.ts`
- `app/api/booking/route.ts`
- `lib/booking-helpers.ts`
- `lib/google-calendar.ts`
- `lib/storage-helpers.ts`

### D) Booking and consultation emails
- `lib/gmail.ts`
- `lib/public-url.ts`

### E) Website content (articles/courses/lessons)
- `lib/content-service.ts`
- `app/articles/*`
- `app/courses/*`
- `app/api/articles/*`
- `app/api/courses/*`

### F) Homepage and main UX entry
- `app/page.tsx`
- `components/ChatWidget.tsx`

## 5) Core Data Model (What matters most)

### Booking and scheduling
- `doctors`
- `doctor_schedules`
- `holidays`
- `booking_intake` (chat-v2 structured intake + event linkage)

### Chat and care context
- `chat_sessions`
- `chat_messages`
- `chat_request_logs`
- `patient_care_profile`
- `care_instructions`
- `follow_up_plans`
- `symptom_logs`

### Content
- `articles`
- `courses`
- `course_modules`
- `course_lessons`
- `user_lesson_progress`

Reference migrations:
- `supabase/migrations/20260214000000_mvp_v1_schema.sql`
- `supabase/migrations/20260216204500_content_unification_phase1.sql`
- `supabase/migrations/20260217093000_add_booking_intake.sql`

## 6) API Surface (Critical Routes)

- `POST /api/chat`
- `POST /api/chat/v2`
- `POST /api/availability`
- `POST|GET|DELETE|PATCH /api/booking`
- `POST /api/consultation`
- `GET /api/articles`, `GET /api/articles/[slug]`
- `GET /api/courses`, `GET /api/courses/[slug]`
- `GET|PUT /api/me/lesson-progress*`

## 7) Minimum Verification Before Push

1. Type and lint
- `npm run typecheck`
- `npm run lint`

2. Booking safety checks (if booking code changed)
- Confirm slot availability still checks Google busy slots before create.
- Confirm create/cancel/reschedule still syncs `booking_intake` status.
- Confirm confirmation/cancellation emails still send without blocking booking success.

3. Chat-v2 checks (if v2 changed)
- Mode routing still returns one of `G1|G2|G3|B`.
- Function-calling path still handles tool loops safely.
- User-scoped tools still require login where needed.

4. Content checks (if content code changed)
- Published-only filtering still enforced.
- Slug resolution still works for encoded slugs.

## 8) Suggested Read Order for New AI Session

1. `CLAUDE_CONTEXT.md` (this file)
2. `docs/WEBSITE_ARCHITECTURE_MAP.md`
3. `ARCHITECTURE.md`
4. `README.md`
5. target files for the current task

## 9) Boundaries

- Work only inside `EdenChatbotBooking/` unless explicitly requested.
- Do not touch legacy `EDENCHATBOT/`.
- Prefer minimal, targeted edits over broad refactors.
