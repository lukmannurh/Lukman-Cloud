# Phase 4: API & Search Updates

## Context
- [Skill detail endpoint](../../apps/web/app/routes/api.skill-detail.ts)
- [Skill detail queries](../../apps/web/app/lib/db/skill-detail-queries.ts)
- [FTS5 search](../../apps/web/app/lib/search/fts5-search.ts)
- [Hybrid search](../../apps/web/app/lib/search/hybrid-search.ts)

## Overview
- **Priority:** P1 — API must serve data before UI/CLI can consume it
- **Status:** Pending
- **Effort:** 2h
- **Depends on:** Phase 3 (data must exist in DB)

Update skill detail API to return references + scripts. Add reference titles to FTS5 for keyword search boost.

## Key Insights

- Skill detail endpoint already runs 6 parallel queries — adding 1 more for references is fine
- Scripts are on the skills row (JSON column), so no extra query needed
- FTS5 currently indexes `name || description || content` — add reference titles to improve keyword discovery
- Vector search already picks up reference content (Phase 3 indexes it in Vectorize)
- No changes needed to RRF fusion or boost scoring — references are just more vectors with `skill_id` metadata

## Architecture

### API Response (Updated)

```json
{
  "skill": { "...existing fields", "scripts": "[{...}]" },
  "references": [
    { "id": "uuid", "title": "MongoDB CRUD", "filename": "mongodb-crud.md", "type": "docs", "url": "..." }
  ],
  "scripts": [
    { "name": "db_migrate", "description": "Generate migrations", "command": "python scripts/db_migrate.py", "url": "..." }
  ],
  "reviews": [...],
  "...rest"
}
```

Note: `references` in API response excludes `content` field (too large). Content available via raw GitHub URL or separate endpoint.

### FTS5 Update

<!-- Red Team: FTS5 ref titles — contradictory, clarified — 2026-02-13 -->

<!-- Updated: Validation Session 1 - Use fts_content column, not content mutation -->
**Decision:** Use separate `fts_content` column (added in Phase 1 migration). Populated at seed time (Phase 3, step 7).
- Stored SKILL.md `content` stays pure for display
- `fts_content` = content + reference titles (FTS5 only)
- FTS5 search should use `COALESCE(fts_content, content)` for indexing
- Only skills with references get `fts_content` populated
- Minor FTS5 code change needed: update INSERT to use fts_content

## Related Code Files

### Modify
- `apps/web/app/routes/api.skill-detail.ts` — return references + parsed scripts
- `apps/web/app/lib/db/skill-detail-queries.ts` — add `fetchSkillReferences()` query

### Reference (no changes)
- `apps/web/app/lib/search/fts5-search.ts` — no changes (ref titles handled at seed time)
- `apps/web/app/lib/search/hybrid-search.ts` — no changes (Vectorize already indexes refs)

## Implementation Steps

1. **Add `fetchSkillReferences()` query**
   ```typescript
   // In skill-detail-queries.ts
   export async function fetchSkillReferences(
     db: DrizzleDb,
     skillId: string
   ) {
     return db.select({
       id: skillReferences.id,
       title: skillReferences.title,
       filename: skillReferences.filename,
       url: skillReferences.url,
       type: skillReferences.type,
     })
     .from(skillReferences)
     .where(eq(skillReferences.skill_id, skillId))
     .orderBy(skillReferences.title);
   }
   ```

2. **Update skill detail loader** to include references
   ```typescript
   // In api.skill-detail.ts loader
   const [skill, reviews, ..., references] = await Promise.all([
     fetchSkillBySlug(db, slug),
     fetchSkillReviews(db, skillId),
     // ...existing queries
     fetchSkillReferences(db, skillId),
   ]);
   ```

3. **Parse scripts JSON** in API response
   ```typescript
   // Parse scripts from JSON string
   const parsedScripts = skill.scripts ? JSON.parse(skill.scripts) : [];

   return {
     skill,
     references,
     scripts: parsedScripts,
     // ...existing
   };
   ```

4. **Update skill detail page loader** (SSR) to pass references + scripts to component
   ```typescript
   // In routes/skill-detail.tsx loader
   const references = await fetchSkillReferences(db, skill.id);
   const scripts = skill.scripts ? JSON.parse(skill.scripts) : [];

   return {
     // ...existing
     references,
     scripts,
   };
   ```

5. **Add reference titles to FTS5 at seed time** (in Phase 3 seed endpoint)
   - After inserting references, build a title string:
     ```typescript
     const refTitles = (skillData.references || []).map(r => r.title).join(' ');
     ```
   - Append to the content used for FTS5 indexing (not stored content)
   - This is handled in the FTS5 INSERT during seed, not in search code

## Todo List

- [ ] Add `fetchSkillReferences()` to skill-detail-queries.ts
- [ ] Update api.skill-detail.ts to return references (metadata only, no content)
- [ ] Parse scripts JSON in API response
- [ ] Update skill-detail.tsx loader to pass references + scripts to component
- [ ] Verify API response with test skill that has references
- [ ] Verify search ranking with reference-enriched content

## Success Criteria

- `GET /api/skills/:slug` returns `references` array (title, filename, type, url)
- `GET /api/skills/:slug` returns `scripts` array (name, description, command, url)
- Reference content NOT included in API response (too large)
- Skill detail page loader provides references + scripts to component
- No performance regression on skill detail endpoint (<200ms target)

## Risk Assessment

- **Extra query latency**: LOW — single indexed query on skill_id, runs in parallel with existing queries
- **Large scripts JSON**: LOW — max 10 scripts, each ~100 bytes metadata
- **FTS5 reindex needed**: MEDIUM — existing skills need FTS5 reindex to include ref titles. Can be done as batch operation.

## Security Considerations

- Reference content excluded from public API (only metadata)
- Scripts URLs point to public GitHub repos only
- JSON parsing uses try/catch to handle malformed data
