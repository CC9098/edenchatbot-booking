-- ============================================================
-- Optimize knowledge_docs for prompt efficiency
-- Date: 2026-02-19
-- Scope:
-- 1) Shorten AUTO-generated titles to reduce prompt token waste
-- 2) Populate deterministic sort_order for stable retrieval
-- ============================================================

-- 1) Normalize AUTO titles:
-- From: AUTO::...::summary::01 核心觀點｜長副標...
-- To:   01 核心觀點
update knowledge_docs
set
  title = concat(
    lpad(
      coalesce(nullif(substring(title from '::summary::\s*([0-9]{1,2})'), ''), '0'),
      2,
      '0'
    ),
    ' ',
    left(
      trim(
        regexp_replace(
          coalesce(
            nullif(substring(title from '::summary::\s*[0-9]{1,2}\s*([^｜|]+)'), ''),
            title
          ),
          '\s+',
          ' ',
          'g'
        )
      ),
      64
    )
  ),
  updated_at = now()
where title like 'AUTO::%::summary::%';

-- 2) Populate deterministic sort_order when it's still 0.
-- Non-AUTO rows are prioritized (summary_no=0), then AUTO summary number.
with ranked as (
  select
    id,
    type,
    case
      when title ~ '^[0-9]{2}\s+' then coalesce(nullif(substring(title from '^([0-9]{2})'), ''), '99')::int
      else 0
    end as summary_no,
    row_number() over (
      partition by type
      order by
        case
          when title ~ '^[0-9]{2}\s+' then coalesce(nullif(substring(title from '^([0-9]{2})'), ''), '99')::int
          else 0
        end asc,
        title asc,
        id asc
    ) as rn
  from knowledge_docs
)
update knowledge_docs kd
set
  sort_order = ranked.rn * 10,
  updated_at = now()
from ranked
where kd.id = ranked.id
  and kd.sort_order = 0;

