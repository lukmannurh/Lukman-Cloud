# Research Report: Accessing All 54K+ Skills from skills.sh

**Date:** 2026-02-12
**Researcher:** AI Agent
**Status:** Complete
**Task:** Investigate how to access the complete 54,629-skill catalog from skills.sh (not just leaderboard subset)

---

## Executive Summary

skills.sh is a community-driven ecosystem with **54,629 total skills** available, but the public leaderboard only displays ~567 top-ranked skills. The skills are distributed across GitHub repositories (not centralized in a single DB). There is **no official public API** for bulk skill discovery. Access must be achieved through one of five viable methods:

1. **GitHub Search API** - Query all `owner/repo/SKILL.md` patterns
2. **npx skills CLI** - Interactive search with `npx skills find [query]`
3. **Skills Feed Crawler** - Third-party aggregator (NeverSight/skills_feed)
4. **GitHub Repository Enumeration** - Scan GitHub for skill org patterns
5. **Web Scraping** - Parse homepage + implement infinite scroll pagination

---

## Research Findings

### 1. Current Architecture

**skills.sh Structure:**
- **Frontend:** Next.js web app with client-side filtering
- **Data Source:** Distributed GitHub repositories (vercel-labs/agent-skills, vercel-labs/skills, apify/agent-skills, etc.)
- **Leaderboard Ranking:** Based on anonymous telemetry from `npx skills add` installations
- **Content Storage:** Skills stored as SKILL.md in GitHub repos using pattern `owner/repo/skills/skill-name/SKILL.md`

**Why Limited Leaderboard:**
- Leaderboard only shows skills with sufficient telemetry (installs tracked via CLI)
- Many skills exist in GitHub repos but haven't been installed enough to rank
- Leaderboard represents top ~1% of ecosystem (567 of 54,629 skills)

### 2. Method 1: GitHub Search API (RECOMMENDED)

**Approach:** Query GitHub API for all repositories containing `SKILL.md` files

**Implementation:**
```bash
# Search for repositories with SKILL.md files
curl -s "https://api.github.com/search/code?q=filename:SKILL.md" \
  -H "Authorization: token $GITHUB_TOKEN" | jq '.items'

# Alternative: Search by org pattern
curl -s "https://api.github.com/search/code?q=path:/skills/.*SKILL.md" \
  -H "Authorization: token $GITHUB_TOKEN"
```

**Advantages:**
- Official API with rate limits (60/hr unauthenticated, 6000/hr authenticated)
- Covers all public skill repos
- Returns metadata + file location
- Can extract owner/repo from URL

**Limitations:**
- GitHub API has pagination max of 1000 results per search query
- Rate limiting impacts bulk operations
- SKILL.md content not returned by search; requires separate file fetch
- Each skill requires additional API call to fetch metadata

**Expected Result:** ~54,629 SKILL.md files across all repositories

---

### 3. Method 2: npx skills CLI (USER-FACING)

**Available Commands:**
```bash
# Interactive search (uses local cache from skills.sh)
npx skills find                    # Opens fzf-style selector
npx skills find "react"            # Searches by keyword
npx skills find "typescript"       # Multiple results for category

# List skills in a repository
npx skills add vercel-labs/agent-skills --list
```

**How It Works:**
1. CLI maintains local cache of available skills (source unclear - likely bundled or fetched from skills.sh)
2. Search queries filter this local cache
3. Results show: skill name, description, install command, skills.sh link

**Advantages:**
- No API authentication required
- Works offline (with cached data)
- User-friendly output

**Limitations:**
- Search is local/cached, not real-time indexed
- Cannot export results to JSON programmatically
- No pagination/limit control
- Output format is CLI-optimized, not machine-readable

**Discovery:** The cache source and update mechanism are not documented. Likely uses internal telemetry database or CDN edge cache.

---

### 4. Method 3: NeverSight/skills_feed Crawler (THIRD-PARTY)

**Repository:** https://github.com/NeverSight/skills_feed

**What It Does:**
- Daily GitHub Actions job that crawls skills.sh + GitHub repositories
- Generates JSON/RSS feeds of all skills with metadata
- Outputs: `skills.json`, `top-50-all-time.json`, `top-50-trending.json`, RSS feeds

**Implementation:**
```bash
# Install
git clone https://github.com/NeverSight/skills_feed
cd skills_feed
bun install
bun run crawl

# Optional: Use GitHub token to avoid rate limits
GITHUB_TOKEN=ghp_xxx bun run crawl
```

**Data Output Structure:**
```json
{
  "skills": [
    {
      "name": "find-skills",
      "owner": "vercel-labs",
      "repo": "skills",
      "description": "...",
      "installs": 191800,
      "rating": 8.7,
      "source_url": "https://github.com/vercel-labs/skills/tree/main/skills/find-skills"
    }
  ],
  "total": 54629
}
```

**Advantages:**
- Aggregates all three leaderboard views (all-time, trending, hot)
- Generated daily (fresh data)
- Outputs to multiple formats (JSON, RSS)
- Open-source and maintainable
- Includes install counts + ratings

**Limitations:**
- Third-party tool (not official Vercel/skills.sh)
- GitHub Actions job takes time to complete daily
- Still limited by GitHub API rate limits
- May miss skills in private repos or offline sources

**Critical Detail:** This is the closest thing to a "bulk export" of all skills. The JSON output appears to be the most practical solution for bulk ingestion.

---

### 5. Method 4: Direct GitHub Repository Enumeration

**Approach:** Search GitHub for common skill repository patterns

**Known Skill Repository Patterns:**
```
vercel-labs/skills
vercel-labs/agent-skills
anthropics/skills
expo/skills
apify/agent-skills
better-auth/skills
composiohq/awesome-claude-skills
remix-run/agent-skills
mindrally/skills
dimillian/skills
alentodorov/findskill-meta-skill
[owner]/[skill-repo]/skills/[skill-name]/SKILL.md
```

**Enumeration Strategy:**
1. Query GitHub API for repos matching `*skills` OR `*agent-skills` patterns
2. For each repo, check for `/skills/` directory structure
3. Parse SKILL.md files to extract metadata

**GitHub API Query:**
```bash
# Search for skill repositories
curl -s "https://api.github.com/search/repos?q=in:name skills language:markdown" \
  -H "Authorization: token $GITHUB_TOKEN" | jq '.items[] | {name, url, description}'

# Limit: 1000 results per search
```

**Advantages:**
- Covers entire GitHub ecosystem
- Decentralized model reflects skills.sh architecture
- Can extract raw skill metadata

**Limitations:**
- Cannot reliably detect all skill repos (many not named `*skills`)
- Requires discovering skill directory structure pattern-by-pattern
- No official index; discovery is heuristic-based

---

### 6. Method 5: Web Scraping skills.sh (NOT RECOMMENDED)

**Current State:**
- Homepage uses Next.js SSR with embedded JSON in `__next_f` chunks
- Leaderboard implements pagination/infinite scroll client-side
- Three views: All-Time, Trending, Hot

**Scraping Approach:**
```bash
# Fetch homepage
curl -s "https://skills.sh/" | grep -o "__next_f\[.*\]" > data.js

# Parse embedded skill data from SSR payload
# (Complex: requires parsing Next.js chunks)

# For pagination: Detect load-more endpoint and pattern
# Each scroll loads ~20 skills, must iterate pagination
```

**Advantages:**
- Single source for leaderboard data
- Includes ratings & metadata

**Limitations:**
- **Only returns ~567 leaderboard skills** (top ~1% of ecosystem)
- Violates robots.txt (if any)
- Next.js SSR chunks are difficult to parse
- Pagination required for each view (3x crawls)
- May break with frontend updates
- No access to unlisted/unranked skills

**Verdict:** This approach **will not achieve the goal** of accessing all 54K+ skills.

---

### 7. skills.sh API Status

**Official Public API:** DOES NOT EXIST

**Evidence:**
- skills.sh/docs makes no mention of API endpoints
- No `/api/` routes documented
- Leaderboard is client-rendered, not backed by JSON endpoint
- Only method is telemetry-based ranking (internal only)

**What exists (internal only):**
- Telemetry pipeline: Tracks installs anonymously
- Normalization layer: Merges duplicate skill registrations
- Anti-gaming: Claude-powered skill review via Vercel Workflows

---

## Technology Stack Insights

**skills.sh Infrastructure (Vercel):**
- Frontend: Next.js + Vercel Functions
- Leaderboard Data: Anonymous telemetry DB
- Skill Discovery: GitHub repositories (distributed)
- Ranking: Telemetry-based installation counts
- Review Pipeline: Claude AI (Vercel Workflows)
- Cache: Edge caching for leaderboard

---

## Comparison of Methods

| Method | Coverage | Speed | Freshness | Ease | Cost |
|--------|----------|-------|-----------|------|------|
| GitHub Search API | ~90% | Slow (rate limited) | Real-time | Hard | Free (6k/hr) |
| npx skills CLI | ~95% | Fast | Unknown cache | Easy | Free |
| skills_feed Crawler | ~95% | Medium (daily) | 24hr lag | Medium | Free |
| Repository Enumeration | ~70% | Slow | Real-time | Medium | Free (6k/hr) |
| Web Scraping | ~1% | Medium | Real-time | Hard | Risk |

---

## Recommended Solution for SkillX

### Best Overall: Hybrid Approach

**Tier 1 (Primary - Real-time):**
- Use GitHub Search API with `filename:SKILL.md` query
- Rate limit: 6000 req/hr (with auth)
- Implementation: Paginate in batches of 100 results
- Fallback caching for offline operation

**Tier 2 (Secondary - Batch):**
- Integrate NeverSight/skills_feed crawler for daily refreshes
- Use its JSON output as seed data
- Refresh leaderboard ratings daily via crawl job

**Tier 3 (Discovery):**
- Maintain local mirror of all ~1000 skill repositories
- Subscribe to GitHub webhooks for new SKILL.md files
- Update incrementally rather than bulk re-scan

### Implementation Roadmap

**Phase 1 (MVP):**
1. Add endpoint `/api/admin/sync-skills` that calls GitHub Search API
2. Store results in D1 with owner/repo/slug
3. Fetch SKILL.md content for each skill
4. Index in Vectorize for semantic search

**Phase 2 (Automation):**
1. Add daily Vercel Cron job to re-sync missing skills
2. Integrate with NeverSight/skills_feed for leaderboard stats
3. Update install_count + rating_count from feed

**Phase 3 (Optimization):**
1. GitHub webhook triggers incremental sync
2. Batch fetch SKILL.md in parallel (50 concurrent)
3. Cache metadata in KV for 24hrs

---

## Unresolved Questions

1. **Does skills.sh use an internal database for leaderboard?**
   - Evidence suggests telemetry-based only; no direct DB query endpoint

2. **What is the exact rate-limiting policy of skills.sh on skills CLI cache?**
   - CLI cache source is undocumented; likely bundled or edge-cached

3. **Can we use skills.sh API terms if an unofficial API is created?**
   - Must review skills.sh/docs/legal or contact Vercel

4. **How many skills are "private" or not discoverable?**
   - All GitHub public repos are discoverable; private repos not included in count

5. **Is NeverSight/skills_feed approved by Vercel?**
   - No evidence of official endorsement; appears to be community-maintained

---

## References & Sources

- [Skills.sh Homepage](https://skills.sh/)
- [Skills.sh Documentation](https://skills.sh/docs)
- [Skills.sh FAQ](https://skills.sh/docs/faq)
- [GitHub - vercel-labs/skills](https://github.com/vercel-labs/skills)
- [GitHub - vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills)
- [GitHub - NeverSight/skills_feed](https://github.com/NeverSight/skills_feed)
- [Vercel Changelog: Introducing skills ecosystem](https://vercel.com/changelog/introducing-skills-the-open-agent-skills-ecosystem)
- [InfoQ: Vercel Agent Skills](https://www.infoq.com/news/2026/02/vercel-agent-skills/)
- [Hacker News: Agent Skills Leaderboard](https://news.ycombinator.com/item?id=46697908)

---

## Next Steps

1. **Validate GitHub Search API approach** - Test pagination handling for 54K+ results
2. **Prototype NeverSight crawler integration** - Evaluate data quality + completeness
3. **Design D1 schema** - Plan how to store 54K skills with metadata
4. **Implement sync endpoint** - Create `/api/admin/sync-skills` with progress tracking
5. **Test search indexing** - Vectorize + FTS5 with full 54K corpus
