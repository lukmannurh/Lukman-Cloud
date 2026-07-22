# Phase 3: Seed Pipeline & Vectorize Integration

## Context
- [Current seed endpoint](../../apps/web/app/routes/api.admin.seed.ts)
- [Current index-skill](../../apps/web/app/lib/vectorize/index-skill.ts)
- [Seed script](../../scripts/seed-skills.mjs)

## Overview
- **Priority:** P1 — populates DB with references/scripts data
- **Status:** Pending
- **Effort:** 3h
- **Depends on:** Phase 1 (schema), Phase 2 (enriched batch data)

Update seed endpoint + script to accept and store references/scripts. Index reference content in Vectorize for semantic search.

## Key Insights

- Current seed endpoint processes skill data one-by-one in a loop
- `indexSkill()` combines name + description + content → chunks → embeds → upserts to Vectorize
- References should be indexed separately per-reference (distinct vector IDs) so search can identify which reference matched
- Scripts are metadata-only — no Vectorize indexing needed
- Workers AI rate limit: ~3,700 embeddings before potential throttle. References add more embeddings per skill.
- Use `?skip_vectors=true` to seed D1 first, backfill Vectorize later

## Architecture

### Seed Flow (Updated)

```
Seed endpoint receives skill + references + scripts
  ↓
1. Upsert skill to D1 (including scripts JSON)
  ↓
2. For each reference:
   - Upsert to skill_references table
   - Index in Vectorize (if not skip_vectors)
  ↓
3. Index skill content in Vectorize (existing behavior)
```

### Vectorize ID Scheme

```
Skill content:    skill_{id}_chunk_{N}         (existing)
Reference:        ref_{skill_id}_{filename}_chunk_{N}  (new)
```

Metadata for reference vectors:
```json
{
  "skill_id": "uuid",
  "category": "implementation",
  "is_paid": 0,
  "avg_rating": 8.5,
  "chunk_index": 0,
  "type": "reference",
  "ref_filename": "mongodb-crud.md"
}
```

## Related Code Files

### Modify
- `apps/web/app/routes/api.admin.seed.ts` — accept references/scripts in payload, write to DB
- `apps/web/app/lib/vectorize/index-skill.ts` — add `indexReference()` function
- `scripts/seed-skills.mjs` — send references/scripts from enriched batch files

### Create
- `apps/web/app/lib/vectorize/index-reference.ts` — reference-specific Vectorize indexing

## Implementation Steps

1. **Update `SkillInput` interface in seed endpoint**
   ```typescript
   interface SkillInput {
     // ... existing fields
     scripts?: string; // JSON string: [{name, description, command, url}]
     references?: Array<{
       title: string;
       filename: string;
       url?: string;
       type?: string;
       content: string;
     }>;
   }
   ```

2. **Update skill upsert to include scripts**
   ```typescript
   .values({
     // ... existing
     scripts: skillData.scripts || null,
   })
   .onConflictDoUpdate({
     // ... existing
     set: { scripts: skillData.scripts || null, /* ...rest */ },
   })
   ```

3. **Add reference upsert after skill insert**
   ```typescript
   if (skillData.references?.length) {
     for (const ref of skillData.references) {
       await db.insert(skillReferences).values({
         id: crypto.randomUUID(),
         skill_id: skillId,
         title: ref.title,
         filename: ref.filename,
         url: ref.url || null,
         type: ref.type || 'docs',
         content: ref.content,
         created_at: now,
       }).onConflictDoNothing(); // skip duplicates
     }
   }
   ```

4. **Create `index-reference.ts`** — titles + first paragraph only
   <!-- Updated: Validation Session 1 - Index titles+first-paragraph, not full content (~200K vectors vs 2M) -->
   ```typescript
   export async function indexReference(
     vectorize: VectorizeIndex,
     ai: Ai,
     ref: {
       skill_id: string;
       filename: string;
       content: string;
       category: string;
       is_paid: boolean;
       avg_rating: number;
     }
   ): Promise<number> {
     // Index title + first paragraph only (validated: 80% search value, 20% vector cost)
     const firstParagraph = ref.content.split('\n\n').slice(0, 2).join('\n\n');
     const fullText = `${ref.filename}\n\n${firstParagraph}`;
     const chunks = chunkText(fullText, 512, 0.1); // Usually 1-2 chunks max
     const embeddings = await embedTexts(ai, chunks.map(c => c.text));

     // Sanitize filename for vector ID (remove .md, replace non-alphanum)
     const safeName = ref.filename.replace(/\.md$/, '').replace(/[^a-z0-9_-]/gi, '_');

     const vectors = embeddings.map((emb, idx) => ({
       id: `ref_${ref.skill_id}_${safeName}_chunk_${chunks[idx].index}`,
       values: emb,
       metadata: {
         skill_id: ref.skill_id,
         category: ref.category,
         is_paid: ref.is_paid ? 1 : 0,
         avg_rating: ref.avg_rating,
         chunk_index: chunks[idx].index,
         type: 'reference',
         ref_filename: ref.filename,
       },
     }));

     // Batch upsert
     for (let i = 0; i < vectors.length; i += 1000) {
       await vectorize.upsert(vectors.slice(i, i + 1000));
     }
     return vectors.length;
   }
   ```

5. **Call `indexReference()` in seed endpoint** (after skill indexing)
   ```typescript
   if (!skipVectors && skillData.references?.length) {
     for (const ref of skillData.references) {
       try {
         vectorCount += await indexReference(env.VECTORIZE, env.AI, {
           skill_id: skillId,
           filename: ref.filename,
           content: ref.content,
           category: skillData.category,
           is_paid: skillData.is_paid || false,
           avg_rating: skillData.avg_rating || 0,
         });
       } catch (e) {
         console.warn(`Vectorize ref skipped: ${ref.filename}`, e);
       }
     }
   }
   ```

6. **Update seed script** to include references/scripts from enriched batch files
   <!-- Red Team: Seed scripts JSON stringification gap — 2026-02-13 -->
   ```javascript
   // In seed script, before sending payload:
   const payload = batchSkills.map(skill => ({
     ...skill,
     scripts: skill.scripts ? JSON.stringify(skill.scripts) : null, // MUST stringify
     // references stay as array — endpoint parses them
   }));
   ```

7. **Populate `fts_content` column for FTS5 indexing**
   <!-- Updated: Validation Session 1 - Use fts_content column instead of mutating content -->
   ```typescript
   // Compute fts_content = original content + ref titles (for FTS5 only)
   if (skillData.references?.length) {
     const refTitles = skillData.references.map(r => r.title).join(' ');
     const ftsContent = `${skillData.content}\n\n${refTitles}`;
     await db.update(skills)
       .set({ fts_content: ftsContent })
       .where(eq(skills.slug, skillData.slug));
   }
   ```
   Note: FTS5 virtual table should index `fts_content` (when available) instead of `content`.

8. **Validate reference URLs match GitHub pattern**
   <!-- Red Team: SSRF via unvalidated URL — 2026-02-13 -->
   ```typescript
   const GITHUB_URL_PATTERN = /^https:\/\/(raw\.githubusercontent\.com|github\.com)\//;
   function validateRefUrl(url: string | null): string | null {
     if (!url) return null;
     return GITHUB_URL_PATTERN.test(url) ? url : null;
   }
   ```

9. **Unique constraint** — already in Phase 1 migration (moved per red team)

## Todo List

- [ ] Update SkillInput interface with references/scripts
- [ ] Add scripts column to skill upsert in seed endpoint
- [ ] Add reference upsert logic with URL validation
- [ ] Create `index-reference.ts` for Vectorize embedding
- [ ] Wire indexReference into seed endpoint
- [ ] Add FTS5 ref titles appending step
- [ ] Update seed script with JSON.stringify for scripts
- [ ] Check Vectorize quota before full rollout (calculate: skills × refs × chunks)
- [ ] Progressive indexing: seed top 1K skills first, verify vector count
- [ ] Test with single batch: `--file=1 --batch=5`
- [ ] Verify Vectorize contains reference vectors

## Success Criteria

- Seed endpoint accepts and stores references in `skill_references` table
- Seed endpoint stores scripts as JSON in skills.scripts column
- Reference content indexed in Vectorize with `type: 'reference'` metadata
- Re-seeding same skill doesn't create duplicate references
- `skip_vectors=true` skips reference embedding too
- Seed script reads enriched batch files and sends full payload

## Risk Assessment

- **Workers AI rate limit**: HIGH — each reference adds embeddings. A skill with 5 references × 3 chunks = 15 extra embeddings. Mitigate: `--batch=5` when refs included, `--skip-vectors` fallback.
- **Vectorize capacity**: HIGH — 133K skills × 5 refs avg × 3 chunks = 2M new vectors. Check Vectorize tier limits before full rollout. Progressive indexing: top 1K skills first, measure, then expand.
- **Seed timeout**: MEDIUM — more DB writes per skill. Mitigate: batch size reduction.
- **D1 row limits**: LOW — 10M row limit, references are bounded (max 20 per skill).

## Security Considerations

- Reference content sanitized (strip HTML tags in markdown)
- Scripts stored as metadata only — no execution on server
- Admin secret required for seed endpoint (existing)
