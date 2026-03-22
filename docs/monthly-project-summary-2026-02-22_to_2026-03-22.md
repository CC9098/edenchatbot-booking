# EdenChatbotBooking 過去一個月項目總結

- 統計範圍：2026-02-22 至 2026-03-22
- 專案：`EdenChatbotBooking`
- 依據：`git log`、`git diff`、核心頁面與 API 實作檢視

## 一頁總結

過去一個月，呢個 project 唔只係做咗幾個零散功能，而係明顯由「有聊天、有預約」進一步升級成一個更完整嘅診所數碼流程系統。重點方向非常清晰，主要集中喺四條主線：

1. 病人端體驗升級：症狀頁、養生頁、體質問卷、手機版介面、原生 app chrome 全面優化。
2. 預約流程升級：由單一路徑，擴展到 app 內預約、嵌入式預約、時間表頁、WhatsApp 確認、自動通知。
3. AI / Chatbot 升級：Chatbot V2 判斷更穩，Chatwoot 一般查詢同互動式選單落地，widget/staff chatbot 可配置化。
4. 醫師 / 內部營運工具升級：醫師錄音轉文字、病人管理、問題建議、排班管理、休診管理逐步成形。

如果用一句話概括，今個月你做緊嘅已經唔係單純「網站改版」，而係將 EdenChatbotBooking 推向一個可同時支援病人、醫師、姑娘、網站嵌入、WhatsApp 同 AI 流程嘅多渠道診所平台。

## 量化概覽

| 指標 | 數值 |
| --- | --- |
| Commit 數 | 164 |
| 變更檔案數 | 171 |
| 新增程式 / 文件行數 | 26,003 |
| 刪除行數 | 1,066 |

### 今個月最集中修改嘅模組

| 模組 | 變更次數 | 代表重心 |
| --- | ---: | --- |
| `app/api/chat/v2/route.ts` | 28 | AI 路由、預約意圖、對話安全性 |
| `app/chat/symptoms/page.tsx` | 25 | 病人症狀頁 UX 與資料結構 |
| `components/booking/BookingTabFlow.tsx` | 15 | 統一預約流程主體 |
| `components/patient/PatientAppChrome.tsx` | 13 | 手機版 / app 外殼一致性 |
| `app/care/page.tsx` | 12 | 養生頁、體質內容呈現 |
| `lib/chatwoot-agent-bot.ts` | 10 | Chatwoot 一般查詢 / 菜單邏輯 |
| `components/doctor/CantoneseVoiceNoteTool.tsx` | 9 | 醫師廣東話錄音轉症狀工具 |

以上分佈反映得好清楚：今個月唔係某一個頁面孤立優化，而係圍繞「AI 問診 + 預約 + 醫師工作流 + 病人自助體驗」同步推進。

## 你今個月主要做咗咩

### 1. 病人端體驗大幅升級

### 症狀頁由資料展示，升級到可操作、可回顧、可追蹤

- 改善病人症狀頁 UX，加入狀態篩選、摘要、恢復紀錄流程。
- 簡化症狀卡片結構，改成更適合手機閱讀嘅最小可展開卡。
- 處理 duplicate symptom name，減少重複項目造成嘅干擾。
- 加入 symptom draft 編輯及儲存前確認，避免 AI 直接錯寫資料。
- 將症狀狀態保持為 explicit status，減少自動轉換造成嘅混亂。
- 新增 cue scoring、severity 權重、體質 fallback、quiz fallback，令身體狀態判斷冇咁脆弱。
- 調整 body-status ratio，令畫面呈現更貼近體質 + 問卷 + 症狀訊號，而唔係單一來源。

### 養生 / 體質內容由靜態資訊，升級到個人化體驗

- 新增 `care advice` 養生分頁，支援醫師標記指引內容。
- 新增每種體質 10-point 飲食原則。
- 加入 tendency quiz、每日 check-in、daily tip、daily sense prompt 等內容層。
- 將 quiz 入口移到更合理位置，並建立更一致嘅體質故事線。
- 以 `風 / 水 / 雷` 敘事語言統一病人端視覺與內容語氣，令產品由工具感轉向陪伴感。

### 手機與 app chrome 體驗更完整

- 修正 mobile top bar、bottom bar、tab bar offset、modal overlap 等問題。
- 將 patient tab / chat top bar 視覺統一。
- mobile app 改為預設進入 chat，並保留登入 session。
- 補上 clinic branding，令手機版與原生 app 外觀更一致。
- 讓 patient chrome 在 mobile web browser 亦能正常顯示。

### 2. 預約流程由單一路徑，變成多渠道預約系統

### App 內預約流程成熟咗好多

- 將 booking tab 改成真正 in-app booking flow，而唔再係簡單入口頁。
- 預約頁加入可預約日期綠點提示，減少用戶盲試日期。
- 在醫師選擇階段直接顯示醫師時間表。
- 為已登入病人預填聯絡資料，減少重複填寫。
- booking form placeholder 本地化成中文，完成度更高。

### 排班與預約資料源更一致

- 將可預約排班改為優先讀 Supabase，而唔再只依賴靜態設定。
- 建立 `public bookable schedules`、`embed timetable`、`doctor timetable admin` 等配套。
- 將預約、改期、時間表、嵌入頁都盡量拉回同一條 schedule data chain。
- 新增 holiday / closure 管理，令排班唔只係週常表，而係能反映真實營運狀態。

### WordPress / Embed / 直達連結能力成形

- 新增 WordPress-ready booking embed flow。
- 新增 dynamic embed timetable page。
- timetable card 可直接導向預約 link。
- booking link 可預先選定診所。
- 新增 doctor-specific booking links，同埋醫師 avatar，令導流頁更易用。
- 修正 embed scrolling 同高度更新問題，令嵌入網站時更穩定。

### WhatsApp 預約通知正式落地

- 新增 WhatsApp booking flow。
- 預約成功後自動發送 WhatsApp confirmation。
- 補上 template fallback、語言同步、named params、template sync before send。
- 對不同 clinic 通知電話做同步與修正，包括荃灣聯絡號碼更新。

整體睇，今個月預約系統最大進步唔係某一個 button，而係將「排班資料、預約 UI、Chatbot booking intent、WhatsApp 通知、嵌入頁導流」串成咗一條比較完整嘅鏈。

### 3. AI / Chatbot 能力明顯進化

### Chatbot V2 判斷更穩，更少答錯模式

- 收緊 `B / G1 / G2 / G3` mode routing，令 booking、一般答問、深入解釋、深度困擾之間分流更穩。
- 修正 booking guidance gating 與 type constraint。
- 改善短句 follow-up 判斷，避免因 context loss 走錯流程。
- 改成由 context 推斷 slot reply，而唔係靠 hardcoded time cue。
- 防止未真正 `create_booking` 就誤判成已確認預約。
- 為 unknown constitution 加 guardrail。
- 全域阻擋 cooking method suggestions，降低偏離專案範圍嘅回答。
- 對「想約醫師」、「bare yue」等廣東話預約意圖補強判斷。

### AI 寫入病人症狀前多咗保護層

- 症狀紀錄改成先確認再保存。
- 允許用戶先編輯 symptom draft，再確認入庫。
- 新增恢復細節流程，令病人後續狀態更新更完整。

### Chatwoot 已由固定答句，進化到半自動客服流程

- 新增 Chatwoot general inquiry bot flow。
- 菜單回覆改為 interactive options。
- 一般查詢加入 submenu。
- follow-up menu 拆成 buttons，並修復 list-based menu 回退。
- 忽略 activity messages，避免系統訊息污染 AI 流。
- normalize sender type，並接受缺 sender type 嘅 payload，提升兼容性。
- clinic menu 嘅 free text 可以轉交 AI。
- general menu 下直接提問時，bot 可直接作答，而唔一定只限按鈕。

### Widget chatbot / staff chatbot 由寫死內容變成可控系統

- 新增 widget chatbot control console。
- 新增 staff chatbot control console。
- 將 menu label、節點流程、預覽、儲存回讀逐步做成設定介面。
- 修正 widget chatbot settings 與實際 flow routing 同步問題。

呢部分非常關鍵，因為代表你開始將 chatbot 由「程式內硬編碼」轉成「營運上可調整」。

### 4. 醫師與內部營運工具進入可用階段

### 醫師錄音工作流正式成形

- 新增廣東話 voice note symptom extraction tool。
- 將 voice notes 由舊位置搬到獨立 record page，並加入 patient picker。
- 支援未揀病人都可以先錄音，再一鍵保存到病人症狀。
- 長錄音會 chunk，降低超時風險。
- 加入 retry 機制、長處理修正、pause、manual editing。
- 串接 Deepgram live STT，令錄音工作流唔再只係離線上載，而係更接近即時處理。

### 醫師睇病人、問後續、追蹤趨勢能力提升

- 病人列表加入 patient creation flow。
- 醫師端加入 question suggestion cards。
- 加入 symptom follow-up answers 與趨勢圖。
- 調整 staff/doctor patient visibility，令所有 staff 更容易處理病人資料。

### 排班營運工具補齊

- 新增醫師 timetable management console。
- 新增 holiday / closure CRUD。
- 加入 staff role 檢查，封鎖非 staff 使用 doctor console。
- doctor relogin 時強制 account chooser，降低登入錯 account 機會。

呢啲改動令 project 開始唔只係「病人前台」，而係真係有內部營運後台雛形。

### 5. 合規、穩定性、基礎設施亦有同步補強

### 合規與公開頁面

- 新增 Meta compliance legal pages。
- 補上 privacy policy、terms of service、data deletion 等頁面。

### 穩定性與錯誤處理

- calendar error handling 更穩，並做 sensitive log redact。
- holiday lookup fail 時可 graceful fallback。
- booking 建立前會再做 availability re-check，降低撞期風險。
- 加入 safe error sanitizer，避免將敏感內容直接打入 log。

### 文件與測試

- 補上 `AI_DATA_LOOKUP.md`，清楚定義 timetable source of truth。
- 補上 Chatbot mode logic one-pager，方便日後驗收與 debug。
- 新增多組測試，包括 auth redirect、booking context、contact utils、Deepgram STT、doctor patient list、doctor voice notes、Gemini request。

## 按時間線睇，今個月大致可以分成四段

### 第一段：2026-02-22 至 2026-02-26

- 打底病人端體驗：症狀頁、養生頁、care advice、體質飲食內容、mobile app session。
- 開始收緊 Chatbot V2 路由與 booking 判斷。
- booking tab 轉向真正 in-app booking flow。
- 問卷、體質、症狀顯示邏輯開始統一。

### 第二段：2026-03-01 至 2026-03-06

- 爆發式推進醫師工作流：voice note、record page、patient picker、one-click save。
- 症狀頁 mobile redesign、體質 fallback、UI 精修同步推進。
- booking 同 AI 流程更深整合，包括 direct booking CTA、schedule 顯示、Supabase 排班來源。
- Chatbot booking mode、follow-up、context budget 等邏輯被重點打磨。

### 第三段：2026-03-08 至 2026-03-13

- 補合規頁。
- 建立 timetable management console 與 timetable source-of-truth 文件。
- Chatwoot general inquiry flow 落地。
- virtual online consultation scheduling 加入系統。
- booking form 中文化與 holiday lookup 穩定性優化。

### 第四段：2026-03-19 至 2026-03-21

- widget chatbot control console / staff chatbot control console 正式成形。
- Chatwoot 菜單互動、submenu、AI handoff 進一步完善。
- WordPress / embed booking flow、doctor avatar、doctor-specific booking links 一次補齊。
- WhatsApp booking confirmation 自動化正式落地，並處理 template fallback / sync / language 細節。

## 今個月最值得講嘅幾個「優化方向」

### 1. 由硬編碼邏輯，轉向可配置 / 可營運

最明顯係 timetable、widget chatbot、staff chatbot 呢幾條線。你唔再只係改 code 回應需求，而係逐步做管理介面，令姑娘 / staff 可以自己操作、更新、維護。

### 2. 由單一入口，轉向多渠道一致預約

今個月幾乎所有預約相關改動都指向同一件事：網站、app、Chatbot、WordPress embed、時間表頁、WhatsApp 通知之間要用同一套資料同流程，減少斷裂。

### 3. 由 AI 能答，進一步要求 AI 唔好亂答

Chatbot V2 嘅大量 routing、guardrail、confirmation-before-save、false-booking prevention，都反映你已經由「追求智能」轉向「追求可靠可控」。

### 4. 由病人前台，擴展到醫師 / 營運後台

voice notes、patient creation、question suggestions、follow-up trends、timetable admin，證明你而家做緊嘅產品邊界已經擴到診所內部流程。

## 目前專案狀態判斷

從過去一個月嘅改動睇，`EdenChatbotBooking` 已經唔只係一個「AI 聊天 + Google Calendar 預約」網站，而係開始形成以下能力組合：

- 病人自助入口
- AI 問答與預約分流
- 醫師工作工具
- 姑娘 / staff 營運控制台
- 多渠道預約承接
- 合規公開頁與可部署產品結構

換句話講，呢個月你做嘅優化，大部分都係提升產品「可營運性」、「可擴展性」同「實戰可用度」，而唔只係畫面靚咗。

## 可直接拎去匯報嘅總結版本

過去一個月，我主要將 EdenChatbotBooking 由一個以聊天與預約為主嘅應用，推進成一個更完整嘅診所數碼流程平台。病人端方面，我完成咗症狀頁、養生頁、體質問卷、手機版體驗同 app chrome 嘅全面優化；預約方面，我打通咗 in-app booking、時間表、WordPress/embed 導流、WhatsApp confirmation 同 doctor-specific booking links；AI 方面，我大幅收緊 Chatbot V2 嘅 routing、booking guardrail 同 symptom save 安全性，亦令 Chatwoot 一般查詢與互動式選單正式落地；內部工具方面，我建立咗醫師 voice note 工作流、病人管理強化、排班管理與 widget/staff chatbot 控制台。

整體而言，今個月最核心嘅成果係將前台病人體驗、AI 對話、預約系統、醫師工具同營運設定逐步整合，令系統由「可展示功能」提升到「更接近真實診所營運使用」。
