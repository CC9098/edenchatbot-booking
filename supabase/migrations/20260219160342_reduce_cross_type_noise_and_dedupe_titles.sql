-- ============================================================
-- Phase B (Round 2): Reduce cross-type noise and duplicate titles
-- Date: 2026-02-19
-- Goal:
--   1) Disable deep-section cards that mainly describe other constitution types.
--   2) Deduplicate repeated titles within the same type (keep earliest sort_order).
--   3) Repack sort_order for active cards to keep deterministic ordering.
-- ============================================================

-- 1) Disable cross-type mismatch cards in deeper sections (sort_order >= 200).
with mismatch_candidates as (
  select id
  from public.knowledge_docs
  where enabled = true
    and is_active = true
    and coalesce(sort_order, 0) >= 200
    and (
      (type = 'crossing' and (title ~ '(虛耗型|屯積型|累積型)' or content_md ~ '(虛耗型|屯積型|累積型)'))
      or (type = 'depleting' and (title ~ '(交錯型|屯積型|累積型)' or content_md ~ '(交錯型|屯積型|累積型)'))
      or (type = 'hoarding' and (title ~ '(交錯型|虛耗型)' or content_md ~ '(交錯型|虛耗型)'))
    )
)
update public.knowledge_docs as kd
set enabled = false,
    is_active = false,
    updated_at = now()
where kd.id in (select id from mismatch_candidates);

-- 2) Deduplicate repeated titles per type (keep first by sort_order/id).
with ranked_titles as (
  select
    id,
    row_number() over (
      partition by type, title
      order by coalesce(sort_order, 0), id
    ) as rn
  from public.knowledge_docs
  where enabled = true
    and is_active = true
)
update public.knowledge_docs as kd
set enabled = false,
    is_active = false,
    updated_at = now()
where kd.id in (
  select id
  from ranked_titles
  where rn > 1
);

-- 3) Repack sort_order for active cards, step = 10.
with active_ordered as (
  select
    id,
    row_number() over (
      partition by type
      order by coalesce(sort_order, 0), id
    ) * 10 as next_sort_order
  from public.knowledge_docs
  where enabled = true
    and is_active = true
)
update public.knowledge_docs as kd
set sort_order = ao.next_sort_order,
    updated_at = now()
from active_ordered as ao
where kd.id = ao.id
  and coalesce(kd.sort_order, 0) <> ao.next_sort_order;
