# Phase 1: Project Scaffold + Database

## Context Links
- [Brainstorm: project structure](../reports/brainstorm-260210-1109-skillx-full-architecture.md)
- [Frontend framework report](../reports/researcher-260210-1113-cloudflare-frontend-framework-comparison.md)
- [CF D1 report](../reports/researcher-260210-1113-cloudflare-vectorize-d1-semantic-search.md)

## Overview
- **Priority:** P1 (Critical path — everything depends on this)
- **Status:** Pending
- **Effort:** 8h
- **Week:** 1 (Day 1-2)

Bootstrap pnpm monorepo with React Router v7 on Cloudflare Workers. Set up D1 database with Drizzle ORM, define full schema, run migrations.

## Key Insights
- React Router v7 has official CF template: `npm create cloudflare@latest -- --framework react-router`
- CF bindings accessible via `context.cloudflare.env` in loaders/actions
- Drizzle ORM has first-class D1 support with `drizzle-orm/d1`
- D1 supports FTS5 virtual tables (needed in Phase 4)
- pnpm workspaces simplest monorepo approach for web + cli

## Requirements

### Functional
- Monorepo: `apps/web` (React Router v7) + `packages/cli` (npm package)
- D1 database with full schema (users, skills, ratings, reviews, favorites, usage_stats, api_keys)
- Drizzle schema files with TypeScript types
- Working local dev with Vite + workerd emulation
- Wrangler config with D1/KV/R2/Vectorize bindings

### Non-functional
- TypeScript strict mode
- Tailwind CSS with design tokens from design-guidelines.md
- Geist Mono/Sans fonts configured
- ESLint + Prettier basic setup

## Architecture

```
skillx/
├── apps/web/                    # React Router v7
│   ├── app/
│   │   ├── routes/
│   │   ├── components/
│   │   ├── lib/
│   │   │   └── db/
│   │   │       ├── schema.ts    # Drizzle schema (all tables)
│   │   │       ├── index.ts     # DB client factory
│   │   │       └── migrations/  # SQL migrations
│   │   └── styles/
│   │       └── tailwind.css
│   ├── wrangler.jsonc
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   └── package.json
├── packages/cli/                # Placeholder (Phase 6)
│   └── package.json
├── pnpm-workspace.yaml
├── package.json
└── tsconfig.json
```

## Related Code Files

### Create
- `pnpm-workspace.yaml` — workspace config
- `package.json` — root with scripts
- `tsconfig.json` — root TS config
- `apps/web/` — entire React Router v7 app from template
- `apps/web/app/lib/db/schema.ts` — Drizzle schema (all tables)
- `apps/web/app/lib/db/index.ts` — DB client factory
- `apps/web/wrangler.jsonc` — CF bindings config
- `apps/web/tailwind.config.ts` — design tokens
- `packages/cli/package.json` — placeholder

## Implementation Steps

### 1. Bootstrap monorepo
```bash
mkdir skillx && cd skillx
pnpm init
```
Create `pnpm-workspace.yaml`:
```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

### 2. Scaffold React Router v7 app
```bash
npm create cloudflare@latest -- apps/web --framework react-router
cd apps/web
pnpm add drizzle-orm better-sqlite3
pnpm add -D drizzle-kit @cloudflare/workers-types
```

### 3. Configure wrangler.jsonc
```jsonc
{
  "name": "skillx-web",
  "compatibility_date": "2026-02-01",
  "compatibility_flags": ["nodejs_compat"],
  "d1_databases": [{
    "binding": "DB",
    "database_name": "skillx-db",
    "database_id": "<create-via-wrangler>"
  }],
  "vectorize": [{
    "binding": "VECTORIZE",
    "index_name": "skillx-skills"
  }],
  "kv_namespaces": [{
    "binding": "KV",
    "id": "<create-via-wrangler>"
  }],
  "r2_buckets": [{
    "binding": "R2",
    "bucket_name": "skillx-assets"
  }],
  "ai": {
    "binding": "AI"
  }
}
```

### 4. Create D1 database + Vectorize index
```bash
npx wrangler d1 create skillx-db
npx wrangler vectorize create skillx-skills --dimensions 768 --metric cosine
npx wrangler kv namespace create KV
npx wrangler r2 bucket create skillx-assets
```

### 5. Define Drizzle schema
Write `apps/web/app/lib/db/schema.ts` with all tables from brainstorm:
- `users` — Better Auth will add session/account tables
- `skills` — name, slug, description, author, category, content, etc.
- `ratings` — skill_id, user_id, score, is_agent
- `reviews` — skill_id, user_id, content, is_agent
- `favorites` — user_id + skill_id composite PK
- `usageStats` — skill_id, model, outcome, duration_ms
- `apiKeys` — user_id, key_hash, name, last_used_at, revoked_at

### 6. Generate + run migrations
```bash
npx drizzle-kit generate
npx wrangler d1 migrations apply skillx-db --local
```

### 7. Create FTS5 migration (separate SQL)
```sql
CREATE VIRTUAL TABLE IF NOT EXISTS skills_fts USING fts5(
  name, description, content, content=skills, content_rowid=rowid
);

CREATE TRIGGER IF NOT EXISTS skills_ai AFTER INSERT ON skills BEGIN
  INSERT INTO skills_fts(rowid, name, description, content)
  VALUES (new.rowid, new.name, new.description, new.content);
END;

CREATE TRIGGER IF NOT EXISTS skills_ad AFTER DELETE ON skills BEGIN
  INSERT INTO skills_fts(skills_fts, rowid, name, description, content)
  VALUES ('delete', old.rowid, old.name, old.description, old.content);
END;

CREATE TRIGGER IF NOT EXISTS skills_au AFTER UPDATE ON skills BEGIN
  INSERT INTO skills_fts(skills_fts, rowid, name, description, content)
  VALUES ('delete', old.rowid, old.name, old.description, old.content);
  INSERT INTO skills_fts(rowid, name, description, content)
  VALUES (new.rowid, new.name, new.description, new.content);
END;
```

### 8. Configure Tailwind with design tokens
Extract from `docs/design-guidelines.md`:
- Colors: `--sx-bg`, `--sx-accent`, etc.
- Fonts: Geist Sans + Geist Mono
- Spacing: 4px base scale

### 9. Verify local dev
```bash
cd apps/web && pnpm dev
# Should start Vite + workerd with D1 local binding
```

### 10. Create DB client factory
```typescript
// apps/web/app/lib/db/index.ts
import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema';

export function getDb(d1: D1Database) {
  return drizzle(d1, { schema });
}
```

## Todo List
- [ ] Bootstrap pnpm monorepo
- [ ] Scaffold React Router v7 from CF template
- [ ] Configure wrangler.jsonc with all bindings
- [ ] Create D1 database + Vectorize index + KV + R2 via wrangler CLI
- [ ] Define complete Drizzle schema
- [ ] Generate and apply migrations (including FTS5)
- [ ] Configure Tailwind with design tokens
- [ ] Set up Geist fonts
- [ ] Create DB client factory
- [ ] Verify local dev server works
- [ ] Create CLI package placeholder

## Success Criteria
- `pnpm dev` starts without errors
- D1 local database has all tables
- FTS5 virtual table created with triggers
- Tailwind compiles with custom design tokens
- TypeScript compiles with strict mode
- Monorepo structure matches brainstorm spec

## Risk Assessment
- **CF template changes:** Pin `create-cloudflare` version
- **Drizzle D1 edge cases:** D1 uses INTEGER for booleans (not BOOLEAN)
- **FTS5 triggers:** Must be applied as raw SQL, not via Drizzle migrations

## Security Considerations
- `.env` and `wrangler.jsonc` with real IDs → `.gitignore`
- No secrets in code — use CF secrets for API keys
- D1 database IDs are not secret but should not be in public repos

## Next Steps
- Phase 2: Authentication setup on top of this schema
