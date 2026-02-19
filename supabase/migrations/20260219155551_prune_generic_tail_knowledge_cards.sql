-- ============================================================
-- Prune low-signal generic tail cards in knowledge_docs
-- Date: 2026-02-19
-- Scope: disable 10 short, repetitive "tips/checklist" tail cards
-- ============================================================

update knowledge_docs
set
  enabled = false,
  is_active = false,
  updated_at = now()
where id in (
  -- crossing
  'ec9e36a7-09db-4b30-bc85-3d63dd6868f9', -- 04 調整心態的建議
  '71483b5a-d3bf-41a9-8b32-8572bc5bb0a1', -- 05 注意症狀的信號
  'e1399710-ae0d-45ad-b6e5-ed1aea520235', -- 05 自查肩頸痛
  -- depleting
  'ff897b67-e114-4aff-87a2-e92a21802db6', -- 04 調整心態的建議
  'e8377aae-428f-4547-862a-47e7b6ea96e5', -- 05 注意症狀的信號
  '98c98926-6857-4047-a9b1-ab207dbfa12e', -- 05 自查肩頸痛
  -- hoarding
  '23fe4151-c48e-4714-87d2-c840f88c2a30', -- 04 調整心態的建議
  'fc19c394-fcbf-4995-bd44-1c803e8e5b52', -- 05 專業建議
  '7e70eb60-dac4-4d43-a26d-37e31d2e8cca', -- 05 注意症狀的信號
  'cdacbc1f-46ef-417f-a6cf-9a915b047e3c'  -- 05 自查肩頸痛
)
and enabled = true
and is_active = true;

