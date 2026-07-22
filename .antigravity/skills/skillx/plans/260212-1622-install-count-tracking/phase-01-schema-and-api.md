# Phase 1: Schema Migration + API Route

## Context

- [Brainstorm report](../reports/brainstorm-260212-1617-install-count-tracking.md)
- Schema: `apps/web/app/lib/db/schema.ts`
- Routes: `apps/web/app/routes.ts`
- API key auth pattern: `apps/web/app/routes/api.usage-report.ts`
- Score recompute: `apps/web/app/lib/leaderboard/recompute-skill-scores.ts`

## Overview

- **Priority:** P2
- **Status:** complete
- **Effort:** S
- Add `installs` table to Drizzle schema, generate migration, create API route

## Key Insights

- Existing pattern: `ratings` table uses `uniqueIndex` on `(user_id, skill_id)` for dedup
- `installs` needs TWO partial unique indexes (user_id when not null, device_id when not null) because SQLite treats NULL != NULL in unique constraints
- API key auth pattern from `api.usage-report.ts`: prefix lookup -> hash verify -> get user_id
- `recomputeSkillScores(db, skillId)` already reads `install_count` from skills table

## Requirements

### Functional
- `installs` table with columns: id, skill_id, user_id (nullable), device_id (nullable), created_at
- Partial unique index on `(skill_id, user_id)` where user_id is not null
- Partial unique index on `(skill_id, device_id)` where device_id is not null
- `POST /api/skills/:slug/install` endpoint
- Accept auth via API key OR X-Device-Id header
- Deduplicate: ON CONFLICT DO NOTHING
- Increment `install_count` only on new installs

### Non-functional
- Idempotent -- repeated calls for same user/device/skill are no-ops
- No auth friction -- anonymous installs allowed via device_id

## Related Code Files

### Modify
- `apps/web/app/lib/db/schema.ts` -- add `installs` table definition
- `apps/web/app/routes.ts` -- add install route entry

### Create
- `apps/web/app/routes/api.skill-install.ts` -- install endpoint

## Implementation Steps

### 1. Add `installs` table to schema.ts

Insert after `usageStats` table (line ~113), before Better Auth tables.

```typescript
// Installs - deduplicated install tracking per user/device
export const installs = sqliteTable(
  "installs",
  {
    id: text("id").primaryKey(),
    skill_id: text("skill_id")
      .notNull()
      .references(() => skills.id, { onDelete: "cascade" }),
    user_id: text("user_id"),
    device_id: text("device_id"),
    created_at: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("idx_installs_skill").on(table.skill_id),
    uniqueIndex("idx_installs_user").on(table.skill_id, table.user_id)
      .where(sql`user_id IS NOT NULL`),
    uniqueIndex("idx_installs_device").on(table.skill_id, table.device_id)
      .where(sql`device_id IS NOT NULL`),
  ]
);
```

**Note:** Import `sql` from `drizzle-orm` for the `.where()` clause on indexes. Check if `sql` is already imported; if not, add it.

### 2. Generate Drizzle migration

```bash
cd apps/web && pnpm db:generate
```

Review generated SQL to confirm partial unique indexes use `WHERE user_id IS NOT NULL` syntax.

### 3. Add route to routes.ts

Insert before the `api/report` line (line 19):

```typescript
route("api/skills/:slug/install", "routes/api.skill-install.ts"),
```

### 4. Create `api.skill-install.ts`

File: `apps/web/app/routes/api.skill-install.ts`

Structure (follow `api.usage-report.ts` pattern):

```typescript
import type { ActionFunctionArgs } from "react-router";
import { getDb } from "~/lib/db";
import { skills, installs, apiKeys } from "~/lib/db/schema";
import { eq, and, isNull, sql } from "drizzle-orm";
import { verifyApiKey } from "~/lib/auth/api-key-utils";
import { recomputeSkillScores } from "~/lib/leaderboard/recompute-skill-scores";

export async function action({ request, params, context }: ActionFunctionArgs) {
  try {
    if (request.method !== "POST") {
      return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    const slug = params.slug;
    if (!slug) {
      return Response.json({ error: "Skill slug required" }, { status: 400 });
    }

    const env = context.cloudflare.env as Env;
    const db = getDb(env.DB);

    // --- Resolve identity ---
    let userId: string | null = null;
    const deviceId = request.headers.get("X-Device-Id");
    const authHeader = request.headers.get("Authorization");

    if (authHeader?.startsWith("Bearer ")) {
      const apiKeyPlaintext = authHeader.substring(7);
      const prefix = apiKeyPlaintext.substring(0, 8);
      const [foundKey] = await db
        .select()
        .from(apiKeys)
        .where(and(eq(apiKeys.key_prefix, prefix), isNull(apiKeys.revoked_at)))
        .limit(1);

      if (foundKey) {
        const isValid = await verifyApiKey(apiKeyPlaintext, foundKey.key_hash);
        if (isValid) {
          userId = foundKey.user_id;
          // Update last_used_at
          await db.update(apiKeys)
            .set({ last_used_at: Date.now() })
            .where(eq(apiKeys.id, foundKey.id));
        }
      }
    }

    // Need at least one identifier
    if (!userId && !deviceId) {
      return Response.json(
        { error: "Authorization header or X-Device-Id required" },
        { status: 400 }
      );
    }

    // --- Find skill ---
    const [skill] = await db
      .select()
      .from(skills)
      .where(eq(skills.slug, slug))
      .limit(1);

    if (!skill) {
      return Response.json({ error: "Skill not found" }, { status: 404 });
    }

    // --- Insert install (ON CONFLICT DO NOTHING) ---
    const installId = `inst-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    const result = await db
      .insert(installs)
      .values({
        id: installId,
        skill_id: skill.id,
        user_id: userId,
        device_id: deviceId,
        created_at: Date.now(),
      })
      .onConflictDoNothing();

    // Check if row was actually inserted
    // D1 returns rowsAffected / changes on the result
    const inserted = (result as any).changes > 0 || (result as any).rowsWritten > 0;

    if (inserted) {
      // Atomic increment
      await db
        .update(skills)
        .set({
          install_count: sql`install_count + 1`,
          updated_at: Date.now(),
        })
        .where(eq(skills.id, skill.id));

      await recomputeSkillScores(db, skill.id);
    }

    return Response.json({ installed: inserted });
  } catch (error) {
    console.error("Error tracking install:", error);
    return Response.json({ error: "Failed to track install" }, { status: 500 });
  }
}
```

**Important implementation notes:**

1. **Checking affected rows:** Drizzle + D1 returns a result object. Need to verify exact property name for "rows affected" -- check Drizzle D1 docs. May be `result.rowsAffected`, `result.meta.changes`, or similar. Test during Phase 3.

2. **Auth is optional but lenient:** Invalid API keys are silently ignored (falls through to device_id check). This is intentional -- don't block install tracking on bad auth.

3. **Both user_id and device_id sent:** When user has API key, both are set. Dedup happens on user_id index. The device_id is also stored for analytics but dedup is on user_id.

## Todo List

- [x] Add `sql` import to schema.ts if not present
- [x] Add `installs` table to schema.ts
- [x] Run `pnpm db:generate` and verify migration SQL
- [x] Add route to routes.ts
- [x] Create `api.skill-install.ts`
- [x] Verify file stays under 200 LOC

## Success Criteria

- Migration generates correct SQL with partial unique indexes
- `POST /api/skills/:slug/install` returns `{ installed: true }` for new install
- Repeated POST returns `{ installed: false }`
- `install_count` increments only on first install per user/device

## Risk Assessment

- **Drizzle partial unique index support:** `.where()` on index builder is supported since Drizzle 0.29+. If not available, fall back to raw SQL in migration and skip Drizzle index definition.
- **D1 rowsAffected property:** Exact API may vary. Fallback: query the installs table after insert to check if the ID exists (less elegant but reliable).
