# Brainstorm: Phase 3.4 — Skill References & Scripts

**Date:** 2026-02-13
**Status:** Agreed — ready for planning

## Problem Statement

SkillX indexes 133K skills but only stores SKILL.md content. Skills on GitHub also have `references/` (markdown docs) and `scripts/` (executable files) directories. These aren't surfaced in search, API, UI, or CLI.

## Decisions Made

### References — Full Content Indexing
- Fetch reference `.md` files from GitHub repos during seeding
- Store content in DB (new `skill_references` table)
- Index in Vectorize for semantic search improvement
- Add titles to FTS5 for keyword discoverability
- Agent can also fetch on-demand from GitHub raw URLs

### Scripts — Agent-Mediated Execution
- Store script metadata (name, description, source URL, command)
- No Docker/sandbox — agent acts as security gate
- Agent reads SKILL.md → sees scripts → fetches from GitHub → reviews → executes via Bash
- User approves/denies via tool permissions (human-in-the-loop)
- Display scripts on skill detail page + CLI output

## Architecture

### Database
- `skill_references` table: id, skill_id, title, url, type, content, created_at
- `skill_scripts` table: id, skill_id, name, description, command, url, created_at
- Or: JSON columns on skills table (simpler, less normalized)

### Seed Pipeline
1. Parse SKILL.md for reference/script links
2. Fetch GitHub tree API to discover `references/` and `scripts/` dirs
3. Fetch raw content for each reference .md file
4. Store in DB + generate embeddings + index in Vectorize
5. Store script metadata (no content fetching needed for scripts)

### Search Enhancement
- Vectorize: reference content indexed alongside skill content
- FTS5: reference titles + script names added to keyword index
- RRF fusion: references contribute to skill ranking

### API Changes
- Skill detail endpoint returns references + scripts arrays
- Search results optionally include matched reference context

### UI Changes
- Skill detail page: "References" collapsible section with icons by type
- Skill detail page: "Scripts" section with descriptions + copy-to-clipboard
- CLI `skillx use` shows available scripts

## Risks
- **Volume**: 133K skills × N references = potentially millions of files to fetch
- **Rate limits**: GitHub API rate limits (5K/hr authenticated, 60/hr unauthenticated)
- **Staleness**: Reference content may change upstream
- **Workers AI limits**: More embeddings = more rate limit risk
- **Storage**: D1 row limits, Vectorize vector count limits

## Mitigations
- Batch fetching with GitHub token for higher rate limits
- Progressive indexing (start with top-rated skills, expand)
- TTL-based reindex for staleness
- Chunking strategy for large references

## Success Criteria
- References displayed on skill detail pages
- Scripts displayed with copy-to-clipboard
- Search quality improved (references contribute to ranking)
- CLI shows references & scripts in `skillx use` output
- Agent workflow: search → use skill → access references → execute scripts
