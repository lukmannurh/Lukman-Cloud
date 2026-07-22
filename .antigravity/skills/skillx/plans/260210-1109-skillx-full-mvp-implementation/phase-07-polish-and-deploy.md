# Phase 7: Polish, Caching, Deploy

## Context Links
- [Design guidelines](../../docs/design-guidelines.md)
- [Brainstorm: cost estimate](../reports/brainstorm-260210-1109-skillx-full-architecture.md)

## Overview
- **Priority:** P2 (Finish line — make it production-ready)
- **Status:** Pending
- **Effort:** 10h
- **Week:** 4 (Day 14-16)
- **Depends on:** Phase 6 (all features complete)

Final design polish per design-guidelines.md, KV caching for leaderboard/search, Turnstile bot protection, production deployment to Cloudflare.

## Key Insights
- KV caching: cache leaderboard for 5 min, search for 1 min
- Turnstile: free, invisible mode for bot protection
- CF Pages: auto-deploy from Git push
- Domain: skillx.sh (needs DNS config)
- Bundle size check: must stay under 3 MiB Worker limit

## Requirements

### Functional
- Design matches design-guidelines.md specifications
- KV caching for leaderboard + popular searches
- Cloudflare Turnstile on auth + rating/review forms
- Production deployment with custom domain
- Usage stats display on skill detail pages
- Error pages (404, 500)

### Non-functional
- Lighthouse: Performance >80, Accessibility >90, SEO >90
- Bundle size < 3 MiB (Worker limit)
- TTFB < 200ms for cached pages
- Mobile responsive verified

## Implementation Steps

### 1. Design polish audit
Verify every component against design-guidelines.md:
- [ ] Colors: `--sx-bg: #0A0A0A`, `--sx-accent: #00E5A0`, all tokens
- [ ] Fonts: Geist Sans headings, Geist Mono code/labels
- [ ] Spacing: 4px base scale applied consistently
- [ ] Cards: `#141414` bg, `#222222` border, 8px radius, hover translateY
- [ ] Buttons: primary (green), secondary (border), ghost
- [ ] Badges: phase colors (planning=blue, impl=purple, testing=green, security=yellow, devops=pink)
- [ ] Rating tiers: S=gold, A=green, B=blue, C=muted
- [ ] Animations: 150ms color transitions, 200ms transforms
- [ ] Nav: 56px sticky, backdrop-blur
- [ ] Search: focus glow ring `0 0 0 2px rgba(0,229,160,0.12)`

### 2. KV caching layer
```typescript
// apps/web/app/lib/cache/kv-cache.ts
export async function getCached<T>(
  kv: KVNamespace,
  key: string,
  ttlSeconds: number,
  fetchFn: () => Promise<T>
): Promise<T> {
  const cached = await kv.get(key, 'json');
  if (cached) return cached as T;

  const fresh = await fetchFn();
  await kv.put(key, JSON.stringify(fresh), { expirationTtl: ttlSeconds });
  return fresh;
}
```

Cache targets:
- `leaderboard:${sort}:${page}` → TTL 300s (5 min)
- `skill:${slug}` → TTL 600s (10 min)
- `search:${queryHash}` → TTL 60s (1 min)
- `stats:global` → TTL 300s (5 min)

### 3. Cloudflare Turnstile integration
```bash
# Get site key from CF dashboard → Turnstile → Add Widget
# Invisible mode (no user interaction)
```

Add to auth + rating + review forms:
```typescript
// apps/web/app/components/turnstile-widget.tsx
export function TurnstileWidget({ siteKey }: { siteKey: string }) {
  return (
    <div
      className="cf-turnstile"
      data-sitekey={siteKey}
      data-theme="dark"
      data-size="invisible"
    />
  );
}
```

Server validation:
```typescript
async function validateTurnstile(token: string, secret: string): Promise<boolean> {
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret, response: token }),
  });
  const data = await res.json();
  return data.success;
}
```

### 4. Error pages
- `apps/web/app/routes/$.tsx` — 404 catch-all
- Root error boundary in `app/root.tsx`

### 5. Usage stats display
Wire usage_stats data into skill detail page:
- Total uses, success/failure ratio
- Per-model breakdown (table)
- Trend indicator (last 7 days)

### 6. Production deployment

#### a. Create CF Pages project
```bash
npx wrangler pages project create skillx-web
```

#### b. Configure production D1
```bash
npx wrangler d1 create skillx-db-prod
npx wrangler d1 migrations apply skillx-db-prod
```

#### c. Configure wrangler.jsonc environments
```jsonc
{
  "env": {
    "production": {
      "d1_databases": [{ "binding": "DB", "database_name": "skillx-db-prod", "database_id": "..." }],
      "vars": { "ENVIRONMENT": "production" }
    }
  }
}
```

#### d. Set production secrets
```bash
npx wrangler secret put GITHUB_CLIENT_ID --env production
npx wrangler secret put GITHUB_CLIENT_SECRET --env production
npx wrangler secret put ADMIN_SECRET --env production
npx wrangler secret put TURNSTILE_SECRET --env production
```

#### e. Custom domain
```bash
# In CF dashboard: Pages → Custom domains → skillx.sh
# Or via wrangler: npx wrangler pages project update skillx-web --custom-domain skillx.sh
```

#### f. Deploy
```bash
cd apps/web
pnpm build
npx wrangler pages deploy ./build/client --project-name skillx-web
```

#### g. Seed production data
```bash
ADMIN_SECRET=xxx API_URL=https://skillx.sh npx tsx scripts/seed-skills.ts
```

### 7. Performance verification
```bash
# Bundle size check
du -sh apps/web/build/worker/index.js  # must be < 3 MiB

# Lighthouse
npx lighthouse https://skillx.sh --output json
```

### 8. CLI publish (if ready)
```bash
cd packages/cli
pnpm build
npm publish --access public
# Verify: npx skillx --help
```

## Todo List
- [ ] Design polish audit against design-guidelines.md
- [ ] Implement KV caching layer
- [ ] Cache leaderboard, skill pages, search results
- [ ] Integrate Cloudflare Turnstile on forms
- [ ] Build 404 + error boundary pages
- [ ] Wire usage stats into skill detail page
- [ ] Create production CF Pages project
- [ ] Create production D1 database + apply migrations
- [ ] Set production secrets
- [ ] Configure custom domain (skillx.sh)
- [ ] Deploy to production
- [ ] Seed production data
- [ ] Verify bundle size < 3 MiB
- [ ] Run Lighthouse audit
- [ ] Publish CLI to npm (if ready)

## Success Criteria
- All pages match design-guidelines.md specifications
- Leaderboard loads in <200ms (cached via KV)
- Turnstile blocks bot submissions
- Production deploy accessible at skillx.sh
- Lighthouse scores: Perf >80, A11y >90, SEO >90
- Worker bundle < 3 MiB
- CLI installable via `npx skillx`

## Risk Assessment
- **Bundle size > 3 MiB:** Tree-shake, code-split routes, move assets to R2
- **KV cache stale data:** Short TTLs (1-5 min), manual cache bust on writes
- **Domain DNS propagation:** May take 24-48h
- **Turnstile invisible mode:** May not trigger on all browsers

## Security Considerations
- Production secrets rotated from dev values
- Turnstile prevents automated abuse
- HTTPS enforced via CF (automatic)
- Security headers set in Workers middleware (CSP, X-Frame, etc.)
- GitHub OAuth callback URL updated for production domain

## Next Steps (Post-MVP)
- MCP Server integration
- Script sandbox execution
- Payment system (credits + subscription)
- Advanced analytics dashboard
- Community moderation tools
