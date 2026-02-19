-- ============================================================
-- Terminology normalization: 累積 -> 屯積
-- Date: 2026-02-19
-- Scope: whole knowledge_docs table (active + inactive)
-- ============================================================

update public.knowledge_docs
set title = regexp_replace(title, '累積', '屯積', 'g'),
    content_md = regexp_replace(content_md, '累積', '屯積', 'g'),
    updated_at = now()
where title ~ '累積'
   or content_md ~ '累積';
