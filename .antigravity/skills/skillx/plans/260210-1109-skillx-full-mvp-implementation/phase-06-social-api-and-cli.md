# Phase 6: Social Features + API + CLI

## Context Links
- [CLI report](../reports/researcher-260210-1113-npm-cli-best-practices.md)
- [Brainstorm: API + CLI](../reports/brainstorm-260210-1109-skillx-full-architecture.md)
- [Phase 5](./phase-05-web-ui-pages.md)

## Overview
- **Priority:** P2 (Extends core product with engagement features)
- **Status:** Pending
- **Effort:** 16h
- **Week:** 3 (Day 9-13)
- **Depends on:** Phase 5 (UI pages needed for social features)

Add ratings, reviews, favorites to web UI. Build remaining API endpoints. Build standalone CLI npm package.

## Key Insights
- Ratings: 0-10 scale, separate human vs agent
- Reviews: simple text, no moderation for MVP
- Favorites: toggle adds weight to search scoring (Phase 4 boost)
- CLI: Commander.js + fetch + chalk + ora + conf
- API key auth for CLI: Bearer token in Authorization header

## Requirements

### Functional — Social
- Star rating component (1-10, half-stars optional)
- Human rating submission (authenticated)
- Agent rating submission (via API key)
- Reviews: text input, display list, is_agent flag
- Favorites: toggle button, persists, boosts search
- Aggregated rating display (avg, count, tier)

### Functional — API
- `POST /api/search` — (done in Phase 4)
- `GET /api/skills/:slug` — skill details
- `GET /api/skills/:slug/install` — install instructions
- `POST /api/report` — report usage outcome
- `GET /api/user/profile` — current user
- `POST /api/user/api-keys` — generate key
- `DELETE /api/user/api-keys/:id` — revoke key

### Functional — CLI
- `npx skillx search "query"` — search via API
- `npx skillx use <skill>` — download SKILL.md content
- `npx skillx report` — report last run outcome
- `npx skillx config set-key` — set API key interactively
- `npx skillx --help` — usage info

## Architecture

### Social Features
```
Rating submission:
  Client → POST /api/skills/:slug/rate → validate auth → insert rating
    → recalculate avg_rating → update Vectorize metadata (avg_rating)

Favorite toggle:
  Client → POST /api/skills/:slug/favorite → insert/delete favorite
    → affects search boost scoring for this user

Review submission:
  Client → POST /api/skills/:slug/review → validate auth → insert review
```

### CLI Architecture
```
packages/cli/
├── bin/skillx.js           # #!/usr/bin/env node entry
├── src/
│   ├── commands/
│   │   ├── search.ts       # search subcommand
│   │   ├── use.ts          # use subcommand
│   │   ├── report.ts       # report subcommand
│   │   └── config.ts       # config subcommand
│   ├── lib/
│   │   └── api-client.ts   # HTTP client wrapper
│   └── utils/
│       └── config.ts       # conf package wrapper
├── tsconfig.json
└── package.json
```

## Related Code Files

### Create — Social
- `apps/web/app/components/star-rating.tsx` — interactive rating input
- `apps/web/app/components/review-form.tsx` — review text input
- `apps/web/app/components/review-list.tsx` — display reviews
- `apps/web/app/components/favorite-button.tsx` — toggle favorite
- `apps/web/app/routes/api.skills.$slug.rate.ts` — rating endpoint
- `apps/web/app/routes/api.skills.$slug.review.ts` — review endpoint
- `apps/web/app/routes/api.skills.$slug.favorite.ts` — favorite endpoint
- `apps/web/app/routes/api.skills.$slug.ts` — skill details endpoint
- `apps/web/app/routes/api.report.ts` — usage report endpoint
- `apps/web/app/routes/api.user.api-keys.ts` — API key management

### Create — CLI
- `packages/cli/bin/skillx.js` — entry point
- `packages/cli/src/commands/search.ts`
- `packages/cli/src/commands/use.ts`
- `packages/cli/src/commands/report.ts`
- `packages/cli/src/commands/config.ts`
- `packages/cli/src/lib/api-client.ts`
- `packages/cli/src/utils/config.ts`
- `packages/cli/package.json`
- `packages/cli/tsconfig.json`

### Modify
- `apps/web/app/routes/skills.$slug.tsx` — add rating/review/favorite UI
- `apps/web/app/routes/settings.tsx` — wire up API key generate/revoke

## Implementation Steps

### Social Features

#### 1. Star rating component
Simple 1-10 rating with filled/empty stars. Submit via form action:
```typescript
// apps/web/app/components/star-rating.tsx
// Renders 10 stars, filled up to current value
// onClick → submit to /api/skills/:slug/rate
```

#### 2. Rating API endpoint
```typescript
// apps/web/app/routes/api.skills.$slug.rate.ts
export async function action({ request, params, context }) {
  const session = await requireAuth(context);
  const { score } = await request.json();
  // Validate: 0 <= score <= 10
  // Upsert rating (one per user per skill)
  // Recalculate avg_rating for skill
  // Update Vectorize metadata (avg_rating field)
}
```

#### 3. Favorite toggle
```typescript
// apps/web/app/routes/api.skills.$slug.favorite.ts
export async function action({ request, params, context }) {
  const session = await requireAuth(context);
  // Toggle: if exists, delete. If not, insert.
  return Response.json({ favorited: !exists });
}
```

#### 4. Review submission
```typescript
// apps/web/app/routes/api.skills.$slug.review.ts
export async function action({ request, params, context }) {
  const session = await requireAuth(context);
  const { content } = await request.json();
  // Validate: content.length > 0 && content.length < 2000
  // Insert review
}
```

#### 5. Usage report endpoint
```typescript
// apps/web/app/routes/api.report.ts
export async function action({ request, context }) {
  // Validate API key
  const { skill_slug, outcome, model, duration_ms } = await request.json();
  // Insert into usage_stats
  return Response.json({ success: true });
}
```

#### 6. API key management endpoints
```typescript
// apps/web/app/routes/api.user.api-keys.ts
// POST: Generate new key → return plaintext once
// DELETE with ?id=xxx: Revoke key (set revoked_at)
// GET: List keys (masked, show last 4 chars)
```

### CLI Package

#### 7. Initialize CLI package
```bash
cd packages/cli
pnpm init
pnpm add commander chalk ora conf
pnpm add -D typescript @types/node tsup
```

package.json:
```json
{
  "name": "skillx",
  "version": "0.1.0",
  "bin": { "skillx": "./bin/skillx.js" },
  "scripts": { "build": "tsup src/index.ts --format esm,cjs" }
}
```

#### 8. Build config utility
```typescript
// packages/cli/src/utils/config.ts
import Conf from 'conf';
const config = new Conf({ projectName: 'skillx' });

export const getApiKey = () => process.env.SKILLX_API_KEY || config.get('apiKey');
export const setApiKey = (key: string) => config.set('apiKey', key);
export const getBaseUrl = () => config.get('baseUrl') || 'https://skillx.sh';
```

#### 9. Build API client
```typescript
// packages/cli/src/lib/api-client.ts
import { getApiKey, getBaseUrl } from '../utils/config';

export async function apiRequest(endpoint: string, options: RequestInit = {}) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('No API key. Run: skillx config set-key');

  const res = await fetch(`${getBaseUrl()}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
  return res.json();
}
```

#### 10. Build CLI commands
```typescript
// packages/cli/src/commands/search.ts
import chalk from 'chalk';
import ora from 'ora';
import { apiRequest } from '../lib/api-client';

export async function searchCommand(query: string) {
  const spinner = ora('Searching skills...').start();
  const { results } = await apiRequest('/api/search', {
    method: 'POST',
    body: JSON.stringify({ query }),
  });
  spinner.succeed(`Found ${results.length} skills`);

  for (const r of results) {
    console.log(`  ${chalk.green(r.skill.name)} ${chalk.gray(`(${r.skill.category})`)}`);
    console.log(`    ${chalk.dim(r.skill.description)}`);
    console.log(`    ${chalk.yellow(`Rating: ${r.avg_rating.toFixed(1)}`)} | ${chalk.cyan(`Score: ${r.score.toFixed(3)}`)}`);
    console.log();
  }
}
```

#### 11. Wire up Commander entry point
```typescript
// packages/cli/bin/skillx.js
#!/usr/bin/env node
import { program } from 'commander';
import { searchCommand } from '../src/commands/search';
import { useCommand } from '../src/commands/use';
import { reportCommand } from '../src/commands/report';
import { configCommand } from '../src/commands/config';

program.name('skillx').description('The Only Skill That Your AI Agent Needs.').version('0.1.0');

program.command('search <query>').description('Search for skills').action(searchCommand);
program.command('use <skill>').description('Install a skill').action(useCommand);
program.command('report').description('Report skill usage outcome').action(reportCommand);
program.command('config').description('Manage configuration').addCommand(
  new Command('set-key').description('Set your API key').action(configCommand)
);

program.parse();
```

## Todo List
- [ ] Build star rating component
- [ ] Build review form + review list components
- [ ] Build favorite toggle button
- [ ] Create rating API endpoint (with Vectorize metadata update)
- [ ] Create review API endpoint
- [ ] Create favorite toggle API endpoint
- [ ] Create skill details API endpoint
- [ ] Create usage report API endpoint
- [ ] Create API key management endpoints
- [ ] Wire social features into skill detail page
- [ ] Wire API key management into settings page
- [ ] Initialize CLI package with Commander.js
- [ ] Build CLI config utility (conf package)
- [ ] Build CLI API client (fetch-based)
- [ ] Build CLI search command
- [ ] Build CLI use command
- [ ] Build CLI report command
- [ ] Build CLI config set-key command
- [ ] Test CLI search against local API
- [ ] Test rating → Vectorize metadata update flow

## Success Criteria
- Rating submission updates avg_rating in D1 + Vectorize metadata
- Favorite toggle persists and affects search boost
- Reviews display chronologically on skill detail
- All API endpoints return correct data with auth
- CLI `search` returns formatted results
- CLI `use` downloads skill content
- CLI `report` successfully submits usage data
- CLI `config set-key` persists key to ~/.config/skillx/

## Risk Assessment
- **Vectorize metadata update latency:** May be async, search results lag behind
- **CLI publish naming conflict:** Check `skillx` availability on npm early
- **Rating aggregation perf:** Pre-compute avg_rating, don't calculate per query

## Security Considerations
- Ratings require auth (no anonymous ratings)
- Reviews: basic XSS protection via React escaping
- API keys in CLI stored in user's config dir (not world-readable)
- Report endpoint rate-limited per API key (future)

## Next Steps
- Phase 7: Design polish, caching, Turnstile, production deploy
