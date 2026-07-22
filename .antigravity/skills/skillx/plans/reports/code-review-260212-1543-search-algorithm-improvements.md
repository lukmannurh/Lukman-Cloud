# Code Review: Search Algorithm Improvements

**Reviewer**: code-reviewer | **Date**: 2026-02-12 | **Scope**: search module rewrite

## Scope

- **Files reviewed**: 6 files in `apps/web/app/lib/search/` + `apps/web/app/routes/api.search.ts`
- **LOC**: ~470 (search modules) + ~250 (API route)
- **Focus**: scoring formula correctness, SQL injection, edge cases, type safety, performance

## Overall Assessment

Solid implementation. The 7-signal boost formula is well-structured, pre-filtering is correctly pushed to retrieval, and FTS5 query sanitization prevents injection. Several medium-priority issues found around alias expansion interacting with FTS5 syntax, duplicated fallback code, and TypeScript implicit `any` types in the API route.

---

## Critical Issues

**None found.** No security vulnerabilities or data loss risks.

---

## High Priority

### H1. Alias expansion generates invalid FTS5 syntax with multi-word aliases

**File**: `/Users/duynguyen/www/claudekit/skillx/apps/web/app/lib/search/query-aliases.ts` (lines 7-40)
**File**: `/Users/duynguyen/www/claudekit/skillx/apps/web/app/lib/search/fts5-search.ts` (lines 24-37)

Several aliases map to multi-word expansions:
```typescript
gcp: 'google cloud',
cli: 'command line terminal',
devops: 'devops deployment operations',
```

`expandAliases("cli")` produces: `(cli OR command OR line OR terminal)`

Then `toPrefixQuery` adds `*` wildcards, yielding: `(cli* OR command* OR line* OR terminal*)`

This is valid FTS5 syntax. However, the intent was likely to match the phrase "command line" rather than the individual words "command" OR "line" OR "terminal" separately. A search for "cli" will match any skill containing the word "line" or "terminal" alone, producing noisy results.

Additionally, the alias `react: 'react reactjs'` maps to `(react OR react OR reactjs)` -- duplicate `react` term (harmless but wasteful).

**Recommendation**: Consider quoting multi-word phrases or accept the current broad-match behavior as intentional for recall. Remove duplicate self-references like `react: 'react reactjs'` -> `react: 'reactjs'`.

### H2. `toPrefixQuery` does not handle nested/multiple parentheses

**File**: `/Users/duynguyen/www/claudekit/skillx/apps/web/app/lib/search/fts5-search.ts` (lines 24-37)

The paren handling only checks `startsWith('(')` and `endsWith(')')`. If alias expansion ever produces a token like `(term)` (both parens on one token), or if user input somehow bypasses sanitization with parens, the logic would break. Currently the sanitizer strips non-`\w\s` chars (line 57), so user-supplied parens are stripped -- this is fine. But alias-expanded tokens with both open+close parens on a single term (not currently possible but fragile) would only have the opening paren handled.

**Risk**: Low currently (sanitizer prevents it), but worth noting for future alias changes.

### H3. TypeScript `any[]` implicit types in `api.search.ts`

**File**: `/Users/duynguyen/www/claudekit/skillx/apps/web/app/routes/api.search.ts` (lines 101, 147, 190, 233)

TypeScript reports 4 errors where `results` has implicit `any[]` type. The `let results;` declaration without a type annotation causes the type to be inferred as `any[]` in the fallback branches.

```
app/routes/api.search.ts(101,9): error TS7034: Variable 'results' implicitly has type 'any[]'
app/routes/api.search.ts(147,7): error TS7005: Variable 'results' implicitly has an 'any[]' type.
app/routes/api.search.ts(190,9): error TS7034 ...
app/routes/api.search.ts(233,7): error TS7005 ...
```

**Fix**: Annotate `let results: SearchResult[]` (importing `SearchResult` from `hybrid-search.ts`) or use a union type.

---

## Medium Priority

### M1. Duplicated FTS5 fallback logic across 3 files

**Files**:
- `/Users/duynguyen/www/claudekit/skillx/apps/web/app/routes/api.search.ts` (lines 117-143, 203-229)
- `/Users/duynguyen/www/claudekit/skillx/apps/web/app/routes/search.tsx` (lines 39-56)
- `/Users/duynguyen/www/claudekit/skillx/apps/web/app/lib/search/hybrid-search.ts` (lines 216-238)

The "fallback to FTS5 + fetch full skills" pattern appears 4 times across 3 files. Each slightly different (some pass filters, some do not; `search.tsx` does not pass filters). This violates DRY and creates divergence risk.

**Recommendation**: Extract a `fts5FallbackSearch(db, d1, query, limit, filters?)` helper in the search module and reuse it everywhere.

### M2. `search.tsx` FTS5 fallback does not pass filters

**File**: `/Users/duynguyen/www/claudekit/skillx/apps/web/app/routes/search.tsx` (line 43)

```typescript
const fts = await fts5Search(env.DB, query, 20); // no filters!
```

While `api.search.ts` correctly passes `{ category, is_paid }` to the FTS5 fallback, the `search.tsx` page route does not. Users filtering by category on the search page will get unfiltered results when Vectorize is unavailable.

**Fix**: Pass `{ category }` as the 4th argument.

### M3. Fallback in `api.search.ts` loses result ordering

**File**: `/Users/duynguyen/www/claudekit/skillx/apps/web/app/routes/api.search.ts` (lines 128-143)

In the FTS5 fallback branch (both action and loader), `skillData` from the DB query is iterated with `skillData.map((skill, i) => ...)` assigning `keyword_rank: i + 1`. But `skillData` is not sorted by the FTS5 rank order -- the `inArray` query returns rows in arbitrary DB order, not in the FTS5 BM25 rank order.

**Fix**: Build a `Map` from `skillIds` order, then sort `skillData` to match the original FTS5 ranking before assigning ranks. Or use the pattern from `hybrid-search.ts` fallback which iterates `fts5Results` and looks up from a skill map.

### M4. `logNormalize` edge case when all values are 0

**File**: `/Users/duynguyen/www/claudekit/skillx/apps/web/app/lib/search/boost-scoring.ts` (lines 44-47, 79-80)

```typescript
const maxUsage = Math.max(...allStats.map((s) => s.usage_count), 1);
const maxStars = Math.max(...allStats.map((s) => s.github_stars), 1);
```

The `1` floor prevents division by zero in `logNormalize`. However, if `rrfResults` contains skill IDs that have no entry in `statsMap`, the default stats (line 83-90) use `usage_count: 0, github_stars: 0`. If ALL skills have 0 usage and 0 stars, `maxUsage = 1` and `logNormalize(0, 1) = 0`, which is correct. No bug, but worth documenting the floor value rationale.

### M5. `Math.max(...array)` can throw on large arrays

**File**: `/Users/duynguyen/www/claudekit/skillx/apps/web/app/lib/search/boost-scoring.ts` (lines 76-80)

`Math.max(...rrfResults.map(...))` spreads the entire array as arguments. If `rrfResults` exceeds ~100K items, this causes a stack overflow. In practice search is limited to 20-40 results after `slice(0, limit * 2)` in `hybrid-search.ts` line 184-186, so this is safe. But if limits change or the slice is removed, this becomes a risk.

### M6. `success_rate` default of 0.5 creates a slight positive bias

**File**: `/Users/duynguyen/www/claudekit/skillx/apps/web/app/lib/search/boost-scoring.ts` (line 87)
**File**: `/Users/duynguyen/www/claudekit/skillx/apps/web/app/lib/search/hybrid-search.ts` (line 109)

Skills with no usage data get `success_rate: 0.5` (neutral). This contributes `0.5 * 0.07 = 0.035` to the final score. A skill that has been used and always fails (`success_rate: 0`) gets `0`. So new/unused skills are slightly preferred over known-failing skills -- this seems intentional and reasonable, but worth confirming the design intent.

---

## Low Priority

### L1. BM25 weight order assumption

**File**: `/Users/duynguyen/www/claudekit/skillx/apps/web/app/lib/search/fts5-search.ts` (lines 70, 90)

BM25 column weights `(10.0, 5.0, 1.0)` correspond to the FTS5 column order defined in the migration: `name, description, content`. This is correct per the migration at `/Users/duynguyen/www/claudekit/skillx/apps/web/drizzle/migrations/0001_fts5-fulltext-search.sql` (line 2-3). A code comment mapping weights to columns would prevent confusion if columns are ever reordered.

### L2. Alias map maintenance burden

**File**: `/Users/duynguyen/www/claudekit/skillx/apps/web/app/lib/search/query-aliases.ts`

The ~30-entry hand-curated alias map will become stale as new skill categories emerge. Consider generating from category metadata or skill tags in the future.

### L3. Vectorize filter type mismatch risk

**File**: `/Users/duynguyen/www/claudekit/skillx/apps/web/app/lib/search/vector-search.ts` (lines 53-59)

The filter object is typed as `Record<string, string | number>` but Cloudflare Vectorize metadata filters have specific type requirements. The `is_paid` conversion `filters.is_paid ? 1 : 0` assumes the Vectorize index stores `is_paid` as a number metadata field. If the indexing pipeline stores it as a boolean string ("true"/"false"), filters will silently match nothing.

**Recommendation**: Verify Vectorize index metadata schema matches the filter types used here.

---

## Scoring Formula Verification

### Weights sum check
```
rrf:      0.50
rating:   0.15
stars:    0.10
usage:    0.08
success:  0.07
recency:  0.05
favorite: 0.05
---
Total:    1.00  [PASS]
```

### Score range
- Each component normalized to [0, 1] before weighting: [PASS]
- `logNormalize` returns 0 when value=0 or max<=0: [PASS]
- `recencyScore` returns 0 for null dates: [PASS]
- `favoriteBoost` is binary 0 or 1: [PASS]
- Final score range: [0.0, 1.0]: [PASS]

### RRF normalization
- RRF scores are divided by `maxRrfScore` (line 93-94), correctly re-normalizing to [0, 1]: [PASS]
- Division-by-zero guard when `maxRrfScore > 0`: [PASS]

---

## SQL Injection Analysis

### FTS5 Query (fts5-search.ts)
- **Sanitization**: `query.replace(/[^\w\s]/g, '')` strips all non-word/non-space chars (line 57): [SAFE]
- This removes `"`, `'`, `*`, `(`, `)`, `:`, `{`, `}` etc. from user input
- Alias expansion adds back `(`, `)`, `OR` keywords -- these are controlled, not user-supplied
- `toPrefixQuery` adds `*` wildcards -- also controlled
- Query passed via parameterized `?1` binding: [SAFE]
- Filter values (`category`, `is_paid`) use parameterized bindings `?2`, `?3`: [SAFE]

### Drizzle ORM Queries (hybrid-search.ts)
- All queries use Drizzle's parameterized API (`eq`, `inArray`, `and`): [SAFE]
- Raw SQL in success_rate computation uses `sql` tagged template: [SAFE]

**Verdict**: No SQL injection vectors found.

---

## Edge Cases Scouted

| Edge Case | Handled? | Location |
|-----------|----------|----------|
| Empty query string | Yes | `fts5-search.ts:59`, `vector-search.ts:38`, `hybrid-search.ts:162` |
| Query with only special chars (e.g., "!!!") | Yes | Sanitized to empty string, returns [] |
| No usage_stats rows for a skill | Yes | `success_rate` defaults to 0.5 |
| `updated_at` is null | Yes | `recencyScore` returns 0 |
| All skills have 0 stars/usage | Yes | `maxStars=1`, `maxUsage=1` floor |
| `statsMap` missing a skill_id | Yes | Default stats object at line 83-90 |
| `skillIds` empty array to `inArray` | Yes | Guarded by `skillIds.length === 0` checks |
| Vectorize unavailable (local dev) | Yes | Hybrid search catches error, falls back to FTS5 |
| Single search result (maxRrfScore = score) | Yes | Normalized to 1.0, formula still valid |
| Very long query string | Partial | No explicit length limit on query before FTS5 MATCH |

---

## Positive Observations

1. **Pre-filtering pushed to retrieval** -- category/is_paid filters applied at FTS5 SQL and Vectorize metadata level, avoiding wasteful post-filtering
2. **Parallel execution** -- FTS5 and vector search run via `Promise.all`, and `fetchSkillStats` runs 3 DB queries in parallel
3. **Graceful degradation** -- Multiple fallback layers (hybrid -> FTS5 -> empty)
4. **Clean module separation** -- Each search concern in its own file under 120 LOC
5. **RRF fusion is textbook correct** -- Standard k=60 constant, proper rank-based scoring
6. **Log-scale normalization** -- Prevents popular skills from dominating through install counts

---

## Recommended Actions (Priority Order)

1. **[H3]** Add explicit type annotation for `results` variable in `api.search.ts` to fix TS errors
2. **[M3]** Fix FTS5 fallback result ordering in `api.search.ts` -- results lose BM25 rank order
3. **[M2]** Pass filters to FTS5 fallback in `search.tsx`
4. **[M1]** Extract shared FTS5 fallback helper to eliminate 4x duplication
5. **[H1]** Audit multi-word aliases for intent (broad match vs phrase match)
6. **[L3]** Verify Vectorize metadata types match filter types

---

## Metrics

| Metric | Value |
|--------|-------|
| Type Coverage | ~90% (4 implicit `any` errors in api.search.ts + 3 in search.tsx) |
| Test Coverage | Not assessed (no test files found for search module) |
| Linting Issues | 0 in search module files; 25+ pre-existing TS errors in other routes |
| Search Module LOC | 470 total across 6 files (avg 78/file) |

---

## Unresolved Questions

1. Are multi-word aliases (e.g., `cli -> command line terminal`) intended as broad OR-match or phrase match?
2. Is there a max query length that should be enforced before hitting FTS5?
3. Should search module have unit tests for the scoring formula and alias expansion?
4. Does the Vectorize index store `is_paid` as integer (0/1) or boolean metadata? Filter correctness depends on this.
