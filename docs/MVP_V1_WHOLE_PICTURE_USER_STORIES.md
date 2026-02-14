# Eden AI Personal Care Assistant - Whole Picture (MVP v1)

## 1) 產品定位
本產品不是一般 FAQ chatbot。  
MVP v1 的定位是：**醫師可控、病人專屬、可持續跟進** 的 AI 健康助理。

核心價值：
- 以醫師建議為主體（體質、介口、覆診），AI 做解釋與提醒
- 以 `Google account user_id` 作病人唯一身份
- 以同一聊天體驗完成「問答 + 覆診預約導流」
- 以 Supabase 作單一資料真相來源（Single Source of Truth）

## 2) 目標與邊界（MVP v1）
## 2.1 目標
1. 保留既有 Eden booking 執行層（availability/booking/cancel/reschedule）。
2. 上線三分型聊天室（`depleting/crossing/hoarding`），各自獨立 session/localStorage。
3. 統一聊天模式：`G1/G2/G3/B`。
4. 建立醫師控制台，可更新病人體質、介口、覆診建議。
5. 病人聊天時可讀取個人化醫囑與覆診提示。

## 2.2 邊界
1. LLM 不做醫療診斷、不改醫囑、不直接寫 Google Calendar。
2. `B` 模式只可透過既有 booking API 做預約動作。
3. 敏感資料必須受 RBAC + RLS 保護。

## 3) 角色與權限（Who）
1. 病人（Patient）
- 用 Google 登入
- 可看自己資料與聊天記錄
- 可在 `B` 模式完成預約/改期/取消

2. 醫師（Doctor）
- 可看與自己 care team 關聯的病人
- 可更新體質、介口、覆診建議
- 可查看病人跟進狀態

3. 助理（Assistant）
- 可協助維護病人建議（權限低於 doctor）
- 不可改 staff role

4. 管理員（Admin）
- 管理 staff 角色
- 管理 care team 關聯

## 4) 功能地圖（What）
## 4.1 身份與存取
- Google OAuth 登入
- `profiles` 同步
- `staff_roles` + `patient_care_team` 控制資料可見範圍

## 4.2 醫師控制台
- 病人搜尋
- 體質管理（depleting/crossing/hoarding/mixed/unknown）
- 介口與生活建議管理（新增、更新、停用）
- 覆診建議管理（建議日期、原因、狀態）
- 重要變更寫入 `audit_logs`

## 4.3 病人 AI 助手
- 三分型路由聊天室
- 獨立 `sessionId` + `localStorage` per type
- `G1/G2/G3` 回答檔位
- `B` 模式 booking 導流與執行
- 每次對話注入病人個人化 context（體質/介口/覆診）

## 4.4 Booking Bridge
- 內部橋接 `availability/booking` 既有 API
- 成功預約後回寫 `follow_up_plans` 狀態（`pending -> booked`）

## 4.5 治理與安全
- RLS
- audit log
- 401/403 一致錯誤語義
- red-flag 內容導向真人處理（非診斷）

## 5) 端到端流程（How）
## 流程 A：病人首次進入
1. 病人用 Google 登入。
2. 系統建立/更新 `profiles`。
3. 病人進入分型聊天室（其中一型）。
4. AI 以預設/既有資料提供回覆。

## 流程 B：看診後醫師更新
1. 醫師在控制台搜尋病人。
2. 更新 `patient_care_profile`（體質、備註）。
3. 新增 `care_instructions`（介口/生活建議）。
4. 新增 `follow_up_plans`（建議覆診日期）。
5. 系統寫 `audit_logs`。

## 流程 C：病人聊天與預約
1. 病人提問，AI 先讀取個人化 context。
2. AI 提醒醫師介口與覆診建議。
3. 病人要求預約，切到 `B` 模式。
4. `B` 模式呼叫 booking API 完成預約。
5. 成功後更新 follow-up 為 `booked`。

## 流程 D：後續追蹤
1. 醫師查看跟進狀態。
2. 覆診完成後標記 `done`。
3. 若逾期未預約可標記 `overdue`（MVP 可手動）。

## 6) 用戶故事（User Stories）
## 6.1 病人故事（P）
### P-001 以 Google 登入建立身份
作為病人，我想用 Google 登入，讓系統識別我並帶出我的個人化建議。  
驗收：
1. 登入後可取得唯一 `user_id`。
2. 首次登入自動建立 profile。
3. 再次登入仍對應同一資料。

### P-002 在三分型聊天室分開紀錄
作為病人，我想三個分型聊天室分開保存對話，避免內容混淆。  
驗收：
1. 三路由皆可進入：`/chat/depleting`、`/chat/crossing`、`/chat/hoarding`。
2. 每型有獨立 `localStorage/session` key。
3. 互不覆蓋訊息。

### P-003 收到醫師個人化介口提醒
作為病人，我想在聊天中被提醒我的介口與調理重點。  
驗收：
1. 若有 active 指示，AI 回覆可引用。
2. 停用/過期指示不再引用。
3. 回覆語氣清楚、非診斷。

### P-004 被提醒覆診建議日期
作為病人，我想知道醫師建議的覆診時間，方便安排。  
驗收：
1. AI 能顯示最近 pending 覆診建議。
2. 日期格式一致。
3. 無資料時不亂生成。

### P-005 在同一聊天切去預約模式
作為病人，我想在同一對話切去 `B` 模式完成預約，不需跳系統。  
驗收：
1. 可在對話中切換 `B`。
2. 可查空檔、建立預約。
3. 流程失敗時有可理解錯誤訊息。

### P-006 預約完成後更新跟進狀態
作為病人，我想預約後系統知道我已安排覆診。  
驗收：
1. 預約成功可關聯 follow-up。
2. follow-up 狀態由 `pending` 轉 `booked`。
3. 醫師端可見。

## 6.2 醫師故事（D）
### D-001 搜尋與開啟病人檔案
作為醫師，我想快速搜尋病人並查看當前體質與建議。  
驗收：
1. 可按姓名/email 查詢。
2. 只顯示我有權限病人。
3. 開啟檔案可見 profile + instructions + follow-ups。

### D-002 更新體質與備註
作為醫師，我想更新病人體質，讓 AI 跟最新臨床判斷。  
驗收：
1. 可更新 `constitution/constitution_note`。
2. 更新後病人聊天即生效。
3. 有 `updated_by/updated_at`。

### D-003 新增介口/生活建議
作為醫師，我想新增可生效期的建議，讓病人得到一致提醒。  
驗收：
1. 可設定 type/title/content/start/end。
2. 可停用或改為 done。
3. AI 只讀 active 且生效中的建議。

### D-004 建立覆診建議
作為醫師，我想設定建議覆診日期與原因，方便跟進。  
驗收：
1. 可建立 follow-up plan。
2. 預設狀態 `pending`。
3. 可更新為 `done/overdue/cancelled`。

### D-005 查閱變更稽核
作為醫師，我想知道誰改過病人關鍵資料。  
驗收：
1. 關鍵操作有 audit log。
2. 記錄 actor、時間、前後差異。
3. 不可由前端篡改歷史。

## 6.3 助理與管理員故事（A）
### A-001 助理協助維護病人建議
作為助理，我想在授權範圍內更新病人建議。  
驗收：
1. 只可操作 care team 內病人。
2. 不可管理 staff role。
3. 所有操作有 audit log。

### A-002 管理員分配醫師與病人關聯
作為 admin，我想管理 care team 關聯以控制資料存取。  
驗收：
1. 可新增/移除關聯。
2. 關聯更新後權限即時生效。
3. 非 admin 無法執行。

## 6.4 系統故事（S）
### S-001 保障跨帳戶資料隔離
作為系統，我必須確保病人只見到自己資料。  
驗收：
1. RLS 阻擋越權查詢。
2. 越權回應 403。
3. 測試覆蓋病人對病人、醫師對非關聯病人。

### S-002 保持既有 booking 相容
作為系統，我必須不破壞現有 booking/cancel/reschedule 流程。  
驗收：
1. 既有 endpoint request/response 不變。
2. 既有頁面 query 參數不變。
3. 回歸測試通過。

### S-003 模式邊界清晰
作為系統，我必須確保 `B` 模式不直接寫 calendar。  
驗收：
1. LLM 不持有 calendar 直接操作能力。
2. 只可呼叫受控 bridge endpoint。
3. bridge 端有白名單 schema 驗證。

## 7) 非功能需求（NFR）
1. 安全：
- RLS、RBAC、server-side validation、審計可追溯

2. 一致性：
- 錯誤碼標準化（401/403/422/500）
- 同一 user 在不同端資料一致

3. 可維護：
- 契約優先（contract-first）
- migration 可重播
- 文檔與代碼同步

4. 可觀測：
- chat request log
- booking bridge log
- 主要錯誤事件可追蹤

## 8) MVP v1 不做（Out of Scope）
1. AI 自動醫療診斷
2. 自動處方
3. 跨平台推送編排（WhatsApp/SMS 全自動）
4. 複雜報表系統
5. 多租戶機構管理

## 9) 成功指標（MVP）
1. 醫師採用率：有更新病人體質/介口的醫師比例
2. 跟進轉化率：`pending -> booked` 比例
3. AI 個人化命中率：回覆含有效個人化指示的比例
4. 預約完成率：`B` 模式進入後成功建立 booking 比例
5. 安全事件：越權讀寫事件為 0

## 10) 與分組計劃對齊
- 任務分工與先後：見 `docs/MVP_V1_MULTI_CODEX_PLAN.md`
- 資料/API 契約：見 `docs/MVP_V1_INTEGRATION_NOTES.md`

本文件是產品層（why/what/how），
`INTEGRATION_NOTES` 是工程契約層（schema/api/rls）。

---

## 11) 實際實作與 User Stories 對照（2026-02-14 更新）

### 架構變更影響
> **P-002（三分型聊天室）已修改**：用戶反饋三個 chatroom 不合理，改為單一 `/chat`。
> 體質類型由 server 自動從用戶 profile 讀取。

### User Stories 完成狀態

#### 病人故事
| ID | 標題 | 狀態 | 備註 |
|---|---|---|---|
| P-001 | Google 登入建立身份 | ✅ 完成 | Google OAuth + profiles 自動同步 |
| P-002 | ~~三分型聊天室~~ → 單一聊天室 | ✅ 完成（已修改） | 改為 `/chat`，體質自動讀取 |
| P-003 | 收到醫師個人化介口提醒 | ✅ 完成 | care_instructions 自動注入 prompt |
| P-004 | 被提醒覆診建議日期 | ✅ 完成 | follow_up_plans 自動注入 prompt |
| P-005 | 同一聊天切去預約模式 | ✅ API 完成 | B mode + booking bridge endpoints 就緒，待 E2E 測試 |
| P-006 | 預約完成後更新跟進狀態 | ✅ API 完成 | ±3 日自動連結 follow_up_plan，待測試 |

#### 醫師故事
| ID | 標題 | 狀態 | 備註 |
|---|---|---|---|
| D-001 | 搜尋與開啟病人檔案 | ✅ 完成 | 病人列表 + 搜尋 + 詳情頁 |
| D-002 | 更新體質與備註 | ✅ 完成 | PATCH constitution API + UI modal |
| D-003 | 新增介口/生活建議 | ✅ 完成 | POST/PATCH instructions API + UI modal |
| D-004 | 建立覆診建議 | ✅ 完成 | POST/PATCH follow-ups API + UI modal |
| D-005 | 查閱變更稽核 | ⚠️ API 完成 | audit_logs 有寫入，但缺 UI 查閱介面 |

#### 系統故事
| ID | 標題 | 狀態 | 備註 |
|---|---|---|---|
| S-001 | 跨帳戶資料隔離 | ⚠️ 待測試 | RLS 已建立，待驗證 |
| S-002 | 既有 booking 相容 | ✅ 完成 | 現有 booking API 未修改 |
| S-003 | 模式邊界清晰 | ✅ 完成 | B mode 只經 bridge endpoint，不直接寫 calendar |

#### 助理/管理員故事
| ID | 標題 | 狀態 | 備註 |
|---|---|---|---|
| A-001 | 助理協助維護 | ⚠️ 待做 | API 支援 assistant role，缺獨立 UI |
| A-002 | Admin 管理 care team | ⚠️ 待做 | 目前以 SQL 手動管理 |
