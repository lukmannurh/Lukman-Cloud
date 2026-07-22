# Code Review: API Documentation Page

**Reviewer**: code-reviewer | **Date**: 2026-02-12 | **Scope**: 4 new files + 2 modified

## Scope

| File | LOC | Status |
|------|-----|--------|
| `apps/web/app/routes/docs-api.tsx` | 142 | New |
| `apps/web/app/components/docs/api-endpoint-card.tsx` | 146 | New |
| `apps/web/app/lib/docs/api-endpoints-data.ts` | 152 | New (edge: under 200 LOC limit) |
| `apps/web/app/components/docs/docs-sub-nav.tsx` | 31 | New |
| `apps/web/app/routes.ts` | 22 | Modified (route added) |
| `apps/web/app/routes/docs.tsx` | 218 | Modified (DocsSubNav added) |
| `docs/api-reference.md` | 599 | Modified (leaderboard section updated) |

**Focus**: Component correctness, data accuracy vs actual API routes, UI consistency, accessibility.

## Overall Assessment

**Good implementation.** Clean component architecture, correct use of `sx-*` design tokens, well-organized data separation. The endpoint documentation is mostly accurate against actual route source code, with a few discrepancies noted below.

---

## Critical Issues

None.

---

## High Priority

### H1. Search response missing `github_stars` in example (Data Accuracy)

**File**: `/Users/duynguyen/www/claudekit/skillx/apps/web/app/lib/docs/api-endpoints-data.ts`, line 18-35

The search endpoint response example does not include `github_stars`, but the actual `hybrid-search.ts` (line 64, 108) returns it as part of the full skill data. The markdown doc `docs/api-reference.md` (line 59) correctly includes it.

```typescript
// Current response example (missing github_stars):
"install_count": 1200,
"final_score": 0.82,

// Should include:
"install_count": 1200,
"github_stars": 450,
"final_score": 0.82,
```

### H2. Admin seed response example omits `scoresRecomputed` field (Data Accuracy)

**File**: `/Users/duynguyen/www/claudekit/skillx/apps/web/app/lib/docs/api-endpoints-data.ts`, line 290

Actual response from `api.admin.seed.ts` (line 120-124):
```typescript
return Response.json({
  skills: skillCount,
  vectors: vectorCount,
  scoresRecomputed: allSkills.length,  // <-- missing from docs
});
```

Documented as: `{ "skills": 30, "vectors": 120 }` -- should add `"scoresRecomputed": 30`.

### H3. Rate endpoint auth: docs say "Session required" but CLAUDE.md routes table says "Session/Key"

**File**: `/Users/duynguyen/www/claudekit/skillx/apps/web/app/lib/docs/api-endpoints-data.ts`, line 91

The project CLAUDE.md routes table lists `/api/skills/:slug/rate` auth as "Session/Key", but the actual implementation (`api.skill-rate.ts`) uses only `getSession()` -- no API key support. The endpoint data correctly says "Session required" matching the actual code. **However**, this means either the CLAUDE.md is wrong, or the implementation is missing API key support. Worth clarifying intent.

Same applies to `/api/skills/:slug/review` and `/api/skills/:slug/favorite` -- CLAUDE.md says "Session/Key" but code only supports session.

### H4. Skill detail reviews limit discrepancy

**File**: `/Users/duynguyen/www/claudekit/skillx/apps/web/app/lib/docs/api-endpoints-data.ts`, line 108

The `skill-review-get` endpoint docs say "newest first (max 100)" -- this is correct for the standalone review endpoint (`api.skill-review.ts` line 34). But the skill-detail endpoint (`api.skill-detail.ts` line 34) limits reviews to 50, not 100. If users expect 100 reviews from the skill-detail response, they'll only get 50. Not a bug in the docs per se, but worth documenting the difference.

---

## Medium Priority

### M1. `navigator.clipboard` lacks error handling/fallback

**File**: `/Users/duynguyen/www/claudekit/skillx/apps/web/app/components/docs/api-endpoint-card.tsx`, line 126-129

`navigator.clipboard.writeText()` can throw if the page isn't served over HTTPS or if the user denies clipboard permission. No try-catch wraps this call. Other existing components in the codebase (e.g., `command-box.tsx`, `settings.tsx`) have the same pattern, so this is consistent -- but all are vulnerable.

```typescript
// Recommended:
const handleCopy = async () => {
  try {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  } catch {
    // Fallback or silent fail
  }
};
```

### M2. `docs.tsx` exceeds 200 LOC limit

**File**: `/Users/duynguyen/www/claudekit/skillx/apps/web/app/routes/docs.tsx` -- 218 lines

Project rule requires max 200 LOC per file. The `CommandEntry` component (lines 146-217) could be extracted to `components/docs/command-entry.tsx` to bring both files under the limit.

### M3. Admin seed error message mismatch

**File**: `/Users/duynguyen/www/claudekit/skillx/apps/web/app/lib/docs/api-endpoints-data.ts`, line 296

Documented error: `"Must be an array of skills"`
Actual error (line 39): `"Request body must be an array of skills"`

Minor wording difference, but should match exactly for developer reference.

### M4. Rate endpoint error message mismatch

**File**: `/Users/duynguyen/www/claudekit/skillx/apps/web/app/lib/docs/api-endpoints-data.ts`, line 98

Documented: `"Score must be between 0 and 10"`
Actual (`api.skill-rate.ts` line 30): `"Score must be a number between 0 and 10"`

---

## Low Priority

### L1. No `aria-label` on TOC nav in docs-api.tsx

**File**: `/Users/duynguyen/www/claudekit/skillx/apps/web/app/routes/docs-api.tsx`, line 42

The `<nav>` element has no `aria-label` to distinguish it from the DocsSubNav `<nav>`. Screen readers benefit from labeled navigation landmarks.

```tsx
<nav aria-label="Table of contents" className="mb-10 ...">
```

### L2. DocsSubNav also lacks `aria-label`

**File**: `/Users/duynguyen/www/claudekit/skillx/apps/web/app/components/docs/docs-sub-nav.tsx`, line 12

```tsx
<nav aria-label="Documentation sections" className="mb-8 ...">
```

### L3. Index-based key in notes list

**File**: `/Users/duynguyen/www/claudekit/skillx/apps/web/app/components/docs/api-endpoint-card.tsx`, line 100

`key={i}` on the notes `<li>` elements. Since notes are static and won't reorder, this is acceptable but not ideal.

### L4. Unused `Code` icon import ambiguity

**File**: `/Users/duynguyen/www/claudekit/skillx/apps/web/app/routes/docs-api.tsx`, line 10

`Code` icon from lucide-react is used for the "User & API Keys" section. `KeyRound` or `Key` might be more semantically appropriate (though `Key` is already used for auth). Not a bug, just a style note.

---

## Edge Cases Found by Scout

1. **`/docs` and `/docs/api` are independent routes, not nested** -- `routes.ts` registers them as sibling routes, not parent/child. This means each page independently renders `PageContainer` + `DocsSubNav`. If someone later adds layout-level logic (e.g., sidebar state), they'll need to refactor to nested routing. Current approach is fine for two tabs.

2. **DocsSubNav uses exact match (`pathname === tab.to`)** -- This works for the current two routes but will break for nested paths like `/docs/api/search`. Fine for now.

3. **Search API supports both GET and POST with different param names** -- GET uses `q`, POST uses `query`. The docs correctly document this difference. Good.

4. **Leaderboard `rating` field is `bayesian_rating`** -- The leaderboard API returns `rating` mapped from `skills.bayesian_rating`, not `skills.avg_rating`. The docs response example correctly shows `rating` but doesn't explicitly note it's Bayesian-adjusted. Users comparing leaderboard `rating` with skill-detail `avg_rating` may be confused.

5. **Admin seed endpoint response shape differs from docs** -- Already captured as H2.

---

## Positive Observations

- **Clean separation of concerns**: Endpoint data in dedicated file, reusable card component, shared sub-nav
- **Consistent design tokens**: All `sx-*` tokens used correctly, method color badges are well-designed
- **Good TypeScript types**: `EndpointProps`, `EndpointParam`, `EndpointError` interfaces are well-structured
- **Proper use of `as const`** for TOC and TABS arrays
- **All files under 200 LOC** (except pre-existing `docs.tsx`)
- **Copy button with visual feedback** (check icon after copy)
- **Responsive tables** with `overflow-x-auto`
- **Section scroll offset** handled via `scroll-mt-20`

---

## Recommended Actions

1. **Fix response examples** to match actual API output (H1, H2) -- quick data fix
2. **Fix error message wording** to match actual error strings (M3, M4) -- quick data fix
3. **Clarify auth discrepancy** between CLAUDE.md and actual code for rate/review/favorite endpoints (H3) -- decision needed
4. **Add `aria-label`** to both nav elements (L1, L2) -- quick accessibility win
5. **Add try-catch** to clipboard copy (M1) -- low effort, prevents silent failures
6. **Extract `CommandEntry`** from `docs.tsx` to meet 200 LOC rule (M2) -- optional

---

## Metrics

- **Type Coverage**: Full (all props typed, no `any` usage)
- **Test Coverage**: N/A (no tests for docs pages -- acceptable for static content)
- **Linting Issues**: 0 (build passes)
- **Accessibility**: 2 minor gaps (nav labels)
- **Data Accuracy vs Source**: 4 discrepancies found (2 high, 2 medium)

---

## Unresolved Questions

1. Should the rate/review/favorite endpoints support API key auth (matching CLAUDE.md), or should CLAUDE.md be updated to match the session-only implementation?
2. Should the leaderboard docs note that `rating` is Bayesian-adjusted, distinct from `avg_rating` on skill detail?
3. Is there intent to add syntax highlighting to the code blocks (e.g., via a lightweight highlighter)?
