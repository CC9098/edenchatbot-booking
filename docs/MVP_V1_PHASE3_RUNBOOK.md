# MVP v1 Phase 3 Runbook

## Goal
Provide a repeatable integration validation flow for Phase 3.

## 1) Local Gate (required)
Run from project root:

```bash
npm run phase3:smoke
```

This includes:
- `npm run lint`
- `npm run typecheck`
- `npm run build`

## 2) API Contract Smoke (optional, local server required)
Start app in another terminal:

```bash
npm run dev
```

Then run:

```bash
RUN_HTTP_CHECKS=1 BASE_URL=http://localhost:3000 npm run phase3:smoke
```

Checks:
- `/api/chat/v2` rejects invalid payload with `400`
- `/api/chat/booking/create` rejects invalid payload with `400`
- `/api/chat/booking/availability` rejects invalid payload with `400`

## 3) Manual QA (Phase 3 remaining items)
1. Prompt quality tuning
- Login as a test patient.
- Ask 3 prompts covering general advice, deeper explanation, and booking intent.
- Confirm response includes profile care context when available.

2. B-mode booking real flow
- Use real Google Calendar credentials.
- Complete availability -> create -> reschedule -> cancel path.
- Verify calendar event and email confirmation.

3. Doctor console E2E
- Login as doctor account.
- Verify patient list visibility matches care-team assignment.
- Perform constitution/instruction/follow-up CRUD and reload verification.

4. RLS isolation verification
- Login with a non-related account.
- Confirm patient data APIs return `403` for cross-account access.

5. Booking regression
- Verify existing `/api/booking`, `/cancel`, `/reschedule` flows still work.

## 4) Expected release gate for Phase 3 complete
- Local Gate passed
- API Contract Smoke passed
- Manual QA checklist passed
- No new build/runtime errors in Vercel logs
