# Phase 2: Authentication (Better Auth + GitHub SSO)

## Context Links
- [Better Auth docs](https://www.better-auth.com/)
- [React Router + CF + D1 + Better Auth template](https://github.com/matthewlynch/better-auth-react-router-cloudflare-d1)
- [Phase 1](./phase-01-scaffold-and-database.md)

## Overview
- **Priority:** P1 (Auth needed before any user-facing features)
- **Status:** Pending
- **Effort:** 6h
- **Week:** 1 (Day 2-3)
- **Depends on:** Phase 1

Integrate Better Auth with GitHub OAuth provider. D1 as session store. Protected routes for profile/settings. API key generation on first login.

## Key Insights
- Better Auth has `@better-auth/d1` adapter — no custom wiring needed
- GitHub OAuth: create OAuth App at github.com/settings/developers
- Session management: cookie-based, auto-refresh
- Better Auth auto-creates its own tables (user, session, account, verification)
- Our `users` table extends Better Auth's user table with extra fields

## Requirements

### Functional
- GitHub "Login with GitHub" button
- Session persistence (cookie-based)
- Protected routes (profile, settings)
- Auto-generate API key on first login
- Logout functionality
- User avatar from GitHub

### Non-functional
- Secure session cookies (httpOnly, sameSite, secure)
- CSRF protection via Better Auth
- No password storage (OAuth only)

## Architecture

```
Login flow:
  Browser → /auth/sign-in/github → GitHub OAuth → /auth/callback/github
    → Better Auth creates session + user → redirect to /leaderboard

API key flow:
  First login → check if api_keys exists for user → if not, generate one
    → store hash in DB, show plaintext once

Protected routes:
  loader() → getSession(context) → if null, redirect to /auth/sign-in
```

## Related Code Files

### Create
- `apps/web/app/lib/auth/auth-server.ts` — Better Auth server config
- `apps/web/app/lib/auth/auth-client.ts` — Better Auth client
- `apps/web/app/lib/auth/middleware.ts` — session helper for loaders
- `apps/web/app/routes/auth.$.tsx` — Better Auth catch-all route
- `apps/web/app/components/auth-button.tsx` — Login/logout button

### Modify
- `apps/web/app/lib/db/schema.ts` — ensure user table compatible with Better Auth
- `apps/web/wrangler.jsonc` — add GitHub OAuth secrets
- `apps/web/app/root.tsx` — add auth provider

## Implementation Steps

### 1. Install Better Auth
```bash
cd apps/web
pnpm add better-auth @better-auth/d1
```

### 2. Create GitHub OAuth App
- Go to github.com/settings/developers
- New OAuth App → callback URL: `http://localhost:5173/auth/callback/github`
- Save CLIENT_ID and CLIENT_SECRET

### 3. Configure Better Auth server
```typescript
// apps/web/app/lib/auth/auth-server.ts
import { betterAuth } from 'better-auth';
import { d1Adapter } from '@better-auth/d1';

export function createAuth(d1: D1Database, env: Env) {
  return betterAuth({
    database: d1Adapter(d1),
    socialProviders: {
      github: {
        clientId: env.GITHUB_CLIENT_ID,
        clientSecret: env.GITHUB_CLIENT_SECRET,
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7 days
      updateAge: 60 * 60 * 24, // refresh daily
    },
  });
}
```

### 4. Create Better Auth client
```typescript
// apps/web/app/lib/auth/auth-client.ts
import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient({
  baseURL: typeof window !== 'undefined' ? window.location.origin : '',
});
```

### 5. Create catch-all auth route
```typescript
// apps/web/app/routes/auth.$.tsx
import type { LoaderFunctionArgs, ActionFunctionArgs } from 'react-router';
import { createAuth } from '~/lib/auth/auth-server';

export async function loader({ request, context }: LoaderFunctionArgs) {
  const auth = createAuth(context.cloudflare.env.DB, context.cloudflare.env);
  return auth.handler(request);
}

export async function action({ request, context }: ActionFunctionArgs) {
  const auth = createAuth(context.cloudflare.env.DB, context.cloudflare.env);
  return auth.handler(request);
}
```

### 6. Create session helper
```typescript
// apps/web/app/lib/auth/middleware.ts
import { createAuth } from './auth-server';

export async function getSession(context: AppLoadContext) {
  const auth = createAuth(context.cloudflare.env.DB, context.cloudflare.env);
  const session = await auth.api.getSession({
    headers: context.request.headers,
  });
  return session;
}

export async function requireAuth(context: AppLoadContext) {
  const session = await getSession(context);
  if (!session) throw redirect('/auth/sign-in/github');
  return session;
}
```

### 7. Create login/logout component
```typescript
// apps/web/app/components/auth-button.tsx
import { authClient } from '~/lib/auth/auth-client';

export function AuthButton({ user }: { user?: User | null }) {
  if (user) {
    return (
      <button onClick={() => authClient.signOut()}>
        <img src={user.image} alt="" className="w-6 h-6 rounded-full" />
        Sign Out
      </button>
    );
  }
  return (
    <button onClick={() => authClient.signIn.social({ provider: 'github' })}>
      Sign in with GitHub
    </button>
  );
}
```

### 8. API key auto-generation
On first login callback, check if user has API key. If not, generate one:
```typescript
import { randomBytes, createHash } from 'node:crypto';

function generateApiKey(): { plaintext: string; hash: string } {
  const plaintext = `sx_${randomBytes(32).toString('hex')}`;
  const hash = createHash('sha256').update(plaintext).digest('hex');
  return { plaintext, hash };
}
```

### 9. Add secrets to wrangler
```bash
npx wrangler secret put GITHUB_CLIENT_ID
npx wrangler secret put GITHUB_CLIENT_SECRET
```

## Todo List
- [ ] Install Better Auth + D1 adapter
- [ ] Create GitHub OAuth App
- [ ] Configure Better Auth server with D1
- [ ] Create Better Auth client
- [ ] Create catch-all auth route
- [ ] Create session helper (getSession, requireAuth)
- [ ] Create login/logout UI component
- [ ] Implement API key auto-generation on first login
- [ ] Add GITHUB_CLIENT_ID/SECRET as wrangler secrets
- [ ] Test full login → session → logout flow
- [ ] Test protected route redirect

## Success Criteria
- GitHub OAuth login works end-to-end
- Session persists across page reloads
- Protected routes redirect to login
- API key generated on first login
- Logout clears session

## Risk Assessment
- **Better Auth D1 migration conflicts:** Run Better Auth migrations separately from Drizzle
- **OAuth callback URL mismatch:** Must match exactly in GitHub settings
- **Session cookies on localhost:** May need `secure: false` in dev

## Security Considerations
- API keys stored as SHA-256 hash (never plaintext in DB)
- Plaintext shown once on generation, never again
- OAuth secrets stored in CF Secrets (not env files)
- CSRF protection built into Better Auth
- httpOnly cookies prevent XSS session theft

## Next Steps
- Phase 3: Seed skills data into D1 (uses auth for admin seeding)
