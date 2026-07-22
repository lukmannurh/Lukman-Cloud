# Phase 1: Database Schema & Migration

## Context
- [Brainstorm report](../reports/brainstorm-260213-1218-phase-3-4-references-scripts.md)
- [Current schema](../../apps/web/app/lib/db/schema.ts)
- [Code standards](../../docs/code-standards.md)

## Overview
- **Priority:** P1 — blocks all other phases
- **Status:** Pending
- **Effort:** 2h

Add `references` and `scripts` JSON columns to skills table + create `skill_references` table for full reference content (needed for Vectorize indexing).

## Key Insights

- D1 supports JSON stored as TEXT — use JSON columns for metadata
- Separate `skill_references` table needed because Vectorize indexes reference content independently
- MUST use manual `ALTER TABLE` migration — Drizzle auto-gen recreates all tables (known issue from MEMORY.md)
- Current schema is 207 LOC — adding to it stays under 200 LOC limit if we put the new table in a separate module

## Architecture

### Data Model

**skills table** (new columns):
```
scripts TEXT  -- JSON: [{name, description, command, url}]
```

**skill_references table** (new):
```
id TEXT PK
skill_id TEXT FK → skills.id (cascade delete)
title TEXT NOT NULL
filename TEXT NOT NULL
url TEXT  -- raw GitHub URL
type TEXT  -- 'docs' | 'api' | 'guide' | 'cheatsheet'
content TEXT NOT NULL  -- full markdown content
created_at INTEGER (timestamp_ms)
```

**Why not a JSON column for references?**
- Reference content can be large (up to 150 lines each)
- Need to iterate over references for Vectorize embedding per-reference
- Separate table allows querying/filtering references independently
- Scripts are metadata-only (no content), so JSON column is fine

### Why `scripts` as JSON column?
- Script metadata is small: `{name, description, command, url}`
- Max 10 scripts per skill (validated at API level)
- Never queried/filtered independently
- No Vectorize indexing needed for script content

## Related Code Files

### Modify
- `apps/web/app/lib/db/schema.ts` — add `scripts` column to skills, add `skillReferences` table definition
- `apps/web/drizzle/` — new manual migration SQL file

### Create
- `apps/web/app/lib/db/skill-references-schema.ts` — if schema.ts exceeds 200 LOC, split into separate module

## Implementation Steps

1. **Add `scripts` and `fts_content` columns to skills table in schema.ts**
   <!-- Updated: Validation Session 1 - fts_content column added to same migration -->
   ```typescript
   scripts: text("scripts"),       // JSON: [{name, command, url}]
   fts_content: text("fts_content"), // Computed: content + ref titles (for FTS5 only)
   ```

2. **Define `skillReferences` table in schema.ts** (or new file if >200 LOC)
   ```typescript
   export const skillReferences = sqliteTable("skill_references", {
     id: text("id").primaryKey(),
     skill_id: text("skill_id").notNull()
       .references(() => skills.id, { onDelete: "cascade" }),
     title: text("title").notNull(),
     filename: text("filename").notNull(),
     url: text("url"),
     type: text("type"),  // docs, api, guide, cheatsheet
     content: text("content").notNull(),
     created_at: integer("created_at", { mode: "timestamp_ms" }).notNull(),
   }, (table) => [
     index("idx_skill_refs_skill").on(table.skill_id),
   ]);
   ```

3. **Write manual D1 migration** (NOT drizzle auto-generate)
   ```sql
   -- Add scripts + fts_content columns to skills
   ALTER TABLE skills ADD COLUMN scripts TEXT;
   ALTER TABLE skills ADD COLUMN fts_content TEXT;

   -- Create skill_references table
   CREATE TABLE IF NOT EXISTS skill_references (
     id TEXT PRIMARY KEY,
     skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
     title TEXT NOT NULL,
     filename TEXT NOT NULL,
     url TEXT,
     type TEXT,
     content TEXT NOT NULL,
     created_at INTEGER NOT NULL
   );

   CREATE INDEX IF NOT EXISTS idx_skill_refs_skill ON skill_references(skill_id);

   -- Unique constraint: prevent duplicate references per skill
   <!-- Red Team: Duplicate references — missing unique constraint — 2026-02-13 -->
   CREATE UNIQUE INDEX IF NOT EXISTS idx_skill_refs_unique ON skill_references(skill_id, filename);
   ```

4. **Apply migration locally**
   ```bash
   cd apps/web && pnpm wrangler d1 migrations apply skillx-db --local
   ```

5. **Apply migration to production**
   ```bash
   cd apps/web && pnpm wrangler d1 migrations apply skillx-db --remote
   ```

6. **Export TypeScript types** for the new table/column
   - Ensure `Skill` type includes `scripts: string | null`
   - Export `SkillReference` type from schema

## Todo List

- [ ] Add `scripts` TEXT column to skills table in Drizzle schema
- [ ] Define `skillReferences` table in Drizzle schema
- [ ] Write manual SQL migration file (includes unique constraint on skill_id+filename)
- [ ] Apply migration locally and verify
- [ ] Apply migration to production D1
- [ ] Verify remote migration: `SELECT * FROM skill_references LIMIT 1;`
- [ ] Verify types compile: `pnpm typecheck`

## Success Criteria

- `scripts` column exists on skills table (nullable TEXT)
- `skill_references` table created with proper FK and index
- Both local and production D1 have the new schema
- TypeScript types updated and typecheck passes
- No existing data affected by migration

## Risk Assessment

- **Migration breaks existing data**: LOW — ALTER TABLE ADD COLUMN is safe, new table is additive
- **Drizzle ORM mismatch**: MEDIUM — Must ensure Drizzle schema matches actual D1 schema after manual migration. Run `pnpm db:generate` to verify no drift.
- **Schema file too large**: LOW — If schema.ts exceeds 200 LOC, split `skillReferences` into separate file

## Security Considerations

- JSON columns validated at API level (max 10 scripts, max 20 references)
- Reference content sanitized (no script tags in markdown)
- FK cascade delete ensures orphan cleanup
