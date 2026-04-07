---
name: openclaw-pos-daily-sync
description: Prepare and orchestrate a daily ECTCM POS sync plan for OpenClaw. Use when Codex or OpenClaw needs to collect today's confirmed Eden bookings, classify first-visit versus follow-up patients, choose safe POS search keys, and hand the resulting candidates to the ECTCM POS automation flow without guessing from raw calendar text.
---

# OpenClaw POS Daily Sync

## Overview

Use this skill when the daily POS sync should run as a scheduled operation instead of an on-demand browser session. This first version prepares the candidate list and execution order. It does not submit any final POS changes by itself.

The source of truth is `booking_intake`, not raw Google Calendar descriptions. `booking_intake` already keeps the structured fields needed for POS search and customer creation, including visit type, phone, ID card, clinic, doctor, and linked calendar event IDs.

## Quick Start

1. Generate today's POS sync plan from the repo.

```bash
./.codex/skills/openclaw-pos-daily-sync/scripts/generate-pos-sync-plan.sh --summary-only
```

2. Generate the full candidate list for a specific date.

```bash
./.codex/skills/openclaw-pos-daily-sync/scripts/generate-pos-sync-plan.sh --date 2026-04-08
```

3. If OpenClaw prefers HTTPS instead of local repo commands, call the cron-style endpoint.

```bash
curl -sS \
  -H "Authorization: Bearer $CRON_SECRET" \
  "$EDEN_BASE_URL/api/cron/pos-sync-daily?includeCandidates=1"
```

## Workflow

### 1. Build the plan

Use [scripts/generate-pos-sync-plan.sh](./scripts/generate-pos-sync-plan.sh) or `GET /api/cron/pos-sync-daily` to fetch the daily plan.

The plan returns:

- total candidates for the requested day
- ready versus blocked records
- which records need manual review
- a `primarySearchKey` for POS lookup
- the recommended action:
  - `search-then-register`
  - `search-or-create-then-register`

### 2. Prioritize safe candidates

Process candidates in this order:

1. `readiness = ready` and no manual-review reasons
2. `readiness = ready` but manual-review reasons exist
3. `readiness = blocked`

Blocked records should not go into live POS automation until the missing search key or missing patient context is repaired.

### 3. Hand candidates to POS automation

For browser work, reuse [ECTCM POS Automation](../ectcm-pos-automation/SKILL.md).

- Follow-up candidate:
  - start with `search-patient.sh`
  - then `open-register-for-unique-match.sh`
- First-visit candidate:
  - search first
  - if no unique match exists, continue with the add-customer path

Do not click final submit actions in POS unless the caller explicitly allows live mutation.

### 4. Treat Google Calendar as secondary verification

This skill is designed so OpenClaw does not need to parse Google Calendar descriptions to reconstruct patient metadata. Use the linked `googleEventId` and `calendarId` only as verification and audit context.

## Safety Rules

- Do not scrape raw calendar text when `booking_intake` already has the structured record.
- Do not auto-process `blocked` candidates.
- Do not assume `followup` means the POS patient record is guaranteed to exist.
- Stop for human review when no search key is available or multiple POS matches appear.
- Keep POS credentials outside the repo.

## Resources

- Planner library: [lib/pos-sync-daily-plan.ts](/Users/chetchung/edenchatbot%20and%20booking%20system%202026/EdenChatbotBooking/lib/pos-sync-daily-plan.ts)
- Cron API: [app/api/cron/pos-sync-daily/route.ts](/Users/chetchung/edenchatbot%20and%20booking%20system%202026/EdenChatbotBooking/app/api/cron/pos-sync-daily/route.ts)
- Planner CLI: [scripts/generate-pos-sync-plan.sh](./scripts/generate-pos-sync-plan.sh)
- POS browser automation: [ECTCM POS Automation](../ectcm-pos-automation/SKILL.md)
