---
name: openclaw-google-cal-pos-sync
description: Build a daily ECTCM POS sync plan from multiple Google Calendars for OpenClaw. Use when the clinic wants to scan today's bookings across doctor and clinic calendars, infer patient name and phone from real event text, map each event to the correct doctor and clinic, and decide safe POS search steps before any live registration is attempted.
---

# OpenClaw Google Calendar POS Sync

## Overview

Use this skill when the daily POS workflow should start from Google Calendar instead of `booking_intake`.

This skill is designed for the real clinic case where some bookings are created manually in Google Calendar by staff. It treats Google Calendar as the source for today's worklist, then prepares a safe POS sync plan.

This is a planning skill. It does not click final submit buttons in POS.

## Observed Constraints

From the live `doctor_schedules` mappings checked on 2026-04-08:

- there are 20 active mappings across 17 unique calendars
- most calendars map cleanly to one doctor and one clinic
- 3 calendars are shared between `online` and a physical clinic for the same doctor

Because of that, the skill must not assume `calendarId -> clinic` is always unique.

## Decision Rules

### 1. Calendar first

- scan all active calendar IDs from `doctor_schedules`
- use the calendar mapping to determine doctor identity
- use the calendar mapping plus event text to resolve clinic identity

### 2. Name first, phone second

For POS search strategy:

1. search by patient name first
2. if exactly one patient matches, continue
3. if more than one patient shares that name, use phone as the tie-breaker
4. if name search fails, try phone as the fallback search
5. if both fail or remain ambiguous, stop for manual review

### 3. Loose event parsing

Do not require staff to follow a fully rigid event template.

Try to extract:

- patient name from event summary first
- phone from event description or summary
- clinic hints from summary, description, location, or meeting-link context

Structured lines such as `Patient / 病人:` and `Phone / 電話:` should be used when present, but they are optional.

### 4. Safety before automation

The output should classify each event as:

- `ready`
- `manual-review`
- `blocked`

Blocked or ambiguous cases should not enter live POS automation automatically.

## Quick Start

1. Generate today's summary.

```bash
./scripts/generate-google-cal-pos-plan.sh --summary-only
```

2. Generate the full plan for a specific date.

```bash
./scripts/generate-google-cal-pos-plan.sh --date 2026-04-08
```

3. Filter a single calendar when debugging.

```bash
./scripts/generate-google-cal-pos-plan.sh --calendar-id your-calendar-id@group.calendar.google.com
```

## Required Environment

The script expects:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REFRESH_TOKEN`

Optional:

- `GOOGLE_REDIRECT_URI`
- `EDEN_REPO_ROOT`

If `EDEN_REPO_ROOT` is set, the script will also try to load `.env.local` or `.env` from that repo root. This is only for environment discovery, not for importing repo code.

## Output Shape

The generated plan should include:

- requested date
- calendars scanned
- events scanned
- per-event inferred patient name and phone
- doctor and clinic resolution
- confidence / manual-review reasons
- POS strategy:
  - `name-first`
  - `phone-tiebreaker`
  - `phone-fallback`

## Resources

- Planner script: [scripts/generate-google-cal-pos-plan.sh](./scripts/generate-google-cal-pos-plan.sh)
- Core logic: [scripts/generate-google-cal-pos-plan.ts](./scripts/generate-google-cal-pos-plan.ts)
