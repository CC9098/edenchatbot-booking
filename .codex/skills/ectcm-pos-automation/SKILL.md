---
name: ectcm-pos-automation
description: Automate and document workflows in the ECTCM POS web app with Playwright CLI. Use when Codex needs to log into `https://os.ectcm.com`, choose a clinic, inspect or automate patient search, customer creation, registration, consultation, dispensing, or other back-office POS flows, and keep a dated record of validated selectors, popups, blockers, and command sequences.
---

# ECTCM POS Automation

## Overview

Use this skill for live browser work inside ECTCM POS and for maintaining a reusable record of what has already been verified. Default to safe, low-risk exploration first, then update the skill's references after each meaningful discovery.

This is a live production-style system. Do not create, update, or register real patients unless the user explicitly asks for it and the cleanup plan is clear.

## Quick Start

1. Set credentials in the shell. Do not store them in repo files.

```bash
export ECTCM_POS_USERNAME='...'
export ECTCM_POS_PASSWORD='...'
export ECTCM_POS_LOGIN_URL='https://os.ectcm.com/Login'
export ECTCM_POS_CLINIC_MATCH='醫天圓中醫診所(佐敦)'
export ECTCM_POS_SESSION='ectcm1'
```

2. Use the session wrapper in [scripts/pos_pwcli.sh](./scripts/pos_pwcli.sh).

```bash
./.codex/skills/ectcm-pos-automation/scripts/pos_pwcli.sh open "$ECTCM_POS_LOGIN_URL"
./.codex/skills/ectcm-pos-automation/scripts/pos_pwcli.sh snapshot
```

Keep `ECTCM_POS_SESSION` short. The wrapper rejects names longer than 16 characters because Playwright CLI can collide on truncated Unix socket paths.

3. Use [scripts/login-and-open-register-list.sh](./scripts/login-and-open-register-list.sh) to replay the validated bootstrap flow.

```bash
./.codex/skills/ectcm-pos-automation/scripts/login-and-open-register-list.sh
./.codex/skills/ectcm-pos-automation/scripts/pos_pwcli.sh snapshot
```

4. Use [scripts/search-patient.sh](./scripts/search-patient.sh) for the first safe automation step after login.

```bash
./.codex/skills/ectcm-pos-automation/scripts/search-patient.sh '91234567'
```

5. Use [scripts/open-register-for-unique-match.sh](./scripts/open-register-for-unique-match.sh) when the keyword should map to exactly one patient and the goal is to stop on the register page before any save.

```bash
./.codex/skills/ectcm-pos-automation/scripts/open-register-for-unique-match.sh 'CL1038977'
```

6. Set `ECTCM_POS_DEBUG_SNAPSHOT=1` only when a patient-specific snapshot is needed for debugging. Search and register scripts now avoid terminal snapshots by default.
7. Keep artifacts in `output/playwright/<label>/`.
8. Read [references/validated-flow.md](./references/validated-flow.md) before changing the automation path.

## Workflow

### 1. Prepare a stable session

Run all browser commands through `scripts/pos_pwcli.sh` so the same Playwright session is reused across steps. Snapshot after every navigation or modal change.

### 2. Log in and select clinic

Use the login page text labels instead of brittle coordinates.

- Username textbox: `輸入賬號`
- Password textbox: `輸入密碼`
- Login button: `立即登錄`
- After successful credential validation, ECTCM opens a clinic-picker dialog inside `iframe[name="MCMSIframe"]`
- Match the clinic by partial text. Do not hardcode the trailing queue count, because it changes.

If the page remains on `/Login`, inspect network and body text before retrying. The login request currently posts to `/Login/ValidateLogin`.

For the already-verified bootstrap path, prefer [scripts/login-and-open-register-list.sh](./scripts/login-and-open-register-list.sh) instead of retyping the full sequence.

### 3. Stabilize the landing page

After clinic selection, expect to land on `https://os.ectcm.com/MCMSIndex`. Message popups can block clicks. Dismiss them before interacting with the main content.

Known page regions:

- Global left menu on the top bar
- Search box in the top toolbar: `顧客編號,姓名,電話,完整證件號`
- Main app content inside `iframe[name="ContentIframe"]`

Use [scripts/dismiss-popups.sh](./scripts/dismiss-popups.sh) whenever clicks start failing because overlays intercept pointer events.

### 4. Explore patient flows safely

Inside `ContentIframe`, the current validated quick actions are:

- `搜索顧客`
- `新增顧客`
- `掛號`
- `快速掛號`

Default exploration order:

1. Search by phone or ID.
2. If one patient matches, inspect the registration path.
3. If no patient matches and the user explicitly wants creation, inspect the add-customer dialog.
4. Stop before the final submit on any live mutation unless the user explicitly approves it.

For search automation, prefer [scripts/search-patient.sh](./scripts/search-patient.sh). The current validated behavior is:

- It can bootstrap the session automatically unless `ECTCM_POS_SKIP_BOOTSTRAP=1`
- It searches from the quick-action field in `掛號列表`
- It lands on `診所顧客列表 > 顧客列表`
- It can return zero, one, or many matching rows, so later automation must guard against ambiguous matches
- It avoids terminal snapshots unless `ECTCM_POS_DEBUG_SNAPSHOT=1`

For the next safe step after a unique match, prefer [scripts/open-register-for-unique-match.sh](./scripts/open-register-for-unique-match.sh). The current validated behavior is:

- It repeats the search and only clicks `掛號` when the result set is exactly one row
- It lands on `診所顧客列表 > 掛號 > 登記掛號`
- It does not click `保存`
- It surfaces whether a blocking warning dialog appeared, for example the known missing-valid-ID warning

### 5. Update the record

After each real discovery, update [references/validated-flow.md](./references/validated-flow.md):

- date
- goal
- result
- stable selectors or iframe names
- blocker or popup behavior
- artifact path under `output/playwright/`

Keep the record concise and factual. Do not paste secrets into the reference.

## Safety Rules

- Never commit POS credentials into the repo or the skill.
- Prefer search-only and read-only actions on live data.
- Use partial-text matching for clinic labels and dynamic badges.
- Expect popups to intercept clicks; close them before retrying.
- When a click fails, snapshot again before guessing.
- If a create or register flow touches real patient data, confirm the intent in the conversation first.

## Resources

- Session wrapper: [scripts/pos_pwcli.sh](./scripts/pos_pwcli.sh)
- Bootstrap flow: [scripts/login-and-open-register-list.sh](./scripts/login-and-open-register-list.sh)
- Popup cleanup: [scripts/dismiss-popups.sh](./scripts/dismiss-popups.sh)
- Search flow: [scripts/search-patient.sh](./scripts/search-patient.sh)
- Open register page: [scripts/open-register-for-unique-match.sh](./scripts/open-register-for-unique-match.sh)
- Verified findings: [references/validated-flow.md](./references/validated-flow.md)
