# Brainstorm: Search Algorithm Improvements

**Date**: 2026-02-12
**Context**: SkillX hybrid search (FTS5 + Vectorize + RRF + boost scoring)
**Scale**: 1000+ skills catalog
**Priority**: Ranking quality over latency

## Problem Statement

Current search algorithm has solid hybrid architecture but leaves ranking quality on the table:
- FTS5 uses equal column weights (name matches valued same as content matches)
- 3 schema signals unused (github_stars, usage_stats.outcome, recency)
- Linear usage normalization breaks at scale (one viral skill crushes all others)
- Post-filtering wastes compute on irrelevant results
- No prefix/fuzzy matching for autocomplete

## Evaluated Approaches

### Approach 1: Incremental Tuning (Recommended)
Improve existing pipeline without architectural changes.
- **Pros**: Low risk, fast to ship, preserves all existing behavior as baseline
- **Cons**: Limited by current FTS5+Vectorize+RRF architecture

### Approach 2: ML Re-Ranker
Add a learned re-ranking stage after RRF.
- **Pros**: Could learn optimal weights from click data
- **Cons**: Needs click-through data (don't have yet), adds latency, overkill for current scale

### Approach 3: Elasticsearch/Meilisearch Migration
Replace FTS5 with dedicated search engine.
- **Pros**: Built-in typo tolerance, faceting, synonyms
- **Cons**: Extra infra cost, migration complexity, loses Cloudflare edge locality

**Decision**: Approach 1 — maximize existing architecture before adding infra.

## Recommended Solution

### Tier 1: Quick Wins

**A. BM25 Column Weights** (5 min)
```sql
ORDER BY bm25(skills_fts, 10.0, 5.0, 1.0)
--                         name  desc  content
```

**B. Log-Scale Usage Normalization** (10 min)
```ts
normalized = Math.log(1 + count) / Math.log(1 + maxCount)
```
Apply to install_count and github_stars.

### Tier 2: Expanded Boost Formula

**C. New Weight Distribution**

| Component | Weight | Source | Normalization |
|-----------|--------|--------|---------------|
| RRF relevance | 50% | rrf-fusion.ts | rrf / max_rrf |
| Rating | 15% | skills.avg_rating | rating / 10 |
| GitHub stars | 10% | skills.github_stars | log-scale |
| Usage | 8% | skills.install_count | log-scale |
| Success rate | 7% | usage_stats.outcome | success / total |
| Recency | 5% | skills.updated_at | exp(-0.005 * days) |
| Favorite | 5% | favorites table | boolean 1/0 |

**D. Success Rate** — Aggregate from usage_stats, cache in KV (15min TTL) or denormalize to skills table.

### Tier 3: Pre-Filtering

**E. Push category/is_paid to retrieval stage**
- FTS5: Add WHERE clause on joined skills table
- Vectorize: Use metadata filter param

### Tier 4: Query Intelligence

**F. Prefix Matching** — FTS5 `MATCH 'term*'` for short queries and Cmd+K palette
**G. Query Aliases** — Small hand-curated map (~50 entries) for known abbreviations (k8s→kubernetes, ts→typescript, etc.)

## Rejected Ideas
- ML re-ranking: no click data, overkill at current scale
- Click-through learning: needs event tracking infra not yet built
- Dynamic weight tuning: premature without A/B testing framework
- Full NLP/synonym pipeline: vector search covers semantic gaps
- Elasticsearch migration: adds infra cost, loses edge locality

## Implementation Order
1. BM25 column weights — single line SQL change
2. Log-scale normalization — small math change in boost-scoring.ts
3. Expanded boost formula — refactor boost-scoring.ts with new signals
4. Pre-filtering — modify fts5-search.ts and vector-search.ts
5. Prefix matching — conditional FTS5 query modification
6. Query aliases — optional, evaluate after steps 1-5

## Risk Assessment
- **BM25 weights**: Low risk. Can always revert to equal weights.
- **Log normalization**: Low risk. Better than linear in all cases.
- **New boost signals**: Medium risk. Wrong weights could degrade results. Test with sample queries before shipping.
- **Pre-filtering**: Low risk. Logically equivalent, just earlier in pipeline.
- **Prefix matching**: Low risk. Only applies to short queries.

## Success Metrics
- Name-exact-match queries return the skill at rank 1
- High-starred, well-rated skills rank above obscure ones for ambiguous queries
- Filtered searches return same quality without scoring irrelevant results first
- No latency regression > 50ms on p95

## Unresolved Questions
- What success_rate threshold should penalize a skill? (e.g., < 50%?)
- Should recency boost apply to `created_at` or `updated_at`?
- Are there specific queries known to return bad results today? (for regression testing)
