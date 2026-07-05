# CLAUDE_CONTEXT

Last updated: 2026-04-15

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
- `app/api/booking-whatsapp/route.ts`
- `app/api/doctor/bookings/route.ts`
- `app/api/chat/booking/create/route.ts`
- `lib/booking-helpers.ts`
- `lib/holiday-store.ts`
- `lib/google-calendar.ts`
- `lib/storage-helpers.ts`
- `lib/bookable-schedule-data-server.ts`
- `POST /api/chat/booking/create` accepts optional `treatmentOptions` (validated against shared booking treatment option IDs).
- Public bookable schedule payload now includes doctor-level `bookingTreatmentOptions` metadata from clinic config.
- `POST /api/doctor/bookings` is staff-authenticated (`requireStaffRole`) and creates booking intake with `source='staff_console'` before Calendar/WhatsApp/Email fan-out.

### D) Booking and consultation emails
- `lib/gmail.ts`
- `lib/public-url.ts`
- `lib/booking-reminder-payload.ts`

### E) Website content (articles/courses/lessons)
- `lib/content-service.ts`
- `app/articles/*`
- `app/courses/*`
- `app/api/articles/*`
- `app/api/courses/*`

### F) Homepage and main UX entry
- `app/page.tsx`
- `components/ChatWidget.tsx`

### G) Timetable / staff schedule admin / WordPress embed
- `app/doctor/timetable/page.tsx`
- `app/doctor/booking/page.tsx`
- `app/api/doctor/timetable/route.ts`
- `app/api/doctor/timetable/schedules/route.ts`
- `app/api/doctor/timetable/holidays/route.ts`
- `app/api/doctor/bookings/route.ts`
- `app/embed/timetable/page.tsx`
- `app/api/public/bookable-schedules/route.ts`
- `lib/doctor-schedule-store.ts`
- `lib/public-timetable-data-server.ts`

### H) Chatwoot / WhatsApp booking notifications
- `app/api/chatwoot/agent-bot/route.ts`
- `app/manage/[...legacy]/page.tsx`
- `lib/chatwoot-agent-bot.ts`
- `lib/chatwoot-whatsapp.ts`
- `lib/legacy-manage-link.ts`
- `lib/whatsapp-booking.ts`
- `lib/widget-booking-management.ts`
- `lib/widget-manage-token.ts`
- Current delivery strategy for booking-related sends is template-preferred, with active-conversation text fallback to preserve delivery when template runtime fails.
- Synced template candidates are ranked by configured template name order first, then by preferred language.
- Template parameter candidates now include body-only combinations (supports confirmation templates without dynamic URL buttons).
- Manage-access button parameter extraction now prefers URL path+query first (for template button concatenation), then falls back to token.
- Chatwoot agent-bot booking flow now uses a booking sub-menu (`預約` / `更期` / `取消` / `返回主選單`), and routes `更期` / `取消` to action-specific manage-link sends.
- Chatwoot manage-link sends still attempt WhatsApp template button delivery, poll delivery status, delete failed template messages, then fall back to plain text.
- Manage access token signing helpers are centralized in `lib/widget-manage-token.ts` and reused by Chatwoot + widget booking management flows.
- Legacy WhatsApp manage links are normalized via `resolveLegacyManageBookingRedirect()` and redirected to canonical manage-booking URL, preserving token from path/query when available.

### I) Daily POS sync plan API
- `app/api/cron/pos-sync-daily/route.ts`
- `lib/pos-sync-daily-plan.ts`
- `GET /api/cron/pos-sync-daily` requires `Authorization: Bearer ${CRON_SECRET}`.
- Supports query params: `date (YYYY-MM-DD)`, `clinicId`, `limit`, `includeCandidates=0` (summary-only).
- Builds a same-day `booking_intake` confirmed-candidate plan for POS search/register action sequencing.

### J) 24h booking reminder cron
- `app/api/cron/booking-reminders/route.ts`
- `lib/booking-reminder-payload.ts`
- `GET /api/cron/booking-reminders` requires `Authorization: Bearer ${CRON_SECRET}`.
- Reminder window is now+23h to now+25h; supports `dryRun=1` summary mode.
- Booking reminder payload extraction is centralized in `buildBookingReminderPayload()`.
- Email reminder send is skipped (not failed) when `patientEmail` is missing; WhatsApp reminder send remains independent.
- Successful sends mark Google Calendar event private metadata keys: `eden_reminder_24h_sent_at` and `eden_reminder_24h_whatsapp_sent_at`.

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

## 6) Live Data Lookup Rules

### Timetable and closures
- `doctor_schedules` and `holidays` are now read from Supabase via `createServiceClient()` in `lib/doctor-schedule-store.ts`.
- Holiday blocking for availability uses `getHolidaysForDate()` in `lib/holiday-store.ts`, which merges Supabase `holidays` rows with legacy `storage` holidays and de-duplicates overlap.
- If Supabase returns no active `doctor_schedules` rows or errors, the app falls back to `shared/schedule-config.ts`. Treat that file as fallback, not source of truth.
- Staff can edit live timetable data at `/doctor/timetable`.
- Public timetable rendering uses `/embed/timetable` and `GET /api/public/bookable-schedules`.
- Actual slot availability still depends on timetable + `holidays` + Google Calendar busy slots in `POST /api/availability`.

### External database access rule
- If someone shares a Railway Postgres URL using `*.railway.internal`, that host is private to Railway and is usually not reachable from an external machine.
- In that case, do not assume direct DB access. Ask for one of:
  - a public/external Postgres connection string
  - a Railway shell / SQL-console result
  - Supabase dashboard / SQL Editor access

### FRONTEND_URL rule
- `FRONTEND_URL` is a public website URL, not a database URL.
- Railway's yellow info/warning icon beside `FRONTEND_URL` is advisory about public-endpoint usage, not a fatal error by itself.

## 7) API Surface (Critical Routes)

- `POST /api/chat`
- `POST /api/chat/booking/create` (bridge booking create; optional treatment option IDs)
- `POST /api/chat/v2`
- `POST /api/availability`
- `POST /api/booking-whatsapp` (public WhatsApp booking create)
- `POST /api/widget-booking/*` (self-manage verify, reschedule, cancel)
- `POST|GET|DELETE|PATCH /api/booking` (retired 2026-07; returns 410)
- `POST /api/doctor/bookings` (staff-assisted booking console)
- `POST /api/consultation`
- `GET /api/articles`, `GET /api/articles/[slug]`
- `GET /api/courses`, `GET /api/courses/[slug]`
- `GET|PUT /api/me/lesson-progress*`
- `GET /api/cron/pos-sync-daily` (cron-protected POS sync planning)
- `GET /api/cron/booking-reminders` (cron-protected 24h reminder dispatch; `dryRun=1` supported)

## 8) Minimum Verification Before Push

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

5. Chatwoot WhatsApp checks (if WhatsApp send logic changed)
- Confirmation/cancel/reschedule/manage-access flows still send on real booking scenarios.
- Keep active-conversation text fallback available when template delivery fails.

## 9) Suggested Read Order for New AI Session

1. `CLAUDE_CONTEXT.md` (this file)
2. `AI_DATA_LOOKUP.md`
3. `docs/CROSS_AGENT_HANDOFF_PLAYBOOK.md`
4. `docs/WEBSITE_ARCHITECTURE_MAP.md`
5. `ARCHITECTURE.md`
6. `README.md`
7. target files for the current task

## 10) Boundaries

- Work only inside `EdenChatbotBooking/` unless explicitly requested.
- Do not touch legacy `EDENCHATBOT/`.
- Prefer minimal, targeted edits over broad refactors.
