# Phase 4: Hybrid Search Engine

## Context Links
- [CF Vectorize + D1 report](../reports/researcher-260210-1113-cloudflare-vectorize-d1-semantic-search.md)
- [Brainstorm: search pipeline](../reports/brainstorm-260210-1109-skillx-full-architecture.md)
- [Phase 3](./phase-03-data-seeding-and-embeddings.md)

## Overview
- **Priority:** P1 (Core differentiator — the product IS the search)
- **Status:** Pending
- **Effort:** 14h
- **Week:** 2 (Day 1-3)
- **Depends on:** Phase 3 (seeded data + vectors required)

Build hybrid search combining D1 FTS5 (BM25 keyword matching) + Vectorize (semantic search) + Reciprocal Rank Fusion (RRF). This is the most complex and critical phase.

## Key Insights
- FTS5 BM25 catches exact keywords, proper nouns, technical terms
- Vectorize catches semantic similarity, paraphrases, concepts
- RRF merges both by rank position: `score = Σ 1/(k + rank)` where k=60
- Boosting: favorites weight, usage count, avg rating
- Vectorize topK limit: 20 with metadata, 100 without
- FTS5 query: `MATCH 'query terms'` with `bm25()` scoring

## Requirements

### Functional
- Semantic search via Vectorize (embed query → find similar vectors)
- Keyword search via FTS5 (BM25 ranking)
- RRF fusion of both result sets
- Boost scoring by rating, usage, favorites
- Category/filter support via Vectorize metadata filtering
- Search API endpoint: `POST /api/search`
- Returns: skill_id, name, slug, description, score, category, rating

### Non-functional
- Search latency: <200ms p95 (Vectorize ~30ms + D1 FTS5 ~10ms + fusion)
- Handle empty results gracefully
- Degrade gracefully if Vectorize unavailable (fallback to FTS5 only)

## Architecture

```
POST /api/search { query: "deploy cloudflare", filters?: { category, is_paid } }
    │
    ├──▶ [1] Embed query via Workers AI (bge-base-en-v1.5)
    │         → 768-dim vector
    │
    ├──▶ [2a] Vectorize.query(embedding, { topK: 20, filter, returnMetadata })
    │         → semantic results [{ id, score, metadata: { skill_id } }]
    │
    ├──▶ [2b] D1 FTS5: SELECT skill_id, bm25(skills_fts) FROM skills_fts
    │         WHERE skills_fts MATCH ? ORDER BY bm25(skills_fts) LIMIT 20
    │         → keyword results [{ skill_id, bm25_score }]
    │
    ├──▶ [3] Reciprocal Rank Fusion
    │         For each unique skill_id across both lists:
    │           rrf_score = 1/(60 + semantic_rank) + 1/(60 + keyword_rank)
    │         Sort by rrf_score descending
    │
    ├──▶ [4] Boost scoring
    │         final = rrf * 0.6 + rating * 0.2 + usage * 0.1 + fav_boost * 0.1
    │
    └──▶ [5] Fetch full skill data from D1
              JOIN ratings aggregation
              Return top N results
```

## Related Code Files

### Create
- `apps/web/app/lib/search/hybrid-search.ts` — main search orchestrator
- `apps/web/app/lib/search/fts5-search.ts` — D1 FTS5 keyword search
- `apps/web/app/lib/search/vector-search.ts` — Vectorize semantic search
- `apps/web/app/lib/search/rrf-fusion.ts` — Reciprocal Rank Fusion
- `apps/web/app/lib/search/boost-scoring.ts` — rating/usage/favorites boost
- `apps/web/app/routes/api.search.ts` — search API endpoint

### Modify
- `apps/web/app/lib/vectorize/embed-text.ts` — reuse for query embedding

## Implementation Steps

### 1. Build FTS5 search module
```typescript
// apps/web/app/lib/search/fts5-search.ts
interface FTS5Result {
  skill_id: string;
  bm25_score: number;
  rank: number;
}

export async function fts5Search(
  db: D1Database,
  query: string,
  limit = 20
): Promise<FTS5Result[]> {
  // Escape FTS5 special chars, split into terms
  const sanitized = query.replace(/[^\w\s]/g, '').trim();
  if (!sanitized) return [];

  const stmt = db.prepare(`
    SELECT s.id as skill_id, bm25(skills_fts) as bm25_score
    FROM skills_fts
    JOIN skills s ON skills_fts.rowid = s.rowid
    WHERE skills_fts MATCH ?
    ORDER BY bm25(skills_fts)
    LIMIT ?
  `);

  const results = await stmt.bind(sanitized, limit).all<{ skill_id: string; bm25_score: number }>();
  return (results.results || []).map((r, i) => ({
    ...r,
    rank: i + 1,
  }));
}
```

### 2. Build Vectorize search module
```typescript
// apps/web/app/lib/search/vector-search.ts
import { embedTexts } from '../vectorize/embed-text';

interface VectorResult {
  skill_id: string;
  similarity_score: number;
  rank: number;
}

interface SearchFilters {
  category?: string;
  is_paid?: boolean;
}

export async function vectorSearch(
  ai: Ai,
  vectorize: VectorizeIndex,
  query: string,
  filters?: SearchFilters,
  topK = 20
): Promise<VectorResult[]> {
  const [embedding] = await embedTexts(ai, [query]);

  const filter: Record<string, unknown> = {};
  if (filters?.category) filter.category = filters.category;
  if (filters?.is_paid !== undefined) filter.is_paid = filters.is_paid ? 1 : 0;

  const results = await vectorize.query(embedding, {
    topK,
    filter: Object.keys(filter).length > 0 ? filter : undefined,
    returnMetadata: 'all',
  });

  // Deduplicate by skill_id (multiple chunks per skill)
  const skillScores = new Map<string, number>();
  for (const match of results.matches) {
    const skillId = match.metadata?.skill_id as string;
    const existing = skillScores.get(skillId) || 0;
    skillScores.set(skillId, Math.max(existing, match.score));
  }

  // Sort by score, assign ranks
  return Array.from(skillScores.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([skill_id, score], i) => ({
      skill_id,
      similarity_score: score,
      rank: i + 1,
    }));
}
```

### 3. Build RRF fusion
```typescript
// apps/web/app/lib/search/rrf-fusion.ts
interface RRFResult {
  skill_id: string;
  rrf_score: number;
  semantic_rank: number | null;
  keyword_rank: number | null;
}

const K = 60; // RRF constant

export function reciprocalRankFusion(
  semanticResults: { skill_id: string; rank: number }[],
  keywordResults: { skill_id: string; rank: number }[]
): RRFResult[] {
  const scores = new Map<string, RRFResult>();

  for (const r of semanticResults) {
    scores.set(r.skill_id, {
      skill_id: r.skill_id,
      rrf_score: 1 / (K + r.rank),
      semantic_rank: r.rank,
      keyword_rank: null,
    });
  }

  for (const r of keywordResults) {
    const existing = scores.get(r.skill_id);
    if (existing) {
      existing.rrf_score += 1 / (K + r.rank);
      existing.keyword_rank = r.rank;
    } else {
      scores.set(r.skill_id, {
        skill_id: r.skill_id,
        rrf_score: 1 / (K + r.rank),
        semantic_rank: null,
        keyword_rank: r.rank,
      });
    }
  }

  return Array.from(scores.values()).sort((a, b) => b.rrf_score - a.rrf_score);
}
```

### 4. Build boost scoring
```typescript
// apps/web/app/lib/search/boost-scoring.ts
interface SkillStats {
  avg_rating: number;    // 0-10
  usage_count: number;
  is_favorited: boolean; // by current user
}

interface BoostedResult {
  skill_id: string;
  final_score: number;
  rrf_score: number;
}

export function applyBoostScoring(
  rrfResults: { skill_id: string; rrf_score: number }[],
  statsMap: Map<string, SkillStats>,
  maxUsage: number
): BoostedResult[] {
  return rrfResults.map(r => {
    const stats = statsMap.get(r.skill_id) || { avg_rating: 0, usage_count: 0, is_favorited: false };

    const normalizedRating = stats.avg_rating / 10;
    const normalizedUsage = maxUsage > 0 ? stats.usage_count / maxUsage : 0;
    const favBoost = stats.is_favorited ? 1 : 0;

    const final_score =
      r.rrf_score * 0.6 +
      normalizedRating * 0.2 +
      normalizedUsage * 0.1 +
      favBoost * 0.1;

    return { skill_id: r.skill_id, final_score, rrf_score: r.rrf_score };
  }).sort((a, b) => b.final_score - a.final_score);
}
```

### 5. Build main search orchestrator
```typescript
// apps/web/app/lib/search/hybrid-search.ts
import { fts5Search } from './fts5-search';
import { vectorSearch } from './vector-search';
import { reciprocalRankFusion } from './rrf-fusion';
import { applyBoostScoring } from './boost-scoring';

export interface SearchParams {
  query: string;
  category?: string;
  is_paid?: boolean;
  userId?: string; // for favorites boost
  limit?: number;
}

export interface SearchResult {
  skill: Skill;
  score: number;
  avg_rating: number;
  usage_count: number;
}

export async function hybridSearch(
  params: SearchParams,
  env: Env
): Promise<SearchResult[]> {
  const { query, category, is_paid, userId, limit = 20 } = params;
  const db = env.DB;

  // Run semantic + keyword search in parallel
  const [semanticResults, keywordResults] = await Promise.all([
    vectorSearch(env.AI, env.VECTORIZE, query, { category, is_paid }),
    fts5Search(db, query),
  ]);

  // Fuse results
  const fused = reciprocalRankFusion(semanticResults, keywordResults);

  // Fetch stats for boosting
  const skillIds = fused.map(r => r.skill_id);
  const statsMap = await fetchSkillStats(db, skillIds, userId);
  const maxUsage = Math.max(...Array.from(statsMap.values()).map(s => s.usage_count), 1);

  // Apply boost
  const boosted = applyBoostScoring(fused, statsMap, maxUsage);

  // Fetch full skill data for top results
  const topIds = boosted.slice(0, limit).map(r => r.skill_id);
  const skills = await fetchSkills(db, topIds);

  return boosted.slice(0, limit).map(r => ({
    skill: skills.get(r.skill_id)!,
    score: r.final_score,
    avg_rating: statsMap.get(r.skill_id)?.avg_rating || 0,
    usage_count: statsMap.get(r.skill_id)?.usage_count || 0,
  })).filter(r => r.skill);
}
```

### 6. Create search API endpoint
```typescript
// apps/web/app/routes/api.search.ts
export async function action({ request, context }: ActionFunctionArgs) {
  // Validate API key from Authorization header
  const apiKey = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!apiKey) return Response.json({ error: 'API key required' }, { status: 401 });

  const keyHash = await hashApiKey(apiKey);
  const validKey = await db.query.apiKeys.findFirst({
    where: eq(apiKeys.key_hash, keyHash),
  });
  if (!validKey || validKey.revoked_at) {
    return Response.json({ error: 'Invalid API key' }, { status: 401 });
  }

  // Parse search params
  const { query, category, is_paid, limit } = await request.json();
  if (!query) return Response.json({ error: 'query required' }, { status: 400 });

  // Execute hybrid search
  const results = await hybridSearch(
    { query, category, is_paid, userId: validKey.user_id, limit },
    context.cloudflare.env
  );

  // Update API key last_used_at
  await db.update(apiKeys).set({ last_used_at: Date.now() }).where(eq(apiKeys.id, validKey.id));

  return Response.json({ results, count: results.length });
}
```

## Todo List
- [ ] Build FTS5 search module with BM25 scoring
- [ ] Build Vectorize search module with deduplication
- [ ] Build RRF fusion algorithm (k=60)
- [ ] Build boost scoring (rating + usage + favorites)
- [ ] Build main hybrid search orchestrator
- [ ] Create search API endpoint with API key auth
- [ ] Test: FTS5 returns keyword matches
- [ ] Test: Vectorize returns semantic matches
- [ ] Test: RRF fusion combines both correctly
- [ ] Test: boost scoring adjusts final ranking
- [ ] Test: search API returns results end-to-end

## Success Criteria
- Query "deploy cloudflare" returns deploy-related skills via both semantic + keyword
- Query "CI/CD pipeline" returns DevOps skills even if "CI/CD" not in text (semantic)
- Query "commit" returns exact match skills via FTS5 (keyword)
- RRF puts skills appearing in both lists higher
- Favorites boost works for authenticated users
- API endpoint responds in <200ms for typical queries
- Fallback to FTS5-only if Vectorize errors

## Risk Assessment
- **Vectorize latency spikes:** Add timeout (500ms), fallback to FTS5-only
- **FTS5 query injection:** Sanitize input, strip special FTS5 operators
- **Empty results:** Return popular/trending skills as fallback
- **RRF k constant tuning:** k=60 is standard, may need adjustment after testing

## Security Considerations
- API key validated via SHA-256 hash comparison
- Search queries logged for abuse detection (future)
- Rate limiting per API key (future, via CF rate limiting)
- No PII in search queries stored

## Next Steps
- Phase 5: Build web UI with search interface on top of this API
