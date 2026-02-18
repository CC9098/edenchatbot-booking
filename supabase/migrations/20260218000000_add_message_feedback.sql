-- ============================================================
-- message_feedback: 記錄用戶對 AI 回覆的讚好 / 負評
-- 同時儲存對話上下文，方便開發者審閱改善
-- ============================================================

CREATE TABLE message_feedback (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at      timestamptz DEFAULT now() NOT NULL,

  -- 評分類型
  feedback_type   text        NOT NULL CHECK (feedback_type IN ('up', 'down')),

  -- 來源介面
  source          text        NOT NULL CHECK (source IN ('widget_v1', 'chat_v2')),

  -- 被評分的 AI 訊息
  message_text    text        NOT NULL,
  message_index   integer,            -- 訊息在對話中的位置（由 0 開始）
  message_mode    text,               -- v2 only: G1 / G2 / G3 / B

  -- 對話上下文：被評分訊息之前最多 10 則訊息
  -- 格式：[{ "role": "user"|"assistant"|"bot", "content": "..." }, ...]
  context_messages jsonb      DEFAULT '[]'::jsonb NOT NULL,

  -- 會話 / 用戶追蹤（可空，widget 用戶未必已登入）
  session_id      text,
  user_id         uuid        REFERENCES auth.users(id) ON DELETE SET NULL
);

-- 常用查詢索引
CREATE INDEX message_feedback_type_date_idx
  ON message_feedback (feedback_type, created_at DESC);

CREATE INDEX message_feedback_source_date_idx
  ON message_feedback (source, created_at DESC);

CREATE INDEX message_feedback_created_at_idx
  ON message_feedback (created_at DESC);

-- ────────────────────────────────────────────
-- Row-Level Security
-- ────────────────────────────────────────────
ALTER TABLE message_feedback ENABLE ROW LEVEL SECURITY;

-- 任何人（包括未登入用戶）均可提交評分
CREATE POLICY "Anyone can insert feedback"
  ON message_feedback
  FOR INSERT
  WITH CHECK (true);

-- 只有 admin 可以閱覽所有評分記錄
CREATE POLICY "Admins can read all feedback"
  ON message_feedback
  FOR SELECT
  USING (is_admin(auth.uid()));
