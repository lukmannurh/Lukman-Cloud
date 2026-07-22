# Code Review: Leaderboard Composite Scoring

**Reviewer:** code-reviewer
**Date:** 2026-02-12
**Commit:** HEAD (main)

---

## Scope

- **Files reviewed:** 17 (4 new, 13 modified, 1 migration)
- **LOC added:** ~400
- **Focus:** Correctness, performance, edge cases, DRY, security

## Overall Assessment

Solid implementation. Clean separation of scoring functions (pure), DB recompute (side-effectful), and UI (badges + tabs). The Bayesian formula is correct, composite weights sum to 1.0, and the extraction of `logNormalize`/`recencyScore` into shared utils is good DRY practice. A few issues need attention, ranging from a **critical performance concern** to medium-priority code duplication.

---

## Critical Issues

### C1. Synchronous recompute on every write event -- latency + correctness risk

**Files:** `api.skill-rate.ts:93`, `api.skill-favorite.ts:71`, `api.usage-report.ts:96`

`recomputeSkillScores()` runs **8 sequential DB queries** inline on every rating/favorite/usage write. On Cloudflare Workers with D1, each query adds ~5-15ms latency (D1 is SQLite over HTTP). That is 40-120ms added to the user-facing response.

**Specific concerns:**
- The "max trending raw across all skills" subquery (step 6, line 86-98) scans ALL skills with 2 correlated subqueries each. For N skills, this is O(N) per write event.
- Concurrent writes to different skills read each other's stale `maxInstalls`/`maxStars`/`maxFavorites` -- not a data corruption risk but causes scores to drift until next recompute.
- KV cache is NOT invalidated after `recomputeSkillScores`. The `leaderboard:v2:*` and `leaderboard:thresholds` cache keys have 300s TTL, meaning updated scores won't appear for up to 5 minutes even though we paid the recompute cost synchronously.

**Recommendation:**
1. Move recompute to `waitUntil()` so it runs after the response is sent:
   ```ts
   context.waitUntil(recomputeSkillScores(db, skill.id));
   ```
2. Add KV cache invalidation for `leaderboard:thresholds` and relevant page keys after recompute.
3. For the seed endpoint loop (seed.ts:116-118), consider batch recompute or a single SQL UPDATE statement instead of N sequential calls. With 30 seed skills = 240 DB queries.

### C2. Raw SQL trending subquery may produce incorrect results with D1 timestamp format

**File:** `recompute-skill-scores.ts:91-98`

```sql
SELECT count(*) FROM ratings r WHERE r.skill_id = s.id AND r.created_at > ${sevenDaysAgo}
```

The `sevenDaysAgo` is a JS `Date` object. The schema uses `mode: "timestamp_ms"` (stored as integer milliseconds). Drizzle's `gt()` operator handles conversion for typed columns, but in **raw SQL** the `Date` object will be serialized by the D1 driver. If it serializes as an ISO string instead of milliseconds, the comparison will fail silently (string > integer always false in SQLite).

The typed Drizzle queries on lines 56-71 (`gt(ratings.created_at, sevenDaysAgo)`) are fine because Drizzle knows the column mode. But the raw SQL on lines 91-98 bypasses Drizzle's type system.

**Recommendation:** Use `sevenDaysAgo.getTime()` (the ms integer) in the raw SQL interpolation:
```ts
const sevenDaysAgoMs = Date.now() - 7 * 24 * 60 * 60 * 1000;
// In raw SQL:
r.created_at > ${sevenDaysAgoMs}
```

---

## High Priority

### H1. Duplicated badge computation logic in 3 places

**Files:**
- `api.leaderboard.ts:29-56` (function `computeBadges`)
- `leaderboard.tsx:81-89` (inline in loader)
- `home.tsx` does NOT compute badges -- inconsistency

The leaderboard page and API endpoint both compute badges independently with copy-pasted logic. The API version uses a proper function; `leaderboard.tsx` duplicates it inline. If badge thresholds or badge types change, one will drift.

**Recommendation:** Extract `computeBadges` from `api.leaderboard.ts` into a shared module (e.g., `~/lib/leaderboard/compute-badges.ts`) and import in both places. The home leaderboard should either use badges or explicitly document why it does not.

### H2. Duplicated threshold queries in 2 places

**Files:** `api.leaderboard.ts:79-98`, `leaderboard.tsx:35-53`

Identical p90 threshold SQL in both `api.leaderboard.ts` loader and `leaderboard.tsx` loader. Since they share the same KV cache key (`leaderboard:thresholds`), whichever runs first caches for both -- but the code duplication is a maintenance risk.

**Recommendation:** Extract the threshold fetch into `~/lib/leaderboard/badge-thresholds.ts`.

### H3. Duplicated `getOrderColumn` function

**Files:** `api.leaderboard.ts:18-26`, `leaderboard.tsx:15-24`

Same switch-case mapping in both files.

**Recommendation:** Extract to shared module.

### H4. `rating` column aliased to `bayesian_rating` but `home.tsx` does not compute badges

**File:** `home.tsx:58`

The home page selects `rating: skills.bayesian_rating` but the `HomeLeaderboard` does not render badges. When users navigate from home leaderboard via infinite scroll to `/api/leaderboard?sort=best`, paginated entries will have badges but the initial SSR entries won't. This creates a visual jump when new pages load.

**Recommendation:** Either add badge computation to home.tsx loader or exclude badges from the API response when called from home context.

### H5. No `bayesian_rating` index for the "Top Rated" sort mode

**File:** `schema.ts`

Indexes exist for `composite_score` and `trending_score`, but sorting by `bayesian_rating` (the "Top Rated" tab) has no index. This will cause a full table scan.

**Recommendation:** Add `index("idx_skills_bayesian_rating").on(table.bayesian_rating)` to the schema and a corresponding migration.

---

## Medium Priority

### M1. p90 OFFSET formula -- edge case with < 10 skills

**File:** `api.leaderboard.ts:85`

```sql
OFFSET max(1, (SELECT count(*) FROM skills) / 10)
```

With 5 skills: `max(1, 5/10) = max(1, 0) = 1` (integer division). So p90 = 2nd highest value. That means 1 out of 5 skills (20%) gets the badge, not 10%. At 1 skill, offset=1 and `LIMIT 1 OFFSET 1` returns nothing, so `coalesce(..., 0)` kicks in -- thresholds are 0, and the `> 0` guard prevents badges. That is correct.

At exactly 10 skills: `10/10 = 1`, so p90 = 2nd highest. 1 skill qualifies. Correct.

**Minor issue:** With 15 skills: `15/10 = 1` (integer div), so p90 = 2nd highest. 2 out of 15 (~13%) qualify. Slightly generous but acceptable.

### M2. `total` field selected but unused in threshold query

**File:** `api.leaderboard.ts:82`

```ts
total: sql<number>`count(*)`,
```

Selected but never referenced. Minor waste.

### M3. `bayesianRating` and `rating` are the same column selected twice

**File:** `api.leaderboard.ts:109,113`

```ts
rating: skills.bayesian_rating,
...
bayesianRating: skills.bayesian_rating,
```

Both reference the same column. The `rating` field is used for display, `bayesianRating` for badge logic. This works but is confusing. Consider using a single field and renaming or documenting.

### M4. `home-leaderboard.tsx` duplicates entry interface already exported from `leaderboard-table.tsx`

**File:** `home-leaderboard.tsx:5-13`

The `LeaderboardEntry` interface is defined locally AND exported from `leaderboard-table.tsx`. The local copy lacks `badges?`.

**Recommendation:** Import from `leaderboard-table.tsx`.

### M5. Weight constants defined in two separate places with different values

**Files:**
- `boost-scoring.ts:11-18` -- search boost weights (rrf: 0.50, rating: 0.15, ...)
- `leaderboard-scoring.ts:9-16` -- leaderboard weights (bayesianRating: 0.35, installs: 0.25, ...)

These are intentionally different (search includes RRF component, leaderboard doesn't). The code comments clarify this. However, having two independent sets of scoring weights that produce different rankings could confuse users when search results and leaderboard disagree.

**Note:** Not necessarily a bug -- just something to document.

### M6. Cache key collision risk between home.tsx and api.leaderboard.ts

**File:** `home.tsx:49`

```ts
`leaderboard:v2:best:0:${PAGE_SIZE}`
```

Home.tsx uses `PAGE_SIZE = 20` and shares the cache key pattern with `api.leaderboard.ts`. But home.tsx's cached data is a subset (no `trendingScore`, `favoriteCount`, `updatedAt`, `bayesianRating` fields) while `api.leaderboard.ts` expects those fields. If home.tsx populates the cache first, the API will get a response missing badge-computation fields.

**This is a real bug.** The home loader caches entries with only `{slug, name, author, installs, rating}`. The API loader caches with `{slug, name, author, installs, rating, trendingScore, favoriteCount, updatedAt, bayesianRating}`. But they share the same cache key `leaderboard:v2:best:0:20`.

**Recommendation:** Use a different cache key prefix for home.tsx (e.g., `home:leaderboard:best:0:20`) or ensure both queries return the same shape.

---

## Low Priority

### L1. `handleTabChange` in `leaderboard.tsx` uses full page reload

**File:** `leaderboard.tsx:174-178`

```ts
window.location.href = url.toString();
```

This discards React state and reloads the page. React Router has `useNavigate()` + `useSearchParams()` for client-side transitions. The full reload is likely intentional (to trigger SSR loader) but is worth documenting.

### L2. `SignalBadge` accepts `type: string` instead of union type

**File:** `signal-badge.tsx:12`

Could use `type: keyof typeof BADGE_CONFIG` for type safety. Low impact since `null` return is the fallback.

### L3. Filter tabs don't use React Router `Link` or `useSearchParams`

Same as L1 -- cosmetic, works correctly.

---

## Edge Cases Found by Scout

1. **Empty database:** If skills table is empty, `recomputeSkillScores` returns early at `if (!skill) return` (line 43). Threshold queries return `coalesce(0)`. Home/leaderboard render empty. All safe.

2. **Zero ratings:** Bayesian formula `(10 * globalAvg + 0 * 0) / (10 + 0) = globalAvg`. Correct -- pulls unrated skills to global mean.

3. **All skills have same install_count:** `logNormalize(x, x) = log(1+x)/log(1+x) = 1.0`. All get same normalized score. Composite then differentiates via other signals. Correct.

4. **Negative value in logNormalize:** Not possible from DB schema (all defaults are 0, integers). But `logNormalize(-1, 10)` = `log(0)/log(11) = -Infinity/2.4 = -Infinity`. No guard. Defensively, clamp to 0.

5. **Concurrent favorite toggle + recompute:** Two users toggle favorites simultaneously. Both read same `globalStats.maxFavorites`. Both compute composite scores using slightly stale max. Next recompute corrects it. Acceptable eventual consistency.

6. **Date serialization through KV cache:** `updatedAt` is a `Date` object from Drizzle. After JSON serialization in KV (`JSON.stringify`), it becomes an ISO string. `new Date(e.updatedAt)` in `computeBadges` handles ISO strings correctly. Safe.

7. **`created_at` in trending raw SQL:** See C2 above -- potential Date vs integer mismatch.

---

## Positive Observations

- Clean separation: pure scoring functions (testable) vs DB-side recompute (effectful)
- Bayesian average formula is textbook correct (IMDB approach)
- `logNormalize` compression prevents outliers from dominating
- Precomputed columns avoid expensive JOINs on read path
- Migration is additive (ALTER TABLE ADD) -- backward compatible
- Badge thresholds are data-driven (p90) not hardcoded
- `recencyScore` half-life of ~140 days is reasonable for a skills marketplace
- Exports from `leaderboard-table.tsx` enable type sharing
- Old `onSort`/`ArrowUpDown` code fully cleaned up

---

## Recommended Actions (Priority Order)

1. **[CRITICAL]** Fix cache key collision between `home.tsx` and `api.leaderboard.ts` (M6)
2. **[CRITICAL]** Fix Date vs integer in raw SQL trending subquery (C2)
3. **[HIGH]** Move `recomputeSkillScores` to `waitUntil()` to avoid blocking responses (C1)
4. **[HIGH]** Add `bayesian_rating` index (H5)
5. **[HIGH]** Extract duplicated badge logic into shared module (H1, H2, H3)
6. **[MEDIUM]** Import `LeaderboardEntry` type instead of redeclaring (M4)
7. **[MEDIUM]** Remove unused `total` from threshold query (M2)
8. **[LOW]** Add guard for negative values in `logNormalize` (edge case 4)

---

## Metrics

- **Type Coverage:** Existing TS errors are pre-existing (search, embed, auth routes). No new TS errors introduced by this change.
- **Test Coverage:** No tests added for scoring functions. `computeBayesianRating`, `computeCompositeScore`, `computeTrendingScore` are pure functions and highly testable. Recommend adding unit tests.
- **Linting Issues:** 0 new (checked via typecheck; all errors are pre-existing)

---

## Unresolved Questions

1. Should the leaderboard API invalidate KV cache after `recomputeSkillScores`? Currently scores update in DB but cached responses serve stale data for up to 5 minutes.
2. Is the 5-minute cache TTL appropriate given synchronous recompute? If recompute moves to `waitUntil()`, the TTL provides natural debouncing.
3. Should `home.tsx` show badges? If not, should it be documented?
4. The trending window is hardcoded to 7 days. Is this configurable? Should it be an env var for tuning?
