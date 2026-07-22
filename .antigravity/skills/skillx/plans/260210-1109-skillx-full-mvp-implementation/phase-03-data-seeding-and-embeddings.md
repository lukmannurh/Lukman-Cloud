# Phase 3: Data Seeding + Embedding Pipeline

## Context Links
- [CF Vectorize + D1 report](../reports/researcher-260210-1113-cloudflare-vectorize-d1-semantic-search.md)
- [Workers AI embedding models](https://developers.cloudflare.com/workers-ai/models/)
- [Phase 1](./phase-01-scaffold-and-database.md)

## Overview
- **Priority:** P1 (Search requires seeded + embedded data)
- **Status:** Pending
- **Effort:** 10h
- **Week:** 1-2 (Day 4-6)
- **Depends on:** Phase 1

Build data import pipeline to seed skills into D1 + generate embeddings via Workers AI + upsert vectors to Vectorize. Creates the foundation for hybrid search.

## Key Insights
- Workers AI `bge-base-en-v1.5` (768-dim): 3000 req/min, free tier
- Vectorize upsert batch: 1000 vectors/batch (Workers binding)
- Chunk SKILL.md content: 512 tokens, 10% overlap, ~4 chunks/skill
- Metadata indexes must be created BEFORE inserting vectors
- FTS5 auto-synced via triggers from Phase 1

## Requirements

### Functional
- Script to import skills from JSON/CSV/GitHub source
- Text chunking (512 tokens, 10% overlap)
- Embedding generation via Workers AI
- Vectorize upsert with metadata
- FTS5 auto-populated via insert triggers
- Idempotent (re-runnable without duplicates)

### Non-functional
- Handle rate limits (3000 req/min for embeddings)
- Batch processing with progress logging
- Error recovery (resume from last success)

## Architecture

```
Import Pipeline:
  Source (JSON/GitHub)
    → Parse SKILL.md files
    → Insert into D1 `skills` table (triggers FTS5 sync)
    → Chunk content (512 tokens, 10% overlap)
    → Embed chunks via Workers AI (bge-base-en-v1.5)
    → Upsert vectors to Vectorize (batch of 1000)

Vectorize metadata per chunk:
  {
    skill_id: "skill_abc123",
    category: "implementation",
    is_paid: 0,
    avg_rating: 0,
    chunk_index: 0
  }
```

## Related Code Files

### Create
- `apps/web/app/lib/vectorize/chunk-text.ts` — text chunking utility
- `apps/web/app/lib/vectorize/embed-text.ts` — Workers AI embedding wrapper
- `apps/web/app/lib/vectorize/index-skill.ts` — full pipeline: chunk → embed → upsert
- `apps/web/app/routes/api.admin.seed.ts` — admin API endpoint for seeding
- `scripts/seed-data.json` — initial skills data (curated)
- `scripts/seed-skills.ts` — standalone seed script (calls admin endpoint)

### Modify
- `apps/web/wrangler.jsonc` — ensure AI + Vectorize bindings present

## Implementation Steps

### 1. Create Vectorize metadata indexes
Before any vector inserts:
```bash
npx wrangler vectorize create-metadata-index skillx-skills --property-name category --type string
npx wrangler vectorize create-metadata-index skillx-skills --property-name is_paid --type number
npx wrangler vectorize create-metadata-index skillx-skills --property-name avg_rating --type number
```

### 2. Build text chunker
```typescript
// apps/web/app/lib/vectorize/chunk-text.ts
interface Chunk {
  text: string;
  index: number;
}

export function chunkText(text: string, maxTokens = 512, overlapPercent = 0.1): Chunk[] {
  // Approximate: 1 token ≈ 4 chars
  const maxChars = maxTokens * 4;
  const overlapChars = Math.floor(maxChars * overlapPercent);
  const chunks: Chunk[] = [];
  let start = 0;
  let index = 0;

  while (start < text.length) {
    const end = Math.min(start + maxChars, text.length);
    chunks.push({ text: text.slice(start, end), index });
    start = end - overlapChars;
    index++;
    if (end === text.length) break;
  }
  return chunks;
}
```

### 3. Build embedding wrapper
```typescript
// apps/web/app/lib/vectorize/embed-text.ts
export async function embedTexts(ai: Ai, texts: string[]): Promise<number[][]> {
  const result = await ai.run('@cf/baai/bge-base-en-v1.5', {
    text: texts,
  });
  return result.data;
}
```

### 4. Build skill indexing pipeline
```typescript
// apps/web/app/lib/vectorize/index-skill.ts
import { chunkText } from './chunk-text';
import { embedTexts } from './embed-text';

export async function indexSkill(
  skill: Skill,
  ai: Ai,
  vectorize: VectorizeIndex
) {
  // Combine searchable content
  const fullText = `${skill.name}\n${skill.description}\n${skill.content}`;
  const chunks = chunkText(fullText);

  // Embed all chunks
  const embeddings = await embedTexts(ai, chunks.map(c => c.text));

  // Prepare vectors
  const vectors = chunks.map((chunk, i) => ({
    id: `skill_${skill.id}_chunk_${chunk.index}`,
    values: embeddings[i],
    metadata: {
      skill_id: skill.id,
      category: skill.category,
      is_paid: skill.is_paid ? 1 : 0,
      avg_rating: 0,
      chunk_index: chunk.index,
    },
  }));

  // Batch upsert (max 1000 per batch)
  for (let i = 0; i < vectors.length; i += 1000) {
    const batch = vectors.slice(i, i + 1000);
    await vectorize.upsert(batch);
  }

  return vectors.length;
}
```

### 5. Create seed data file
Curate 50-100 initial skills as JSON:
```json
[
  {
    "name": "commit",
    "slug": "commit",
    "description": "Git commit with conventional commits",
    "author": "claudekit",
    "source_url": "https://github.com/claudekit/commit-skill",
    "category": "devops",
    "content": "# Commit Skill\n\nAutomates git commits...",
    "install_command": "npx skills add claudekit/commit",
    "version": "1.0.0",
    "is_paid": false
  }
]
```

### 6. Create admin seed endpoint
```typescript
// apps/web/app/routes/api.admin.seed.ts
// Protected: only works with admin secret header
export async function action({ request, context }: ActionFunctionArgs) {
  const authHeader = request.headers.get('X-Admin-Secret');
  if (authHeader !== context.cloudflare.env.ADMIN_SECRET) {
    return new Response('Unauthorized', { status: 401 });
  }

  const skills = await request.json();
  const db = getDb(context.cloudflare.env.DB);

  let indexed = 0;
  for (const skill of skills) {
    // Insert into D1 (triggers FTS5 sync)
    await db.insert(skillsTable).values({
      id: crypto.randomUUID(),
      ...skill,
      created_at: Date.now(),
      updated_at: Date.now(),
    }).onConflictDoUpdate({
      target: skillsTable.slug,
      set: { ...skill, updated_at: Date.now() },
    });

    // Index in Vectorize
    const count = await indexSkill(
      skill,
      context.cloudflare.env.AI,
      context.cloudflare.env.VECTORIZE
    );
    indexed += count;
  }

  return Response.json({ skills: skills.length, vectors: indexed });
}
```

### 7. Create standalone seed script
```typescript
// scripts/seed-skills.ts
import seedData from './seed-data.json';

const API_URL = process.env.API_URL || 'http://localhost:5173';
const ADMIN_SECRET = process.env.ADMIN_SECRET;

async function seed() {
  const response = await fetch(`${API_URL}/api/admin/seed`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Secret': ADMIN_SECRET!,
    },
    body: JSON.stringify(seedData),
  });
  const result = await response.json();
  console.log('Seeded:', result);
}

seed().catch(console.error);
```

## Todo List
- [ ] Create Vectorize metadata indexes via wrangler CLI
- [ ] Build text chunking utility
- [ ] Build Workers AI embedding wrapper
- [ ] Build skill indexing pipeline (chunk → embed → upsert)
- [ ] Curate initial seed data (50-100 skills JSON)
- [ ] Create admin seed API endpoint
- [ ] Create standalone seed script
- [ ] Run seeding against local D1 + dev Vectorize
- [ ] Verify FTS5 populated via triggers
- [ ] Verify Vectorize vectors queryable

## Success Criteria
- 50+ skills in D1 with FTS5 indexed
- 200+ vectors in Vectorize (4 chunks/skill avg)
- `SELECT * FROM skills_fts WHERE skills_fts MATCH 'deploy'` returns results
- Vectorize query with embedding returns relevant skill chunks
- Seed script idempotent (re-run produces same state)

## Risk Assessment
- **Workers AI rate limits:** 3000 req/min for bge-base. 50 skills × 4 chunks = 200 embeddings → well within limits
- **Vectorize no local sim:** Must use `--remote` flag or dev Vectorize index
- **FTS5 trigger failures:** Silent — add logging to verify after seed

## Security Considerations
- Admin seed endpoint protected by secret header
- ADMIN_SECRET stored in CF secrets, not code
- Seed data should not contain sensitive info

## Next Steps
- Phase 4: Build hybrid search on top of seeded data
