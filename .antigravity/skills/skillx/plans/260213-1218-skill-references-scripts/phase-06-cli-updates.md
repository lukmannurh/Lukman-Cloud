# Phase 6: CLI Updates

## Context
- [CLI use command](../../packages/cli/src/commands/use.ts) — 189 LOC
- [CLI API client](../../packages/cli/src/lib/api-client.ts)
- [CLI search command](../../packages/cli/src/commands/search.ts)

## Overview
- **Priority:** P2 — agent-facing, key for the "agent uses skillx" flow
- **Status:** Pending
- **Effort:** 2h
- **Depends on:** Phase 4 (API must return references + scripts)
- **Parallel with:** Phase 5 (UI)

Update `skillx use` to display references and scripts. This is critical for the agent workflow: agent searches → uses skill → sees available references/scripts → fetches and executes as needed.

## Key Insights

- CLI `use` command is 189 LOC — very close to 200 LOC limit. Must be careful with additions.
- `useSkillBySlug()` currently shows: name, description, category, rating, install command, content preview
- For agents using `--raw` mode: output full content only (no formatting). References/scripts should be appended as structured metadata.
- For human-readable mode: show references as list, scripts with commands
- `SkillDetails` interface needs updating to include references + scripts from API response

## Architecture

### Agent Flow (--raw mode)

```
$ skillx use databases --raw

# Databases
... (SKILL.md content) ...

---
## References
- mongodb-crud.md: https://raw.githubusercontent.com/.../references/mongodb-crud.md
- postgresql-queries.md: https://raw.githubusercontent.com/.../references/postgresql-queries.md

## Scripts
- db_migrate: python scripts/db_migrate.py
- db_backup: python scripts/db_backup.py
```

Agent reads this, then:
1. Fetches reference URLs if needed (agent has WebFetch/Bash tools)
2. Reviews script commands and decides whether to execute

### Human-Readable Mode (default)

```
✓ Skill: Databases

────────────────────
Description: ...
Category: implementation
Rating: ⭐ 8.7

Install Command:
 npx skillx-sh use databases

📚 References (3):
  docs   mongodb-crud.md
  docs   postgresql-queries.md
  api    mongodb-atlas.md

⚙️  Scripts (2):
  db_migrate    python scripts/db_migrate.py
  db_backup     python scripts/db_backup.py

Content Preview:
────────────────────
...
```

## Related Code Files

### Modify
- `packages/cli/src/commands/use.ts` — add references/scripts display
- `packages/cli/src/commands/use.ts` — update SkillDetails interface

### Reference (no changes)
- `packages/cli/src/lib/api-client.ts` — generic, no changes needed

## Implementation Steps

1. **Update `SkillDetails` interface**
   ```typescript
   interface SkillDetails {
     // ...existing
     scripts: string | null; // JSON string from skills table
   }

   interface SkillReference {
     id: string;
     title: string;
     filename: string;
     url: string | null;
     type: string | null;
   }

   interface SkillScript {
     name: string;
     description: string;
     command: string;
     url?: string;
   }

   interface SkillDetailResponse {
     skill: SkillDetails;
     references: SkillReference[];
     scripts: SkillScript[];
     // ...existing
   }
   ```

2. **Update `useSkillBySlug()` API call** to use full response
   ```typescript
   const res = await apiRequest<SkillDetailResponse>(`/api/skills/${apiSlug}`);
   const { skill, references, scripts } = res;
   ```

3. **Update raw mode output** — opt-in refs/scripts
   <!-- Red Team: CLI token waste — add opt-in flags — 2026-02-13 -->
   ```typescript
   if (options.raw) {
     console.log(skill.content);
     // Only include refs/scripts when explicitly requested (saves agent tokens)
     if (options.includeRefs && references.length) {
       console.log('\n---\n## References');
       for (const ref of references) {
         console.log(`- ${ref.filename}: ${ref.url || 'N/A'}`);
       }
     }
     if (options.includeScripts && scripts.length) {
       console.log('\n## Scripts');
       for (const s of scripts) {
         // Strip terminal control chars from command before display
         const safeCmd = s.command.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
         console.log(`- ${s.name}: ${safeCmd}`);
       }
     }
     return;
   }
   ```

4. **Update human-readable output** — add sections after install command
   ```typescript
   // After install command display:
   if (references.length) {
     console.log(chalk.bold('\n📚 References') + chalk.dim(` (${references.length}):`));
     for (const ref of references) {
       const type = chalk.dim((ref.type || 'docs').padEnd(10));
       console.log(`  ${type} ${ref.filename}`);
     }
   }

   if (scripts.length) {
     console.log(chalk.bold('\n⚙️  Scripts') + chalk.dim(` (${scripts.length}):`));
     for (const s of scripts) {
       // Strip terminal escape sequences from untrusted command strings
       <!-- Red Team: Terminal escape injection — 2026-02-13 -->
       const safeCmd = s.command.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
       const name = chalk.cyan(s.name.padEnd(14));
       console.log(`  ${name} ${chalk.dim(safeCmd)}`);
     }
   }
   ```

5. **Handle missing data gracefully** — older API responses may not have these fields
   ```typescript
   const references = res.references || [];
   const scripts = res.scripts || [];
   ```

6. **Keep use.ts under 200 LOC** — if exceeding, extract display helpers to `lib/display-helpers.ts`

## Todo List

- [ ] Update SkillDetails + response interfaces
- [ ] Update API call to destructure references/scripts
- [ ] Add `--include-refs` and `--include-scripts` CLI flags (opt-in for raw mode)
- [ ] Add terminal escape sanitization for script commands
- [ ] Add raw mode: refs/scripts only with opt-in flags
- [ ] Add human-readable mode: formatted references/scripts sections
- [ ] Handle backwards compatibility (API may not return these fields yet)
- [ ] Verify use.ts stays under 200 LOC (extract to display-helpers.ts if needed)
- [ ] Test: `skillx use databases` (human mode)
- [ ] Test: `skillx use databases --raw --include-refs` (agent mode)
- [ ] Test: skill with no references/scripts (empty sections hidden)

## Success Criteria

- `skillx use <slug>` shows references and scripts in both modes
- `--raw` mode outputs structured metadata (agent-parseable)
- Human mode shows formatted sections with chalk styling
- Empty references/scripts = no section output
- Backwards compatible with older API responses
- use.ts under 200 LOC

## Risk Assessment

- **use.ts exceeds 200 LOC**: MEDIUM — currently 189 LOC. Extract display helpers if needed.
- **API response breaking change**: LOW — new fields are additive, default to empty arrays.
- **Emoji rendering in terminals**: LOW — some terminals don't render 📚/⚙️. Acceptable trade-off.

## Security Considerations

- Script commands displayed as text, never executed by CLI
- Reference URLs are raw GitHub links — safe to display
- No user input processed in this phase
