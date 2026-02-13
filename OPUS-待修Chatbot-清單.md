# Opus 待修Chatbot 清單

## 你而家最需要做嘅 10 件事

- [x] 1. 修復時區 Bug（最緊急）
  /api/availability/route.ts 用 new Date(date) 生成 time slots，但 Vercel server 係 UTC 時區。呢個會導致香港用戶睇到錯嘅可用時間。你已經裝咗 date-fns-tz，但呢個 API 冇用到。呢個係 production bug，要即刻修。

- [x] 2. 統一醫師/診所資料（一個 source of truth）
  同一批醫師資料散落喺 5 個地方：
  - ChatWidget.tsx → DOCTOR_MAP, CLINIC_MAP, doctorLinks, doctorSchedules
  - schedule-config.ts → CALENDAR_MAPPINGS
  - reschedule/page.tsx → DOCTOR_REVERSE_MAP
  - chat/route.ts → Gemini 系統 prompt 入面
  - gmail.ts → 診所地址
  已完成：建立 `shared/clinic-data.ts`（含 `DoctorId`/`ClinicId` 強型別）+ `shared/clinic-schedule-data.ts`，並遷移相關引用至 shared source。

- [ ] 3. 拆分 ChatWidget.tsx（1,072 行太大）
  而家一個 component 包含 14 個 useState、booking 流程、AI 對話、表單、touch handlers……
  建議拆成：
  - ChatWidget.tsx — 外殼（開關、佈局）
  - hooks/useBookingFlow.ts — booking 狀態機
  - hooks/useChatState.ts — 訊息管理
  - ChatMessages.tsx / ChatOptions.tsx / ChatInput.tsx — UI 組件

- [ ] 4. Booking 流程加「返回上一步」
  用戶選錯醫師之後，唯一選擇係「取消預約」重來。應該加返 back button，唔使每次重頭開始。

- [ ] 5. Email 改為可選
  香港好多長者病人冇 email。而家 Zod schema 要求必填 email，應該改成 optional。

- [x] 6. Cancel/Reschedule 頁面翻譯成中文
  呢兩頁而家全部英文（"Cancel Appointment"、"Confirm Cancellation"），但成個 chatbot 都係繁體中文。對病人嚟講好突兀。

- [x] 7. 防止 double booking
  用戶揀完時間到真正確認之間，另一個人可以 book 同一個 slot。/api/booking POST 應該 re-check getFreeBusy 先再建立 event。

- [ ] 8. 「諮詢醫師」表單而家係假嘅
  收集咗病人姓名、電話、email、症狀描述之後乜都冇做。顯示「資料已收 (Simulated)」。應該 send email 去診所或者存入 database。

- [x] 9. 清理未用依賴
  package.json 有 20+ 個 Radix/Shadcn 組件從未 import 過（accordion、dialog、tabs 等）。刪除可以減少 build 時間同 bundle size。

- [ ] 10. 建立 Admin Dashboard（長遠）
  而家改時間表要改 code 再 deploy。應該用 database schema（已經有 doctors、doctorSchedules、holidays table）建一個簡單管理介面，俾診所姑娘自己管理。

---

## 建議執行順序

階段: 即刻
任務: #1 時區 bug
原因: Production 正確性

階段: 本週
任務: #7 防 double booking
原因: 減少錯誤風險

階段: 下週
任務: #4 返回上一步 + #5 Email 可選
原因: UX 改善

階段: 之後
任務: #3 拆分 ChatWidget + #8 修復諮詢表單
原因: 代碼質素

階段: 長遠
任務: #9 清理依賴 + #10 Admin Dashboard
原因: 可維護性
