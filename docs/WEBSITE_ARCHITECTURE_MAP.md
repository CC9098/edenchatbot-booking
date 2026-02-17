# EdenChatbotBooking Website Architecture Map

最後更新：2026-02-17

## 1) 全站頁面架構（Page to Page）

```mermaid
flowchart TD
  HOME["/ (首頁)"]

  ARTICLES["/articles (文章列表)"]
  ARTICLE_DETAIL["/articles/[slug] (文章詳情)"]

  COURSES["/courses (課程列表)"]
  COURSE_DETAIL["/courses/[slug] (課程詳情 + 課堂列表)"]
  LESSON_DETAIL["/courses/[slug]/lessons/[lessonSlug] (課堂詳情)"]

  CHAT["/chat (AI 諮詢)"]
  BOOKING["/booking (預約)"]
  CANCEL["/cancel (取消預約)"]
  RESCHEDULE["/reschedule (改期)"]
  EMBED["/embed (嵌入式 chatbot)"]

  LOGIN["/login (登入)"]
  DOCTOR_HOME["/doctor (醫師病人列表)"]
  DOCTOR_PATIENT["/doctor/patients/[patientUserId] (病人詳情)"]
  DOCTOR_CONTENT["/doctor/content/articles (文章管理 CMS)"]

  HOME --> ARTICLES
  HOME --> COURSES
  HOME --> CHAT
  HOME --> BOOKING

  ARTICLES --> ARTICLE_DETAIL
  ARTICLE_DETAIL --> CHAT
  ARTICLE_DETAIL --> BOOKING

  COURSES --> COURSE_DETAIL
  COURSE_DETAIL --> LESSON_DETAIL
  LESSON_DETAIL --> CHAT
  LESSON_DETAIL --> BOOKING

  BOOKING --> CANCEL
  BOOKING --> RESCHEDULE

  LOGIN --> DOCTOR_HOME
  LOGIN --> DOCTOR_CONTENT
  DOCTOR_HOME --> DOCTOR_PATIENT

  HOME -. 浮動入口 .-> EMBED
```

## 2) 用戶主流程（由內容去 AI / 預約）

```mermaid
flowchart LR
  A["首頁 /"] --> B["文章列表 /articles 或 課程列表 /courses"]
  B --> C["文章詳情 /articles/[slug] 或 課堂詳情 /courses/.../lessons/..."]
  C --> D["AI 諮詢 /chat"]
  C --> E["預約 /booking"]
  D --> E
  E --> F["取消 /cancel 或 改期 /reschedule"]
```

## 3) 後台內容管理流程（你而家可直接出文）

```mermaid
flowchart LR
  L["登入 /login"] --> M["文章管理 /doctor/content/articles"]
  M --> N["新增 / 編輯草稿"]
  N --> O["發佈 (published_at)"]
  O --> P["公開顯示在 /articles + /"]
```

## 4) 資料流（簡化）

```mermaid
flowchart TD
  PAGES["Public Pages<br/>/, /articles, /courses, detail pages"] --> SERVICE["lib/content-service.ts"]
  SERVICE --> SUPABASE["Supabase tables<br/>articles, courses, course_modules, course_lessons"]

  DOCTOR_UI["/doctor/content/articles"] --> ADMIN_API["/api/doctor/content/articles*"]
  ADMIN_API --> SUPABASE
```

## 5) 目前重點狀態

- 已合併成單一主站：`https://edenchatbot-booking.vercel.app`
- 已有文章後台 CMS：`/doctor/content/articles`
- 已支援中文 slug 文章路由（例如 `/articles/雨水`）

## 6) 純用戶視角（最簡版）

```mermaid
flowchart TD
  U1["1. 首頁 /"] --> U2["2. 揀入口：文章 /articles 或 課程 /courses"]
  U2 --> U3["3. 睇詳情：/articles/[slug] 或 /courses/.../lessons/..."]
  U3 --> U4["4. 追問 AI：/chat"]
  U3 --> U5["5. 直接預約：/booking"]
  U4 --> U5
  U5 --> U6["6. 之後可取消 /cancel 或改期 /reschedule"]
```

## 7) 資料表關係圖（ERD）

```mermaid
erDiagram
  AUTH_USERS ||--o{ STAFF_ROLES : has_role
  AUTH_USERS ||--o{ USER_LESSON_PROGRESS : tracks
  COURSES ||--o{ COURSE_MODULES : contains
  COURSES ||--o{ COURSE_LESSONS : contains
  COURSE_MODULES ||--o{ COURSE_LESSONS : groups
  COURSE_LESSONS ||--o{ USER_LESSON_PROGRESS : progress_on

  ARTICLES {
    uuid id PK
    text slug UK
    text title
    text[] tags
    boolean is_active
    timestamptz published_at
    uuid created_by FK
  }

  COURSES {
    uuid id PK
    text slug UK
    text title
    boolean is_active
    timestamptz published_at
    uuid created_by FK
  }

  COURSE_MODULES {
    uuid id PK
    uuid course_id FK
    text title
    int sort_order
    boolean is_active
  }

  COURSE_LESSONS {
    uuid id PK
    uuid course_id FK
    uuid module_id FK
    text slug
    text title
    text content_md
    int duration_minutes
    boolean is_active
    timestamptz published_at
  }

  USER_LESSON_PROGRESS {
    uuid user_id FK
    uuid lesson_id FK
    int progress_pct
    timestamptz completed_at
    timestamptz last_viewed_at
  }

  STAFF_ROLES {
    uuid user_id FK
    text role
    boolean is_active
  }
```

## 8) 頁面 → API/Service → Table 對應圖

```mermaid
flowchart TD
  P_HOME["/"] --> S_CONTENT["lib/content-service.ts"]
  P_ARTICLES["/articles"] --> S_CONTENT
  P_ARTICLE_DETAIL["/articles/[slug]"] --> S_CONTENT
  P_COURSES["/courses"] --> S_CONTENT
  P_COURSE_DETAIL["/courses/[slug]"] --> S_CONTENT
  P_LESSON["/courses/[slug]/lessons/[lessonSlug]"] --> S_CONTENT

  S_CONTENT --> T_ARTICLES["articles"]
  S_CONTENT --> T_COURSES["courses"]
  S_CONTENT --> T_MODULES["course_modules"]
  S_CONTENT --> T_LESSONS["course_lessons"]

  P_DOCTOR_CONTENT["/doctor/content/articles"] --> API_DOCTOR_CONTENT["/api/doctor/content/articles*"]
  API_DOCTOR_CONTENT --> AUTH_CHECK["getCurrentUser + requireStaffRole (admin write)"]
  AUTH_CHECK --> T_STAFF["staff_roles"]
  API_DOCTOR_CONTENT --> T_ARTICLES

  P_PROGRESS["/api/me/lesson-progress*"] --> T_PROGRESS["user_lesson_progress"]
  T_PROGRESS --> T_LESSONS
```

## 9) RLS 權限邏輯（簡版）

```mermaid
flowchart LR
  PUBLIC["Public (未登入)"]
  MEMBER["Member / Patient"]
  ADMIN["Admin / Staff"]
  SERVER["Server API (Service Role)"]

  A["articles"]
  C["courses"]
  M["course_modules"]
  L["course_lessons"]
  P["user_lesson_progress"]

  PUBLIC -->|"SELECT: published + active"| A
  PUBLIC -->|"SELECT: published + active"| C
  PUBLIC -->|"SELECT: parent course published"| M
  PUBLIC -->|"SELECT: lesson+course published"| L

  MEMBER -->|"SELECT/INSERT/UPDATE own user_id"| P

  ADMIN -->|"ALL (admin policy)"| A
  ADMIN -->|"ALL (admin policy)"| C
  ADMIN -->|"ALL (admin policy)"| M
  ADMIN -->|"ALL (admin policy)"| L
  ADMIN -->|"ALL (admin override)"| P

  SERVER -->|"Bypass RLS (service role key)"| A
  SERVER -->|"Bypass RLS (service role key)"| C
  SERVER -->|"Bypass RLS (service role key)"| M
  SERVER -->|"Bypass RLS (service role key)"| L
  SERVER -->|"Bypass RLS (service role key)"| P
```
