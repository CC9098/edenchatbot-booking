# MVP v1 Multi-Codex 執行計劃

## 1) 目標（MVP v1）
- 保留現有 Eden booking flow 作為執行層（`/api/availability`、`/api/booking`、取消/改期頁）。
- 新增 3 個分型聊天室（`depleting` / `crossing` / `hoarding`），各自獨立 `session/localStorage`。
- 聊天模式統一為 `G1/G2/G3/B`。
- `B` 模式只可經現有 booking API 執行，不允許 LLM 直接改 Google Calendar。
- 醫師控制台可寫入病人資料（體質、介口、覆診建議），AI 讀取後做個人化提醒。
- 所有核心資料統一落 Supabase（auth + app data + chat logs）。

## 2) 工作分組（用 6 個 Codex chat）
`Chat-0` 係總控，其餘 chat 平行開工。每個 chat 用獨立 branch（建議 prefix：`codex/`）。

1. `Chat-0`（Orchestrator）
- 負責：拆任務、定接口契約、整合 PR、衝突解決。
- 交付：`docs/MVP_V1_INTEGRATION_NOTES.md`、最終整合 PR。

2. `Chat-1`（DB + RLS）
- 負責：Supabase schema、migration、RLS policy、seed。
- 交付：`supabase/migrations/*`、`docs/MVP_V1_SCHEMA.md`。

3. `Chat-2`（Auth + Profile + Care Team）
- 負責：Google 登入串接、`profiles/staff_roles/patient_care_team` CRUD API。
- 交付：`app/api/auth/*`、`app/api/patients/*`、權限 middleware。

4. `Chat-3`（Doctor Console）
- 負責：醫師控制台頁面與資料寫入（體質、介口、覆診）。
- 交付：`app/doctor/*`、`components/doctor/*`。

5. `Chat-4`（Chat Engine：G1/G2/G3/B）
- 負責：3 分型聊天室、獨立 session/localStorage、模式切換、Supabase prompt/knowledge 注入。
- 交付：`app/chat/*`、`app/api/chat/*`、`components/chat/*`。

6. `Chat-5`（Booking Bridge + Follow-up）
- 負責：`B` 模式與現有 booking API 對接、覆診建議與預約狀態回寫。
- 交付：`app/api/follow-up/*`、booking 狀態同步邏輯。

## 3) 先後次序（Phase）
## Phase 0（必做，先串好契約）
1. `Chat-0` 建立「資料欄位契約 + API 契約」文件。
2. 所有 chat 只可按契約開發，避免後期 schema 打架。

## Phase 1（平行）
1. `Chat-1`：出 migration + RLS + seed。
2. `Chat-2`：做 auth/profile/care team API。
3. `Chat-4`：做 3 分型聊天室骨架 + 獨立 session/localStorage。

## Phase 2（平行）
1. `Chat-3`：做 Doctor Console UI + 寫入 API（依賴 Phase 1 schema）。
2. `Chat-4`：接 Supabase prompt/knowledge/chat logs（依賴 Phase 1 schema）。
3. `Chat-5`：接 `B` 模式 booking bridge（依賴 Chat-4 模式接口）。

## Phase 3（整合）
1. `Chat-0` 合併順序：
- 先 `Chat-1`
- 再 `Chat-2`
- 再 `Chat-4`
- 再 `Chat-3`
- 最後 `Chat-5`
2. 每次 merge 後跑 smoke test + 型別檢查。

## Phase 4（上線前）
1. 全流程 E2E：登入 → 醫師寫介口/覆診 → 病人 chat 收到個人化提醒 → `B` 模式預約。
2. 安全驗證：RLS、跨帳戶不可讀、敏感欄位不可被病人寫入。
3. Vercel 預覽環境驗證，再上 production。

## 4) 每組的 Definition of Done（DoD）
## Chat-1 DoD
- 所有核心表建立完成（含 index + FK + enum/check）。
- RLS policy 可阻擋未授權讀寫。
- migration 可重播（乾淨 DB 可一次成功）。

## Chat-2 DoD
- Google 登入成功建立/更新 profile。
- API 只能讀寫授權範圍資料。
- 錯誤碼一致（401/403/422/500）。

## Chat-3 DoD
- 醫師可更新：體質、介口、覆診建議。
- 每次更新有 audit log。
- UI 顯示最近更新者與時間。

## Chat-4 DoD
- 3 路由正常：`/chat/depleting`、`/chat/crossing`、`/chat/hoarding`。
- 每型獨立 `localStorage key` + `sessionId`。
- 可在同一對話切換 `G1/G2/G3/B`。

## Chat-5 DoD
- `B` 模式只經 booking API 執行，不直接改 calendar。
- 預約成功可回寫 follow-up 狀態（如 `booked`）。
- 取消/改期後狀態一致。

## 5) 交接規範（避免多 chat 打架）
1. 所有 PR 必附：
- 變更摘要
- 影響 API/schema
- 測試證據（最少手動步驟 + 截圖）
- 風險與 rollback 方法

2. 檔案 ownership（暫定）
- `supabase/migrations/*`：只限 `Chat-1`
- `app/api/chat/*`：`Chat-4` 主導
- `app/api/booking/*`：`Chat-5` 主導（不可破壞現有能力）
- `app/doctor/*`：`Chat-3` 主導

3. 禁止事項
- 未經契約更新，不可私自改動 shared schema 欄位名。
- 未經總控同意，不可改動 production env var 命名。
- 不可讓 LLM 直接執行 booking 寫操作。

## 6) 建議 branch 命名
- `codex/mvpv1-orchestrator`
- `codex/mvpv1-db-rls`
- `codex/mvpv1-auth-profile`
- `codex/mvpv1-doctor-console`
- `codex/mvpv1-chat-engine`
- `codex/mvpv1-booking-bridge`

## 7) 建議每日節奏（你作為 PM）
1. 早上：收集各 chat blocker，先解 schema/API 契約問題。
2. 中段：只准平行做 non-conflict 模組。
3. 晚上：`Chat-0` 做一次整合 + smoke test + 問題回派。

## 8) 第一個里程碑（3-5 日）
1. Day 1：Phase 0 + Phase 1 開始。
2. Day 2：Phase 1 完成，開始 Phase 2。
3. Day 3-4：Phase 2 完成 + Phase 3 整合。
4. Day 5：Phase 4 驗收，準備 deploy。

## 9) 可直接貼給各 Codex chat 的開場指令模板
```md
你是本組負責的 Codex。請只處理以下範圍，不要越界修改：
- Scope: <填本組範圍>
- 不可修改: <填不可改檔案/資料表>
- 交付物: <填輸出>
- 驗收標準: <填 DoD>

請先閱讀：
1) docs/MVP_V1_MULTI_CODEX_PLAN.md
2) docs/MVP_V1_INTEGRATION_NOTES.md（如存在）

完成後輸出：
1) 變更摘要
2) 檔案清單
3) 測試結果
4) 風險與回滾方案
```

