# MVP v1 Integration Notes (Contract-First)

## 1) 文件用途
- 這份文件是 `Chat-0` 的整合契約。
- 所有分組（`Chat-1` 至 `Chat-5`）必須依此欄位與 API 命名實作。
- 若需改契約，先更新本文件，再通知所有分組同步。

## 2) Scope 與原則
1. 保留既有 booking 執行層：
- `POST /api/availability`
- `POST/GET/DELETE/PATCH /api/booking`
- `/cancel`、`/reschedule` 頁面流程

2. 新增同一 AI 助手四模式：
- `G1`：短答
- `G2`：中答
- `G3`：教練式
- `B`：booking 導流/執行（只可調用現有 booking API，不可直接寫 Google Calendar）

3. 新增三分型聊天室路由：
- `/chat/depleting`
- `/chat/crossing`
- `/chat/hoarding`

4. 每型獨立本地記憶：
- `localStorage key`: `eden.chat.<type>.v1`
- `session key`: `eden.chat.session.<type>.v1`

5. 單一資料平台：
- 目標：app data + chat logs + doctor console 全走 Supabase Postgres。
- 現有 `DATABASE_URL`（Neon）可在 migration 過渡期保留，但最終會移除。

## 3) 資料庫契約（Supabase）
## 3.1 Enum/字典（應以 DB check 或 enum 限制）
- `constitution`: `depleting | crossing | hoarding | mixed | unknown`
- `instruction_type`: `diet_avoid | diet_recommend | lifestyle | warning | medication_note`
- `instruction_status`: `active | paused | done`
- `follow_up_status`: `pending | booked | done | overdue | cancelled`
- `staff_role`: `doctor | assistant | admin`
- `chat_mode`: `G1 | G2 | G3 | B`

## 3.2 核心表（MVP v1）
1. `profiles`
- `user_id uuid pk references auth.users(id)`
- `display_name text`
- `phone text`
- `locale text default 'zh-HK'`
- `created_at timestamptz default now()`
- `updated_at timestamptz default now()`

2. `staff_roles`
- `user_id uuid pk references auth.users(id)`
- `role text not null` (`doctor|assistant|admin`)
- `is_active boolean not null default true`
- `created_at timestamptz default now()`

3. `patient_care_team`
- `patient_user_id uuid not null references auth.users(id)`
- `staff_user_id uuid not null references auth.users(id)`
- `team_role text not null` (如 `primary_doctor|assistant`)
- `is_primary boolean not null default false`
- `created_at timestamptz default now()`
- `primary key (patient_user_id, staff_user_id)`

4. `patient_care_profile`
- `patient_user_id uuid pk references auth.users(id)`
- `constitution text not null default 'unknown'`
- `constitution_note text`
- `last_visit_at timestamptz`
- `updated_by uuid references auth.users(id)`
- `updated_at timestamptz default now()`

5. `care_instructions`
- `id uuid pk default gen_random_uuid()`
- `patient_user_id uuid not null references auth.users(id)`
- `instruction_type text not null`
- `title text not null`
- `content_md text not null`
- `status text not null default 'active'`
- `start_date date`
- `end_date date`
- `created_by uuid not null references auth.users(id)`
- `created_at timestamptz default now()`
- `updated_at timestamptz default now()`

6. `follow_up_plans`
- `id uuid pk default gen_random_uuid()`
- `patient_user_id uuid not null references auth.users(id)`
- `suggested_date date not null`
- `reason text`
- `status text not null default 'pending'`
- `linked_booking_id text` (先對接現有 Google event id)
- `created_by uuid not null references auth.users(id)`
- `created_at timestamptz default now()`
- `updated_at timestamptz default now()`

7. `audit_logs`
- `id uuid pk default gen_random_uuid()`
- `actor_user_id uuid not null references auth.users(id)`
- `patient_user_id uuid references auth.users(id)`
- `entity text not null` (table name)
- `entity_id text`
- `action text not null` (`insert|update|delete`)
- `before_json jsonb`
- `after_json jsonb`
- `created_at timestamptz default now()`

8. Chat 相關（沿用現有 chat stack）
- `chat_sessions`
- `chat_messages`
- `chat_request_logs`
- `knowledge_docs`
- `chat_prompt_settings`

9. Booking 相關（由現有 schema 遷移）
- `doctor_schedules`
- `holidays`
- `intake_questions`
- `doctors`

## 3.3 Index 最低要求
- `care_instructions(patient_user_id, status, start_date, end_date)`
- `follow_up_plans(patient_user_id, status, suggested_date)`
- `patient_care_team(staff_user_id)`
- `audit_logs(patient_user_id, created_at desc)`
- `chat_messages(session_id, created_at)`

## 4) RLS 契約（最低可接受）
1. 病人（authenticated user）：
- 可讀：自己 `profiles`、`patient_care_profile`、自己的 active `care_instructions`、自己的 `follow_up_plans`、自己的 chat logs。
- 不可寫：`staff_roles`、`patient_care_team`、其他病人資料。

2. 醫師/助理（staff）：
- 只可讀寫 `patient_care_team` 內關聯病人資料。
- `assistant` 不可改 `staff_roles`。

3. admin：
- 可管理 `staff_roles`、`patient_care_team`。

4. Service Role（server-only）：
- 僅在 API route 使用，可 bypass RLS 做系統寫入（chat logs、system tasks）。

## 5) API 契約（新增）
## 5.1 醫師控制台
1. `GET /api/doctor/patients`
- Query: `q`, `limit`, `cursor`
- Response: `items[]`（含 `patient_user_id`, `display_name`, `constitution`, `next_follow_up_date`）

2. `GET /api/doctor/patients/:patientUserId/profile`
- Response: `patient_care_profile + active care_instructions + follow_up_plans`

3. `PATCH /api/doctor/patients/:patientUserId/constitution`
- Body:
```json
{
  "constitution": "depleting",
  "constitutionNote": "string"
}
```

4. `POST /api/doctor/patients/:patientUserId/instructions`
- Body:
```json
{
  "instructionType": "diet_avoid",
  "title": "避免生冷",
  "contentMd": "string",
  "startDate": "2026-02-14",
  "endDate": "2026-03-14"
}
```

5. `PATCH /api/doctor/instructions/:id`
- Body: 允許更新 `title/contentMd/status/startDate/endDate`

6. `POST /api/doctor/patients/:patientUserId/follow-ups`
- Body:
```json
{
  "suggestedDate": "2026-03-01",
  "reason": "string"
}
```

7. `PATCH /api/doctor/follow-ups/:id`
- Body: 允許更新 `status/suggestedDate/reason`

## 5.2 病人端讀取
1. `GET /api/me/care-context`
- Response:
```json
{
  "constitution": "depleting",
  "constitutionNote": "string",
  "activeInstructions": [],
  "nextFollowUp": {
    "id": "uuid",
    "suggestedDate": "2026-03-01",
    "status": "pending"
  }
}
```

## 5.3 Chat API（統一）
`POST /api/chat`

Request:
```json
{
  "type": "depleting",
  "mode": "G2",
  "sessionId": "uuid",
  "messages": [],
  "modelId": "optional"
}
```

Response:
- Streaming UI messages（與現代 `ai` SDK 格式一致）。

Server 行為契約：
1. `mode=G1/G2/G3`：按檔位規則回覆。
2. `mode=B`：只做 booking 導流與 API 編排，不可直接 calendar write。
3. 自動注入：
- `patient_care_profile`
- `active care_instructions`
- `next pending follow_up_plan`
4. 寫入 `chat_request_logs`（包含 mode）。

## 5.4 Booking bridge（B mode 專用）
1. `POST /api/chat/booking/availability`
- 內部轉發到 `POST /api/availability`

2. `POST /api/chat/booking/create`
- 內部轉發到 `POST /api/booking`

3. `POST /api/chat/booking/reschedule`
- 內部轉發到 `PATCH /api/booking`

4. `POST /api/chat/booking/cancel`
- 內部轉發到 `DELETE /api/booking`

約束：
- 這四個 endpoint 必須做 server-side schema validation。
- 僅接受白名單欄位，不可透傳任意 payload。

## 6) 狀態轉移契約（follow-up）
1. 醫師建立後預設 `pending`。
2. 病人於 B mode 成功預約後，若日期接近建議日，更新為 `booked` 並寫入 `linked_booking_id`。
3. 完成就診由醫師改 `done`。
4. 超過 `suggested_date` 且未 booked/done，可標記 `overdue`（v1 可用手動或 cron）。

## 7) 現有 endpoint 相容要求
1. 現有 `app/api/booking/route.ts` request/response 不可破壞。
2. 現有 `app/api/availability/route.ts` 行為不變。
3. 現有 `/cancel`、`/reschedule` URL query（`eventId`, `calendarId`）不變。
4. 既有 `components/ChatWidget.tsx` booking 分支在 v1 期間可保留，後續再逐步收斂到新 chat engine。

## 8) Env Var 契約
## 新增（Supabase）
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`（server only）
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 既有（保留）
- `GEMINI_API_KEY`（若改 AI Gateway 可後續淘汰）
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REFRESH_TOKEN`
- `BASE_URL`

## 過渡
- `DATABASE_URL`：遷移期間保留；完成全轉 Supabase 後移除。

## 9) 測試契約（最少）
1. 權限測試：
- 病人 A 不可讀病人 B。
- 醫師只能讀自己 care team 病人。

2. 功能測試：
- 醫師更新體質/介口/覆診後，病人 chat 立即可見。
- `mode=B` 完成預約後 follow-up 狀態正確。

3. 回歸測試：
- 現有 booking、cancel、reschedule 不回歸。

## 10) Merge Gate（Chat-0 執行）
1. `Chat-1` schema 與 RLS 先合併。
2. `Chat-2` auth/profile 合併。
3. `Chat-4` chat engine 合併。
4. `Chat-3` doctor console 合併。
5. `Chat-5` booking bridge/follow-up 合併。

任何 PR 若改動契約欄位或 endpoint path，必須同時更新本文件。

---

## 11) 實作進度追蹤（2026-02-14 更新）

### Phase 0 — 契約與基建 ✅ 完成
- [x] `MVP_V1_INTEGRATION_NOTES.md` 契約文件建立
- [x] `MVP_V1_MULTI_CODEX_PLAN.md` 執行計劃建立
- [x] `MVP_V1_WHOLE_PICTURE_USER_STORIES.md` 用戶故事建立

### Phase 1 — Chat-1 DB + RLS ✅ 完成
- [x] Supabase 專案對接（`3types` / `ophpnzswebrmjmkrtmwe`）
- [x] 增量 migration 套用（保留既有 6 表資料，新增 10 表）
- [x] 6 個 enum 建立（constitution, instruction_type, instruction_status, follow_up_status, staff_role, chat_mode）
- [x] 51 條 RLS policy 套用
- [x] 5 個 index 建立
- [x] 7 個 trigger + 3 個 helper function 建立
- [x] `.env.local` 設定完成（Supabase URL + keys）

**產出檔案：**
- `supabase/migrations/20260214000000_mvp_v1_schema.sql`
- `lib/supabase.ts`（service role client）
- `lib/supabase-server.ts`（cookie-based SSR client）
- `lib/supabase-browser.ts`（browser singleton client）
- `.env.local`、`.env.example`

### Phase 1 — Chat-2 Auth + Profile ✅ 完成
- [x] Google OAuth callback route（`app/api/auth/callback/route.ts`）
- [x] 登入頁面（`app/login/page.tsx`）
- [x] AuthProvider context + `useAuth()` hook（`components/auth/AuthProvider.tsx`）
- [x] AuthGuard 保護路由（`components/auth/AuthGuard.tsx`）
- [x] Auth helpers：`getCurrentUser()`、`requireStaffRole()`、`requirePatientAccess()`（`lib/auth-helpers.ts`）

**備註：**
- `requireStaffRole` 已修正：`staff_roles` 主鍵是 `user_id`（非 `id`），select 改為 `user_id, role, is_active`
- `requirePatientAccess` 已修正：`patient_care_team` 是複合主鍵 `(patient_user_id, staff_user_id)`

### Phase 1 — Chat-4 聊天室骨架 ✅ 完成
- [x] 三分型路由：`/chat/depleting`、`/chat/crossing`、`/chat/hoarding`
- [x] `/chat` 自動重定向到 `/chat/depleting`
- [x] ChatLayoutShell（桌面側邊欄 + 手機 tab 切換）
- [x] ChatRoom 組件（localStorage 持久化 + session 管理）
- [x] ChatInputV2（自動調整高度 textarea）
- [x] MessageList（訊息氣泡 + 模式徽章 + 時間戳）
- [x] ModeIndicator（唯讀模式顯示，非用戶選擇）

**重要設計決定：**
- 模式（G1/G2/G3/B）由 AI 自動判斷，**不是**用戶手動選擇
- `ModeSelector.tsx` 已改為 `ModeIndicator`（read-only），只顯示當前 AI 判斷的模式
- ChatRoom 從 API response `data.mode` 接收模式，不再由前端控制

**產出檔案：**
- `app/chat/page.tsx`、`app/chat/layout.tsx`、`app/chat/[type]/page.tsx`
- `components/chat-v2/ChatLayoutShell.tsx`
- `components/chat-v2/ChatRoom.tsx`
- `components/chat-v2/ChatInputV2.tsx`
- `components/chat-v2/MessageList.tsx`
- `components/chat-v2/ModeSelector.tsx`（已重構為 ModeIndicator）

### Phase 2 — Chat-4 統一 Chat API ✅ 完成
- [x] `POST /api/chat/v2` — 新三分型聊天室專用 API
- [x] `resolveMode()` — 語意自動分檔（關鍵字 + 訊息長度分析）
  - 預約關鍵字（預約/book/改期/取消）→ `B`
  - 長訊息(>150字) / 教練關鍵字 → `G3`
  - 理論關鍵字（點解/原理/why）→ `G2`
  - 預設 → `G1`
- [x] Care context 自動注入（patient_care_profile + care_instructions + follow_up_plans）
- [x] 體質專屬 system prompt（虛損/交叉/積滯各有側重）
- [x] Chat logging 寫入 Supabase（chat_messages + chat_request_logs）
- [x] ChatRoom.tsx 已更新為呼叫 `/api/chat/v2`

**備註：**
- 舊有 `/api/chat`（route.ts）保持不變，繼續服務 WordPress 內嵌 chatbot
- 新 API 放在 `/api/chat/v2`，避免破壞現有功能
- 未登入用戶仍可使用聊天，但不會有個人化 care context 注入

**產出檔案：**
- `app/api/chat/v2/route.ts`

### Phase 2 — 醫師控制台 API ✅ 完成
- [x] `GET /api/doctor/patients` — 病人列表（搜尋 + 分頁）
- [x] `GET /api/doctor/patients/:id/profile` — 病人完整護理檔案
- [x] `PATCH /api/doctor/patients/:id/constitution` — 更新體質評估
- [x] `POST /api/doctor/patients/:id/instructions` — 新增護理指引
- [x] `PATCH /api/doctor/instructions/:id` — 更新護理指引
- [x] `POST /api/doctor/patients/:id/follow-ups` — 新增覆診計劃
- [x] `PATCH /api/doctor/follow-ups/:id` — 更新覆診計劃
- [x] `GET /api/me/care-context` — 病人讀取自己的護理資料

**共通模式：**
- 所有 mutation 均寫入 `audit_logs`（before/after JSON）
- 所有 route 使用 `createServiceClient()` bypass RLS
- DB 用 snake_case，API response 用 camelCase
- 統一錯誤處理：401（未登入）、403（無權限）、400（輸入錯誤）、500（伺服器錯誤）

**產出檔案：**
- `app/api/doctor/patients/route.ts`
- `app/api/doctor/patients/[patientUserId]/profile/route.ts`
- `app/api/doctor/patients/[patientUserId]/constitution/route.ts`
- `app/api/doctor/patients/[patientUserId]/instructions/route.ts`
- `app/api/doctor/instructions/[id]/route.ts`
- `app/api/doctor/patients/[patientUserId]/follow-ups/route.ts`
- `app/api/doctor/follow-ups/[id]/route.ts`
- `app/api/me/care-context/route.ts`

---

## 12) 未完成項目 / 下一步

### Phase 2 — 待做
- [ ] **Chat-3：醫師控制台 UI 頁面**
  - API 已建好，需要建立前端頁面（`app/doctor/*`、`components/doctor/*`）
  - 包含：病人列表、病人詳情、體質編輯、介口管理、覆診管理
  - 每次更新需顯示更新者與時間
- [ ] **Chat-5：Booking Bridge（B mode 專用）**
  - 4 個 bridge endpoint 未建立：
    - `POST /api/chat/booking/availability`
    - `POST /api/chat/booking/create`
    - `POST /api/chat/booking/reschedule`
    - `POST /api/chat/booking/cancel`
  - 需做 server-side schema validation + 白名單欄位
  - 預約成功後自動回寫 `follow_up_plans` 狀態

### Phase 3 — 整合測試
- [ ] 全流程 E2E 測試
- [ ] RLS 權限驗證（跨帳戶隔離）
- [ ] 現有 booking/cancel/reschedule 回歸測試

### Phase 4 — 上線前
- [ ] Supabase Dashboard 設定 Google OAuth provider
- [ ] Vercel 環境變數確認（4 個 Supabase vars 已加）
- [ ] Production smoke test

---

## 13) 開發備註

### 契約偏差記錄
1. **Chat API 路徑**：契約寫 `POST /api/chat`，實作用 `POST /api/chat/v2`。
   - 原因：`/api/chat` 已被 WordPress chatbot 佔用，不可破壞。
   - 建議：契約可更新為 `/api/chat/v2`，或待 WordPress chatbot 遷移後合併。

2. **Mode 不在 request body**：契約寫 request 含 `"mode": "G2"`，實作改為 server 自動判斷。
   - 原因：用戶明確要求「模式由 AI 語意分析決定，唔係用戶選」。
   - 實作：server 端 `resolveMode()` 分析最新用戶訊息，response 返回 `mode` 欄位。

3. **`staff_roles` / `patient_care_team` 主鍵**：
   - `staff_roles` 主鍵是 `user_id`（非自動生成的 `id`）
   - `patient_care_team` 是複合主鍵 `(patient_user_id, staff_user_id)`
   - `auth-helpers.ts` 已修正對應的 select 語句

### 技術決定
- Supabase 專案：`3types`（`ophpnzswebrmjmkrtmwe`）
- AI 模型：Gemini Pro（`gemini-pro`）
- 前端狀態：localStorage per type（`eden.chat.<type>.v1`）
- Session 管理：client-side generated session ID（`sess_<timestamp>_<random>`）
- 所有 API route 使用 service role client bypass RLS，前端不直接查 Supabase

### 已知限制（v1 可接受）
- Chat logging 是 fire-and-forget，失敗不影響回覆但可能丟失 log
- Token 計算是估算值（字元數 / 4），非精確值
- Follow-up `overdue` 標記需手動或後續加 cron job
- 未實作 streaming response（v1 用一次性 JSON 回覆）
