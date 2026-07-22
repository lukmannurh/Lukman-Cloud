# Frontend Framework Comparison for Cloudflare Pages/Workers
**Research Report: Developer Marketplace/Leaderboard MVP (2-4 weeks, Solo AI-Assisted Dev)**

**Date:** 2026-02-10
**Researcher:** Claude (researcher agent)

---

## Executive Summary

**Top Recommendation:** **React Router v7** or **Astro 6** (conditional on use case)

- **React Router v7** = Best for interactive marketplace with dynamic features
- **Astro 6** = Best for content-heavy leaderboard with some interactivity
- **SvelteKit** = Close second, excellent DX, smaller bundles
- **Hono + HonoX** = Best if you want Workers-native and minimal overhead
- **Next.js** = Avoid unless locked into React ecosystem; requires OpenNext workarounds

---

## Framework Analysis

### 1. Next.js on Cloudflare ❌ Not Recommended

**Compatibility:** Requires @opennextjs/cloudflare adapter (formerly next-on-pages deprecated)

**Status:**
- OpenNext adapter now preferred method
- Supports Next.js 14/15/16 (v14 support ends Q1 2026)
- Requires `nodejs_compat` flag + compatibility date ≥ 2024-09-23
- Edge Runtime deprecated; must use Node.js runtime

**D1/KV/R2 Access:** Possible but complex; not first-class

**Bundle Size:** **CRITICAL ISSUE** - Next.js frequently hits 3 MiB Worker limit, causes cold start issues

**Developer Experience:**
- ❌ No Cloudflare Vite plugin support
- ❌ Adapter is workaround, not native integration
- ❌ Large bundles slow development iteration
- ✅ Familiar React ecosystem

**Verdict:** Avoid unless locked into Next.js ecosystem. Overhead not worth it for MVP.

**Sources:**
- [Cloudflare OpenNext.js Adapter](https://opennext.js.org/cloudflare)
- [Next.js on Cloudflare Workers](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/)
- [Deploying Next.js to Cloudflare Workers](https://blog.cloudflare.com/deploying-nextjs-apps-to-cloudflare-workers-with-the-opennext-adapter/)
- [OpenNext GitHub](https://github.com/opennextjs/opennextjs-cloudflare)
- [Worker Size Limits Discussion](https://github.com/LubomirGeorgiev/cloudflare-workers-nextjs-saas-template/issues/11)

---

### 2. React Router v7 (Remix) ✅ **RECOMMENDED**

**Compatibility:** First-class Cloudflare support via @react-router/cloudflare adapter

**Status:**
- Remix deprecated by authors; React Router v7 is successor
- Official Cloudflare template maintained by Cloudflare
- Works with Cloudflare Vite plugin (local dev runs in workerd runtime)
- Cloudflare recommends Workers over Pages (Workers now have same capabilities)

**D1/KV/R2 Access:** ✅ **EXCELLENT**
- Bindings passed through `context.cloudflare.env` and `context.cloudflare.ctx`
- Direct access in loaders/actions
- Template repos available (e.g., react-router-cloudflare-d1)
- Works with Drizzle ORM out of box

**SSR/SSG:** Full SSR support, no SSG (use loader caching instead)

**Developer Experience:**
- ✅ Excellent local dev with Vite + workerd emulation
- ✅ Type-safe bindings via TypeScript
- ✅ Simple deployment via Wrangler
- ✅ Clean separation of server/client code
- ✅ Nested routing, data loaders, actions

**Bundle Size:** Medium (React + React Router), manageable under 3 MiB limit

**Community/Ecosystem:**
- Large React community
- Official Cloudflare support
- Multiple D1/auth templates on GitHub
- Active development

**Maturity:** Adapter v7.11.0 (stable)

**Verdict:** Best choice for interactive marketplace. Strong Cloudflare integration, excellent DX, proven for full-stack apps.

**Sources:**
- [React Router on Cloudflare Workers](https://developers.cloudflare.com/workers/framework-guides/web-apps/react-router/)
- [React Router Deployment Guide](https://reactrouter.com/start/framework/deploying)
- [react-router-cloudflare-d1 Template](https://github.com/matthewlynch/react-router-cloudflare-d1)
- [React Router Cloudflare Adapter NPM](https://www.npmjs.com/package/@react-router/cloudflare)
- [Full-Stack React Router + Cloudflare Tutorial](https://dev.to/atman33/from-zero-to-deployed-a-step-by-step-guide-to-building-a-full-stack-app-with-react-router-and-3efl)

---

### 3. Astro 6 ✅ **RECOMMENDED (for content-first sites)**

**Compatibility:** First-class Cloudflare Workers support (NEW in Astro 6 Beta, Feb 2026)

**Status:**
- **Astro 6 Beta just released** with redesigned dev server using Vite Environment API
- Direct Cloudflare bindings via `cloudflare:workers` module (no more `Astro.locals.runtime`)
- HMR support for D1, KV, R2, Durable Objects, Analytics Engine
- Adapter sets `output: 'server'` for on-demand SSR in Workers

**D1/KV/R2 Access:** ✅ **EXCELLENT**
- Direct platform API access via `cloudflare:workers`
- Local simulators work with Node.js dev server
- Best practices documented for D1/R2/KV

**SSR/SSG:** Hybrid - SSG by default, opt-in SSR per route (best of both worlds)

**Developer Experience:**
- ✅ Islands architecture (only hydrate interactive components)
- ✅ Framework-agnostic (use React, Vue, Svelte components together)
- ✅ Excellent for content-heavy sites
- ✅ Fast builds, minimal JS shipped
- ⚠️ Server code requires Node.js API knowledge

**Bundle Size:** **SMALLEST** - Only ships JS for interactive islands

**Performance:** 2x faster than traditional frameworks for content sites (Astro Islands architecture)

**Community/Ecosystem:**
- Growing rapidly (Cloudflare backing as of 2026)
- Strong documentation
- Content-focused community

**Maturity:** Astro 6 Beta (stable release imminent)

**Verdict:** Best for leaderboard/content-heavy sites with some interactivity. Excellent Cloudflare integration, tiny bundles, fast.

**Sources:**
- [Astro 6 Beta Announcement](https://www.infoq.com/news/2026/02/astro-v6-beta-cloudflare/)
- [Astro Cloudflare Adapter](https://docs.astro.build/en/guides/integrations-guide/cloudflare/)
- [Astro Cloudflare Deployment](https://docs.astro.build/en/guides/deploy/cloudflare/)
- [Astro in 2026: Why It's Beating Next.js](https://dev.to/polliog/astro-in-2026-why-its-beating-nextjs-for-content-sites-and-what-cloudflares-acquisition-means-6kl)
- [Astro Cloudflare Guide with Speed Boost](https://eastondev.com/blog/en/posts/dev/20251203-astro-cloudflare-deploy/)

---

### 4. SvelteKit ✅ Good Alternative

**Compatibility:** First-class support via @sveltejs/adapter-cloudflare

**Status:**
- `adapter-cloudflare-workers` deprecated; use `adapter-cloudflare`
- Svelte CLI (sv@0.11.0) provides one-click Cloudflare setup
- Vite Runtime API enables server-side HMR for data loaders
- Automated type detection for bindings

**D1/KV/R2 Access:** ✅ **EXCELLENT**
- Bindings via `platform.env` in hooks/endpoints
- Pass KV/DO namespaces, D1 databases
- Works with Drizzle ORM

**SSR/SSG:** Full SSR + adapter-static for SSG

**Developer Experience:**
- ✅ Outstanding DX - hot reload for server code
- ✅ One-click scaffolding for CF bindings
- ✅ Streamlined tooling out of box
- ✅ Type-safe by default
- ⚠️ Smaller community than React

**Bundle Size:** **20-40% smaller than Next.js**, typically scores 90/100 Lighthouse vs Next.js ~75/100

**Performance:** Excellent - faster than Next.js in most scenarios

**Community/Ecosystem:**
- Smaller than React but growing
- Strong Cloudflare community support
- Good CF-specific tutorials

**Maturity:** Stable adapter, production-ready

**Verdict:** Excellent choice if comfortable with Svelte. Better performance than React Router, smaller bundles, great DX.

**Sources:**
- [SvelteKit Cloudflare Adapter](https://svelte.dev/docs/kit/adapter-cloudflare)
- [SvelteKit on Cloudflare Pages](https://developers.cloudflare.com/pages/framework-guides/deploy-a-svelte-kit-site/)
- [D1 with SvelteKit Tutorial](https://developers.cloudflare.com/d1/examples/d1-and-sveltekit/)
- [SvelteKit vs Next.js 2026 Comparison](https://www.gigson.co/blog/sveltekit-vs-next-js-vs-astro-which-framework-wins-in-2026)
- [What's New in Svelte January 2026](https://svelte.dev/blog/whats-new-in-svelte-january-2026)

---

### 5. Hono + HonoX ⚡ **Best for Workers-Native**

**Compatibility:** Built FOR Cloudflare Workers (not adapted to it)

**Status:**
- Hono = ultrafast Web Standards microframework
- HonoX = meta-framework (file-based routing, SSR hydration)
- Workers-first design, runs on CF/Deno/Bun/Node/Edge
- No React dependency (can use any UI approach)

**D1/KV/R2 Access:** ✅ **NATIVE**
- Direct access via Workers bindings (no abstraction layer)
- Perfect integration with KV/R2/D1/Durable Objects/Queues
- Smallest overhead for CF resources

**SSR/SSG:** HonoX supports SSR + island hydration (like Astro)

**Developer Experience:**
- ✅ Minimal footprint, zero bloat
- ✅ Workers-native = no adapter friction
- ✅ Can use React/htmx/JSX/whatever
- ⚠️ HonoX still alpha (Hono itself stable)
- ⚠️ Less structure = more decisions
- ⚠️ Smaller community/ecosystem

**Bundle Size:** **SMALLEST** - Hono core ~12KB

**Performance:** Fastest cold starts, minimal bundle size

**Community/Ecosystem:**
- Growing rapidly (Cloudflare featured in blog)
- htmx + Hono stack gaining traction
- "Post-React" microframework movement

**Maturity:** Hono stable; HonoX alpha

**Verdict:** Best if you want Workers-native, minimal framework. Great for htmx + server-driven UI. Not ideal for MVP speed unless you know Hono well.

**Sources:**
- [Hono on Cloudflare Workers](https://developers.cloudflare.com/workers/framework-guides/web-apps/more-web-frameworks/hono/)
- [Hono + htmx + Cloudflare Stack](https://blog.yusu.ke/hono-htmx-cloudflare/)
- [Hono Official Site](https://hono.dev/)
- [Hono htmx Example](https://hono.dev/examples/htmx)
- [Hono Shows the Way for Microframeworks](https://thenewstack.io/hono-shows-the-way-for-microframeworks-in-a-post-react-world/)
- [HonoX GitHub](https://github.com/honojs/honox)

---

## Decision Matrix

| Framework | CF Integration | D1/KV/R2 | DX | Bundle Size | Speed to MVP | Recommendation |
|-----------|---------------|----------|-----|-------------|--------------|----------------|
| **Next.js** | ⚠️ Workaround | ⚠️ Complex | ⭐⭐⭐ | ❌ Large | Slow | ❌ Avoid |
| **React Router v7** | ✅ First-class | ✅ Excellent | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | **Fast** | ✅ **Top Pick** |
| **Astro 6** | ✅ First-class | ✅ Excellent | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | **Fast** | ✅ **Content-First** |
| **SvelteKit** | ✅ First-class | ✅ Excellent | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | **Fast** | ✅ Great Alternative |
| **Hono/HonoX** | ✅ Native | ✅ Native | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Medium | ⚡ Advanced Users |

---

## Final Recommendation

### For Developer Marketplace/Leaderboard:

**Primary:** **React Router v7**
- Proven full-stack framework
- Excellent Cloudflare integration
- Large React ecosystem for plugins/components
- Template repos with D1/auth
- Fast development iteration
- Perfect for interactive marketplace features

**Alternative:** **Astro 6** (if leaderboard is content-heavy)
- Best performance for static content
- Islands for interactive widgets (search, filters, charts)
- Tiny bundles = fast load times
- Can use React components where needed
- Better SEO for content pages

**If You Want Minimal/Workers-Native:** **Hono + htmx**
- Smallest bundles
- Server-driven UI (less client JS)
- Perfect CF Workers integration
- Requires more architectural decisions

**Avoid:** Next.js (unless you have existing Next.js codebase)

---

## Implementation Path (2-4 Week MVP)

### Week 1: Setup + Core Features
1. **Choose React Router v7** (interactive) or **Astro 6** (content-first)
2. Use official template: `npm create cloudflare@latest -- --framework react-router` or `npm create astro@latest`
3. Configure D1 database (users, submissions, leaderboard)
4. Set up authentication (Better Auth works with both)

### Week 2: Build Features
5. API routes for submissions/rankings
6. Leaderboard UI (SSR for SEO)
7. User profiles + auth flows

### Week 3: Polish + Integrations
8. Search/filtering (client-side)
9. KV for caching leaderboard
10. R2 for file uploads (if needed)

### Week 4: Deploy + Optimize
11. Deploy to Cloudflare Pages
12. Edge caching strategy
13. Performance optimization

---

## Unresolved Questions

1. **Authentication strategy?** Better Auth vs Clerk vs custom D1-based auth
2. **Real-time updates needed?** If yes, consider Durable Objects for WebSocket leaderboard updates
3. **File uploads?** R2 direct or presigned URLs
4. **Analytics?** Workers Analytics Engine vs third-party
5. **Content moderation?** AI Workers for submission screening

---

## Additional Resources

### General Cloudflare Info
- [Cloudflare Workers Limits](https://developers.cloudflare.com/workers/platform/limits/)
- [Cloudflare Pages Bindings](https://developers.cloudflare.com/pages/functions/bindings/)
- [Full-Stack Frameworks with Cloudflare](https://blog.cloudflare.com/blazing-fast-development-with-full-stack-frameworks-and-cloudflare/)

### Performance Benchmarks
- [2026 Wasm Benchmarks: Next.js vs Astro vs SvelteKit](https://criztec.com/2026-wasm-benchmarks-next-js-vs-astro-vs-kybc)
- [Top 10 Next.js Alternatives 2026](https://thebcms.com/blog/nextjs-alternatives)
- [Best Next.js Alternatives](https://naturaily.com/blog/best-nextjs-alternatives)

### Bundle Size Optimization
- [Cloudflare Workers Bundle Size Discussion](https://news.ycombinator.com/item?id=46336747)
- [Cloudflare Workers Performance Benchmarks](https://blog.cloudflare.com/unpacking-cloudflare-workers-cpu-performance-benchmarks/)

---

**Report Path:** `/Users/duynguyen/www/claudekit/skillx/plans/reports/researcher-260210-1113-cloudflare-frontend-framework-comparison.md`
