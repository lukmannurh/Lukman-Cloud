# Brainstorm: Install Count Tracking

**Date:** 2026-02-12
**Status:** Agreed

## Problem

`install_count` column exists in `skills` table, displayed on leaderboard/cards/scoring, but **nothing increments it**. All values are 0 unless manually seeded. The column is a dead metric.

Current tracking:
- `usageStats` table tracks execution reports via `POST /api/report` (CLI `skillx report`)
- CLI `use` command fetches skill content but doesn't phone home
- No install event captured anywhere

## Requirements

- Count installs when CLI `skillx use <slug>` is run
- Deduplicate per user per skill (10 runs = 1 install)
- Track unauthenticated users via device fingerprint (no auth friction)
- Don't block CLI UX — fire-and-forget

## Agreed Solution

### Device Fingerprint
- Generate UUID on first CLI run, persist via `conf` package (already used)
- Stored in `~/.config/skillx/config.json` as `deviceId`

### New `installs` Table
```sql
CREATE TABLE installs (
  id TEXT PRIMARY KEY,
  skill_id TEXT NOT NULL REFERENCES skills(id),
  user_id TEXT,
  device_id TEXT,
  created_at INTEGER NOT NULL,
  UNIQUE(skill_id, user_id),
  UNIQUE(skill_id, device_id)
);
```
- Authenticated: dedupe on `(skill_id, user_id)`
- Anonymous: dedupe on `(skill_id, device_id)`

### API Endpoint: `POST /api/skills/:slug/install`
- Auth: optional API key OR `X-Device-Id` header
- Logic:
  1. Resolve skill by slug
  2. Determine identity (user_id from API key, or device_id from header)
  3. Insert into `installs` (ON CONFLICT DO NOTHING)
  4. If new row: `UPDATE skills SET install_count = install_count + 1`
  5. Recompute scores via `recomputeSkillScores()`
- Response: `{ installed: true/false }` (true = new, false = already counted)

### CLI Changes
- `packages/cli/src/lib/config-store.ts`: Add `getDeviceId()` helper
- `packages/cli/src/commands/use.ts`: After fetching skill, fire-and-forget POST to install endpoint
- Send API key if configured, else `X-Device-Id` header

### Scoring Integration
- `recomputeSkillScores()` already reads `install_count` — no changes needed
- Composite score formula already weights installs at 0.25

## Trade-offs

| Aspect | Decision | Rationale |
|--------|----------|-----------|
| Dedup | Per user/device per skill | Honest metric |
| Auth | Optional (device fallback) | No friction on core UX |
| Tracking | Fire-and-forget | Doesn't slow `use` command |
| Storage | Separate `installs` table | Auditable, queryable |
| Counter | Atomic `+1` on insert | Avoids expensive COUNT(*) |

## Risks

- **Device ID spoofing**: Acceptable — popularity signal, not billing
- **Counter drift**: If install rows deleted without decrementing. Mitigate with periodic reconciliation
- **Offline CLI**: Fire-and-forget silently fails. Installs are approximate
- **Dual unique constraints**: SQLite handles compound UNIQUE fine; need to handle NULL user_id/device_id correctly (NULL != NULL in SQL)

## Implementation Scope

| Component | Effort |
|-----------|--------|
| Schema migration (installs table) | S |
| API route + auth handling | S |
| CLI config-store deviceId | XS |
| CLI use command integration | XS |
| Seed backfill (optional) | XS |

**Total effort:** Small — 4-5 files, straightforward
