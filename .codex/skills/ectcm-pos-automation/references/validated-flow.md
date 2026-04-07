# Validated Flow

This file is the living record for ECTCM POS automation findings. Add short dated entries as the workflow becomes clearer.

## 2026-04-07: Login and clinic selection

- Goal: Verify whether ECTCM POS login can be automated reliably with Playwright CLI.
- Result: Success. Login is a two-step flow: credentials first, then clinic selection.
- Login URL: `https://os.ectcm.com/Login`
- Verified controls:
  - Username textbox label: `輸入賬號`
  - Password textbox label: `輸入密碼`
  - Submit button label: `立即登錄`
- Network after login click: `POST /Login/ValidateLogin => 200`
- Post-login behavior:
  - The page stays on `/Login`
  - A clinic-picker dialog opens inside `iframe[name="MCMSIframe"]`
  - The clinic select currently uses element id `#DropListLoginClinic`
  - Do not hardcode the full option text because the suffix queue count changes
- Verified clinic target text fragment: `醫天圓中醫診所(佐敦)`
- After clinic selection and `登 錄`, landing page becomes `https://os.ectcm.com/MCMSIndex`

Artifacts:

- `output/playwright/ectcm-pos-login/.playwright-cli/page-2026-04-07T09-33-22-263Z.png`
- `output/playwright/ectcm-pos-login/.playwright-cli/page-2026-04-07T09-33-44-031Z.png`

## 2026-04-07: Main app shell and patient entry points

- Goal: Identify where patient creation and registration start after login.
- Result: Success. The actionable page lives in `iframe[name="ContentIframe"]`.
- Landing page blockers:
  - Unread message balloon popup
  - Message dialog popup
  - These can intercept clicks and should be closed before continuing
- Verified navigation:
  - Top menu link: `診所顧客列表`
  - Inside `ContentIframe`, the tab `掛號列表` exposes a quick-action row
- Verified quick-action buttons inside `ContentIframe`:
  - `搜索顧客`
  - `新增顧客`
  - `掛號`
  - `快速掛號`

Artifacts:

- `output/playwright/ectcm-pos-login/.playwright-cli/page-2026-04-07T09-34-13-283Z.png`

## 2026-04-07: Add-customer dialog

- Goal: Verify the minimum fields needed for first-visit customer creation.
- Result: Dialog opened successfully from `新增顧客`.
- Dialog title: `新增顧客 - 篩選`
- Verified fields:
  - `姓名(中)*`
  - `證件號碼*`
  - certificate type combobox defaulting to `身份證`
  - `出生日期*`
  - optional `月份不詳` checkbox
  - `手提號碼*`
  - `Email`
- Action buttons:
  - `確定`
  - `重設`
  - `取消`
- Operational note: email appears present but not visually required in this dialog.

Artifacts:

- `output/playwright/ectcm-pos-login/.playwright-cli/page-2026-04-07T09-34-46-906Z.png`

## 2026-04-07: Quick registration prerequisite

- Goal: Check whether follow-up registration can start from an existing identifier.
- Result: `快速掛號` requires at least one identifier before it proceeds.
- Triggered validation message:
  - `請輸入其中一項：顧客編號、證件號、電話、姓名！`
- Implication:
  - Follow-up flow is likely feasible with phone or ID search first
  - This is the preferred route before opening `新增顧客`

Artifacts:

- `output/playwright/ectcm-pos-login/.playwright-cli/page-2026-04-07T09-35-18-602Z.png`

## 2026-04-07: Reusable bootstrap automation

- Goal: Turn the validated login and navigation steps into a reusable script.
- Result: Added `scripts/login-and-open-register-list.sh`.
- Expected environment:
  - `ECTCM_POS_USERNAME`
  - `ECTCM_POS_PASSWORD`
  - optional `ECTCM_POS_LOGIN_URL`
  - optional `ECTCM_POS_CLINIC_MATCH`
  - optional `ECTCM_POS_SESSION`
- Script behavior:
  - open or reuse a Playwright session
  - log into ECTCM
  - choose the clinic by partial text match
  - wait for `/MCMSIndex`
  - attempt to dismiss common popups
  - open `診所顧客列表`
  - verify `掛號列表` and `快速掛號` are visible in `ContentIframe`

### Verification run

- Date: 2026-04-07
- Session used: `ectcm-pos-bootstrap-4`
- Outcome: success
- Final page title observed during run: `顧客管理 > 掛號列表`
- Notes:
  - the script reached the registration list without entering patient data
  - unread-message and system-message popups can still remain visible afterward
  - later mutation steps should still re-check popup state before clicking final action buttons

## Open Questions

- What exact screen appears after a successful customer search plus `快速掛號`
- Whether registration can be completed with only phone lookup when multiple matches exist
- What final submit buttons mutate live data in the registration flow
- Which field becomes the most stable key for mapping local patients to POS patients
