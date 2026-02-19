# Knowledge Docs Cleanup Report (2026-02-19)

## Scope

- Environment: production Supabase (`summerhill`)
- Goal: reduce noisy knowledge cards and improve prompt relevance for chat v2
- Strategy:
  - keep Phase A top-k + char cap in code
  - prune low-signal and cross-type noise cards in DB
  - normalize `sort_order` for deterministic fallback ordering

## Applied Migrations

- `20260219093000_optimize_knowledge_docs_titles_sort.sql`
- `20260219100000_prune_generic_tail_knowledge_cards.sql`
- `20260219164000_reduce_cross_type_noise_and_dedupe_titles.sql`
- `20260219170000_disable_cross_type_comparison_cards.sql`
- `20260219173000_disable_generic_tail_cards.sql`

## Before/After Snapshot

Baseline before cleanup rounds:

- active cards: `178`
- by type:
  - `crossing`: `68`
  - `depleting`: `52`
  - `hoarding`: `58`

After cleanup rounds:

- active cards: `132` (down `46`, about `-25.8%`)
- by type:
  - `crossing`: `50` (down `18`)
  - `depleting`: `38` (down `14`)
  - `hoarding`: `44` (down `14`)

## Quality Notes

- Remaining cross-type deep noise cards (rule-based check): `0`
- Generic duplicated `05` tail cards removed; only a few type-specific `05` cards remain.
- Most cards are still short summaries (<120 chars), which means future quality gains now depend on better card authoring/chunking, not only pruning.

## Follow-up (Recommended)

- Build a re-chunk pipeline for long-form articles:
  - chunk by idea unit (not fixed sentence count)
  - each chunk ~`180-320` chars with one core claim + one concrete cue
  - hard cap per type and archive stale cards by score
- Keep monitoring with:
  - `docs/perf/2026-02-19-speed-monitoring.sql`
  - `scripts/chatbot-v2-regression.ts` perf gates
