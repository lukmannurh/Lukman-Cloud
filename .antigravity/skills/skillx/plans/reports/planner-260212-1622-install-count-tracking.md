# Planner Report: Install Count Tracking

**Date:** 2026-02-12
**Plan:** `plans/260212-1622-install-count-tracking/`

## Summary

Created 3-phase implementation plan to make `install_count` a live metric. Currently dead (always 0) despite being weighted at 0.25 in leaderboard scoring.

## Phases

1. **Schema + API (S):** New `installs` table with partial unique indexes for user/device dedup. `POST /api/skills/:slug/install` endpoint with optional API key auth + X-Device-Id fallback.
2. **CLI tracking (XS):** `getDeviceId()` in config-store (UUID via `conf`). Fire-and-forget POST in `use.ts` after skill fetch.
3. **Validation (XS):** Typecheck both packages, verify migration SQL, curl test dedup behavior.

## Files to Change

| File | Change |
|------|--------|
| `apps/web/app/lib/db/schema.ts` | Add `installs` table with partial unique indexes |
| `apps/web/app/routes.ts` | Add install route |
| `apps/web/app/routes/api.skill-install.ts` | **New** -- install endpoint |
| `packages/cli/src/utils/config-store.ts` | Add `getDeviceId()` |
| `packages/cli/src/commands/use.ts` | Fire-and-forget install POST |

## Key Design Decisions

- **Partial unique indexes** (WHERE NOT NULL) instead of plain UNIQUE -- SQLite treats NULL != NULL, so plain UNIQUE wouldn't dedup correctly
- **Optional auth** -- anonymous installs via device UUID, no friction on core CLI UX
- **Fire-and-forget** -- raw `fetch` with `.catch(() => {})`, not `apiRequest` which throws
- **Atomic increment** -- `SET install_count = install_count + 1` only on new inserts, avoids COUNT(*) recalculation
- **No scoring changes** -- `recomputeSkillScores()` already reads `install_count`

## Risk Items

- D1 `result.changes` property for detecting affected rows -- fallback strategy documented if it doesn't work
- Drizzle partial unique index support -- manual migration SQL edit if `.where()` not supported on index builder
- Process exit before fire-and-forget completes -- acceptable for approximate metric

## Effort

~2 hours total. 5 files changed/created. Straightforward patterns copied from existing `api.usage-report.ts` and `api.skill-favorite.ts`.
