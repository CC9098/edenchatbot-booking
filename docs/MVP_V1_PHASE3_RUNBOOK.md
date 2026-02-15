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

## 4) Playwright E2E (Phase 3 automation)
Run from project root:

```bash
npm run test:e2e
```

Optional:

```bash
npm run test:e2e:headed
npm run test:e2e:report
```

### Covered specs
- `tests/chat.smoke.spec.ts` (`/chat` smoke + basic conversation)
- `tests/embed.smoke.spec.ts` (`/embed` widget open/close smoke)
- `tests/doctor.auth.spec.ts` (`/doctor` auth guard + post-login flow)
- `tests/doctor.crud.spec.ts` (doctor console CRUD: constitution/instructions/follow-ups)
- `tests/rls-isolation.spec.ts` (cross-account access should return `403`)

### Required E2E env vars (real test accounts, no mock data)
Set these in `.env.local` or shell before running:

```bash
E2E_BASE_URL=https://edenchatbot-booking.vercel.app
E2E_DOCTOR_EMAIL=
E2E_DOCTOR_PASSWORD=
E2E_PATIENT_EMAIL=
E2E_PATIENT_PASSWORD=
E2E_UNRELATED_EMAIL=
E2E_UNRELATED_PASSWORD=
```

Notes:
- Without role credentials above, role-based specs are auto-skipped with explicit messages.
- `/doctor` unauth redirect and `/embed` smoke can still run without credentials.
- Current E2E auth path uses Supabase password sign-in for automation reliability (UI login remains Google OAuth).

## 5) Expected release gate for Phase 3 complete
- Local Gate passed
- API Contract Smoke passed
- Playwright E2E passed (or documented skip/blocker reasons)
- Manual QA checklist passed
- No new build/runtime errors in Vercel logs

## 6) Phase 3 Final Sign-off Checklist
Use this checklist before declaring Phase 3 done.

1. Local quality gate
- [ ] `npm run phase3:smoke` passed

2. API contract smoke
- [ ] `RUN_HTTP_CHECKS=1 BASE_URL=http://localhost:3000 npm run phase3:smoke` passed

3. Playwright automation
- [ ] `npm run test:e2e` passed (or each skip has a documented reason)
- [ ] `tests/booking-regression.spec.ts` passed (`7/7`)
- [ ] `tests/booking-real-flow.spec.ts` passed in DRY_RUN mode
- [ ] `tests/booking-real-flow.spec.ts` passed with `RUN_REAL_BOOKING=1` (if production-safe window approved)

4. Manual quality sign-off
- [ ] Chat quality report reviewed (accuracy, personalization/care-context, actionability, safety)
- [ ] B-mode real booking run verified in Google Calendar + Gmail confirmation
- [ ] Doctor console CRUD manually spot-checked after automation

5. Operational checks
- [ ] No new critical errors in Vercel logs
- [ ] No secret leakage in Git diff (`.env.local` not committed)
- [ ] Runbook and integration notes updated with latest outcomes

6. Final decision
- [ ] Mark Phase 3 as complete in release notes / tracker
