-- Chatbot v2 phase timing query (24h)
-- Requires knowledge_sources populated with phase payload by app/api/chat/v2/route.ts

with base as (
  select
    model_gear,
    knowledge_sources as ks
  from chat_request_logs
  where created_at >= now() - interval '24 hours'
    and knowledge_sources is not null
),
phase_rows as (
  select model_gear, 'mode_router' as phase, (ks->'phase_ms'->>'mode_router')::numeric as ms from base
  union all
  select model_gear, 'user_context' as phase, (ks->'phase_ms'->>'user_context')::numeric as ms from base
  union all
  select model_gear, 'content_search' as phase, (ks->'phase_ms'->>'content_search')::numeric as ms from base
  union all
  select model_gear, 'prompt_build' as phase, (ks->'phase_ms'->>'prompt_build')::numeric as ms from base
  union all
  select model_gear, 'gemini_api' as phase, (ks->'phase_ms'->>'gemini_api')::numeric as ms from base
)
select
  model_gear,
  phase,
  count(*) as n,
  round(percentile_cont(0.5) within group (order by ms)::numeric, 2) as p50_ms,
  round(percentile_cont(0.95) within group (order by ms)::numeric, 2) as p95_ms
from phase_rows
where ms is not null
group by model_gear, phase
order by model_gear, phase;
