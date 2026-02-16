# Chatbot v2 修改說明書（Prompt + Mode）

最後更新：2026-02-16

## 1) TL;DR（先答你最關心）

- `B mode`（預約模式）目前是 **code-driven**，不讀 Supabase prompt。
- `G1/G2/G3` 目前是 **Supabase-driven 優先**（`chat_prompt_settings` + `knowledge_docs`），沒有資料才 fallback 到 code 內建 prompt。
- `/chat` 頁面用的是 `/api/chat/v2`；舊 widget 仍可能打 `/api/chat`（另一套邏輯）。

## 2) 系統路徑總覽

### 前端入口

- `app/chat/page.tsx` -> `components/chat-v2/ChatRoom.tsx`
- `ChatRoom.tsx` 送 request 到 `/api/chat/v2`

### 後端主邏輯

- `app/api/chat/v2/route.ts`
  - `resolveMode(messages)`：判斷 `G1/G2/G3/B`
  - `buildSystemPrompt(type, mode, careContext)`：決定 prompt 來源
  - `mode === 'B'`：走 function calling（`list_doctors/get_available_slots/create_booking`）
  - `mode !== 'B'`：一般 `generateContent`

### 預約 function 實作

- `lib/booking-conversation-helpers.ts`
  - `listBookableDoctors`
  - `getAvailableTimeSlots`
  - `createConversationalBooking`

## 3) Prompt 來源優先次序（最重要）

### 3.1 B mode（預約）

`buildSystemPrompt()` 一開始就 `if (mode === 'B') return buildBookingSystemPrompt();`

意思：
- 不查 Supabase `chat_prompt_settings`
- 不查 Supabase `knowledge_docs`
- 不注入 `careContext`
- 完全用 code 內文（`FALLBACK_MODE_PROMPTS.B` + `buildBookingSystemPrompt()`）

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
| B mode 唔好講體質建議 | `FALLBACK_MODE_PROMPTS.B` + `buildBookingSystemPrompt()` | Code 改動，非 Supabase |
| B mode 問題太多（一次3條） | 同上 | 在 prompt 明確「一次只問一條」 |
| B mode 醫師/時段流程 | `BOOKING_FUNCTIONS` + `handleFunctionCall()` + `lib/booking-conversation-helpers.ts` | Function calling 層 |
| G1/G2/G3 語氣與內容 | Supabase `chat_prompt_settings` | DB 即時生效（同 type 相關） |
| G1/G2/G3 知識內容 | Supabase `knowledge_docs` | `sort_order` 決定注入次序 |
| 判斷入 B/G1/G2/G3 規則 | `resolveMode()` + keyword 常量 | Code 改動 |

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
- 改 `buildBookingSystemPrompt()`（包裝說明、診所資訊、節奏規則）

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
