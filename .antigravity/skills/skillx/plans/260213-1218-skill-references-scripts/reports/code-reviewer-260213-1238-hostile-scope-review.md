# Hostile Scope & Complexity Review: Phase 3.4 Skill References & Scripts

**Reviewer:** code-reviewer
**Date:** 2026-02-13 12:38
**Plan:** Phase 3.4: Skill References & Scripts
**Review Type:** Scope & complexity critique (YAGNI enforcement)

---

## Finding 1: JSON Column Over-Engineering for Scripts
- **Severity:** Medium
- **Location:** Phase 1, section "Why `scripts` as JSON column?"
- **Flaw:** Storing scripts as JSON TEXT column creates parsing overhead, type safety issues, and query limitations without solving any actual problem
- **Failure scenario:** Every API call, CLI request, and UI render must JSON.parse() the scripts field. No validation at DB layer means corrupt JSON can get stored. Can't query "which skills have scripts" without full table scan. Try/catch parsing in Phase 4 line 168 already hints at data corruption risk.
- **Evidence:** Phase 1: "Scripts are metadata-only (no content), so JSON column is fine." Phase 4: "JSON parsing uses try/catch to handle malformed data." Phase 3: scripts sent as JSON string from seed pipeline. This is premature format optimization without measuring if separate table would even matter.
- **Suggested fix:** Use separate `skill_scripts` table matching `skill_references` structure. Same FK pattern, same cascade delete, indexable, queryable, type-safe. The "max 10 scripts" validation is app-level fiction that won't prevent bad data.

## Finding 2: Massive GitHub Rate Limit Exposure with No Concrete Mitigation
- **Severity:** Critical
- **Location:** Phase 2, section "Risk Assessment" line 207-211
- **Flaw:** Plan acknowledges 5K/hr rate limit but provides zero concrete math on actual request counts needed. "~1K unique repos" is a guess. "May need multiple runs" is not a mitigation strategy.
- **Failure scenario:** Script starts fetching trees for 1K repos. Each repo has avg 5 references × 1K repos = 5K raw content fetches. Total 6K requests. Hits rate limit after 5K requests (~83% complete). Script pauses. User waits 1 hour. Resumes. Hits limit again because batch files weren't written incrementally. User gives up. Phase 2 blocks Phase 3, entire feature dead.
- **Evidence:** Phase 2 line 207: "HIGH probability — 133K skills but deduplicated to ~1K unique repos. Tree fetch = 1 call/repo + N calls for reference content." No actual calculation of N. No staged rollout plan (top 100 skills first, then expand). Progress tracking saves completed repos but doesn't write enriched batches until end.
- **Suggested fix:** Calculate exact request budget. Start with top 50 most-installed skills only. Verify rate limit math works. Expand incrementally. Write enriched batches after each repo (not at end). Add `--top-n` flag to process subset.

## Finding 3: Vectorize Embedding Explosion Without Capacity Planning
- **Severity:** High
- **Location:** Phase 3, section "Risk Assessment" line 212
- **Flaw:** Phase adds "5 references × 3 chunks = 15 extra embeddings" per skill but provides no calculation of total new vectors or Vectorize capacity limits
- **Failure scenario:** Current 133K skills already indexed. Plan adds 5 references/skill avg = 665K new reference entries. Each reference 512-token chunks × 3 avg = 2M new vectors. Vectorize free tier: 5M vectors. Already have ~400K skill vectors (133K skills × 3 chunks). 400K + 2M = 2.4M vectors just for references. Paid tier costs not evaluated. Seed starts, hits Vectorize quota at 60% complete, entire feature fails.
- **Evidence:** Phase 3 line 212: "each reference adds embeddings. A skill with 5 references × 3 chunks = 15 extra embeddings." No multiplication by 133K skills. No Vectorize capacity check. No staged rollout. Phase plan overview line 26: "Progressive indexing: Start with top-rated skills, expand" — mentioned but NOT implemented in any phase steps.
- **Suggested fix:** Calculate total vectors needed. Check Vectorize limits. Implement actual progressive indexing in Phase 3: seed top 1K skills first, measure vector count, project costs, get approval before full rollout.

## Finding 4: Reference Content Duplication Across DB and Vectorize
- **Severity:** Medium
- **Location:** Phase 1, section "Why not a JSON column for references?" line 43-47 + Phase 3 Vectorize indexing
- **Flaw:** Reference content stored in full in `skill_references.content` TEXT column AND chunked/embedded in Vectorize. D1 storage doubles for no user-facing benefit.
- **Failure scenario:** User browses skill detail page. API returns reference metadata (title, filename, url) but NOT content (Phase 4 line 33). UI shows reference links (Phase 5). User clicks link, goes to GitHub raw URL. The stored `content` field is never served to users. Only Vectorize uses it for search. 133K skills × 5 refs × 50KB avg = 33GB stored in D1 that's never read except during re-indexing.
- **Evidence:** Phase 4 line 33-43: "Note: `references` in API response excludes `content` field (too large)." Phase 5 never displays reference content. Phase 1 justifies separate table for "Vectorize embedding per-reference" but content is only for Vectorize, not user display.
- **Suggested fix:** Don't store reference content in D1. Fetch from GitHub on-demand during seed → embed in Vectorize → discard. Or store content but ONLY if you plan to serve it (preview snippets, full-text view). Current plan pays storage cost for unused data.

## Finding 5: FTS5 Re-Index Handwaving Without Implementation Plan
- **Severity:** High
- **Location:** Phase 4, section "FTS5 Update" line 45-63 + section "Risk Assessment" line 162
- **Flaw:** Plan concludes "append reference titles to content at seed time" (Phase 3) but existing 133K skills already seeded won't have reference titles in FTS5 index. Risk assessment admits "existing skills need FTS5 reindex" but provides no steps.
- **Failure scenario:** Phase 3 seeds 5K new skills with reference titles in content field → FTS5 indexes them. 128K existing skills have no reference titles → search for "MongoDB CRUD" (a reference title) only returns newly seeded skills. User searches for skill they know has MongoDB references, doesn't appear in results. Feature broken for 96% of skills.
- **Evidence:** Phase 4 line 162: "existing skills need FTS5 reindex to include ref titles. Can be done as batch operation." Zero implementation details. Phase 3 seed pipeline updates content at seed time but doesn't backfill existing skills. Phase 4 has no TODO for backfill script.
- **Suggested fix:** Add Phase 3.5: FTS5 backfill script. Iterate all skills, fetch references from `skill_references`, append titles to FTS5 indexed text, rebuild FTS5 virtual table. OR just rebuild entire FTS5 index from scratch (simpler). Include in plan with time estimate.

## Finding 6: Type Inference Magic Instead of Explicit Metadata
- **Severity:** Medium
- **Location:** Phase 2, section "Infer reference type from filename" line 166-173
- **Flaw:** Relies on brittle filename pattern matching ("includes 'api'", "includes 'guide'") instead of requiring skill authors to specify type in SKILL.md or frontmatter
- **Failure scenario:** Skill has reference `advanced-api-patterns.md` → inferred as type "api". Actually it's a guide about API patterns. UI shows API icon (Code2), user expects API reference docs, clicks, gets workflow guide. Filename-based heuristic fails for: `mongo.md` (docs? api? guide?), `quick-start.md` (guide? docs?), `v2-migration.md` (guide? cheatsheet?).
- **Evidence:** Phase 2 line 166-173: entire type inference based on substring matching. Fallback to 'docs' for everything else. No plan to parse structured metadata from reference files (frontmatter, headers).
- **Suggested fix:** Either accept that ALL references are type "docs" (good enough for MVP), OR require skill authors to add frontmatter to reference files (`type: api`), OR parse first heading level (`# API Reference` → api type). Filename guessing is fake precision.

## Finding 7: CLI Token Efficiency Ignored in --raw Mode
- **Severity:** Medium
- **Location:** Phase 6, section "Agent Flow (--raw mode)" line 27-43
- **Flaw:** Raw mode appends full reference URLs and script commands to skill content output. Agent receives 5 references × 150 chars each = 750 extra tokens per skill. Multiplied by search results = massive token waste.
- **Failure scenario:** Agent runs `skillx search database --limit=20 --raw` to compare skills. Each result now includes 5 reference URLs + 3 script commands = 1K extra tokens/skill × 20 results = 20K tokens. Agent's context window fills with URLs it won't fetch. Agent can't fit full search results in Claude API request, truncates, misses best match.
- **Evidence:** Phase 6 line 35-42: references and scripts appended to EVERY skill output in raw mode. No flag to disable. Search command uses same raw mode (line 7). No token budget analysis.
- **Suggested fix:** Add `--include-refs` and `--include-scripts` flags. Default raw mode = SKILL.md content only (current behavior). Agent opts into references/scripts when specifically needed (detail view, not search results).

## Finding 8: Scripts Description Inference from SKILL.md Content
- **Severity:** Medium
- **Location:** Phase 2, section "Infer script description from SKILL.md content" line 175-177
- **Flaw:** Brittle text parsing of SKILL.md to extract script descriptions. No structured format defined. Fallback to filename means most scripts will have useless descriptions.
- **Failure scenario:** Skill author writes SKILL.md with scripts listed as: "Use `db_migrate.py` for migrations." Parser looks for pattern `**db_migrate.py** - description`. Pattern doesn't match. Falls back to filename. CLI shows "db_migrate.py" as both name AND description (redundant). Or author writes in table format, parser fails entirely. Scripts shipped with no description metadata.
- **Evidence:** Phase 2 line 175-177: "Parse SKILL.md for script mentions... Fallback: use filename as description." No regex pattern provided. No validation that this works across diverse SKILL.md formats.
- **Suggested fix:** Skip description inference entirely for MVP. Script metadata = name + command + URL only. If author wants descriptions, they can add a `scripts.json` manifest in the repo. Don't build fragile markdown parser for marginal value.

---

## Summary

8 findings identified: 1 Critical, 3 High, 4 Medium severity.

**Blocker issues:**
- GitHub rate limit will kill Phase 2 execution without staged rollout
- Vectorize capacity planning missing — can't ship without knowing if quota allows feature
- FTS5 backfill required but not planned — feature broken for 96% of existing skills

**Over-engineering:**
- JSON column for scripts (use proper table)
- Reference content stored but never served (33GB wasted storage)
- Filename-based type inference (accept 'docs' for all or require structured metadata)
- CLI token waste in raw mode (add opt-in flags)
- SKILL.md parsing for descriptions (skip for MVP)

**YAGNI violations:**
- Storing reference content in D1 when only Vectorize needs it
- Complex type inference when simple label would work
- Script description parsing when filename already exists

**Recommended actions before implementation:**
1. Calculate exact GitHub API request budget for Phase 2, add `--top-n=50` flag
2. Calculate total Vectorize vectors needed, verify quota, plan progressive rollout
3. Add Phase 3.5: FTS5 backfill task with time estimate
4. Change scripts to separate table OR accept JSON with explicit tradeoffs documented
5. Simplify reference type to single 'docs' label for MVP
6. Add CLI flags `--include-refs` and `--include-scripts` (default off in search)
7. Remove script description inference, ship with name+command only
