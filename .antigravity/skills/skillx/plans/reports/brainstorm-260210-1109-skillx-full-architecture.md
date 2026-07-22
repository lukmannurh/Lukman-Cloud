# SkillX.sh Brainstorm Summary

**Date:** 2026-02-10
**Context:** Full MVP architecture for SkillX.sh - AI agent skills marketplace
**Timeline:** 2-4 weeks, AI-assisted solo developer
**Decision status:** Agreed

---

## Problem Statement

Build SkillX.sh - a developer-first marketplace and runtime for AI agent skills. Core differentiator: semantic search + RAG scoring system that finds the most efficient skill based on rating, security, accuracy, and speed. Needs web UI, API, and CLI.

---

## Agreed Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Frontend framework | **React Router v7** | First-class CF support, D1 bindings, large ecosystem, proven templates |
| Search strategy | **Hybrid (BM25 + Vectorize + RRF)** | Core differentiator, combining keyword + semantic for best results |
| Authentication | **Better Auth** | TypeScript, D1 adapter, GitHub OAuth, React Router template exists |
| CLI | **Standalone npm package** | `npx skillx search/use/report` - independent from any other CLI |
| Deployment | **Cloudflare ecosystem** | Pages, Workers, D1, Vectorize, R2, KV, Turnstile |
| ORM | **Drizzle ORM** | Works with D1, type-safe, lightweight, migrations support |

---

## Full-Stack Architecture

### Tech Stack

```
┌─────────────────────────────────────────────────┐
│                   FRONTEND                       │
│  React Router v7 + TypeScript                    │
│  Tailwind CSS + Geist Mono/Sans fonts            │
│  Deployed on: Cloudflare Pages                   │
└──────────────────┬──────────────────────────────┘
                   │ SSR loaders/actions
┌──────────────────┴──────────────────────────────┐
│                   BACKEND                        │
│  React Router server (Cloudflare Workers)        │
│  Better Auth (GitHub OAuth)                      │
│  Drizzle ORM (D1 adapter)                        │
│  Hono API routes (optional, for CLI)             │
└──────────────────┬──────────────────────────────┘
                   │
┌──────────────────┴──────────────────────────────┐
│                 DATA LAYER                       │
│  ┌──────────┐  ┌───────────┐  ┌──────────┐     │
│  │ D1 (SQL) │  │ Vectorize │  │ KV Cache │     │
│  │ + FTS5   │  │ (vectors) │  │          │     │
│  └──────────┘  └───────────┘  └──────────┘     │
│  ┌──────────┐  ┌───────────┐                    │
│  │    R2    │  │Workers AI │                    │
│  │ (files)  │  │(embeddings│                    │
│  └──────────┘  └───────────┘                    │
└─────────────────────────────────────────────────┘
                   │
┌──────────────────┴──────────────────────────────┐
│                    CLI                           │
│  Commander.js + fetch + chalk + ora              │
│  Config: ~/.config/skillx/ (conf package)        │
│  Published: npm (npx skillx)                     │
└─────────────────────────────────────────────────┘
```

### D1 Database Schema (Drizzle)

```sql
-- Users (Better Auth manages session/account tables)
users (
  id TEXT PK,
  name TEXT,
  email TEXT UNIQUE,
  github_username TEXT UNIQUE,
  avatar_url TEXT,
  api_key TEXT UNIQUE,       -- generated on first login
  created_at INTEGER,
  updated_at INTEGER
)

-- Skills catalog
skills (
  id TEXT PK,
  name TEXT UNIQUE,
  slug TEXT UNIQUE,
  description TEXT,
  author TEXT,               -- github org/user
  source_url TEXT,           -- github repo
  category TEXT,             -- planning, implementation, testing, security, devops
  content TEXT,              -- full SKILL.md content (for FTS5 indexing)
  install_command TEXT,       -- e.g. "npx skills add org/skill"
  version TEXT,
  is_paid BOOLEAN DEFAULT FALSE,
  created_at INTEGER,
  updated_at INTEGER
)

-- FTS5 virtual table for keyword search
skills_fts VIRTUAL TABLE USING fts5(name, description, content, content=skills)

-- Skill ratings
ratings (
  id TEXT PK,
  skill_id TEXT FK,
  user_id TEXT FK,           -- NULL for agent ratings
  score REAL,                -- 0-10
  is_agent BOOLEAN,          -- human vs agent rating
  created_at INTEGER
)

-- Skill reviews
reviews (
  id TEXT PK,
  skill_id TEXT FK,
  user_id TEXT FK,
  content TEXT,
  is_agent BOOLEAN,
  created_at INTEGER
)

-- Favorites
favorites (
  user_id TEXT,
  skill_id TEXT,
  created_at INTEGER,
  PRIMARY KEY (user_id, skill_id)
)

-- Usage stats (per skill per model)
usage_stats (
  id TEXT PK,
  skill_id TEXT FK,
  model TEXT,                -- e.g. "claude-4", "gpt-4o"
  outcome TEXT,              -- "success" | "failure"
  duration_ms INTEGER,
  created_at INTEGER
)

-- API Keys (linked to users, separate for management)
api_keys (
  id TEXT PK,
  user_id TEXT FK,
  key_hash TEXT UNIQUE,      -- hashed API key
  name TEXT,
  last_used_at INTEGER,
  created_at INTEGER,
  revoked_at INTEGER
)
```

### Vectorize Index

```
Index name: skillx-skills
Dimensions: 768 (bge-base-en-v1.5)
Distance: cosine

Metadata indexes (create before insert):
- category (string)   → filter by skill category
- is_paid (number)    → filter free/paid
- avg_rating (number) → filter by quality

Vector content: Chunked SKILL.md + description + name
  - Chunk size: 512 tokens, 10% overlap
  - ~4 chunks per skill average
  - Vector ID format: "skill_{id}_chunk_{n}"
  - Metadata: { skill_id, category, is_paid, avg_rating, chunk_index }
```

### Hybrid Search Pipeline

```
User query: "deploy to cloudflare workers"
                    │
    ┌───────────────┼───────────────┐
    ▼               ▼               │
 [Embed query]  [D1 FTS5 BM25]     │
 Workers AI      keyword match      │
    │               │               │
    ▼               │               │
 [Vectorize]        │               │
 semantic top-20    │               │
    │               │               │
    ▼               ▼               │
 ┌─────────────────────────┐        │
 │  Reciprocal Rank Fusion │        │
 │  score = Σ 1/(k + rank) │        │
 │  k = 60 (constant)      │        │
 └────────────┬────────────┘        │
              │                     │
              ▼                     │
 ┌─────────────────────────┐        │
 │  Boost by favorites +   │◄───────┘
 │  usage count + rating   │  user favorites add weight
 └────────────┬────────────┘
              │
              ▼
         Final ranked results
```

**Scoring formula:**
```
final_score = rrf_score * 0.6
            + normalized_rating * 0.2
            + normalized_usage * 0.1
            + favorites_boost * 0.1
```

### API Endpoints (for CLI + potential future MCP)

```
POST   /api/search          - Semantic search (requires API key)
GET    /api/skills/:slug    - Skill details
GET    /api/skills/:slug/install - Get install instructions
POST   /api/report          - Report usage outcome
GET    /api/user/profile    - Current user profile
POST   /api/user/api-keys   - Generate new API key
DELETE /api/user/api-keys/:id - Revoke API key
```

### CLI Commands

```bash
npx skillx --help           # Show help
npx skillx search "query"   # Search skills via API
npx skillx use skill1       # Download/install skill
npx skillx report           # Report last skill run outcome
npx skillx config set-key   # Set API key interactively
```

**CLI stack:** Commander.js + native fetch + chalk + ora + conf

---

## MVP Feature Prioritization (2-4 Weeks)

### Honest Assessment

Full MVP = ~15 distinct features. At ~1 feature/day with AI assistance, you need ~3 weeks minimum. Some features will be thin.

### Week 1: Foundation (must have)

| # | Feature | Complexity | Notes |
|---|---------|-----------|-------|
| 1 | Project scaffold (RR7 + D1 + Tailwind) | Low | Template exists |
| 2 | D1 schema + Drizzle setup + migrations | Medium | Core data model |
| 3 | Better Auth (GitHub SSO) | Medium | Template exists |
| 4 | Seed data pipeline (import skills) | Medium | Scraper/importer |
| 5 | Basic leaderboard page (list + sort) | Medium | SSR, table component |

### Week 2: Search + Core Pages

| # | Feature | Complexity | Notes |
|---|---------|-----------|-------|
| 6 | Vectorize setup + embedding pipeline | High | Core differentiator |
| 7 | FTS5 setup + hybrid search | High | BM25 + RRF fusion |
| 8 | Search UI (input + results + filters) | Medium | Real-time feel |
| 9 | Skill detail page | Medium | All data, radar chart embed |
| 10 | User profile page | Low | Basic info + favorites |

### Week 3: Features + CLI

| # | Feature | Complexity | Notes |
|---|---------|-----------|-------|
| 11 | Ratings system (human + agent) | Medium | Star rating + aggregation |
| 12 | Reviews system | Low | Text input + display |
| 13 | Favorites + search boost | Low | Toggle + weight adjustment |
| 14 | API key management | Medium | Generate, list, revoke |
| 15 | CLI package (search, use, report) | Medium | Standalone npm package |

### Week 4: Polish + Deploy

| # | Feature | Complexity | Notes |
|---|---------|-----------|-------|
| 16 | Usage stats tracking | Low | Counter increments |
| 17 | Cloudflare Turnstile (bot protection) | Low | Drop-in component |
| 18 | Design polish (design-guidelines.md) | Medium | Dark theme, Geist fonts |
| 19 | Performance + caching (KV) | Medium | Leaderboard cache |
| 20 | Deploy to production | Low | CF Pages + wrangler |

### What Will Be Thin

- **Radar chart from Skillmark.sh:** Embed/iframe, not custom built
- **Agent ratings:** Likely manual/seeded initially, not automated
- **Skill usage stats per model:** Basic counters, no advanced analytics
- **Reviews:** Simple text, no moderation system
- **CLI `use` command:** Downloads SKILL.md, doesn't execute scripts (sandbox is future scope)

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Astro 6/Vectorize breaking changes | High | Pin versions, test early |
| D1 10GB limit | Low (MVP) | Won't hit this with <10K skills |
| Vectorize no local simulation | Medium | Use dev index, mock in tests |
| Better Auth D1 compatibility issues | Medium | Template exists, well-tested |
| 2-week timeline too tight | High | Cut reviews + favorites first |
| Embedding quality for short SKILL.md | Medium | Chunk with overlap, test quality |

---

## Cost Estimate (MVP Traffic)

| Service | Free Tier | Estimated Monthly (post-launch) |
|---------|-----------|--------------------------------|
| D1 | 5M reads/day, 100K writes/day | $0 (well within free) |
| Vectorize | 30M queried dims/mo | $0-5 |
| Workers AI | 3K embedding req/min | $0 (free tier) |
| Workers | 100K req/day free | $0-5 |
| R2 | 10GB free | $0 |
| KV | 100K reads/day free | $0 |
| **Total** | | **$0-10/month** |

---

## Project Structure

```
skillx/
├── apps/
│   └── web/                         # React Router v7 app
│       ├── app/
│       │   ├── routes/              # File-based routing
│       │   │   ├── _index.tsx       # Home/hero
│       │   │   ├── leaderboard.tsx  # Leaderboard page
│       │   │   ├── search.tsx       # Search page
│       │   │   ├── skills.$slug.tsx # Skill detail
│       │   │   ├── profile.tsx      # User profile
│       │   │   ├── settings.tsx     # API keys, preferences
│       │   │   └── api/             # API routes
│       │   │       ├── search.ts
│       │   │       ├── report.ts
│       │   │       └── api-keys.ts
│       │   ├── components/          # UI components
│       │   ├── lib/                 # Utilities
│       │   │   ├── db/              # Drizzle schema + queries
│       │   │   ├── auth/            # Better Auth config
│       │   │   ├── search/          # Hybrid search engine
│       │   │   └── vectorize/       # Embedding + indexing
│       │   └── styles/              # Tailwind + design tokens
│       ├── drizzle/                 # Migrations
│       ├── wrangler.jsonc           # CF config
│       └── package.json
│
├── packages/
│   └── cli/                         # npx skillx CLI
│       ├── bin/
│       │   └── skillx.js
│       ├── src/
│       │   ├── commands/
│       │   │   ├── search.js
│       │   │   ├── use.js
│       │   │   └── report.js
│       │   ├── lib/
│       │   │   └── api-client.js
│       │   └── utils/
│       │       └── config.js
│       └── package.json
│
├── scripts/                         # Data import/seed scripts
│   └── seed-skills.ts
├── docs/                            # Design + docs
├── plans/                           # Plans + reports
└── package.json                     # Monorepo root (pnpm workspaces)
```

---

## Next Steps

1. **Create implementation plan** with phased approach (4 weeks)
2. **Bootstrap project** with React Router v7 + CF template
3. **Set up D1 schema** with Drizzle migrations
4. **Implement hybrid search** as core infrastructure
5. **Build UI** following [design-guidelines.md](docs/design-guidelines.md)

---

## Unresolved Questions

1. **Skill data source:** Where exactly to scrape/import initial skills from? GitHub repos? Existing registries?
2. **Skillmark.sh radar chart:** Is this an existing service with an embed API, or needs to be built?
3. **Agent ratings:** How do agents submit ratings? Via CLI `report` command? Automated?
4. **Script execution sandbox:** Explicitly deferred to future scope - confirm this is OK for MVP
5. **Monorepo tooling:** pnpm workspaces or turborepo? (recommend pnpm workspaces - simpler)
