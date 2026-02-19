# Chatbot Speed Recovery Plan (2026-02-19)

## 1) Problem Statement

- Current chatbot responses are consistently slow in production usage.
- The user concern is valid: prompt payload likely contains too much low-value context.

## 2) Baseline (Observed)

Data window: recent production logs around 2026-02-18 to 2026-02-19.

- `duration_ms` (overall)
  - p50: ~12-14s
  - p90: ~19-26s
- `prompt_tokens`
  - p50: ~12.7k
  - high for G1/G2 routine turns
- Phase timing (from `knowledge_sources.phase_ms`)
  - `gemini_api`: dominant cost (~10.8s avg)
  - `content_search` + `prompt_build`: sub-second each
- Correlation
  - `duration_ms` vs `prompt_tokens`: positive (around 0.67)

Conclusion: main bottleneck is model processing large prompts, not DB query latency.

## 3) Root Causes (Working Hypothesis)

1. Full knowledge injection per type in `buildSystemPrompt()`:
   - all active `knowledge_docs` are concatenated into `{{KNOWLEDGE}}`.
2. `{{SOURCES}}` injects very long card titles (many `AUTO::...` strings), creating token waste.
3. High duplicate knowledge payload across types (same content copied to 3 types).
4. Prompt budget currently trims chat history, but does not trim knowledge block size.
5. Telemetry gap:
   - `knowledge_chars` remains `0`, making future diagnosis harder.

## 4) Targets (SLO)

Phase-1 target (quick win, no architecture rewrite):

- Reduce `prompt_tokens` p50 by >= 35%
- Reduce `duration_ms` p50 to <= 8s
- Reduce `duration_ms` p90 to <= 14s
- Preserve answer quality for core health Q&A and booking handoff

## 5) Plan of Execution

## Phase A: Immediate Prompt Diet (Priority: P0)

1. Stop full knowledge dump:
   - Retrieve candidates by type.
   - Select top-k cards by lexical relevance to latest user message.
   - Fallback to a small default pack if no good match.
2. Cap knowledge payload chars:
   - hard limit (example: 1200-1800 chars for G1, slightly higher for G2/G3).
3. Remove or shrink `{{SOURCES}}`:
   - either disable in prompt template, or include max 2-3 short source labels.
4. Keep history budget and content/care budget enabled.

Deliverable:
- Code change in `app/api/chat/v2/route.ts` for knowledge selection + char cap.

## Phase B: Data Cleanup (Priority: P1)

1. Normalize long AUTO titles:
   - generate short human-readable titles.
2. De-duplicate cards:
   - remove cross-type duplicates unless truly type-specific.
3. Fix ordering:
   - populate `sort_order` with meaningful sequence.
4. Archive noisy/low-value cards:
   - set `enabled=false` and `is_active=false` for unused cards.

Deliverable:
- SQL migration + one-time cleanup script/report.

## Phase C: Observability Fix (Priority: P1)

1. Log real knowledge metrics:
   - `knowledge_chars`, selected card count, selected card IDs/titles.
2. Distinguish source composition:
   - prompt template chars vs knowledge chars vs history chars vs contentContext chars.
3. Add dashboard query snippets for daily p50/p90 tracking.

Deliverable:
- Updated logging payload + docs/perf query snippets.

## Phase D: Guardrails and Regression (Priority: P2)

1. Add regression checks:
   - short input should not produce > target prompt size.
2. Add fallback behavior tests:
   - no relevant card still produces safe and useful answer.
3. Track quality:
   - no regression in factual alignment and booking escalation behavior.

Deliverable:
- automated checks + manual checklist run.

## 6) Rollout Strategy

1. Deploy with feature flag:
   - `CHAT_V2_KNOWLEDGE_TOPK_ENABLED=true`
   - `CHAT_V2_KNOWLEDGE_MAX_CHARS=...`
2. Canary period (same day):
   - monitor p50/p90, error rate, user-visible quality.
3. If stable, expand to all traffic.

Rollback:
- disable new flags and revert to prior behavior immediately.

## 7) Acceptance Criteria

- `duration_ms` p50 <= 8s for normal G1 traffic.
- `prompt_tokens` p50 reduced by >= 35%.
- No increase in critical errors.
- No obvious quality regression in sampled conversations.

## 8) Open Decisions

1. Should `{{SOURCES}}` be fully removed or capped to top 2 items?
2. Should knowledge retrieval be shared for G1/G2/G3 or mode-specific?
3. How aggressive should duplicate-card cleanup be in first pass?

---

## 9) Execution Update (2026-02-19)

- Phase A: done
  - `route.ts` now uses top-k card selection + per-mode knowledge char cap + capped sources.
- Phase B: in progress (major cleanup done)
  - titles normalized, sort order normalized, multiple rounds of noisy card pruning applied.
- Phase C: done
  - request logs now include `knowledge_chars`, `knowledge_injected`, and knowledge selection metadata.
- Phase D: partial
  - regression script now includes perf summary + perf gates.
  - remaining item: integrate this regression into a regular CI/cron run.

Owner: Chatbot performance track  
Status: Executing (P0/P1 done, P2 partial)
