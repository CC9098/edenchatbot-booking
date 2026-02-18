# Supabase Tables 5W1H 說明（EdenChatbotBooking）

最後更新：2026-02-18  
資料來源：Supabase `public` schema 即時查詢（table/column/FK/RLS/trigger）+ 專案程式碼搜尋

## 1) 用途與讀法

- 目標：一次過說明每個 Supabase table 的 `Why / What / How / Where / When / Who`。
- 範圍：`public` schema 共 30 張 table（不含 `auth` schema 內建表）。
- `Where` 會同時列：
  - DB 位置：`public.<table>`
  - 程式位置：主要讀寫檔案（Next.js route / helper / script）
- `Who` 來自 RLS policy 摘要（以當前 DB 狀態為準）。

## 2) 共用欄位語意（先看呢節，下面會大量重複）

- `id` / `*_id`：主鍵或關聯鍵（連去其他表）。
- `status`：流程狀態欄（通常有 CHECK 或 ENUM）。
- `is_active` / `enabled`：是否啟用。
- `created_at`：建立時間（通常 default `now()`）。
- `updated_at`：更新時間（多數表有 `BEFORE UPDATE` trigger 自動改）。
- `raw` / `payload` / `*_json`：保留原始外部資料（webhook / debug /審計）。

## 3) Table-by-table（5W1H + 欄位）

### A. 內容與學習 Content/Learning

#### `public.articles`
- Why: 文章內容管理（前台顯示 + 後台 CMS）。
- What: 文章主檔（slug、標題、內文、發佈控制）。
- How: 由內容服務/API/scripts 寫入；前台按發佈條件讀取。
- Where:
  - DB: `public.articles`
  - Code: `lib/content-service.ts`, `app/page.tsx`, `app/articles/page.tsx`, `scripts/import-finished-articles.ts`
- When: `created_at` 建立；`updated_at` 經 `trg_articles_updated_at` 自動更新。
- Who: 公開可讀「已啟用 + 已發佈 + 發佈時間 <= 現在」；admin 全權。
- 欄位:
  - `id` (uuid, PK): 文章唯一 ID。
  - `slug` (text, unique): 路由鍵（URL）。
  - `title` (text): 標題。
  - `excerpt` (text, nullable): 摘要。
  - `content_md` (text): Markdown 內文。
  - `cover_image_url` (text, nullable): 封面圖 URL。
  - `tags` (text[]): 標籤集合。
  - `is_active` (bool): 啟用旗標。
  - `published_at` (timestamptz, nullable): 發佈時間。
  - `created_by` (uuid, FK -> `auth.users.id`): 建立者。
  - `created_at` / `updated_at`: 審計時間。

#### `public.courses`
- Why: 課程主檔（課程頁及課程清單）。
- What: 課程級資料（slug、標題、說明、發佈控制）。
- How: 由內容服務/scripts 維護；前台查詢公開課程。
- Where:
  - DB: `public.courses`
  - Code: `lib/content-service.ts`, `app/courses/page.tsx`, `app/courses/[slug]/page.tsx`, `scripts/migrate-legacy-content.ts`
- When: `updated_at` 由 `trg_courses_updated_at` 自動更新。
- Who: 公開只可讀已發佈且啟用；admin 全權。
- 欄位:
  - `id` (uuid, PK): 課程 ID。
  - `slug` (text, unique): 路由鍵。
  - `title` (text): 課程名。
  - `description_md` (text, nullable): 課程介紹。
  - `cover_image_url` (text, nullable): 封面圖。
  - `level` (text, nullable): 難度/級別。
  - `is_active` (bool): 啟用旗標。
  - `published_at` (timestamptz, nullable): 發佈時間。
  - `created_by` (uuid, FK -> `auth.users.id`): 建立者。
  - `created_at` / `updated_at`: 審計時間。

#### `public.course_modules`
- Why: 把課程分章節（module）。
- What: 課程與課堂中間層。
- How: 主要由內容腳本/CMS 管理；前台按排序展示。
- Where:
  - DB: `public.course_modules`
  - Code: `lib/content-service.ts`, `scripts/migrate-legacy-content.ts`
- When: `updated_at` 由 `trg_course_modules_updated_at` 自動更新。
- Who: 公開可讀 active 且母課程已發佈；admin 全權。
- 欄位:
  - `id` (uuid, PK): module ID。
  - `course_id` (uuid, FK -> `public.courses.id`): 所屬課程。
  - `title` (text): 章節名。
  - `sort_order` (int): 排序。
  - `is_active` (bool): 啟用旗標。
  - `created_at` / `updated_at`: 審計時間。

#### `public.course_lessons`
- Why: 課堂內容主表。
- What: 課堂層資料（slug、標題、內文、影片、時長）。
- How: 內容服務/API 讀取；scripts 匯入；進度 API 用它校驗 lesson。
- Where:
  - DB: `public.course_lessons`
  - Code: `lib/content-service.ts`, `app/api/me/lesson-progress/route.ts`, `scripts/migrate-legacy-content.ts`
- When: `updated_at` 由 `trg_course_lessons_updated_at` 自動更新。
- Who: 公開可讀 active + published，且母課程已發佈；admin 全權。
- 欄位:
  - `id` (uuid, PK): lesson ID。
  - `course_id` (uuid, FK -> `public.courses.id`): 所屬課程。
  - `module_id` (uuid, nullable, FK -> `public.course_modules.id`): 所屬章節。
  - `slug` (text): 課堂路由鍵（同課程內 unique）。
  - `title` (text): 課堂標題。
  - `content_md` (text): 課堂內容。
  - `video_url` (text, nullable): 影片連結。
  - `duration_minutes` (int, nullable): 時長（>=0）。
  - `sort_order` (int): 排序。
  - `is_active` (bool): 啟用旗標。
  - `published_at` (timestamptz, nullable): 發佈時間。
  - `created_at` / `updated_at`: 審計時間。

#### `public.user_lesson_progress`
- Why: 記錄會員每課學習進度。
- What: 使用者 x 課堂的關聯進度表（複合主鍵）。
- How: `/api/me/lesson-progress*` 寫入與查詢。
- Where:
  - DB: `public.user_lesson_progress`
  - Code: `app/api/me/lesson-progress/route.ts`, `app/api/me/lesson-progress/[lessonId]/route.ts`
- When: 每次更新進度會改 `updated_at`（trigger `trg_user_lesson_progress_updated_at`）。
- Who: 用戶只可讀寫自己；admin 可全權。
- 欄位:
  - `user_id` (uuid, PK, FK -> `auth.users.id`): 進度擁有者。
  - `lesson_id` (uuid, PK, FK -> `public.course_lessons.id`): 課堂。
  - `progress_pct` (int): 0-100 進度百分比。
  - `completed_at` (timestamptz, nullable): 完成時間。
  - `last_viewed_at` (timestamptz): 最後瀏覽時間。
  - `created_at` / `updated_at`: 審計時間。

### B. Chat 與知識

#### `public.chat_sessions`
- Why: 聊天會話主檔。
- What: 一段對話 session 的索引。
- How: chat/v2 流程建立 session，後續 message/log 以 `session_id` 關聯。
- Where:
  - DB: `public.chat_sessions`
  - Code: `lib/user-context.ts`
- When: 建立時寫 `created_at`；更新標題/活躍時間會改 `updated_at`（trigger）。
- Who: authenticated 只可 CRUD 自己 (`auth.uid() = user_id`)。
- 欄位:
  - `session_id` (text, PK): 會話主鍵。
  - `type` (text): 體質類型（depleting/crossing/hoarding）。
  - `created_at` / `last_seen_at`: 建立與最後互動。
  - `user_id` (uuid, nullable, FK -> `auth.users.id`): 會話擁有者。
  - `title` (text, nullable): 會話標題。
  - `updated_at` (timestamptz): 更新時間。

#### `public.chat_messages`
- Why: 儲存對話訊息內容。
- What: 每條 message（角色、內容）並關聯 session。
- How: chat/v2 完成回覆後 insert user/assistant 訊息。
- Where:
  - DB: `public.chat_messages`
  - Code: `app/api/chat/v2/route.ts`
- When: insert 時可由 trigger `chat_messages_fill_user_id_before_insert` 自動補 `user_id`。
- Who: authenticated 只可讀寫自己 message。
- 欄位:
  - `id` (uuid, PK): message ID。
  - `session_id` (text, FK -> `public.chat_sessions.session_id`): 所屬會話。
  - `role` (text): `user` / `assistant` / `system`。
  - `content_text` (text): 訊息內容。
  - `client_message_id` (text, nullable): 前端去重 ID。
  - `created_at` (timestamptz): 建立時間。
  - `user_id` (uuid, nullable, FK -> `auth.users.id`): 擁有者。
  - `mode` (text, nullable): 聊天模式（例如 G1/G2/G3/B）。

#### `public.chat_prompt_settings`
- Why: 可配置化 prompt 策略。
- What: 每種 `type` 的 prompt/gear 設定。
- How: chat/v2 請求前讀取；admin 可後台調整。
- Where:
  - DB: `public.chat_prompt_settings`
  - Code: `app/api/chat/v2/route.ts`
- When: update 會自動刷新 `updated_at`（trigger）。
- Who: 全站可讀 active；admin 可全權改。
- 欄位:
  - `type` (text, PK): 體質類型鍵。
  - `enabled` (bool): 是否啟用。
  - `variant` (text, nullable): `constitution` / `three_view`。
  - `extra_instructions_md` (text): 額外指令。
  - `prompt_md` (text): 主 prompt。
  - `model_gear` (text): 模型配置鍵。
  - `gear_g1_md` / `gear_g2_md` / `gear_g3_md` (text): 各 gear prompt block。
  - `system_prompt` (text, nullable): 可覆寫系統 prompt。
  - `is_active` (bool): 生效旗標。
  - `updated_at` (timestamptz): 更新時間。

#### `public.chat_request_logs`
- Why: 追蹤每次 LLM 請求與效能。
- What: 模型、token、耗時、知識注入與錯誤記錄。
- How: chat/v2 回覆後寫入，用作 observability/debug。
- Where:
  - DB: `public.chat_request_logs`
  - Code: `app/api/chat/v2/route.ts`
- When: insert 時 trigger 可自動補 `user_id`。
- Who: authenticated 可讀自己記錄。
- 欄位:
  - `id` (uuid, PK): log ID。
  - `created_at` (timestamptz): 記錄時間。
  - `session_id` (text, nullable): 關聯會話。
  - `type` (text): 體質類型。
  - `model_id` / `model_gear` (text): 模型資訊。
  - `prompt_source` (text): `supabase_prompt_md` / `code_prompt`。
  - `prompt_variant` (text, nullable): prompt variant。
  - `knowledge_sources` (jsonb): 知識來源清單。
  - `knowledge_chars` (int): 注入字數。
  - `knowledge_injected` (bool): 是否注入知識。
  - `latest_user_text` (text): 最新用戶訊息。
  - `response_gear` (text): `g1`/`g2`/`g3`。
  - `user_id` (uuid, nullable, FK -> `auth.users.id`): 請求用戶。
  - `prompt_tokens` / `completion_tokens` (int, nullable): token 用量。
  - `duration_ms` (int, nullable): 耗時。
  - `error` (text, nullable): 錯誤訊息。

#### `public.knowledge_docs`
- Why: chat/v2 取用的知識庫文檔池。
- What: 依體質分類的 Markdown 知識片段。
- How: chat/v2 查詢 active docs 注入 prompt。
- Where:
  - DB: `public.knowledge_docs`
  - Code: `app/api/chat/v2/route.ts`
- When: 更新時 `updated_at` trigger 自動更新。
- Who: 以 policy 控制可讀 active；admin 可全權；另有 deny-all policy 作防護層。
- 欄位:
  - `id` (uuid, PK): 文檔 ID。
  - `type` (text): 體質分類。
  - `title` (text): 標題。
  - `content_md` (text): 內文。
  - `enabled` (bool): 舊啟用旗標。
  - `is_active` (bool): 新啟用旗標（實際查詢常用）。
  - `sort_order` (int): 排序。
  - `created_at` / `updated_at`: 審計時間。

### C. 醫療照護與病人上下文 Care Context

#### `public.patient_care_profile`
- Why: 病人照護摘要主檔。
- What: 體質、最近就診、醫師更新註記。
- How: 醫師端更新；chat/v2 / patient API 讀取。
- Where:
  - DB: `public.patient_care_profile`
  - Code: `lib/user-context.ts`, `app/api/me/care-context/route.ts`, `app/api/doctor/patients/[patientUserId]/constitution/route.ts`, `app/api/chat/v2/route.ts`
- When: 更新時 `updated_at` 自動刷新（trigger）。
- Who: 病人可讀自己；staff 可按 care-team 關係讀寫。
- 欄位:
  - `patient_user_id` (uuid, PK, FK -> `auth.users.id`): 病人 user id。
  - `constitution` (enum `constitution_type`): 體質。
  - `constitution_note` (text, nullable): 體質註解。
  - `last_visit_at` (timestamptz, nullable): 最近就診時間。
  - `updated_by` (uuid, nullable, FK -> `auth.users.id`): 最後更新者。
  - `updated_at` (timestamptz): 更新時間。

#### `public.care_instructions`
- Why: 醫囑/生活建議。
- What: 給病人的持續照護事項。
- How: 醫師建立與更新；病人端只讀 active。
- Where:
  - DB: `public.care_instructions`
  - Code: `lib/user-context.ts`, `app/api/me/care-context/route.ts`, `app/api/doctor/patients/[patientUserId]/instructions/route.ts`, `app/api/chat/v2/route.ts`
- When: `updated_at` trigger 自動維護。
- Who: staff 可插入/更新/讀；病人只可讀自己且 `status=active`。
- 欄位:
  - `id` (uuid, PK): 指示 ID。
  - `patient_user_id` (uuid, FK -> `auth.users.id`): 病人。
  - `instruction_type` (enum): `diet_avoid` / `diet_recommend` / `lifestyle` / `warning` / `medication_note`。
  - `title` (text): 標題。
  - `content_md` (text): 內容。
  - `status` (enum `instruction_status`): active/paused/done。
  - `start_date` / `end_date` (date, nullable): 生效區間。
  - `created_by` (uuid, FK -> `auth.users.id`): 醫師/職員。
  - `created_at` / `updated_at`: 審計時間。

#### `public.follow_up_plans`
- Why: 追蹤覆診計畫。
- What: 建議覆診日期與狀態。
- How: 醫師建立，病人/醫師查看，cron 會掃逾期。
- Where:
  - DB: `public.follow_up_plans`
  - Code: `lib/user-context.ts`, `app/api/doctor/patients/[patientUserId]/follow-ups/route.ts`, `app/api/cron/follow-ups-overdue/route.ts`, `app/api/chat/v2/route.ts`
- When: 更新時 `updated_at` trigger；`status` 隨流程變更。
- Who: 病人可讀自己；staff 可讀寫關聯病人。
- 欄位:
  - `id` (uuid, PK): follow-up ID。
  - `patient_user_id` (uuid, FK -> `auth.users.id`): 病人。
  - `suggested_date` (date): 建議覆診日。
  - `reason` (text, nullable): 原因。
  - `status` (enum `follow_up_status`): pending/booked/done/overdue/cancelled。
  - `linked_booking_id` (text, nullable): 關聯 booking 標識。
  - `created_by` (uuid, FK -> `auth.users.id`): 建立者。
  - `created_at` / `updated_at`: 審計時間。

#### `public.symptom_logs`
- Why: 症狀時間線。
- What: 病人症狀與嚴重度紀錄。
- How: 病人可自助記錄，chat/v2 可輔助新增，醫師可查看。
- Where:
  - DB: `public.symptom_logs`
  - Code: `lib/symptom-conversation-helpers.ts`, `app/api/me/symptoms/route.ts`, `app/api/doctor/patients/[patientUserId]/symptoms/route.ts`, `app/api/chat/v2/route.ts`
- When: update 時 `updated_at` trigger。
- Who: 病人可 CRUD 自己；staff 可讀；admin 全權。
- 欄位:
  - `id` (uuid, PK): 症狀記錄 ID。
  - `patient_user_id` (uuid, FK -> `auth.users.id`): 病人。
  - `category` (text): 症狀分類。
  - `description` (text, nullable): 描述。
  - `severity` (smallint, nullable): 嚴重度 1-5。
  - `status` (enum `symptom_status`): active/resolved/recurring。
  - `started_at` / `ended_at` (date): 起止日期。
  - `logged_via` (text): 來源（預設 `chat`）。
  - `created_at` / `updated_at`: 審計時間。

#### `public.audit_logs`
- Why: 關鍵變更審計。
- What: 誰對邊個病人的哪個實體做了甚麼變更。
- How: 醫療相關 API / helper 在寫入業務表後同步寫審計。
- Where:
  - DB: `public.audit_logs`
  - Code: `app/api/doctor/*`, `app/api/me/symptoms/*`, `lib/symptom-conversation-helpers.ts`
- When: 每次業務操作即時 append-only insert。
- Who: 只允許 staff 查閱其可接觸病人的審計。
- 欄位:
  - `id` (uuid, PK): 審計 ID。
  - `actor_user_id` (uuid, FK -> `auth.users.id`): 執行操作者。
  - `patient_user_id` (uuid, nullable, FK -> `auth.users.id`): 受影響病人。
  - `entity` (text): 實體名（如 symptom/follow_up）。
  - `entity_id` (text, nullable): 實體主鍵值。
  - `action` (text): 操作類型（create/update/delete...）。
  - `before_json` / `after_json` (jsonb, nullable): 變更前後快照。
  - `created_at` (timestamptz): 操作時間。

#### `public.patient_care_team`
- Why: 定義「哪位 staff 可看哪位病人」。
- What: 病人與 staff 的授權關係表。
- How: auth helper / doctor API 查詢授權範圍。
- Where:
  - DB: `public.patient_care_team`
  - Code: `lib/auth-helpers.ts`, `app/api/doctor/patients/route.ts`
- When: 建立照護關係時插入；通常不高頻改。
- Who: 病人可讀自己關係、staff 可讀自己關係、admin 全權。
- 欄位:
  - `patient_user_id` (uuid, PK, FK -> `auth.users.id`): 病人。
  - `staff_user_id` (uuid, PK, FK -> `auth.users.id`): staff。
  - `team_role` (text): 團隊角色描述。
  - `is_primary` (bool): 是否主責。
  - `created_at` (timestamptz): 建立時間。

#### `public.profiles`
- Why: 使用者基本資料（擴充 auth.users）。
- What: 顯示名、電話、語言時區、體質偏好等。
- How: user/doctor API 讀寫；chat/v2 讀取上下文。
- Where:
  - DB: `public.profiles`
  - Code: `app/api/chat/v2/route.ts`, `app/api/doctor/patients/route.ts`, `app/api/doctor/patients/[patientUserId]/audit-logs/route.ts`
- When: update 時 `updated_at` trigger。
- Who: authenticated 讀寫自己；staff 可讀其授權病人 profile。
- 欄位:
  - `id` (uuid, PK, FK -> `auth.users.id`): 與 auth user 一對一。
  - `display_name` (text, nullable): 顯示名稱。
  - `avatar_path` (text, nullable): 頭像 storage path。
  - `constitution_type` (enum, nullable): 體質標記。
  - `locale` (text): 語言（預設 `zh-HK`）。
  - `timezone` (text): 時區（預設 `Asia/Hong_Kong`）。
  - `phone` (text, nullable): 電話。
  - `created_at` / `updated_at`: 審計時間。

#### `public.staff_roles`
- Why: staff 身份與權限入口。
- What: 每個 user 對應 staff 角色。
- How: auth helper 用來判斷 is_staff/is_admin。
- Where:
  - DB: `public.staff_roles`
  - Code: `lib/auth-helpers.ts`
- When: 管理員授權 staff 時更新。
- Who: 自己可讀；admin 可全權改。
- 欄位:
  - `user_id` (uuid, PK, FK -> `auth.users.id`): staff user id。
  - `role` (enum `staff_role`): doctor/assistant/admin。
  - `is_active` (bool): 啟用狀態。
  - `created_at` (timestamptz): 建立時間。

### D. 預約與排班 Booking/Scheduling

#### `public.booking_intake`
- Why: chat-v2 預約流程的結構化落庫（含改期/取消同步）。
- What: 病人提交的預約資料 + Google Calendar event linkage。
- How: booking helper/route 建立與更新狀態，並記錄 payload。
- Where:
  - DB: `public.booking_intake`
  - Code: `lib/booking-intake-storage.ts`, `lib/booking-conversation-helpers.ts`, `app/api/booking/route.ts`, `app/api/chat/booking/cancel/route.ts`, `app/api/chat/booking/reschedule/route.ts`
- When: 建立時 `status=pending`，成功後 `confirmed_at`；取消/改期更新對應欄位。
- Who: user 只可查改自己紀錄；server/service-role 可執行全流程。
- 欄位:
  - `id` (uuid, PK): intake 主鍵。
  - `source` (text): 來源（預設 `chat_v2`）。
  - `status` (text): pending/confirmed/cancelled/failed。
  - `failure_reason` (text, nullable): 失敗原因。
  - `user_id` (uuid, nullable, FK -> `auth.users.id`): 登入病人。
  - `session_id` (text, nullable): 關聯 chat session。
  - `google_event_id` (text, nullable): Google 事件 ID。
  - `calendar_id` (text, nullable): 日曆 ID。
  - `doctor_id` / `doctor_name_zh`: 醫師資料快照。
  - `clinic_id` / `clinic_name_zh`: 診所資料快照。
  - `appointment_date` / `appointment_time`: 預約時段。
  - `duration_minutes` (int): 預約分鐘數。
  - `patient_name` / `phone` / `email`: 聯絡資料。
  - `visit_type` (text): `first` / `followup`。
  - `need_receipt` (text): no/yes_insurance/yes_not_insurance。
  - `medication_pickup` (text): none/lalamove/sfexpress/clinic_pickup。
  - `id_card` / `dob` / `gender` (nullable): 個人資料補充。
  - `allergies` / `medications` / `symptoms` / `referral_source` / `notes` (nullable): 問診補充。
  - `booking_payload` (jsonb): 原始流程 payload 快照。
  - `confirmed_at` / `cancelled_at` / `last_rescheduled_at` (nullable): 流程時間戳。
  - `reschedule_count` (int): 改期次數。
  - `created_at` / `updated_at`: 審計時間。

#### `public.doctors`
- Why: 醫師名單主檔。
- What: 醫師代號與中英職稱。
- How: 舊 booking storage（Drizzle/Neon 路徑）讀寫；Supabase 已有對應表。
- Where:
  - DB: `public.doctors`
  - Code: `shared/schema.ts`, `lib/storage.ts`, `lib/booking-helpers.ts`
- When: 後台維護醫師名單時更新。
- Who: 公開可讀；admin 可全權。
- 欄位:
  - `id` (text, PK): 醫師代號（例 `lee`）。
  - `name` / `name_zh` (text): 名稱。
  - `title` / `title_zh` (text): 職稱。
  - `is_active` (bool): 是否在職/可預約。
  - `created_at` (timestamptz): 建立時間。

#### `public.doctor_schedules`
- Why: 醫師在診所的可預約時間與 calendar mapping。
- What: `doctor_id + clinic_id + calendar_id + schedule(jsonb)`。
- How: availability/booking 流程查 schedule；後台可維護。
- Where:
  - DB: `public.doctor_schedules`
  - Code: `shared/schema.ts`, `lib/storage.ts`, `app/api/availability/route.ts`
- When: schedule 變動時寫入；`created_at` 建立時間。
- Who: 公開可讀 active；admin 可全權。
- 欄位:
  - `id` (uuid, PK): schedule ID。
  - `doctor_id` (text, FK -> `public.doctors.id`): 醫師。
  - `clinic_id` (text): 診所。
  - `calendar_id` (text): Google Calendar ID。
  - `is_active` (bool): 是否生效。
  - `schedule` (jsonb): 週排班 JSON。
  - `created_at` (timestamptz): 建立時間。

#### `public.holidays`
- Why: 封鎖日期（全局/醫師/診所級）。
- What: 不可預約日設定。
- How: availability 流程計算可預約時段前先檢查。
- Where:
  - DB: `public.holidays`
  - Code: `shared/schema.ts`, `lib/storage.ts`, `lib/booking-helpers.ts`, `app/api/availability/route.ts`
- When: 每逢假期配置更新。
- Who: 公開可讀；admin 可全權。
- 欄位:
  - `id` (uuid, PK): 假期 ID。
  - `doctor_id` (text, nullable, FK -> `public.doctors.id`): 指定醫師（null=不限）。
  - `clinic_id` (text, nullable): 指定診所（null=不限）。
  - `holiday_date` (date): 日期。
  - `reason` (text, nullable): 原因。
  - `created_at` (timestamptz): 建立時間。

#### `public.intake_questions`
- Why: 可配置初診/覆診問卷欄位。
- What: 問題 key、顯示文字、欄位類型、選項。
- How: 後台維護；前端可按 visit type 拉取。
- Where:
  - DB: `public.intake_questions`
  - Code: `shared/schema.ts`, `lib/storage.ts`
- When: 表單調整時更新。
- Who: 公開可讀 active；admin 可全權。
- 欄位:
  - `id` (uuid, PK): 問題 ID。
  - `visit_type` (text): 適用類型。
  - `question_key` (text): 穩定識別鍵。
  - `label_en` / `label_zh` (text): 題目文案。
  - `field_type` (text): text/textarea/select/radio/checkbox。
  - `required` (bool): 是否必填。
  - `options` (jsonb, nullable): 選項列表。
  - `sort_order` (int): 排序。
  - `is_active` (bool): 啟用旗標。
  - `created_at` (timestamptz): 建立時間。

### E. 會員與支付 Billing/Subscription

#### `public.membership_plans`
- Why: 定義訂閱方案（價錢、price id）。
- What: Stripe price 對應的方案主檔。
- How: 主要供訂閱流程讀取；目前應用層引用較少。
- Where:
  - DB: `public.membership_plans`
  - Code: 目前主要在 DB 層與 Stripe 關聯表（app code 暫未見直接 `.from()`）。
- When: 調價/上新 plan 時更新（`updated_at` trigger）。
- Who: `anon/authenticated` 可讀 active plan。
- 欄位:
  - `code` (text, PK): 方案代號。
  - `name` (text): 顯示名。
  - `stripe_price_id` (text, unique): Stripe 價格 ID。
  - `currency` (text): 幣別（預設 hkd）。
  - `amount_monthly` (int): 月費（>0）。
  - `is_active` (bool): 啟用旗標。
  - `created_at` / `updated_at`: 審計時間。

#### `public.user_subscriptions`
- Why: 用戶訂閱主狀態（新結構）。
- What: 用戶與 Stripe subscription 的映射與週期狀態。
- How: 預期由 webhook/service role 更新；前台僅讀自己狀態。
- Where:
  - DB: `public.user_subscriptions`
  - Code: 目前 app code 未見直接 `.from()`；主要依賴 DB/支付流程。
- When: webhook 事件觸發時更新；`updated_at` trigger。
- Who: authenticated 可讀自己 (`select_own`)。
- 欄位:
  - `id` (uuid, PK): 訂閱記錄 ID。
  - `user_id` (uuid, FK -> `auth.users.id`): 用戶。
  - `provider` (text): 目前固定 `stripe`。
  - `stripe_customer_id` / `stripe_subscription_id` (text, nullable): Stripe 對應 ID。
  - `plan_code` (text, nullable, FK -> `public.membership_plans.code`): 方案代號。
  - `status` (text): trialing/active/past_due/...。
  - `current_period_start` / `current_period_end` (timestamptz, nullable): 當前週期。
  - `cancel_at_period_end` (bool): 週期末取消旗標。
  - `canceled_at` (timestamptz, nullable): 取消時間。
  - `raw` (jsonb): 原始 subscription payload。
  - `created_at` / `updated_at`: 審計時間。

#### `public.stripe_customers`
- Why: 追蹤 user 與 Stripe customer 關係。
- What: 一對一 customer 映射。
- How: 預期由支付流程/service role 建立；客戶端只讀。
- Where:
  - DB: `public.stripe_customers`
  - Code: 目前 app code 未見直接 `.from()`。
- When: 建立 customer 時 insert；更新時 trigger 更新 `updated_at`。
- Who: authenticated 可讀自己。
- 欄位:
  - `user_id` (uuid, PK, FK -> `auth.users.id`): 用戶。
  - `stripe_customer_id` (text, unique): Stripe customer ID。
  - `livemode` (bool): live/test 模式。
  - `created_at` / `updated_at`: 審計時間。

#### `public.stripe_checkout_sessions`
- Why: 追蹤 checkout session 狀態。
- What: 發起付款到完成付款的會話紀錄。
- How: 預期由 checkout 建立 + webhook 更新。
- Where:
  - DB: `public.stripe_checkout_sessions`
  - Code: 目前 app code 未見直接 `.from()`。
- When: 建立 session 時 insert；完成時寫 `completed_at`。
- Who: authenticated 可讀自己。
- 欄位:
  - `id` (uuid, PK): 內部 ID。
  - `checkout_session_id` (text, unique): Stripe session ID。
  - `user_id` (uuid, FK -> `auth.users.id`): 用戶。
  - `plan_code` (text, nullable, FK -> `public.membership_plans.code`): 方案。
  - `stripe_customer_id` (text, nullable): customer ID。
  - `mode` (text): 固定 `subscription`。
  - `status` (text): open/complete/expired。
  - `amount_total` (int, nullable): 金額。
  - `currency` (text, nullable): 幣別。
  - `livemode` (bool): live/test。
  - `checkout_url` (text, nullable): 跳轉連結。
  - `raw` (jsonb): 原始 payload。
  - `created_at` / `completed_at`: 時間戳。

#### `public.billing_events`
- Why: 記錄 webhook 事件，防重與重試追蹤。
- What: 支付事件流水帳（event_id unique）。
- How: 預期由 Stripe webhook receiver append，處理後標記 processed。
- Where:
  - DB: `public.billing_events`
  - Code: 目前 app code 未見直接 `.from()`。
- When: 收到事件即 insert；處理完成填 `processed_at`。
- Who: authenticated 僅可讀自己（若事件含 user_id）。
- 欄位:
  - `id` (bigint, PK): 自增流水 ID。
  - `provider` (text): 固定 stripe。
  - `event_id` (text, unique): Stripe event ID（冪等鍵）。
  - `event_type` (text): 事件類型。
  - `user_id` (uuid, nullable, FK -> `auth.users.id`): 關聯用戶。
  - `received_at` / `processed_at` (timestamptz): 收到與處理時間。
  - `payload` (jsonb): 原始事件。
  - `source` (text): 來源（預設 webhook）。
  - `processing_error` (text, nullable): 處理錯誤。
  - `retries` (int): 重試次數。
  - `livemode` (bool, nullable): live/test。
  - `request_id` (text, nullable): 請求追蹤。

#### `public.member_subscriptions`（舊表）
- Why: 較早期的會員訂閱結構（legacy）。
- What: 舊版 user<->subscription 映射。
- How: 現時多為保留兼容用途。
- Where:
  - DB: `public.member_subscriptions`
  - Code: app code 暫未見直接使用。
- When: 若 legacy 路徑仍寫入會更新 `updated_at`（trigger）。
- Who: **RLS 關閉**（表級風險較高，應只由受控 server 使用）。
- 欄位:
  - `user_id` (uuid, PK, FK -> `auth.users.id`): 用戶。
  - `stripe_customer_id` (text, nullable, unique): customer ID。
  - `stripe_subscription_id` (text, nullable, unique): subscription ID。
  - `stripe_price_id` (text, nullable): price ID。
  - `status` (text): 狀態。
  - `cancel_at_period_end` (bool): 週期末取消。
  - `current_period_end` (timestamptz, nullable): 週期結束。
  - `created_at` / `updated_at`: 審計時間。

### F. 使用者媒體

#### `public.user_images`
- Why: 儲存使用者圖片 metadata（非二進位本體）。
- What: 圖片路徑、來源、尺寸、關聯 session。
- How: 預期由上傳或 AI 生成流程寫入；目前 app code 未見直接 `.from()`。
- Where:
  - DB: `public.user_images`
  - Code: 目前主要在 DB schema 層，尚未見主要 route 寫入。
- When: 上傳/生成圖片時 insert。
- Who: authenticated 只可 CRUD 自己圖片。
- 欄位:
  - `id` (uuid, PK): 圖片 ID。
  - `user_id` (uuid, FK -> `auth.users.id`): 擁有者。
  - `kind` (text): avatar/chat-upload/generated。
  - `origin` (text): upload/ai-generated。
  - `path` (text, unique): storage path。
  - `mime_type` (text, nullable): MIME。
  - `bytes` (int, nullable): 檔案大小。
  - `width` / `height` (int, nullable): 尺寸。
  - `related_session_id` (text, nullable, FK -> `public.chat_sessions.session_id`): 關聯聊天。
  - `created_at` (timestamptz): 建立時間。

## 4) 關聯總覽（高頻 FK）

- 所有 `*_user_id` 多數連到 `auth.users.id`。
- 內容域：
  - `course_modules.course_id -> courses.id`
  - `course_lessons.course_id -> courses.id`
  - `course_lessons.module_id -> course_modules.id`
  - `user_lesson_progress.lesson_id -> course_lessons.id`
- Chat 域：
  - `chat_messages.session_id -> chat_sessions.session_id`
  - `user_images.related_session_id -> chat_sessions.session_id`
- 支付域：
  - `stripe_checkout_sessions.plan_code -> membership_plans.code`
  - `user_subscriptions.plan_code -> membership_plans.code`

## 5) 重要提醒（實務）

- `member_subscriptions` 目前 `rls_enabled = false`，如繼續保留，建議限制只由 service role 寫讀。
- 支付相關多張表（`billing_events`, `stripe_*`, `user_subscriptions`）在目前 app code 未見直接 `.from()`，屬「DB 已備好，應用層尚在整合/由 webhook 路徑處理」狀態。
- 預約資料目前存在「Supabase (`booking_intake`) + 舊 Drizzle storage 路徑（`doctors/doctor_schedules/holidays/intake_questions`）」雙軌痕跡，後續建議統一來源。

