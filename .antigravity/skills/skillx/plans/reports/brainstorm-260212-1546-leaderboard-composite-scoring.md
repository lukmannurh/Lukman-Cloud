# Brainstorm: Leaderboard Composite Scoring

**Date:** 2025-02-12
**Status:** Agreed
**Context:** Current leaderboard uses naive single-column sort. Need composite scoring with statistical fairness.

## Problem

- Single-column `ORDER BY DESC` on `avg_rating` or `install_count`
- 1 perfect rating outranks 500 solid ratings (no sample-size correction)
- FilterTabs cosmetic — doesn't affect queries
- Tie-breaking arbitrary (SQLite default)
- Search has 7-signal boost scoring but leaderboard ignores it

## Decisions

| Decision | Choice |
|---|---|
| Score type | Composite + statistical fairness (Bayesian avg) |
| Tabs | Best (default), Top Rated, Most Installed, Trending, Newest |
| Transparency | Signal badges (Top Rated, Popular, Trending, etc.) |
| Computation | Precomputed columns, recomputed on write events |
| Trending window | 7 days |

## Bayesian Average Rating

```
bayesian_avg = (C × m + Σ ratings) / (C + n)
```

- C = 10 (confidence threshold)
- m = global avg rating across all skills
- n = number of ratings per skill
- Pulls low-sample skills toward the mean

Example: Skill with 1 rating of 10.0 → `(10×6.5 + 10) / 11 ≈ 6.8`

## Composite Score Formula ("Best" tab)

| Signal | Weight | Normalization |
|---|---|---|
| Bayesian rating | 0.35 | `/10` |
| Installs | 0.25 | `log(1+x)/log(1+max)` |
| GitHub stars | 0.15 | `log(1+x)/log(1+max)` |
| Success rate | 0.10 | 0-1 from usage_stats |
| Recency | 0.10 | `exp(-0.005 × days)` |
| Favorites | 0.05 | `log(1+x)/log(1+max)` |

## Trending Score (7-day velocity)

```
trending = (ratings_7d × 2) + (usage_events_7d × 1)
```

Log-normalized across all skills. Derived from `ratings.created_at` and `usage_stats.created_at`.

## Tab Structure

| Tab | Sort Column | Description |
|---|---|---|
| **Best** (default) | `composite_score` | Multi-signal quality |
| **Top Rated** | `bayesian_rating` | Statistically fair rating |
| **Most Installed** | `install_count` | Raw popularity |
| **Trending** | `trending_score` | 7-day activity velocity |
| **Newest** | `created_at` | Recently added |

## Signal Badges

| Badge | Condition |
|---|---|
| Top Rated | `bayesian_rating > 8.0` |
| Popular | `install_count` in top 10% |
| Trending | `trending_score` in top 10% |
| Well Maintained | `updated_at` within 30 days |
| Community Pick | `favorite_count` in top 10% |

## Schema Changes

Add to `skills` table:

```sql
composite_score  REAL DEFAULT 0
bayesian_rating  REAL DEFAULT 0
trending_score   REAL DEFAULT 0
favorite_count   INTEGER DEFAULT 0
```

## Recomputation Strategy

- **On rating/review/favorite/usage events**: recompute affected skill's scores inline
- **Trending**: periodic refresh (time-windowed, refresh when >1hr stale or via cron)
- **KV cache**: existing 5min TTL applies

## Implementation Scope

| Change | Files |
|---|---|
| Schema migration | `schema.ts` + Drizzle migration |
| Shared normalization utils | Extract `logNormalize()`, `recencyScore()` from `boost-scoring.ts` |
| Scoring logic | New `lib/leaderboard/scoring.ts` |
| Recompute triggers | `api.skill-rate.ts`, `api.skill-review.ts`, `api.skill-favorite.ts`, `api.usage-report.ts` |
| Leaderboard API | `api.leaderboard.ts` — accept tab param |
| Leaderboard UI | `leaderboard.tsx` — wire FilterTabs to real tabs |
| Signal badges | New `components/signal-badge.tsx` |
| Home leaderboard | `home-leaderboard.tsx` — use `composite_score` |

## Risks

| Risk | Mitigation |
|---|---|
| Cold start (new skills = zero score) | Recency weight (10%) gives new skills initial visibility |
| Trending sparsity (low traffic) | Show "no trending data" fallback; tab still accessible |
| Recomputation cost at scale | Inline OK for now; batch via scheduled worker if needed |
| Formula tuning | Weights are configurable constants; iterate based on real data |

## Code Reuse

`logNormalize()` and `recencyScore()` from `boost-scoring.ts` extracted to shared `lib/scoring-utils.ts`. Keeps search + leaderboard scoring consistent.
