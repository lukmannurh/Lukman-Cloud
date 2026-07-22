---
title: "Install Count Tracking"
description: "Track CLI installs via new installs table, deduplicated per user/device, with fire-and-forget POST from CLI"
status: complete
priority: P2
effort: 2h
branch: main
tags: [backend, cli, feature]
created: 2026-02-12
---

# Install Count Tracking

## Problem

`install_count` exists in `skills` table (used in leaderboard scoring at 0.25 weight + displayed on UI) but nothing increments it. All values are 0 unless manually seeded.

## Solution

Track installs when CLI `skillx use <slug>` runs. Deduplicate per user (API key) or device (UUID). Fire-and-forget POST from CLI so UX is not blocked.

## Architecture

```
CLI: skillx use <slug>
  -> fetch skill content (existing)
  -> fire-and-forget POST /api/skills/:slug/install
     Headers: Authorization: Bearer <key> OR X-Device-Id: <uuid>

API: POST /api/skills/:slug/install
  -> resolve identity (user_id from API key, or device_id from header)
  -> INSERT INTO installs ON CONFLICT DO NOTHING
  -> if new row: UPDATE skills SET install_count = install_count + 1
  -> recomputeSkillScores()
```

## Phases

| # | Phase | Effort | Status | Details |
|---|-------|--------|--------|---------|
| 1 | Schema migration + API route | S | complete | [phase-01](./phase-01-schema-and-api.md) |
| 2 | CLI device ID + install tracking | XS | complete | [phase-02](./phase-02-cli-install-tracking.md) |
| 3 | Typecheck + validation | XS | complete | [phase-03](./phase-03-validation.md) |

Phases are sequential: 1 -> 2 -> 3.

## Key Files

| File | Action |
|------|--------|
| `apps/web/app/lib/db/schema.ts` | Add `installs` table |
| `apps/web/app/routes.ts` | Add install route |
| `apps/web/app/routes/api.skill-install.ts` | New API endpoint |
| `packages/cli/src/utils/config-store.ts` | Add `getDeviceId()` |
| `packages/cli/src/commands/use.ts` | Fire-and-forget install POST |

## Dependencies

- `recomputeSkillScores()` already reads `install_count` -- no changes needed
- `conf` package already in CLI for device ID persistence
- Drizzle ORM for schema + migration

## Risks

- **Device ID spoofing**: Acceptable for popularity signal (not billing)
- **Counter drift**: If install rows deleted without decrementing; mitigate with periodic reconciliation
- **Offline CLI**: Fire-and-forget silently fails; installs are approximate
- **Partial unique indexes**: SQLite supports them; Drizzle `.where()` on index builder needed

## Reports

- [Brainstorm](../reports/brainstorm-260212-1617-install-count-tracking.md)
