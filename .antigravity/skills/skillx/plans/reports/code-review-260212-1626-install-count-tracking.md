# Code Review: Install Count Tracking

**Reviewer:** code-reviewer | **Date:** 2026-02-12 | **Scope:** 5 files, ~130 LOC net new

## Scope

| File | Action | LOC |
|------|--------|-----|
| `apps/web/app/routes/api.skill-install.ts` | New | 101 |
| `apps/web/app/lib/db/schema.ts` | Modified | +21 |
| `apps/web/app/routes.ts` | Modified | +1 |
| `packages/cli/src/utils/config-store.ts` | Modified | +8 |
| `packages/cli/src/commands/use.ts` | Modified | +11 |
| `apps/web/drizzle/migrations/0005_crazy_kate_bishop.sql` | New | 12 |

**Scout findings:** Cache staleness after install_count changes, dual-identity dedup gap, no rate limiting, `waitUntil` not used for background work.

## Overall Assessment

Solid implementation that follows existing codebase patterns well. The try/catch approach for detecting inserts (instead of unreliable D1 `meta.changes`) is a pragmatic choice. Partial unique indexes are correct for SQLite NULL semantics. The fire-and-forget CLI pattern is appropriate for non-critical telemetry.

Several medium-severity issues found, one high-priority correctness bug regarding dual-identity dedup.

---

## Critical Issues

None.

---

## High Priority

### H1. Dual-identity double-counting (Correctness Bug)

**File:** `apps/web/app/routes/api.skill-install.ts` lines 18-50, 67-80

When a user provides BOTH a valid API key AND an `X-Device-Id` header (which the CLI always does -- see `use.ts` lines 29-35), the insert stores both `user_id` and `device_id` on the same row. The partial unique indexes are:

- `idx_installs_user`: `(skill_id, user_id) WHERE user_id IS NOT NULL`
- `idx_installs_device`: `(skill_id, device_id) WHERE device_id IS NOT NULL`

**The bug:** If the same physical user first installs without auth (only device_id), then later configures an API key and installs again, BOTH rows are accepted because:
- Row 1: `user_id=NULL, device_id=abc` -- passes device index check
- Row 2: `user_id=u1, device_id=abc` -- different user_id means no device index conflict (device_id is the same but user_id differs, and the device index only checks `(skill_id, device_id)`)

Wait -- actually the device index IS `(skill_id, device_id) WHERE device_id IS NOT NULL`. Row 2 has device_id=abc, so it WILL conflict with Row 1 on the device index. The UNIQUE constraint on `(skill_id, device_id)` where both are `abc` and the same `skill_id` will trigger.

**Correction:** This is actually handled correctly IF the device_id is always sent. The CLI always sends `X-Device-Id`, so for authenticated users, the device index catches the duplicate.

**Remaining edge case:** If a user authenticates via API key but does NOT send `X-Device-Id` (e.g., a custom integration, curl, or future web-based install), then later installs the same skill from CLI with device_id only -- two rows get counted. This is a minor concern since it requires two different clients for the same user.

**Recommendation:** When both `userId` and `deviceId` are present, set `device_id = null` on the insert to rely solely on the user_id index. This prevents double-counting across client modes.

```typescript
// When we have a userId, don't store deviceId to avoid double-count
await db.insert(installs).values({
  id: installId,
  skill_id: skill.id,
  user_id: userId,
  device_id: userId ? null : deviceId,  // <-- prefer user_id dedup
  created_at: new Date(),
});
```

### H2. No rate limiting on install endpoint

**File:** `apps/web/app/routes/api.skill-install.ts`

The endpoint has no rate limiting. While the dedup prevents inflating `install_count` for a single skill, an attacker could:
1. Send thousands of requests with different `X-Device-Id` values (trivially spoofable UUIDs) to inflate any skill's install count
2. Cause heavy DB write load (INSERT + UPDATE + recomputeSkillScores per request)

**Impact:** Leaderboard manipulation. A skill could be boosted to #1 by scripting POST requests with random device IDs.

**Recommendation:**
- Short-term: Add IP-based rate limiting via Cloudflare Rate Limiting rules (no code change needed, configure in dashboard)
- Medium-term: Add device_id format validation (must be UUID v4 format) to at least raise the bar slightly
- Long-term: Consider requiring a minimum install age or frequency cap per IP

### H3. Synchronous recomputeSkillScores in request path

**File:** `apps/web/app/routes/api.skill-install.ts` line 89

`recomputeSkillScores` runs 7 DB queries (global stats, skill data, favorites count, recent ratings, recent usage, success data, max trending, then UPDATE). This runs synchronously in the request handler.

The codebase does NOT use `waitUntil()` anywhere currently (confirmed via grep), so this is consistent with existing patterns (e.g., `api.skill-rate.ts` line 93, `api.skill-favorite.ts` line 71). However, the install endpoint is fire-and-forget from the CLI -- the CLI ignores the response. This makes it a perfect candidate for `context.cloudflare.ctx.waitUntil()`.

**Recommendation:** Move recompute to `waitUntil` since the CLI doesn't wait for the response anyway:

```typescript
if (inserted) {
  await db.update(skills)
    .set({ install_count: sql`install_count + 1`, updated_at: new Date() })
    .where(eq(skills.id, skill.id));

  // Recompute in background -- CLI doesn't wait for response
  context.cloudflare.ctx.waitUntil(recomputeSkillScores(db, skill.id));
}
return Response.json({ installed: inserted });
```

---

## Medium Priority

### M1. Cache staleness after install_count mutation

**Files affected:** `apps/web/app/routes/home.tsx`, `apps/web/app/routes/leaderboard.tsx`, `apps/web/app/routes/api.leaderboard.ts`

The leaderboard and home page cache `install_count` data with 5-minute TTL via `getCached()`. After an install, the cached data becomes stale. There is no cache invalidation utility in the codebase (`kv-cache.ts` only has `getCached()`).

**Impact:** Install counts will lag up to 5 minutes on the UI. This is acceptable for a popularity signal, but worth noting. The `stats:global` cache key in `home.tsx` (line 26) includes `sum(install_count)` which will also be stale.

**Recommendation:** Acceptable as-is for P2 feature. If real-time counts become important, add a `deleteCached(kv, keyPattern)` utility and call it after install_count changes.

### M2. Inconsistent `created_at` / `last_used_at` types

**File:** `apps/web/app/routes/api.skill-install.ts` lines 38, 73, 86

The install endpoint uses `new Date()` for `created_at` (line 73), `updated_at` (line 86), and `last_used_at` (line 38). With Drizzle `timestamp_ms` mode, passing `Date` objects to typed Drizzle operations is correct -- Drizzle handles the conversion.

However, the plan's reference implementation (phase-01 line 179, 193-194) used `Date.now()` (a number) for `created_at` and `updated_at`. The actual implementation uses `new Date()` instead. Both work with Drizzle `timestamp_ms`, but the codebase is inconsistent:
- `api.skill-favorite.ts` line 66: `created_at: Date.now()` (number)
- `api.skill-rate.ts` lines 58-59: `created_at: now` where `now = Date.now()` (number)
- `api.skill-install.ts` line 73: `created_at: new Date()` (Date object)

**Recommendation:** Standardize on `new Date()` across the codebase since Drizzle `timestamp_ms` mode expects Date objects. The existing routes using `Date.now()` actually cause TS errors (confirmed in typecheck output). The install endpoint's usage of `new Date()` is the correct approach.

### M3. ID generation uses `Math.random()` -- predictable but acceptable

**File:** `apps/web/app/routes/api.skill-install.ts` line 64

```typescript
const installId = `inst-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
```

`Math.random()` is not cryptographically secure. For a primary key that only needs uniqueness (not secrecy), this is fine. The existing codebase uses similar patterns. `crypto.randomUUID()` would be more robust but is not required here.

### M4. No `loader` export -- GET requests return 405 implicitly

**File:** `apps/web/app/routes/api.skill-install.ts`

The route only exports `action` (handles POST/PUT/PATCH/DELETE). GET requests to `/api/skills/:slug/install` will get React Router's default 405 behavior. This is fine but worth noting -- the plan's reference code had an explicit method check (`request.method !== "POST"`) that was removed in the final implementation.

React Router's `action` function is only called for non-GET methods, so PUT/PATCH/DELETE would also hit this handler. The endpoint silently accepts any non-GET method. Consider adding a method guard:

```typescript
if (request.method !== "POST") {
  return Response.json({ error: "Method not allowed" }, { status: 405 });
}
```

---

## Low Priority

### L1. `isNull` import unused if API key auth is skipped

**File:** `apps/web/app/routes/api.skill-install.ts` line 4

The import `isNull` from `drizzle-orm` is used on line 29: `isNull(apiKeys.revoked_at)`. This is correct and used. No issue.

### L2. Skill lookup selects only `id` -- clean

**File:** `apps/web/app/routes/api.skill-install.ts` lines 53-57

Good practice: `.select({ id: skills.id })` instead of `.select()` which would fetch all columns. This is better than the pattern in `api.skill-rate.ts` line 37 which does `.select()` (fetches all columns).

### L3. CLI `use.ts` properly encodes slug in URL

**File:** `packages/cli/src/commands/use.ts` line 36

The slug comes from Commander.js argument parsing and is interpolated into the URL. Since slugs are URL-safe by convention (alphanumeric + hyphens), this is acceptable. If exotic slugs were possible, `encodeURIComponent` would be needed.

---

## Edge Cases Found by Scout

1. **Dual-client double-counting:** User installs via curl with API key (no device_id), then via CLI (with device_id) -- two install rows, count incremented twice. See H1.
2. **Device ID spoofing for leaderboard manipulation:** Trivial to generate unlimited UUIDs and POST to inflate any skill. See H2.
3. **Cache lag on leaderboard/home after install:** Up to 5 min delay. See M1.
4. **Concurrent installs race condition:** Two simultaneous requests with the same identity could both pass the try/catch if the UNIQUE violation hasn't been committed. SQLite/D1 serializes writes, so this is not an issue on D1 specifically. Safe.
5. **`recomputeSkillScores` failure doesn't roll back install_count:** If recompute fails (line 89), the install_count is already incremented but leaderboard scores are stale. This is acceptable -- scores will be corrected on next write event.

---

## Positive Observations

1. **Try/catch for dedup detection** instead of unreliable `(result as any).changes` -- pragmatic fix for D1 quirk
2. **Partial unique indexes** -- correct approach for SQLite NULL dedup, properly generated in migration SQL
3. **Fire-and-forget pattern** in CLI -- good UX, `.catch(() => {})` prevents unhandled rejections
4. **Minimal select** on skill lookup (only `id`) -- better than existing routes
5. **Consistent error handling** with try/catch wrapper and 500 fallback
6. **Clean separation** -- config-store handles device ID persistence, use.ts handles tracking call
7. **File sizes well under 200 LOC** -- all files comply with project standards

---

## Recommended Actions

1. **[H1]** Nullify `device_id` when `user_id` is present to prevent cross-client double-counting
2. **[H2]** Add Cloudflare Rate Limiting rule for `/api/skills/*/install` (10 req/min per IP)
3. **[H3]** Move `recomputeSkillScores` to `waitUntil()` for this endpoint
4. **[M4]** Add `request.method !== "POST"` guard for explicit 405

---

## Metrics

- **Type Coverage:** No new TS errors introduced (all 20+ errors are pre-existing in other files)
- **Test Coverage:** No tests added (acceptable for P2 fire-and-forget telemetry)
- **Linting Issues:** 0 new issues in changed files
- **File Size Compliance:** All files under 200 LOC

---

## Unresolved Questions

1. Should device_id be validated as UUID v4 format server-side, or is any non-empty string acceptable?
2. Is 5-minute cache staleness for install_count acceptable for the leaderboard, or should cache be invalidated on install?
3. Should the endpoint return 200 even for deduplicated installs (current: `{ installed: false }`), or should it return 204 No Content?
