# Code Reviewer Memory - SkillX Project

## Project Context
- SkillX.sh: AI agent skills marketplace (React Router v7 + Vite + SSR on Cloudflare Workers)
- DB: Cloudflare D1 (SQLite) + Drizzle ORM
- Search: FTS5 + Vectorize (768-dim) + RRF fusion + 7-signal boost scoring
- Max 200 LOC per file rule enforced

## Key Patterns Observed

### Search Architecture
- FTS5 virtual table: `skills_fts(name, description, content)` with BM25 weights (10/5/1)
- Vectorize: `bge-base-en-v1.5`, 768-dim, cosine similarity
- RRF fusion constant k=60 (standard)
- Boost: 50% RRF, 15% rating, 10% stars, 8% usage, 7% success, 5% recency, 5% favorite
- Pre-filtering pushed to retrieval (FTS5 WHERE + Vectorize metadata filter)
- Fallback chain: hybrid -> FTS5-only -> empty

### Recurring Issues
- FTS5 fallback logic duplicated 4x across 3 files (DRY violation)
- `api.search.ts` has implicit `any[]` TS errors on `results` variable
- Drizzle timestamp columns use `mode: "timestamp_ms"` but some routes pass raw numbers
- Pre-existing TS errors in non-search routes (api.skill-rate, api.skill-review, etc.)

### SQL Injection Safety
- FTS5 sanitization: `query.replace(/[^\w\s]/g, '')` strips specials before MATCH
- All Drizzle queries use parameterized API
- Raw SQL uses `sql` tagged template literals

### Edge Cases to Watch
- Multi-word aliases (cli, gcp, devops) expand to individual OR terms, not phrases
- `Math.max(...largeArray)` can stack overflow but currently bounded by limit*2
- Vectorize metadata filter types must match index schema (is_paid as int vs bool)

## File Locations
- Search modules: `apps/web/app/lib/search/`
- DB schema: `apps/web/app/lib/db/schema.ts`
- FTS5 migration: `apps/web/drizzle/migrations/0001_fts5-fulltext-search.sql`
- API search route: `apps/web/app/routes/api.search.ts`
- Page search route: `apps/web/app/routes/search.tsx`

## Typecheck Command
- `pnpm typecheck` from `apps/web/` directory
- 25+ pre-existing TS errors in non-search routes (timestamp/type issues)
