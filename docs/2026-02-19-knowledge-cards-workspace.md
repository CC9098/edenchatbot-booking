# 知識卡工作台實作紀錄（2026-02-19）

## 今次交付內容

今次完成一個「Obsidian 感」嘅知識卡工作層，重點係先沉澱點子，再決定邊啲變成文章，唔會直接將全部卡片餵入 chatbot prompt。

1. 醫師後台新增知識卡頁：`/doctor/content/cards`
2. 完整知識卡 API（CRUD + 建議 + AI 合稿 + 同步）
3. 文章 -> 知識卡同步服務（手動/API/cron）
4. Supabase 新增兩張表管理卡片及卡片-文章關係
5. 補齊操作文件，方便後續維護

---

## 資料庫層

### 新增資料表

- `public.knowledge_cards`
  - 核心欄位：`title`, `body_md`, `status`, `source`, `tags`
  - 追蹤欄位：`source_article_id`, `source_hash`
  - 工作流欄位：`is_active`, `sort_order`
  - 稽核欄位：`created_by`, `updated_by`, `created_at`, `updated_at`

- `public.knowledge_card_article_links`
  - 卡片與文章多對多關係
  - `relation_type`: `seed | draft | published`

### Migration

- 檔案：`supabase/migrations/20260219194225_create_knowledge_cards_workspace.sql`
- 已透過 Supabase MCP 套用到 production
- migration name：`create_knowledge_cards_workspace`

---

## API 層

### 知識卡 CRUD

- `GET /api/doctor/content/cards`
  - 支援 `q`, `status`, `source`, `onlyUnlinked`, `limit`
- `POST /api/doctor/content/cards`
  - 建立知識卡
- `PATCH /api/doctor/content/cards/:id`
  - 更新欄位
  - 可選 `linkArticleId` / `unlinkArticleId`
- `DELETE /api/doctor/content/cards/:id`
  - 僅 admin 可刪除

### 寫作支援

- `GET /api/doctor/content/cards/suggestions`
  - 回傳未有 `published` 關聯文章嘅高優先卡片
- `POST /api/doctor/content/cards/compose`
  - 輸入：`cardIds`
  - 輸出：文章草稿 `title/excerpt/contentMd/tags`
  - `saveAsDraft=true`（admin）：直接寫入 `articles` 並建立 `draft` 關聯

### 同步

- `POST /api/doctor/content/cards/sync`
  - 醫師後台手動觸發文章同步為卡片
- `GET /api/cron/knowledge-card-sync`
  - 給 cron 用（Bearer `CRON_SECRET`）
  - 執行同一套同步邏輯

---

## 共用服務與工具

- `lib/knowledge-cards-utils.ts`
  - status/source enum
  - tags 清洗
  - markdown 壓縮摘要
  - source hash
  - DB row -> API row map

- `lib/knowledge-card-sync.ts`
  - 讀取 `articles`
  - 用 `source_hash` 決定插入/更新/略過 `article_sync` 卡
  - 自動 upsert `knowledge_card_article_links`

- `scripts/sync-knowledge-cards.ts`
  - CLI 手動同步腳本

---

## 前端層

- 新頁面：`app/doctor/content/cards/page.tsx`
  - 卡片列表 + 篩選
  - 新增/編輯卡片
  - 多選卡片 AI 合稿
  - 未寫作建議清單
  - 手動同步按鈕

- 導航更新：`app/doctor/layout.tsx`
  - 醫師後台 header 新增「知識卡」入口

---

## 驗證結果

- `npm run typecheck`：通過
- `npm run lint -- --file ...`（本次改動檔案）：通過

---

## 設計重點

- 呢層故意同 chatbot runtime 用嘅 `knowledge_docs` 分離。
- 你可以保留大量 raw cards 作為創作素材，不會直接拖慢聊天 prompt。
- 後續可再加「審核/發佈到 knowledge_docs」管道，令 chatbot 只食精選卡片。
