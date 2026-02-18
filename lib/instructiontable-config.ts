export type InstructiontableRelation = {
  column: string;
  targetTable: string;
  targetColumn: string;
};

export type InstructiontableDefinition = {
  name: string;
  label: string;
  group:
    | "content"
    | "chat"
    | "care"
    | "booking"
    | "billing"
    | "media";
  description: string;
  primaryKey: string[];
  relations: InstructiontableRelation[];
};

export type Instructiontable5W1H = {
  why: string;
  what: string;
  how: string;
  where: string;
  when: string;
  who: string;
};

export const instructiontableDefinitions: InstructiontableDefinition[] = [
  {
    name: "articles",
    label: "Articles",
    group: "content",
    description: "Website article content records.",
    primaryKey: ["id"],
    relations: [{ column: "created_by", targetTable: "auth.users", targetColumn: "id" }],
  },
  {
    name: "courses",
    label: "Courses",
    group: "content",
    description: "Course master records.",
    primaryKey: ["id"],
    relations: [{ column: "created_by", targetTable: "auth.users", targetColumn: "id" }],
  },
  {
    name: "course_modules",
    label: "Course Modules",
    group: "content",
    description: "Course section groupings.",
    primaryKey: ["id"],
    relations: [{ column: "course_id", targetTable: "courses", targetColumn: "id" }],
  },
  {
    name: "course_lessons",
    label: "Course Lessons",
    group: "content",
    description: "Lesson content per course/module.",
    primaryKey: ["id"],
    relations: [
      { column: "course_id", targetTable: "courses", targetColumn: "id" },
      { column: "module_id", targetTable: "course_modules", targetColumn: "id" },
    ],
  },
  {
    name: "user_lesson_progress",
    label: "User Lesson Progress",
    group: "content",
    description: "Per-user learning progress by lesson.",
    primaryKey: ["user_id", "lesson_id"],
    relations: [
      { column: "user_id", targetTable: "auth.users", targetColumn: "id" },
      { column: "lesson_id", targetTable: "course_lessons", targetColumn: "id" },
    ],
  },

  {
    name: "chat_sessions",
    label: "Chat Sessions",
    group: "chat",
    description: "Conversation sessions.",
    primaryKey: ["session_id"],
    relations: [{ column: "user_id", targetTable: "auth.users", targetColumn: "id" }],
  },
  {
    name: "chat_messages",
    label: "Chat Messages",
    group: "chat",
    description: "Chat messages per session.",
    primaryKey: ["id"],
    relations: [
      { column: "session_id", targetTable: "chat_sessions", targetColumn: "session_id" },
      { column: "user_id", targetTable: "auth.users", targetColumn: "id" },
    ],
  },
  {
    name: "chat_prompt_settings",
    label: "Chat Prompt Settings",
    group: "chat",
    description: "Prompt variants and gears.",
    primaryKey: ["type"],
    relations: [],
  },
  {
    name: "chat_request_logs",
    label: "Chat Request Logs",
    group: "chat",
    description: "LLM request telemetry records.",
    primaryKey: ["id"],
    relations: [{ column: "user_id", targetTable: "auth.users", targetColumn: "id" }],
  },
  {
    name: "knowledge_docs",
    label: "Knowledge Docs",
    group: "chat",
    description: "Knowledge snippets for chat injection.",
    primaryKey: ["id"],
    relations: [],
  },

  {
    name: "patient_care_profile",
    label: "Patient Care Profile",
    group: "care",
    description: "Patient-level care profile and constitution.",
    primaryKey: ["patient_user_id"],
    relations: [
      { column: "patient_user_id", targetTable: "auth.users", targetColumn: "id" },
      { column: "updated_by", targetTable: "auth.users", targetColumn: "id" },
    ],
  },
  {
    name: "care_instructions",
    label: "Care Instructions",
    group: "care",
    description: "Doctor instructions for patient care.",
    primaryKey: ["id"],
    relations: [
      { column: "patient_user_id", targetTable: "auth.users", targetColumn: "id" },
      { column: "created_by", targetTable: "auth.users", targetColumn: "id" },
    ],
  },
  {
    name: "follow_up_plans",
    label: "Follow-up Plans",
    group: "care",
    description: "Scheduled follow-up targets for patients.",
    primaryKey: ["id"],
    relations: [
      { column: "patient_user_id", targetTable: "auth.users", targetColumn: "id" },
      { column: "created_by", targetTable: "auth.users", targetColumn: "id" },
    ],
  },
  {
    name: "symptom_logs",
    label: "Symptom Logs",
    group: "care",
    description: "Patient symptom history and severity.",
    primaryKey: ["id"],
    relations: [{ column: "patient_user_id", targetTable: "auth.users", targetColumn: "id" }],
  },
  {
    name: "audit_logs",
    label: "Audit Logs",
    group: "care",
    description: "Change history for sensitive operations.",
    primaryKey: ["id"],
    relations: [
      { column: "actor_user_id", targetTable: "auth.users", targetColumn: "id" },
      { column: "patient_user_id", targetTable: "auth.users", targetColumn: "id" },
    ],
  },
  {
    name: "patient_care_team",
    label: "Patient Care Team",
    group: "care",
    description: "Care team access mapping between staff and patient.",
    primaryKey: ["patient_user_id", "staff_user_id"],
    relations: [
      { column: "patient_user_id", targetTable: "auth.users", targetColumn: "id" },
      { column: "staff_user_id", targetTable: "auth.users", targetColumn: "id" },
    ],
  },
  {
    name: "profiles",
    label: "Profiles",
    group: "care",
    description: "Extended user profile data.",
    primaryKey: ["id"],
    relations: [{ column: "id", targetTable: "auth.users", targetColumn: "id" }],
  },
  {
    name: "staff_roles",
    label: "Staff Roles",
    group: "care",
    description: "Staff permission roles.",
    primaryKey: ["user_id"],
    relations: [{ column: "user_id", targetTable: "auth.users", targetColumn: "id" }],
  },

  {
    name: "booking_intake",
    label: "Booking Intake",
    group: "booking",
    description: "Structured booking payload and lifecycle.",
    primaryKey: ["id"],
    relations: [{ column: "user_id", targetTable: "auth.users", targetColumn: "id" }],
  },
  {
    name: "doctors",
    label: "Doctors",
    group: "booking",
    description: "Doctor catalog.",
    primaryKey: ["id"],
    relations: [],
  },
  {
    name: "doctor_schedules",
    label: "Doctor Schedules",
    group: "booking",
    description: "Doctor-to-clinic calendar mappings.",
    primaryKey: ["id"],
    relations: [{ column: "doctor_id", targetTable: "doctors", targetColumn: "id" }],
  },
  {
    name: "holidays",
    label: "Holidays",
    group: "booking",
    description: "Booking-blocked dates.",
    primaryKey: ["id"],
    relations: [{ column: "doctor_id", targetTable: "doctors", targetColumn: "id" }],
  },
  {
    name: "intake_questions",
    label: "Intake Questions",
    group: "booking",
    description: "Configurable booking intake fields.",
    primaryKey: ["id"],
    relations: [],
  },

  {
    name: "membership_plans",
    label: "Membership Plans",
    group: "billing",
    description: "Subscription plan definitions.",
    primaryKey: ["code"],
    relations: [],
  },
  {
    name: "user_subscriptions",
    label: "User Subscriptions",
    group: "billing",
    description: "Current subscription state by user.",
    primaryKey: ["id"],
    relations: [
      { column: "user_id", targetTable: "auth.users", targetColumn: "id" },
      { column: "plan_code", targetTable: "membership_plans", targetColumn: "code" },
    ],
  },
  {
    name: "stripe_customers",
    label: "Stripe Customers",
    group: "billing",
    description: "Mapping of app users to Stripe customer IDs.",
    primaryKey: ["user_id"],
    relations: [{ column: "user_id", targetTable: "auth.users", targetColumn: "id" }],
  },
  {
    name: "stripe_checkout_sessions",
    label: "Stripe Checkout Sessions",
    group: "billing",
    description: "Stripe checkout session lifecycle records.",
    primaryKey: ["id"],
    relations: [
      { column: "user_id", targetTable: "auth.users", targetColumn: "id" },
      { column: "plan_code", targetTable: "membership_plans", targetColumn: "code" },
    ],
  },
  {
    name: "billing_events",
    label: "Billing Events",
    group: "billing",
    description: "Webhook event journal for billing.",
    primaryKey: ["id"],
    relations: [{ column: "user_id", targetTable: "auth.users", targetColumn: "id" }],
  },
  {
    name: "member_subscriptions",
    label: "Member Subscriptions (Legacy)",
    group: "billing",
    description: "Legacy subscription table.",
    primaryKey: ["user_id"],
    relations: [{ column: "user_id", targetTable: "auth.users", targetColumn: "id" }],
  },

  {
    name: "user_images",
    label: "User Images",
    group: "media",
    description: "User image metadata records.",
    primaryKey: ["id"],
    relations: [
      { column: "user_id", targetTable: "auth.users", targetColumn: "id" },
      { column: "related_session_id", targetTable: "chat_sessions", targetColumn: "session_id" },
    ],
  },
];

export const instructiontableDefinitionMap = new Map(
  instructiontableDefinitions.map((item) => [item.name, item])
);

export const instructiontableTableNames = instructiontableDefinitions.map(
  (item) => item.name
);

export function getInstructiontableDefinition(table: string) {
  return instructiontableDefinitionMap.get(table) ?? null;
}

export const instructiontable5W1HMap: Record<string, Instructiontable5W1H> = {
  articles: {
    why: "管理公開文章內容與發佈狀態。",
    what: "文章主檔：slug、title、content、published_at。",
    how: "由內容後台/API 或匯入腳本寫入，前台依發佈條件讀取。",
    where: "DB `public.articles`; 主要程式 `lib/content-service.ts`, `app/articles/page.tsx`。",
    when: "建立於新增文章；更新時 `updated_at` trigger 自動刷新。",
    who: "公開讀已發佈內容；admin 可全權管理。",
  },
  courses: {
    why: "承載課程主檔內容。",
    what: "課程基本資料與發佈控制。",
    how: "內容流程維護，前台課程頁讀取。",
    where: "DB `public.courses`; `lib/content-service.ts`, `app/courses/page.tsx`。",
    when: "新增/編輯課程時寫入。",
    who: "公開讀發佈內容；admin 可管理。",
  },
  course_modules: {
    why: "把課程拆分為章節。",
    what: "課程與課堂之間的 module。",
    how: "內容管理流程寫入，前台按排序讀取。",
    where: "DB `public.course_modules`; `lib/content-service.ts`。",
    when: "調整課程結構時更新。",
    who: "公開可讀生效資料；admin 可管理。",
  },
  course_lessons: {
    why: "存放每一課內容。",
    what: "lesson 標題、slug、內容、時長、影片。",
    how: "內容服務/匯入腳本寫入，課堂頁與進度 API 讀取。",
    where: "DB `public.course_lessons`; `lib/content-service.ts`, `app/courses/[slug]/lessons/[lessonSlug]/page.tsx`。",
    when: "課程內容更新時同步更新。",
    who: "公開讀發佈課堂；admin 可管理。",
  },
  user_lesson_progress: {
    why: "追蹤會員學習進度。",
    what: "user + lesson 的進度百分比。",
    how: "由 `/api/me/lesson-progress*` 寫讀。",
    where: "DB `public.user_lesson_progress`; `app/api/me/lesson-progress/route.ts`。",
    when: "觀看或完成課堂時更新。",
    who: "使用者只可管理自己進度；admin 可全權。",
  },
  chat_sessions: {
    why: "管理對話 session。",
    what: "每段聊天的主索引與標題。",
    how: "chat v2 流程建立與更新。",
    where: "DB `public.chat_sessions`; `lib/user-context.ts`。",
    when: "開新對話或更新 session 時。",
    who: "authenticated 只可存取自己 session。",
  },
  chat_messages: {
    why: "保存訊息明細。",
    what: "role + content 的聊天訊息。",
    how: "chat v2 完成回覆後 insert。",
    where: "DB `public.chat_messages`; `app/api/chat/v2/route.ts`。",
    when: "每次 user/assistant 發送訊息時。",
    who: "authenticated 只可讀寫自己訊息。",
  },
  chat_prompt_settings: {
    why: "讓 prompt 可配置而非寫死程式。",
    what: "體質 prompt、gear、variant 設定。",
    how: "chat v2 請求時載入設定。",
    where: "DB `public.chat_prompt_settings`; `app/api/chat/v2/route.ts`。",
    when: "調整 prompt 策略時更新。",
    who: "全站可讀 active 設定；admin 可修改。",
  },
  chat_request_logs: {
    why: "追蹤模型請求成效與問題。",
    what: "token、耗時、knowledge 注入與錯誤。",
    how: "chat v2 每次請求後寫入。",
    where: "DB `public.chat_request_logs`; `app/api/chat/v2/route.ts`。",
    when: "每次模型回應後。",
    who: "用戶可看自己記錄。",
  },
  knowledge_docs: {
    why: "管理可注入 prompt 的知識片段。",
    what: "按 type 分類的知識文檔。",
    how: "chat v2 查詢 active docs 後拼接到 prompt。",
    where: "DB `public.knowledge_docs`; `app/api/chat/v2/route.ts`。",
    when: "知識內容更新時。",
    who: "依 RLS/policy 控制；admin 可全權管理。",
  },
  patient_care_profile: {
    why: "病人照護主檔。",
    what: "體質、最近就診、更新者。",
    how: "doctor API 更新，chat/病人 context 讀取。",
    where: "DB `public.patient_care_profile`; `app/api/doctor/patients/[patientUserId]/constitution/route.ts`。",
    when: "醫師評估病人或覆診後更新。",
    who: "病人可讀自己；staff 依授權可讀寫。",
  },
  care_instructions: {
    why: "記錄醫囑與生活建議。",
    what: "instruction type、內容與狀態。",
    how: "doctor API 建立/更新，病人端讀 active 指示。",
    where: "DB `public.care_instructions`; `app/api/doctor/patients/[patientUserId]/instructions/route.ts`。",
    when: "醫師發出或調整照護指示時。",
    who: "staff 可維護；病人可讀自己 active 項目。",
  },
  follow_up_plans: {
    why: "追蹤覆診安排。",
    what: "建議覆診日期與執行狀態。",
    how: "doctor API 寫入，cron/病人 API 查詢。",
    where: "DB `public.follow_up_plans`; `app/api/doctor/follow-ups/[id]/route.ts`。",
    when: "每次安排/改動覆診計畫時。",
    who: "病人可讀自己；staff 依權限可讀寫。",
  },
  symptom_logs: {
    why: "建立症狀時間線。",
    what: "症狀分類、嚴重度、起止日期。",
    how: "病人 API + chat helper 寫入，doctor 端檢視。",
    where: "DB `public.symptom_logs`; `app/api/me/symptoms/route.ts`。",
    when: "病人回報或更新症狀時。",
    who: "病人可管理自己；staff 可讀授權病人。",
  },
  audit_logs: {
    why: "確保可追溯性與醫療審計。",
    what: "誰在何時改了哪個實體。",
    how: "業務 API 在重要變更後 append log。",
    where: "DB `public.audit_logs`; `app/api/doctor/*`, `app/api/me/symptoms/*`。",
    when: "create/update/delete 等敏感操作後即時寫入。",
    who: "staff 依患者授權關係可查看。",
  },
  patient_care_team: {
    why: "定義 staff 可接觸的病人範圍。",
    what: "patient/staff 關係與主責標記。",
    how: "權限檢查 helper 查詢此表。",
    where: "DB `public.patient_care_team`; `lib/auth-helpers.ts`。",
    when: "分配或調整照護團隊時。",
    who: "病人與 staff 可讀自己關係；admin 可管理。",
  },
  profiles: {
    why: "擴充 auth user 基本資料。",
    what: "名稱、電話、語言、時區、頭像。",
    how: "auth 後流程與 API 讀寫。",
    where: "DB `public.profiles`; `app/api/chat/v2/route.ts`, `app/api/doctor/patients/route.ts`。",
    when: "用戶更新個人資料時。",
    who: "用戶可改自己；staff 可讀授權病人。",
  },
  staff_roles: {
    why: "定義 staff 身份等級。",
    what: "doctor/assistant/admin 角色。",
    how: "授權 helper 先查角色再決定 API 權限。",
    where: "DB `public.staff_roles`; `lib/auth-helpers.ts`。",
    when: "授權或停用 staff 時。",
    who: "admin 可管理；本人可查看。",
  },
  booking_intake: {
    why: "保存 chat/booking 結構化預約資料。",
    what: "預約資料、event id、狀態與改期紀錄。",
    how: "booking routes + helper 寫入更新。",
    where: "DB `public.booking_intake`; `app/api/booking/route.ts`, `lib/booking-intake-storage.ts`。",
    when: "建立、確認、取消、改期時。",
    who: "用戶可查看自己記錄；後端可完整維護。",
  },
  doctors: {
    why: "管理醫師清單。",
    what: "醫師代碼、名稱、職稱、啟用狀態。",
    how: "排班/預約流程按 doctor_id 連結。",
    where: "DB `public.doctors`; `lib/storage.ts`, `shared/schema.ts`。",
    when: "新增或調整醫師時。",
    who: "公開可讀；admin 管理。",
  },
  doctor_schedules: {
    why: "控制可預約時段來源。",
    what: "醫師 x 診所 x calendar mapping + weekly schedule。",
    how: "availability 計算先讀此表。",
    where: "DB `public.doctor_schedules`; `app/api/availability/route.ts`。",
    when: "排班調整時更新。",
    who: "公開讀 active；admin 管理。",
  },
  holidays: {
    why: "封鎖不可預約日期。",
    what: "全局/醫師/診所層級假期。",
    how: "availability 前置檢查 holiday。",
    where: "DB `public.holidays`; `lib/booking-helpers.ts`。",
    when: "假期設定調整時。",
    who: "公開可讀；admin 管理。",
  },
  intake_questions: {
    why: "令預約問卷可配置。",
    what: "問題 key、欄位類型、選項。",
    how: "前端/流程按 visit type 讀取題目。",
    where: "DB `public.intake_questions`; `lib/storage.ts`。",
    when: "問卷調整時。",
    who: "公開讀 active；admin 管理。",
  },
  membership_plans: {
    why: "管理可售賣訂閱方案。",
    what: "plan code、price id、月費。",
    how: "支付流程依 plan code 對應 Stripe price。",
    where: "DB `public.membership_plans`。",
    when: "定價或方案調整時。",
    who: "公開可讀 active 方案；後台管理。",
  },
  user_subscriptions: {
    why: "保存用戶實際訂閱狀態。",
    what: "subscription id、週期、status。",
    how: "通常由 webhook/後端同步更新。",
    where: "DB `public.user_subscriptions`。",
    when: "付款事件觸發後更新。",
    who: "用戶可讀自己狀態。",
  },
  stripe_customers: {
    why: "映射 app user 與 Stripe customer。",
    what: "user_id ↔ stripe_customer_id。",
    how: "建立 checkout 前或 webhook 同步維護。",
    where: "DB `public.stripe_customers`。",
    when: "首次付款建立 customer 時。",
    who: "用戶可讀自己記錄；後端維護。",
  },
  stripe_checkout_sessions: {
    why: "追蹤 checkout session 流程。",
    what: "session id、狀態、金額、raw payload。",
    how: "建立 checkout 後 insert，完成後更新。",
    where: "DB `public.stripe_checkout_sessions`。",
    when: "每次發起付款時。",
    who: "用戶可讀自己記錄；後端寫入。",
  },
  billing_events: {
    why: "記錄 webhook 事件與重試。",
    what: "event id、type、payload、processing 狀態。",
    how: "webhook receiver append-only 寫入並標記 processed。",
    where: "DB `public.billing_events`。",
    when: "每個 Stripe 事件到達時。",
    who: "後端主導；用戶可讀關聯到自己的事件。",
  },
  member_subscriptions: {
    why: "保留 legacy 訂閱資料。",
    what: "舊版 subscription mapping。",
    how: "歷史兼容用途，與新表並存。",
    where: "DB `public.member_subscriptions`。",
    when: "舊流程仍使用時才更新。",
    who: "建議只由後端受控使用（RLS 關閉）。",
  },
  user_images: {
    why: "管理圖片 metadata（非檔案本體）。",
    what: "path、mime、尺寸、來源。",
    how: "上傳/生成圖片後寫 metadata。",
    where: "DB `public.user_images`。",
    when: "每次新增或更新圖片記錄時。",
    who: "用戶只可管理自己圖片。",
  },
};

export function getInstructiontable5W1H(
  table: string
): Instructiontable5W1H | null {
  return instructiontable5W1HMap[table] ?? null;
}
