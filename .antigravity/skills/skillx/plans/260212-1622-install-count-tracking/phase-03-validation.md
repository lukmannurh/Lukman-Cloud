# Phase 3: Typecheck + Validation

## Context

- [Phase 1](./phase-01-schema-and-api.md) and [Phase 2](./phase-02-cli-install-tracking.md) must be complete
- All code changes implemented

## Overview

- **Priority:** P2
- **Status:** complete
- **Effort:** XS
- Verify types compile, migration SQL is correct, and end-to-end flow works

## Validation Steps

### 1. TypeScript compilation

```bash
cd apps/web && pnpm typecheck
```

Common issues to watch for:
- `sql` import missing from drizzle-orm in schema.ts
- `installs` not exported from schema (other files importing it)
- `result.changes` type on D1 insert result -- may need `as any` cast

```bash
cd packages/cli && pnpm typecheck   # if typecheck script exists
# OR
cd packages/cli && npx tsc --noEmit
```

Common issues:
- `randomUUID` import -- may need `@types/node` version check
- `getDeviceId` export not found -- check named export

### 2. Review migration SQL

After `pnpm db:generate`, inspect the generated migration file in `apps/web/drizzle/` folder.

Verify it contains:
```sql
CREATE TABLE `installs` (
  `id` text PRIMARY KEY NOT NULL,
  `skill_id` text NOT NULL REFERENCES `skills`(`id`) ON DELETE CASCADE,
  `user_id` text,
  `device_id` text,
  `created_at` integer NOT NULL
);
CREATE UNIQUE INDEX `idx_installs_user` ON `installs`(`skill_id`, `user_id`) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX `idx_installs_device` ON `installs`(`skill_id`, `device_id`) WHERE device_id IS NOT NULL;
CREATE INDEX `idx_installs_skill` ON `installs`(`skill_id`);
```

If Drizzle does NOT generate partial unique indexes correctly:
- Manually edit the migration SQL file
- Or add a custom migration with raw SQL

### 3. Local dev test (FTS5-only mode)

```bash
cd apps/web && pnpm dev
```

Test with curl:
```bash
# Anonymous install (device_id only)
curl -X POST http://localhost:5173/api/skills/cursor-rules/install \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: test-device-123"
# Expected: { "installed": true }

# Repeat -- should be deduplicated
curl -X POST http://localhost:5173/api/skills/cursor-rules/install \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: test-device-123"
# Expected: { "installed": false }

# Different device
curl -X POST http://localhost:5173/api/skills/cursor-rules/install \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: test-device-456"
# Expected: { "installed": true }
```

### 4. Verify install_count increment

After test installs, check skill's install_count was incremented:
```bash
curl http://localhost:5173/api/skills/cursor-rules | jq '.install_count'
```

### 5. Check D1 result.changes behavior

If `result.changes` does not work as expected (always 0, or property doesn't exist), implement fallback:

```typescript
// Fallback: try insert, catch unique constraint, use that as dedup signal
try {
  await db.insert(installs).values({ ... });
  // If we get here, row was inserted
  inserted = true;
} catch (e: any) {
  if (e.message?.includes('UNIQUE constraint')) {
    inserted = false;
  } else {
    throw e;
  }
}
```

This is less elegant but reliable across D1 versions.

## Todo List

- [x] Run `pnpm typecheck` in apps/web -- fix any errors
- [x] Run typecheck in packages/cli -- fix any errors
- [x] Review generated migration SQL for correct partial indexes
- [x] Test anonymous install (X-Device-Id only)
- [x] Test deduplication (same device, same skill)
- [x] Test install_count increment
- [x] Verify D1 `result.changes` behavior, apply fallback if needed

## Success Criteria

- Zero TypeScript errors in both packages
- Migration SQL contains correct partial unique indexes
- End-to-end: `POST /install` -> new row in installs -> install_count incremented -> score recomputed
- Dedup works: repeated install from same identity returns `{ installed: false }` and does NOT increment count
