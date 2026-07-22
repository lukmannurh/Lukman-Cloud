# Phase 5: UI — Skill Detail Page

## Context
- [Skill detail page](../../apps/web/app/routes/skill-detail.tsx) — 186 LOC
- [Design guidelines](../../docs/design-guidelines.md)
- [Skill content renderer](../../apps/web/app/components/skill-content-renderer.tsx)

## Overview
- **Priority:** P2 — user-facing but not blocking
- **Status:** Pending
- **Effort:** 3h
- **Depends on:** Phase 4 (API must return references + scripts)
- **Parallel with:** Phase 6 (CLI)

Add "References" and "Scripts" sections to skill detail page. References show linked docs with type icons. Scripts show copyable commands.

## Key Insights

- Skill detail page is 186 LOC — near 200 LOC limit. New sections MUST be separate components.
- Dark theme: `bg-slate-900`, `text-white`, `text-mint`, `border-mint/20`
- Icons: Lucide React (already used — `FileText`, `Star`, `Download`)
- Existing `CommandBox` component handles copy-to-clipboard — reuse for scripts
- Place references + scripts between SKILL.md content and "Your Rating" section

## Architecture

### Layout (Updated)

```
┌─────────────────────────────────┬──────────┐
│ Breadcrumb                      │          │
│ Header + Favorite               │          │
│ Install Command                 │ Sidebar  │
│ SKILL.md Content                │          │
│ ─────────────────────────       │          │
│ References Section (NEW)        │          │
│ Scripts Section (NEW)           │          │
│ ─────────────────────────       │          │
│ Your Rating                     │          │
│ Reviews                         │          │
└─────────────────────────────────┴──────────┘
```

### Component Breakdown

```
skill-detail.tsx (existing, ~186 LOC)
  └── <SkillReferencesSection />  (NEW, ~60 LOC)
  └── <SkillScriptsSection />     (NEW, ~60 LOC)
```

## Related Code Files

### Create
- `apps/web/app/components/skill-references-section.tsx` — references list with type icons
- `apps/web/app/components/skill-scripts-section.tsx` — scripts list with copy buttons

### Modify
- `apps/web/app/routes/skill-detail.tsx` — import and render new sections

## Implementation Steps

1. **Create `skill-references-section.tsx`**

   ```tsx
   import { BookOpen, Code2, FileText, Video, ExternalLink } from 'lucide-react';

   interface Reference {
     id: string;
     title: string;
     filename: string;
     url: string | null;
     type: string | null;
   }

   const typeIcons: Record<string, typeof FileText> = {
     docs: FileText,
     api: Code2,
     guide: BookOpen,
     cheatsheet: BookOpen,
     video: Video,
   };

   export function SkillReferencesSection({ references }: { references: Reference[] }) {
     if (!references.length) return null;

     return (
       <div className="mb-8">
         <h2 className="mb-4 text-lg font-semibold tracking-tight">
           References
           <span className="ml-2 text-sm font-normal text-sx-fg-muted">
             ({references.length})
           </span>
         </h2>
         <div className="space-y-2">
           {references.map((ref) => {
             const Icon = typeIcons[ref.type || 'docs'] || FileText;
             return (
               <a
                 key={ref.id}
                 href={ref.url || '#'}
                 target="_blank"
                 rel="noopener noreferrer"
                 className="flex items-center gap-3 rounded-lg border border-sx-border
                            bg-sx-bg-elevated p-3 transition-colors hover:border-sx-accent/40"
               >
                 <Icon size={16} className="shrink-0 text-sx-accent" />
                 <div className="min-w-0 flex-1">
                   <div className="text-sm font-medium">{ref.title}</div>
                   <div className="text-xs text-sx-fg-muted">{ref.filename}</div>
                 </div>
                 <span className="rounded bg-sx-bg px-2 py-0.5 text-xs text-sx-fg-subtle">
                   {ref.type || 'docs'}
                 </span>
                 <ExternalLink size={14} className="shrink-0 text-sx-fg-muted" />
               </a>
             );
           })}
         </div>
       </div>
     );
   }
   ```

2. **Create `skill-scripts-section.tsx`**

   ```tsx
   import { Terminal, Copy, Check, ExternalLink } from 'lucide-react';
   import { useState } from 'react';

   interface Script {
     name: string;
     description: string;
     command: string;
     url?: string;
   }

   function CopyButton({ text }: { text: string }) {
     const [copied, setCopied] = useState(false);
     const handleCopy = () => {
       navigator.clipboard.writeText(text);
       setCopied(true);
       setTimeout(() => setCopied(false), 2000);
     };
     return (
       <button onClick={handleCopy} className="text-sx-fg-muted hover:text-sx-accent transition-colors">
         {copied ? <Check size={14} className="text-sx-accent" /> : <Copy size={14} />}
       </button>
     );
   }

   export function SkillScriptsSection({ scripts }: { scripts: Script[] }) {
     if (!scripts.length) return null;

     return (
       <div className="mb-8">
         <h2 className="mb-4 text-lg font-semibold tracking-tight">
           Scripts
           <span className="ml-2 text-sm font-normal text-sx-fg-muted">
             ({scripts.length})
           </span>
         </h2>
         <div className="space-y-3">
           {scripts.map((script) => (
             <div
               key={script.name}
               className="rounded-lg border border-sx-border bg-sx-bg-elevated p-4"
             >
               <div className="mb-2 flex items-center justify-between">
                 <div className="flex items-center gap-2">
                   <Terminal size={14} className="text-sx-accent" />
                   <span className="font-mono text-sm font-medium">{script.name}</span>
                 </div>
                 <div className="flex items-center gap-2">
                   {script.url && (
                     <a href={script.url} target="_blank" rel="noopener noreferrer"
                        className="text-sx-fg-muted hover:text-sx-accent">
                       <ExternalLink size={14} />
                     </a>
                   )}
                   <CopyButton text={script.command} />
                 </div>
               </div>
               <p className="mb-2 text-xs text-sx-fg-muted">{script.description}</p>
               <code className="block rounded bg-sx-bg px-3 py-2 font-mono text-xs text-sx-fg-subtle">
                 {script.command}
               </code>
             </div>
           ))}
         </div>
       </div>
     );
   }
   ```

3. **Update `skill-detail.tsx`** — import + render between content and rating

   ```tsx
   import { SkillReferencesSection } from '../components/skill-references-section';
   import { SkillScriptsSection } from '../components/skill-scripts-section';

   // In component JSX, after SKILL.md content div:
   {data.references.length > 0 && (
     <>
       <hr className="mb-8 border-sx-border" />
       <SkillReferencesSection references={data.references} />
     </>
   )}

   {data.scripts.length > 0 && (
     <>
       <hr className="mb-8 border-sx-border" />
       <SkillScriptsSection scripts={data.scripts} />
     </>
   )}
   ```

## Todo List

- [ ] Create `skill-references-section.tsx` with type icons and external links
- [ ] Create `skill-scripts-section.tsx` with copy-to-clipboard commands
- [ ] Update `skill-detail.tsx` to import and render both sections
- [ ] Verify dark theme styling matches existing design
- [ ] Test with skill that has references + scripts
- [ ] Test empty state (no references/scripts — sections hidden)
- [ ] Verify responsive layout on mobile (single column)

## Success Criteria

- References section renders with correct type icons (docs, api, guide, video)
- Each reference links to raw GitHub URL
- Scripts section renders with command, description, and copy button
- Empty arrays → sections completely hidden (no empty headers)
- Dark theme consistent with existing design
- Responsive on mobile
- Skill detail page stays under 200 LOC (new code in separate components)

## Risk Assessment

- **Skill detail page exceeds 200 LOC**: LOW — new sections are separate components, only ~6 lines added to page
- **Missing icons for types**: LOW — fallback to FileText icon for unknown types
- **Copy-to-clipboard fails on HTTP**: LOW — production is HTTPS. Local dev may need fallback.

## Security Considerations

- Reference URLs rendered as `<a>` with `rel="noopener noreferrer"` and `target="_blank"`
- Script commands displayed as text, never executed in browser
- No `dangerouslySetInnerHTML` — all content rendered as text
