# Brainstorm: Leaderboard Enhancements

**Date:** 2026-02-13
**Status:** Agreed — ready for planning

## Problem Statement

The leaderboard UI is bare-bones: hardcoded sort, plain text author, no quick actions, no community engagement signals. Users can't filter, favorite, preview, or vote on skills without navigating to individual detail pages. The search algorithm lacks a community sentiment signal (votes).

## Requested Features

1. **Filter & Sort** — expose existing API sort modes + category filter in UI
2. **Clickable Author** — link to GitHub profile
3. **Quick Favorites** — heart toggle button in leaderboard rows
4. **Preview Modal** — quick info popup without navigating away
5. **Reddit-style Votes** — upvote/downvote with net count, integrated into search + leaderboard scoring

## Current State

- Leaderboard API: 5 sort modes (`best|rating|installs|trending|newest`), pagination, KV cached
- UI: hardcoded `sort=best`, infinite scroll, no controls
- Author: plain text, not clickable
- Favorites API: exists (`POST /api/skills/:slug/favorite`), toggle behavior
- Votes: **do not exist** — no table, no API, no UI
- Search boost: 7 signals (RRF 50%, rating 15%, stars 10%, usage 8%, success 7%, recency 5%, favorites 5%)
- Leaderboard scoring: 6 signals (rating 35%, installs 25%, stars 15%, success 10%, recency 10%, favorites 5%)

## Agreed Approach

### 1. Filter & Sort (LOW effort)
- Sort pills/tabs above table: Best, Rating, Installs, Trending, Newest
- Category dropdown filter (fetch category list from loader)
- Update `home-leaderboard.tsx` to pass dynamic `sort` + `category` params to API
- Update `api.leaderboard.ts` to accept `category` filter param (if not already)

### 2. Clickable Author → GitHub (TRIVIAL)
- Wrap author in `<a href="https://github.com/{author}" target="_blank">`
- Add external link icon
- Most SkillsMP authors = GitHub usernames

### 3. Quick Favorites (MEDIUM effort)
- Heart icon toggle in Actions column
- Auth required — show login prompt for anon users
- **Client-side overlay pattern**: KV-cached leaderboard stays shared, fetch user's favorites via `/api/user/favorites` on mount, overlay filled/unfilled state
- Optimistic UI: toggle immediately, revert on error

### 4. Preview Modal (MEDIUM effort)
- Eye/preview icon button in Actions column
- Modal shows: name, author, description, category, rating, install count, install command
- **Expand leaderboard API** to include `description` + `category` in response (no extra fetch needed)
- Reuse existing design tokens, lucide icons

### 5. Vote System (HIGH effort)

**Database:**
- New `votes` table: `id, user_id, skill_id, vote_type ('up'|'down'), created_at`
- Unique constraint: `(user_id, skill_id)` — change vote allowed, no double-vote
- Precomputed columns on skills: `upvote_count`, `downvote_count`, `net_votes`

**API:**
- New `POST /api/skills/:slug/vote` endpoint
- Body: `{ type: 'up' | 'down' | 'none' }` (none = remove vote)
- Auth required; anon users see counts but can't vote
- Triggers `recomputeSkillScores()` fire-and-forget

**UI:**
- Up/down arrows + net count displayed in leaderboard
- Current user's vote state highlighted (like Reddit)
- Client-side overlay for vote state (same pattern as favorites)

**Search Algorithm (8th signal):**

| Signal | Current | New | Delta |
|--------|---------|-----|-------|
| RRF Score | 50% | 43% | -7% |
| Rating | 15% | 15% | — |
| Stars | 10% | 10% | — |
| Usage | 8% | 8% | — |
| Success Rate | 7% | 7% | — |
| **Votes** | — | **7%** | **+7%** |
| Recency | 5% | 5% | — |
| Favorites | 5% | 5% | — |

Normalization: `log(1 + max(0, net_votes)) / log(1 + max_net_votes)` — same as stars/installs.

**Leaderboard Scoring (7th signal):**

| Signal | Current | New | Delta |
|--------|---------|-----|-------|
| Bayesian Rating | 35% | 30% | -5% |
| Installs | 25% | 20% | -5% |
| Stars | 15% | 15% | — |
| **Votes** | — | **10%** | **+10%** |
| Success Rate | 10% | 10% | — |
| Recency | 10% | 10% | — |
| Favorites | 5% | 5% | — |

## Implementation Phases (Proposed)

| Phase | Scope | Effort |
|-------|-------|--------|
| 1 | DB migration (votes table, skills columns) + Vote API | 2h |
| 2 | Leaderboard UI: sort/filter + clickable author + preview modal | 3h |
| 3 | Leaderboard UI: favorites button + vote arrows + auth overlay | 3h |
| 4 | Scoring updates: search boost + leaderboard composite + recompute | 2h |

**Total estimated effort:** ~10h

## Risks

| Risk | Level | Mitigation |
|------|-------|------------|
| Vote gaming (bots) | Medium | Auth required + rate limit (10 votes/min) |
| KV cache shows stale vote counts | Low | 5-min TTL acceptable; client overlay for own votes |
| Leaderboard response size growth | Low | +200 bytes/entry for preview data |
| Score rebalancing changes rankings | Medium | A/B test weights, monitor search quality |

## Decisions Made

- Votes **coexist** with 0-10 ratings (not replace)
- Author links to **GitHub profile** (not filter or new page)
- Votes as **8th signal** in search (reduce RRF from 50% → 43%)
- Anon users **see counts**, login required to vote
- **Single plan** with 4 phases
- Client-side overlay for favorites/votes state (preserve KV cache)
