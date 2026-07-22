---
title: "SkillX.sh Full MVP Implementation"
description: "Build complete SkillX.sh marketplace: web UI, hybrid search, auth, CLI, API"
status: pending
priority: P1
effort: 80h
tags: [feature, fullstack, cloudflare, search, cli]
created: 2026-02-10
---

# SkillX.sh Full MVP Implementation

## Overview

Build SkillX.sh — AI agent skills marketplace with semantic search, leaderboard, ratings, reviews, CLI, and API. Deployed on Cloudflare ecosystem. 4-week timeline, AI-assisted solo dev.

## Tech Stack

- **Frontend:** React Router v7 + TypeScript + Tailwind CSS
- **Backend:** Cloudflare Workers (via React Router server)
- **Auth:** Better Auth (GitHub SSO)
- **DB:** Cloudflare D1 + Drizzle ORM
- **Search:** Hybrid (D1 FTS5 BM25 + Vectorize semantic + RRF)
- **Embeddings:** Workers AI (bge-base-en-v1.5, 768-dim)
- **CLI:** Commander.js + fetch + chalk + ora + conf
- **Cache:** Cloudflare KV
- **Storage:** Cloudflare R2
- **Bot protection:** Cloudflare Turnstile

## Research Reports

- [Brainstorm summary](../reports/brainstorm-260210-1109-skillx-full-architecture.md)
- [CF Vectorize + D1](../reports/researcher-260210-1113-cloudflare-vectorize-d1-semantic-search.md)
- [Frontend framework comparison](../reports/researcher-260210-1113-cloudflare-frontend-framework-comparison.md)
- [npm CLI best practices](../reports/researcher-260210-1113-npm-cli-best-practices.md)
- [Design guidelines](../../docs/design-guidelines.md)

## Phases

| # | Phase | Status | Effort | Week | Link |
|---|-------|--------|--------|------|------|
| 1 | Project scaffold + database | Pending | 8h | 1 | [phase-01](./phase-01-scaffold-and-database.md) |
| 2 | Authentication (Better Auth) | Pending | 6h | 1 | [phase-02](./phase-02-authentication.md) |
| 3 | Data seeding + embedding pipeline | Pending | 10h | 1-2 | [phase-03](./phase-03-data-seeding-and-embeddings.md) |
| 4 | Hybrid search engine | Pending | 14h | 2 | [phase-04](./phase-04-hybrid-search-engine.md) |
| 5 | Web UI pages | Pending | 16h | 2-3 | [phase-05](./phase-05-web-ui-pages.md) |
| 6 | Social features + API + CLI | Pending | 16h | 3 | [phase-06](./phase-06-social-api-and-cli.md) |
| 7 | Polish, caching, deploy | Pending | 10h | 4 | [phase-07](./phase-07-polish-and-deploy.md) |

## Dependencies

- Phase 2 depends on Phase 1 (DB schema needed for auth tables)
- Phase 3 depends on Phase 1 (skills table needed for seeding)
- Phase 4 depends on Phase 3 (vectors must exist for search)
- Phase 5 depends on Phases 2 + 4 (auth + search needed for UI)
- Phase 6 depends on Phase 5 (UI pages needed for social features)
- Phase 7 depends on Phase 6 (all features needed for polish)

## Key Risks

- Vectorize has no local simulation → use dev index
- Better Auth D1 adapter edge cases → test early
- 2-week overrun possible → cut reviews/favorites first
- FTS5 trigger sync can fail silently → add error logging
