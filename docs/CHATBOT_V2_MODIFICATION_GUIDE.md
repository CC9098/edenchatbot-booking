# Chatbot v2 修改說明書（Prompt + Mode + Symptom Logging）

最後更新：2026-02-16（hotfix: symptom logging prompt + validation + function-calling flow）

## 1) TL;DR（先答你最關心）

- `B mode`（預約模式）目前是 **code-driven**，不讀 Supabase prompt。**新增：B mode 同時支持 booking + symptom functions**。
- `G1/G2/G3` 目前是 **Supabase-driven 優先**（`chat_prompt_settings` + `knowledge_docs`），沒有資料才 fallback 到 code 內建 prompt。**新增：G1/G2/G3 支持 symptom functions（需登入）**。
- `/chat` 頁面用的是 `/api/chat/v2`；舊 widget 仍可能打 `/api/chat`（另一套邏輯）。
- **新功能（2026-02-16）：症狀記錄 (Symptom Logging)** - 病人可透過對話記錄症狀，醫師可在 dashboard 查看。

## 2) 系統路徑總覽

### 前端入口

- `app/chat/page.tsx` -> `components/chat-v2/ChatRoom.tsx`
- `ChatRoom.tsx` 送 request 到 `/api/chat/v2`

### 後端主邏輯

- `app/api/chat/v2/route.ts`
  - `resolveMode(messages)`：判斷 `G1/G2/G3/B`
  - `buildSystemPrompt(type, mode, careContext)`：決定 prompt 來源
  - **Function Calling 策略**：
    - `mode === 'B'`：booking + symptom functions
    - `mode !== 'B' && userId`：symptom functions only
    - `!userId`：no function calling（simple generateContent）
  - **Streaming 與 Function Calling**：
    - 有 tools（booking/symptom）時，會走 non-stream chat API，確保 function calling 正常執行
    - 只有無 tools 時先走 streaming generateContent

### 預約 function 實作

- `lib/booking-conversation-helpers.ts`
  - `listBookableDoctors`
  - `getAvailableTimeSlots`
  - `createConversationalBooking`

### 症狀記錄 function 實作（新增 2026-02-16）

- `lib/symptom-conversation-helpers.ts`
  - `logSymptom`：記錄新症狀
  - `updateSymptom`：更新症狀狀態（標記已好返）
  - `listSymptoms`：查詢症狀歷史

## 3) Prompt 來源優先次序（最重要）

### 3.1 B mode（預約）

`buildSystemPrompt()` 一開始就 `if (mode === 'B') return buildBookingSystemPrompt(careContext);`

意思：
- 不查 Supabase `chat_prompt_settings`
- 不查 Supabase `knowledge_docs`
- 會注入 `careContext`（包括護理指示、follow-up、近期症狀 ID）
- 完全用 code 內文（`FALLBACK_MODE_PROMPTS.B` + `buildBookingSystemPrompt(careContext)`）

### 3.2 G1/G2/G3（健康對話）

`buildSystemPrompt()` 的順序：

1. 讀 `chat_prompt_settings`（按 `type` + `is_active = true`）
2. 讀 `knowledge_docs`（按 `type` + `enabled = true` + `is_active = true` + `sort_order`）
3. 如果 `settings` 有值：  
   - 用 `prompt_md` 模板，替換：
     - `{{KNOWLEDGE}}`
     - `{{SOURCES}}`
     - `{{EXTRA_INSTRUCTIONS}}`
   - 再附加該檔位 `gear_g1_md` / `gear_g2_md` / `gear_g3_md`
   - 再附加 `careContext`
4. 如果 `settings` 無值：用 `buildFallbackPrompt()`

### 3.3 常見誤區

- `chat_prompt_settings.system_prompt` 欄位目前 **未被 v2 使用**（v2讀的是 `prompt_md` / `gear_g*_md` / `extra_instructions_md`）。
- 只改 `enabled` 可能不夠，v2 對 `knowledge_docs` 同時檢查 `enabled` 和 `is_active`。

## 4) Mode 判斷規則（resolveMode）

檔案：`app/api/chat/v2/route.ts`

### 4.1 判斷順序

1. 看最近 5 則對話有無 booking intent（`BOOKING_KEYWORDS`）
2. 如果有，且最新訊息無明確取消字眼（`CANCEL_KEYWORDS`），直接留在 `B`
3. 否則若最新訊息含 booking keyword，也入 `B`
4. 否則若訊息長度 > 150 或命中 `G3_KEYWORDS`，入 `G3`
5. 否則若命中 `G2_KEYWORDS`，入 `G2`
6. 其他預設 `G1`

### 4.2 你應該改邊度

- 想更易入 B mode：加 `BOOKING_KEYWORDS`
- 想更易退出 B mode：加 `CANCEL_KEYWORDS`
- 想減少誤入 G3：調整 `lower.length > 150` 門檻或 `G3_KEYWORDS`

## 5) 「我要改乜，去邊改」對照表

| 需求 | 應改位置 | 備註 |
|---|---|---|
| B mode 唔好講體質建議 | `FALLBACK_MODE_PROMPTS.B` + `buildBookingSystemPrompt(careContext)` | Code 改動，非 Supabase |
| B mode 問題太多（一次3條） | 同上 | 在 prompt 明確「一次只問一條」 |
| B mode 醫師/時段流程 | `BOOKING_FUNCTIONS` + `handleFunctionCall()` + `lib/booking-conversation-helpers.ts` | Function calling 層 |
| G1/G2/G3 語氣與內容 | Supabase `chat_prompt_settings` | DB 即時生效（同 type 相關） |
| G1/G2/G3 知識內容 | Supabase `knowledge_docs` | `sort_order` 決定注入次序 |
| 判斷入 B/G1/G2/G3 規則 | `resolveMode()` + keyword 常量 | Code 改動 |
| **症狀記錄功能（新）** | `SYMPTOM_FUNCTIONS` + `handleFunctionCall()` + `lib/symptom-conversation-helpers.ts` | **2026-02-16 新增** |
| **症狀 AI 記錄邏輯** | `SYMPTOM_RECORDING_GUIDANCE` + `buildBookingSystemPrompt(careContext)` + G mode prompt append | **Prompt engineering** |

## 6) Supabase 修改範例（G 模式）

### 6.1 先看目前 active prompt

```sql
select type, is_active, prompt_md, gear_g1_md, gear_g2_md, gear_g3_md, extra_instructions_md
from chat_prompt_settings
where is_active = true;
```

### 6.2 更新某個體質（例：hoarding）prompt

```sql
update chat_prompt_settings
set
  prompt_md = '你係醫天圓 AI 顧問...{{KNOWLEDGE}}...{{EXTRA_INSTRUCTIONS}}',
  gear_g1_md = 'G1 規則...',
  gear_g2_md = 'G2 規則...',
  gear_g3_md = 'G3 規則...',
  extra_instructions_md = '全域額外指示...',
  updated_at = now()
where type = 'hoarding'
  and is_active = true;
```

### 6.3 更新知識庫內容

```sql
update knowledge_docs
set
  content_md = '新版知識內容...',
  sort_order = 10,
  is_active = true,
  enabled = true,
  updated_at = now()
where id = 123;
```

### 6.4 新增知識庫內容

```sql
insert into knowledge_docs (type, title, content_md, sort_order, enabled, is_active)
values ('hoarding', '痰濕飲食重點', '內容...', 20, true, true);
```

## 7) B mode 常用改法（code）

檔案：`app/api/chat/v2/route.ts`

### 7.1 改 B mode prompt

- 改 `FALLBACK_MODE_PROMPTS.B`（行為規則）
- 改 `buildBookingSystemPrompt(careContext)`（包裝說明、診所資訊、節奏規則）

### 7.2 改預約工具規格

- `BOOKING_FUNCTIONS`（給模型的 function schema）
- `handleFunctionCall()`（實際呼叫）

### 7.3 改 booking 實際邏輯

- `lib/booking-conversation-helpers.ts`
  - 時段計算
  - double booking re-check
  - 建立預約與 email

## 8) 版本共存注意（v1 vs v2）

- `/api/chat/v2`：新 chat（本說明書覆蓋範圍）
- `/api/chat`：舊接口，獨立 prompt 邏輯
- `components/ChatWidget.tsx` 目前打 `/api/chat`，唔受 v2 規則影響

如果你改完 v2 但某頁仍無變，第一步要確認該頁是否真的在打 `/api/chat/v2`。

## 9) 標準改動流程（交接建議）

1. 先確認目標屬於「B mode」定「G mode」
2. B mode 改 code；G mode 先改 Supabase（必要時再改 fallback code）
3. 本地跑 `npm run typecheck`
4. 用真實對話測 4 種 case：
   - 查預約（應入 B）
   - 取消預約意圖（應可離開 B）
   - 一般短問答（G1）
   - 深入分析（G2/G3）
5. 檢查是否有「模式正確但內容錯層」：
   - B mode 仍講體質建議
   - G mode 誤觸 booking function

## 10) 快速故障排查

### 問題：改了 Supabase prompt 但沒生效

- 先確認當下 mode 不是 `B`
- 確認 `chat_prompt_settings` 該 `type` 有且只有一筆 `is_active = true`
- 確認 `prompt_md` 不是空，且模板 token 拼字正確

### 問題：B mode 內容仍然太雜

- 先看 `FALLBACK_MODE_PROMPTS.B` 是否有明確禁止非預約內容
- 再加「只可輸出預約相關句型」硬規則
- 必要時在回覆前做 post-process 過濾（程式層）

### 問題：模式判斷飄忽

- 調整 `BOOKING_KEYWORDS / CANCEL_KEYWORDS / G2_KEYWORDS / G3_KEYWORDS`
- 微調「最近 5 則對話」和長度閾值

---

## 11) 症狀記錄功能（Symptom Logging）- 新增 2026-02-16

### 11.1 功能概述

**目的**：讓病人透過對話記錄身體症狀，醫師可查看症狀歷史。

**使用場景**：
- 病人：「我今日頭痛」→ AI 自動記錄症狀
- 病人：「我3月1號第一日嚟經期，3月6號完」→ AI 記錄症狀 + 日期範圍
- 病人：「我頭痛好返了」→ AI 更新症狀狀態為 resolved
- 醫師：在 dashboard 查看病人症狀記錄

### 11.2 Function Calling 架構

**SYMPTOM_FUNCTIONS**（3個）：
1. `log_symptom` - 記錄新症狀
2. `update_symptom` - 更新症狀（標記已好返）
3. `list_my_symptoms` - 查詢症狀歷史

**Mode-specific 啟用策略**：
```typescript
if (mode === 'B') {
  // B mode: 預約 + 症狀 functions
  tools = [{ functionDeclarations: [...BOOKING_FUNCTIONS, ...SYMPTOM_FUNCTIONS] }];
} else if (userId) {
  // G1/G2/G3: 只有症狀 functions（需登入）
  tools = [{ functionDeclarations: SYMPTOM_FUNCTIONS }];
} else {
  // 未登入：無 function calling
  tools = undefined;
}
```

**為什麼咁設計**：
- B mode 可以同時處理預約 + 記錄症狀（例如：「我想預約睇頭痛」）
- G1/G2/G3 可以記錄症狀但唔會誤觸 booking functions
- 未登入用戶無法記錄症狀（因為冇 user_id）

### 11.3 Database Schema

**Table**: `symptom_logs`

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| patient_user_id | uuid | FK to auth.users |
| category | text | 症狀類別（頭痛、經期、失眠等） |
| description | text | 詳細描述 |
| severity | smallint (1-5) | 嚴重程度 |
| status | symptom_status | active / resolved / recurring |
| started_at | date | 開始日期 |
| ended_at | date | 結束日期（NULL = 進行中） |
| logged_via | text | chat / manual |
| created_at | timestamptz | |
| updated_at | timestamptz | |

**RLS Policies**:
- 病人可 CRUD 自己嘅症狀
- 醫師可查看 care team 病人嘅症狀（read-only）
- Admin 全權限

### 11.4 API Routes

**病人端**：
- `GET /api/me/symptoms` - 列出自己嘅症狀
- `POST /api/me/symptoms` - 手動新增症狀
- `PATCH /api/me/symptoms/[id]` - 更新症狀
- `DELETE /api/me/symptoms/[id]` - 刪除症狀

**醫師端**：
- `GET /api/doctor/patients/[patientUserId]/symptoms` - 查看病人症狀（read-only）

**Profile API 整合**：
- `GET /api/doctor/patients/[patientUserId]/profile` 已加入 `recentSymptoms` 欄位

### 11.5 AI Prompt 指引

**加入位置**：
- `SYMPTOM_RECORDING_GUIDANCE`（共用指引）
- `buildBookingSystemPrompt(careContext)`（B mode）
- `mode !== 'B' && userId` 時，`systemPrompt` 會額外 append 同一段指引（G1/G2/G3）

```
【症狀記錄功能】
你具備幫用戶記錄身體症狀的功能。注意以下原則：
1. 當用戶「描述」自己的症狀時（例如「我今日頭痛」「我最近失眠」），call log_symptom 記錄
2. 當用戶「詢問」症狀原因時（例如「頭痛點算好」），唔好急住記錄，先提供建議
3. 症狀記錄後，自然提及「我幫你記錄低咗，醫師睇症時會參考」
4. 如果用戶話症狀好返，call update_symptom 更新狀態
```

**User Context 注入（v2 實際路徑）**：
- `app/api/chat/v2/route.ts` 內 `fetchCareContext()` 會 fetch 近 2 週嘅症狀
- 注入到 prompt 顯示：進行中/近期症狀 + symptom ID
- AI 可直接用該 ID 去 call `update_symptom`

### 11.6 醫師 Dashboard UI

**位置**：`app/doctor/patients/[patientUserId]/page.tsx`

**新增 Component**：`SymptomsSection`
- 顯示最近 30 天症狀
- Status badge（active=紅, resolved=綠, recurring=橙）
- Severity bar（1-5 視覺化色條）
- 日期範圍顯示
- logged_via 指示器（💬 AI對話記錄）
- **Read-only**（醫師只能查看，唔能修改）

### 11.7 修改症狀功能常見需求

| 需求 | 應改位置 | 備註 |
|------|---------|------|
| 改症狀分類選項 | `SYMPTOM_FUNCTIONS[0].parameters.properties.category.description` | 提供 AI 建議分類 |
| 改 AI 記錄邏輯 | `SYMPTOM_RECORDING_GUIDANCE`（共用於 B + G 已登入） | Prompt engineering |
| 改嚴重程度判斷 | `SYMPTOM_FUNCTIONS[0].parameters.properties.severity.description` | 1-5 定義 |
| 新增症狀欄位 | 1) Migration 加欄位<br>2) `symptom-conversation-helpers.ts` 更新<br>3) Function declarations 更新 | 需改多處 |
| 改醫師 UI 顯示 | `app/doctor/patients/[patientUserId]/page.tsx` SymptomsSection | 前端 component |

### 11.8 測試症狀記錄

**對話測試**：
```
用戶：「我今日頭痛好辛苦」
預期：AI call log_symptom({ category: "頭痛", startedAt: "2026-02-16", severity: 4 })

用戶：「我頭痛好返了」
預期：AI call update_symptom({ symptomId: "xxx", status: "resolved", endedAt: "2026-02-16" })

用戶：「我之前記錄咗啲咩症狀？」
預期：AI call list_my_symptoms({})
```

**Database 驗證**：
```sql
-- 查看症狀記錄
SELECT * FROM symptom_logs
WHERE patient_user_id = 'user-id-here'
ORDER BY started_at DESC;

-- 查看 audit log
SELECT * FROM audit_logs
WHERE entity = 'symptom_logs'
ORDER BY created_at DESC LIMIT 10;
```

### 11.9 常見問題

**Q: 未登入用戶可以記錄症狀嗎？**
A: 不可以。症狀 functions 只在 `userId` 存在時啟用。未登入用戶會收到「需要登入才能記錄症狀」錯誤。

**Q: B mode 會唔會因為有症狀 functions 而分心？**
A: 不會。Prompt 已明確指示「只在用戶描述症狀時記錄，唔會主動問症狀」。

**Q: 症狀記錄會影響 AI 建議嗎？**
A: 會。`chat/v2` 的 `fetchCareContext()` 會將近期症狀（含 ID）注入 prompt，令 AI 建議更個人化並可更新狀態。

**Q: 開咗 streaming 會唔會令症狀/預約 function 失效？**
A: 現時唔會。當有 function tools 可用時，server 會自動改用 non-stream function-calling flow。

**Q: 醫師可以修改病人記錄嘅症狀嗎？**
A: 不可以。醫師只有 read-only 權限，保持數據真實性。

**Q: 點樣手動執行 migration？**
A: 去 Supabase Dashboard → SQL Editor → 執行 `supabase/migrations/20260216192246_add_symptom_logs.sql`

---

## 12) 總結：完整 Function Calling Map

| Mode | Booking Functions | Symptom Functions | 條件 |
|------|------------------|-------------------|------|
| B | ✅ | ✅ | 所有用戶 |
| G1/G2/G3 | ❌ | ✅ | 需登入 |
| 未登入任何 mode | ❌ | ❌ | - |

**檔案修改總覽**（2026-02-16 症狀功能）：
- ✅ `supabase/migrations/20260216192246_add_symptom_logs.sql` - Schema
- ✅ `lib/symptom-conversation-helpers.ts` - Function implementations
- ✅ `app/api/me/symptoms/**` - Patient API routes
- ✅ `app/api/doctor/patients/[id]/symptoms/**` - Doctor API routes
- ✅ `app/api/chat/v2/route.ts` - Function calling integration
- ✅ `app/api/chat/v2/route.ts` (`fetchCareContext`) - Context injection
- ✅ `app/doctor/patients/[id]/page.tsx` - Doctor UI
