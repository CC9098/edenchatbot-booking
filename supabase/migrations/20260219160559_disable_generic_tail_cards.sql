-- ============================================================
-- Phase B (Round 4): Disable generic duplicated tail cards
-- Date: 2026-02-19
-- Goal:
--   Remove low-signal tail cards that are duplicated across all types.
-- ============================================================

-- 1) Disable duplicated generic 05-tail cards.
update public.knowledge_docs
set enabled = false,
    is_active = false,
    updated_at = now()
where enabled = true
  and is_active = true
  and title in (
    '05 治療方向的誤區',
    '05 注意事項',
    '05 自查與反思',
    '05 自查養生效果',
    '05 調整身體的實操建議'
  );

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
