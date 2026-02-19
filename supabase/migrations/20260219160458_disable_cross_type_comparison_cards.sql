-- ============================================================
-- Phase B (Round 3): Disable cross-type comparison cards
-- Date: 2026-02-19
-- Goal:
--   Remove remaining active cards whose content focus mismatches the card type
--   in deeper sections, then repack sort_order.
-- ============================================================

-- 1) Disable targeted cross-type comparison cards.
with cross_type_noise as (
  select id
  from public.knowledge_docs
  where enabled = true
    and is_active = true
    and coalesce(sort_order, 0) >= 200
    and (
      (type = 'crossing' and (title ~ '(虛耗|屯積|累積|水性)' or content_md ~ '(虛耗|屯積|累積|水性)'))
      or (type = 'depleting' and (title ~ '(交錯|屯積|累積|水性)' or content_md ~ '(交錯|屯積|累積|水性)'))
      or (type = 'hoarding' and (title ~ '(交錯|虛耗|風性)' or content_md ~ '(交錯|虛耗|風性)'))
    )
)
update public.knowledge_docs as kd
set enabled = false,
    is_active = false,
    updated_at = now()
where kd.id in (select id from cross_type_noise);

-- 2) Repack sort_order for active cards, step = 10.
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
