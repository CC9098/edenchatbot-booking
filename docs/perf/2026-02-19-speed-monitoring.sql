-- ============================================================
-- Chatbot v2 Speed Monitoring Queries
-- Date: 2026-02-19
-- ============================================================

-- 1) Daily latency and prompt size trend (recent 14 days)
select
  date_trunc('day', created_at) as day,
  count(*) as n,
  round(avg(duration_ms)) as avg_ms,
  percentile_cont(0.5) within group (order by duration_ms) as p50_ms,
  percentile_cont(0.9) within group (order by duration_ms) as p90_ms,
  round(avg(prompt_tokens)) as avg_prompt_tokens,
  percentile_cont(0.5) within group (order by prompt_tokens) as p50_prompt_tokens,
  percentile_cont(0.9) within group (order by prompt_tokens) as p90_prompt_tokens
from public.chat_request_logs
where created_at >= now() - interval '14 days'
  and duration_ms is not null
group by 1
order by day desc;

-- 2) Knowledge injection observability (recent 14 days)
select
  date_trunc('day', created_at) as day,
  count(*) as n,
  round(avg(knowledge_chars)) as avg_knowledge_chars,
  percentile_cont(0.5) within group (order by knowledge_chars) as p50_knowledge_chars,
  percentile_cont(0.9) within group (order by knowledge_chars) as p90_knowledge_chars,
  sum(case when knowledge_injected then 1 else 0 end) as injected_true
from public.chat_request_logs
where created_at >= now() - interval '14 days'
  and duration_ms is not null
group by 1
order by day desc;

-- 3) Correlation check: prompt size vs latency (recent 14 days)
select
  corr(duration_ms::float, coalesce(prompt_tokens, 0)::float) as corr_duration_prompt_tokens,
  corr(duration_ms::float, coalesce(knowledge_chars, 0)::float) as corr_duration_knowledge_chars
from public.chat_request_logs
where created_at >= now() - interval '14 days'
  and duration_ms is not null;

-- 4) Phase timing split (requires knowledge_sources.phase_ms)
select
  count(*) as n,
  round(avg((knowledge_sources->'phase_ms'->>'mode_router')::numeric)) as avg_mode_router_ms,
  round(avg((knowledge_sources->'phase_ms'->>'user_context')::numeric)) as avg_user_context_ms,
  round(avg((knowledge_sources->'phase_ms'->>'content_search')::numeric)) as avg_content_search_ms,
  round(avg((knowledge_sources->'phase_ms'->>'prompt_build')::numeric)) as avg_prompt_build_ms,
  round(avg((knowledge_sources->'phase_ms'->>'gemini_api')::numeric)) as avg_gemini_api_ms,
  percentile_cont(0.5) within group (order by (knowledge_sources->'phase_ms'->>'gemini_api')::numeric) as p50_gemini_api_ms,
  percentile_cont(0.9) within group (order by (knowledge_sources->'phase_ms'->>'gemini_api')::numeric) as p90_gemini_api_ms
from public.chat_request_logs
where created_at >= now() - interval '14 days'
  and knowledge_sources is not null
  and duration_ms is not null;

-- 5) Inspect slowest requests (recent 3 days)
select
  id,
  created_at,
  response_gear as mode,
  duration_ms,
  prompt_tokens,
  completion_tokens,
  knowledge_chars,
  knowledge_injected,
  left(latest_user_text, 100) as latest_user_text
from public.chat_request_logs
where created_at >= now() - interval '3 days'
  and duration_ms is not null
order by duration_ms desc
limit 30;

