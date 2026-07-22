# Phase 5: Web UI Pages

## Context Links
- [Design guidelines](../../docs/design-guidelines.md)
- [Phase 2: Auth](./phase-02-authentication.md)
- [Phase 4: Search](./phase-04-hybrid-search-engine.md)

## Overview
- **Priority:** P1 (User-facing product)
- **Status:** Pending
- **Effort:** 16h
- **Week:** 2-3 (Day 4-8)
- **Depends on:** Phase 2 (auth) + Phase 4 (search API)

Build all web UI pages following design-guidelines.md: Home/Hero, Leaderboard, Search, Skill Detail, Profile, Settings. Dark theme, Geist fonts, terminal-native aesthetic.

## Key Insights
- Design tokens from design-guidelines.md: `--sx-bg: #0A0A0A`, `--sx-accent: #00E5A0`
- Geist Sans for headings/body, Geist Mono for code/labels
- Lucide icons, monoline style
- Mobile-first responsive: 640/1024/1200px breakpoints
- SSR for SEO on leaderboard + skill pages
- Card hover: translateY(-2px) + shadow

## Requirements

### Functional
- **Home:** Hero section, tagline, command box, stats row
- **Leaderboard:** Sortable table, rank/skill/source/installs/rating/actions
- **Search:** Input with `/` shortcut, results grid, filter tabs
- **Skill Detail:** Full info, description, tags, rating display, install command
- **Profile:** User info, favorites list, usage history
- **Settings:** API key management (generate, list, revoke)

### Non-functional
- Dark theme default (near-black #0A0A0A)
- Responsive: mobile → tablet → desktop → wide
- Page load: staggered fade-in for card grids
- Accessible: 4.5:1 contrast, focus rings, keyboard navigation

## Architecture

```
Route structure (React Router v7 file-based):
  routes/
  ├── _index.tsx         → Home/Hero (public)
  ├── leaderboard.tsx    → Leaderboard (public, SSR)
  ├── search.tsx         → Search page (public)
  ├── skills.$slug.tsx   → Skill detail (public, SSR)
  ├── profile.tsx        → User profile (protected)
  ├── settings.tsx       → API keys (protected)
  └── api/               → API routes (Phase 4+6)

Shared components:
  components/
  ├── layout/
  │   ├── navbar.tsx
  │   ├── footer.tsx
  │   └── page-container.tsx
  ├── skill-card.tsx
  ├── leaderboard-table.tsx
  ├── search-input.tsx
  ├── filter-tabs.tsx
  ├── rating-badge.tsx
  ├── command-box.tsx
  └── auth-button.tsx (from Phase 2)
```

## Related Code Files

### Create
- `apps/web/app/routes/_index.tsx` — Home/Hero page
- `apps/web/app/routes/leaderboard.tsx` — Leaderboard page
- `apps/web/app/routes/search.tsx` — Search page
- `apps/web/app/routes/skills.$slug.tsx` — Skill detail page
- `apps/web/app/routes/profile.tsx` — User profile (protected)
- `apps/web/app/routes/settings.tsx` — Settings/API keys (protected)
- `apps/web/app/components/layout/navbar.tsx`
- `apps/web/app/components/layout/footer.tsx`
- `apps/web/app/components/layout/page-container.tsx`
- `apps/web/app/components/skill-card.tsx`
- `apps/web/app/components/leaderboard-table.tsx`
- `apps/web/app/components/search-input.tsx`
- `apps/web/app/components/filter-tabs.tsx`
- `apps/web/app/components/rating-badge.tsx`
- `apps/web/app/components/command-box.tsx`

### Modify
- `apps/web/app/root.tsx` — add navbar, footer, font loading
- `apps/web/tailwind.config.ts` — ensure all design tokens present

## Implementation Steps

### 1. Build layout components

**Navbar** (56px height, sticky, backdrop-blur):
- Left: "SkillX" wordmark in Geist Mono
- Center: Leaderboard, Search links
- Right: AuthButton + "Get API Key" CTA

**PageContainer**: max-w-6xl, centered, responsive padding

### 2. Build shared components

**SkillCard:** Elevated card with name, description (2-line truncate), category badge, rating badge, install action. Hover: translateY(-2px).

**LeaderboardTable:** Rank, Skill name, Author, Installs (K/M format), Rating tier badge (S/A/B/C), "Install" button. Alternating row bg. Sticky header. Clickable column headers for sorting.

**SearchInput:** Mono font, `/` keyboard shortcut badge, accent border on focus, glow ring.

**FilterTabs:** All Time | Trending | Top Rated | New. Mono uppercase, accent bg on active.

**RatingBadge:** Tier letter + score. Colors: S=gold, A=green, B=blue, C=muted.

**CommandBox:** Dark elevated surface, `$` prefix in subtle color, copy button.

### 3. Home/Hero page (`_index.tsx`)
```
loader: Fetch stats (total skills, total installs, agents supported)
UI:
  - ASCII "SKILLX" brand treatment
  - Tagline: "The Only Skill That Your AI Agent Needs."
  - Command box: $ npx skillx search "deploy to cloudflare"
  - Stats row: 3 stat cards
  - Featured/trending skills grid (top 6)
```

### 4. Leaderboard page (`leaderboard.tsx`)
```
loader: Fetch skills with ratings, sorted by rank
  - Support query params: ?sort=rating|installs|new&category=all
  - SSR for SEO
UI:
  - Page title "Leaderboard"
  - FilterTabs for time/category
  - LeaderboardTable with sortable columns
  - Pagination (load more or infinite scroll)
```

### 5. Search page (`search.tsx`)
```
loader: If ?q param, run hybridSearch from Phase 4
UI:
  - Large SearchInput (centered, prominent)
  - FilterTabs below search
  - Results: SkillCard grid (3-col desktop, 2-col tablet, 1-col mobile)
  - Empty state: "No skills found. Try a different query."
  - Loading state: skeleton cards
```

### 6. Skill detail page (`skills.$slug.tsx`)
```
loader: Fetch skill by slug, ratings, reviews, usage stats
  - SSR for SEO
UI:
  - Skill name + author badge
  - Description (full text)
  - Category badges (phase colors)
  - Install command box
  - Rating display (aggregate + tier badge)
  - Skillmark radar chart embed (iframe/placeholder)
  - Reviews section (Phase 6 populates)
  - Usage stats (Phase 6 populates)
  - Favorite button (Phase 6)
```

### 7. Profile page (`profile.tsx`) — protected
```
loader: requireAuth → fetch user, favorites, recent usage
UI:
  - Avatar + name + GitHub link
  - Favorites list (SkillCard grid)
  - Recent usage history (table)
```

### 8. Settings page (`settings.tsx`) — protected
```
loader: requireAuth → fetch API keys
UI:
  - "API Keys" section
  - List of keys (name, created, last used, revoke button)
  - "Generate New Key" button → shows plaintext once
```

## Todo List
- [ ] Build navbar component (sticky, backdrop-blur, auth button)
- [ ] Build footer + page-container layout
- [ ] Build skill-card component
- [ ] Build leaderboard-table component (sortable)
- [ ] Build search-input component (/ shortcut, focus glow)
- [ ] Build filter-tabs component
- [ ] Build rating-badge component (S/A/B/C tiers)
- [ ] Build command-box component (copy button)
- [ ] Build Home/Hero page with stats
- [ ] Build Leaderboard page with sorting/filtering
- [ ] Build Search page with hybrid search integration
- [ ] Build Skill detail page
- [ ] Build Profile page (protected)
- [ ] Build Settings page (protected, API keys)
- [ ] Responsive testing (mobile/tablet/desktop)
- [ ] Dark theme polish (design tokens verified)

## Success Criteria
- All 6 pages render correctly
- Leaderboard sortable by rating/installs/new
- Search returns results from hybrid search API
- Skill detail shows full information
- Protected routes redirect unauthenticated users
- Design matches design-guidelines.md specs
- Mobile responsive at all breakpoints
- Lighthouse: Performance >80, Accessibility >90

## Risk Assessment
- **Geist font loading:** Self-host via R2 or use next-font equivalent
- **SSR hydration mismatches:** Test with `pnpm build && pnpm start`
- **Large leaderboard data:** Paginate, don't load all at once

## Security Considerations
- Protected routes use `requireAuth` from Phase 2
- No sensitive data in SSR'd HTML
- API keys shown once, masked in list view
- XSS prevention: React auto-escapes, don't use dangerouslySetInnerHTML

## Next Steps
- Phase 6: Add ratings, reviews, favorites interactions + CLI
