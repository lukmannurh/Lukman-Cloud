# Phase 2: GitHub Fetcher Script

## Context
- [Brainstorm report](../reports/brainstorm-260213-1218-phase-3-4-references-scripts.md)
- [Existing fetch-skill-content.mjs](../../scripts/fetch-skill-content.mjs) — pattern to follow
- [Seed batches](../../scripts/seed-batches/) — 134 batch files × 1K skills

## Overview
- **Priority:** P1 — produces data needed by Phase 3
- **Status:** Pending
- **Effort:** 4h
- **Depends on:** Phase 1 (schema must exist before seeding)

New script that discovers `references/` and `scripts/` directories from GitHub repos, fetches reference content, and enriches batch files with metadata.

## Key Insights

- **GitHub Trees API** can list directory contents in a single call per repo: `GET /repos/{owner}/{repo}/git/trees/{branch}?recursive=1`
- This returns the entire tree — filter for `references/*.md` and `scripts/*` paths
- With a GitHub token: 5,000 requests/hr. 133K skills but many share the same repo (e.g., `vercel-labs/skills` hosts hundreds of skills)
- **Repo-level caching**: Group skills by repo, fetch tree once, distribute refs/scripts across all skills in that repo
- Pattern: follow `fetch-skill-content.mjs` — resumable, batched, concurrent

## Architecture

### Flow

```
1. Read seed-batches/*.json
2. Group skills by repo (extract owner/repo from source_url)
3. For each unique repo (deduplicated):
   a. Fetch repo tree via GitHub Trees API
   b. For each skill in that repo:
      - Find references/*.md files under skill path
      - Find scripts/* files under skill path
      - Fetch raw content for each reference .md
      - Store script metadata (name, path, type)
4. Enrich batch files with references + scripts data
5. Save enriched batch files
```

### GitHub URL Parsing

```
source_url: https://github.com/vercel-labs/skills/tree/main/skills/find-skills
                    ↓ parse ↓
owner: vercel-labs
repo: skills
branch: main
skill_path: skills/find-skills

→ Tree API: GET /repos/vercel-labs/skills/git/trees/main?recursive=1
→ Filter:   skills/find-skills/references/*.md
            skills/find-skills/scripts/*
```

### Output Format (enriched in batch files)

```json
{
  "name": "databases",
  "slug": "databases",
  "content": "# Databases...",
  "references": [
    {
      "title": "MongoDB CRUD",
      "filename": "mongodb-crud.md",
      "url": "https://raw.githubusercontent.com/.../references/mongodb-crud.md",
      "type": "docs",
      "content": "# MongoDB CRUD Operations\n\n..."
    }
  ],
  "scripts": [
    {
      "name": "db_migrate",
      "description": "Generate and apply database migrations",
      "command": "python scripts/db_migrate.py",
      "url": "https://raw.githubusercontent.com/.../scripts/db_migrate.py"
    }
  ]
}
```

## Related Code Files

### Create
- `scripts/fetch-skill-refs-scripts.mjs` — main fetcher script

### Reference (read only)
- `scripts/fetch-skill-content.mjs` — pattern to follow for resume/progress
- `scripts/seed-batches/*.json` — input data

## Implementation Steps

1. **Create `scripts/fetch-skill-refs-scripts.mjs`** with CLI flags:
   ```
   --reset          Clear progress
   --file=N         Single batch file
   --range=A-B      Range of batch files
   --concurrency=N  Parallel fetches (default: 5)
   --dry-run        Show what would be fetched
   --top-n=N        Process only top N skills by install_count (staged rollout)
   ```
   <!-- Red Team: GitHub rate limit — no concrete budget — 2026-02-13 -->
   **Staged rollout:** Start with `--top-n=50`, verify results, expand to 500, then full.

2. **Parse source_url to extract owner/repo/branch/skill_path**
   ```javascript
   function parseSourceUrl(url) {
     const m = url.match(/github\.com\/([^/]+)\/([^/]+)\/tree\/([^/]+)\/(.*)/);
     if (!m) return null;
     return { owner: m[1], repo: m[2], branch: m[3], skillPath: m[4] };
   }
   ```

3. **Group skills by repo** — deduplicate tree fetches
   ```javascript
   // Map<"owner/repo", { branch, skills: [{slug, skillPath}] }>
   const repoMap = new Map();
   for (const skill of allSkills) {
     const parsed = parseSourceUrl(skill.source_url);
     if (!parsed) continue;
     const key = `${parsed.owner}/${parsed.repo}`;
     if (!repoMap.has(key)) repoMap.set(key, { branch: parsed.branch, skills: [] });
     repoMap.get(key).skills.push({ slug: skill.slug, skillPath: parsed.skillPath, skill });
   }
   ```

4. **Fetch repo tree with truncation handling**
   <!-- Red Team: GitHub Trees API truncation not handled — 2026-02-13 -->
   ```javascript
   async function fetchRepoTree(owner, repo, branch) {
     const url = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;
     const res = await fetch(url, { headers: { Authorization: `token ${GITHUB_TOKEN}` } });
     if (!res.ok) return { tree: null, truncated: false };
     const data = await res.json();
     return { tree: data.tree, truncated: !!data.truncated };
   }

   // Fallback for truncated repos: fetch per-directory via Contents API
   async function fetchDirContents(owner, repo, branch, dirPath) {
     const url = `https://api.github.com/repos/${owner}/${repo}/contents/${dirPath}?ref=${branch}`;
     const res = await fetch(url, { headers: { Authorization: `token ${GITHUB_TOKEN}` } });
     if (!res.ok) return [];
     return res.json(); // [{name, path, type, size}]
   }
   ```

5. **Filter tree for references and scripts per skill path**
   ```javascript
   function findSkillResources(tree, skillPath) {
     const refs = tree.filter(f =>
       f.type === 'blob' &&
       f.path.startsWith(`${skillPath}/references/`) &&
       f.path.endsWith('.md')
     );
     const scripts = tree.filter(f =>
       f.type === 'blob' &&
       f.path.startsWith(`${skillPath}/scripts/`) &&
       !f.path.endsWith('.md') // skip READMEs in scripts dir
     );
     return { refs, scripts };
   }
   ```

6. **Fetch raw content with size limit + rate limit handling**
   <!-- Red Team: Reference content size unbounded + rate limit handling — 2026-02-13 -->
   ```javascript
   const MAX_REF_CONTENT_SIZE = 15000; // ~150 lines × 100 chars

   async function fetchRawContent(owner, repo, branch, path) {
     const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
     const headers = { Authorization: `token ${GITHUB_TOKEN}` };

     for (let attempt = 1; attempt <= 2; attempt++) {
       const res = await fetch(url, { headers });

       if (res.status === 403) {
         const reset = res.headers.get('x-ratelimit-reset');
         const remaining = res.headers.get('x-ratelimit-remaining');
         if (remaining === '0' && reset) {
           const waitMs = (parseInt(reset, 10) * 1000) - Date.now() + 1000;
           if (waitMs > 0 && waitMs < 120000) {
             console.warn(`  Rate limited, waiting ${Math.ceil(waitMs / 1000)}s...`);
             await new Promise(r => setTimeout(r, waitMs));
             continue;
           }
         }
         return null;
       }
       if (!res.ok) return null;

       const text = await res.text();
       if (text.length > MAX_REF_CONTENT_SIZE) {
         console.warn(`  Truncating ${path} (${text.length} chars → ${MAX_REF_CONTENT_SIZE})`);
         return text.slice(0, MAX_REF_CONTENT_SIZE);
       }
       return text;
     }
     return null;
   }
   ```

7. **Reference type: default to 'docs'**
   <!-- Red Team: Type inference fragile — default to 'docs' for MVP — 2026-02-13 -->
   All references get `type: 'docs'` for MVP. Future: parse frontmatter if authors add `type:` metadata.

8. **Script metadata: name + command only (no description inference)**
   <!-- Red Team: Script description inference fragile — skip for MVP — 2026-02-13 -->
   ```javascript
   function extractScriptMeta(treePath, owner, repo, branch) {
     const filename = treePath.split('/').pop();
     const name = filename.replace(/\.(py|js|sh|ts)$/, '');
     return {
       name,
       command: `python scripts/${filename}`, // or infer from extension
       url: `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${treePath}`,
     };
   }
   ```
   No description field for MVP. Filename-derived name is sufficient.

9. **Progress tracking** — same pattern as `fetch-skill-content.mjs`
   - Track completed repos (not individual skills) since tree fetch is per-repo
   - Save to `.refs-scripts-progress.json`

10. **Enrich batch files** — add `references` and `scripts` arrays to each skill object

## Todo List

- [ ] Create `scripts/fetch-skill-refs-scripts.mjs`
- [ ] Implement GitHub Trees API fetching with repo deduplication
- [ ] Implement reference content fetching (raw URLs)
- [ ] Implement script metadata extraction
- [ ] Add resumable progress tracking
- [ ] Add rate limit handling (wait + retry on 403)
- [ ] Handle truncated trees (Contents API fallback)
- [ ] Add `--top-n` flag for staged rollout
- [ ] Add reference content size limit (15K chars max)
- [ ] Copy rate limit handling from fetch-skill-content.mjs
- [ ] Use relative path as filename (not basename) to handle subdirs
- [ ] Validate reference URLs match GitHub raw pattern
- [ ] Test with `--top-n=50 --dry-run` on known skills
- [ ] Staged rollout: top 50 → 500 → full

## Success Criteria

- Script successfully enriches batch files with references and scripts data
- Resumable — re-run continues from last completed repo
- Rate limit handled gracefully (auto-wait on 403)
- Repos fetched once regardless of how many skills they contain
- Reference content fetched and stored in batch files
- Script metadata (name, description, command, url) extracted

## Risk Assessment

- **GitHub rate limit (5K/hr)**: HIGH probability — 133K skills but deduplicated to ~1K unique repos. Tree fetch = 1 call/repo + N calls for reference content. With 5K/hr limit, may need multiple runs.
  - **Mitigation**: Resume support, rate limit auto-wait, prioritize top-rated skills
- **Large repos with truncated trees**: MEDIUM — GitHub truncates trees >100K entries. Few repos this large.
  - **Mitigation**: For truncated trees, fall back to listing `references/` and `scripts/` dirs individually
- **Many skills have no references/scripts**: Expected. Script handles gracefully — skill gets empty arrays.

## Security Considerations

- GITHUB_TOKEN stored as env var only, never committed
- Raw content fetched over HTTPS
- No execution of fetched scripts — metadata only
