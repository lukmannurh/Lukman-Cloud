# SkillX.sh Design Guidelines

> Extracted from [skills.sh](https://skills.sh/) and [skillsmp.com](https://skillsmp.com/), combined for SkillX.sh identity.

---

## 1. Brand Identity

**Tagline:** "The Only Skill That Your AI Agent Needs."

**Tone:** Terminal-native, developer-first, premium. SkillX positions itself as the *definitive* skills engine - not just a marketplace but the single entry point. The design should feel like a powerful CLI tool that happens to have a beautiful web interface.

**Differentiator:** Where skills.sh is an open ecosystem directory and skillsmp.com is a browsable marketplace, SkillX.sh is the *runtime* - one skill to rule them all. Design should convey authority, speed, and intelligence.

---

## 2. Color System

### Primary Palette (Dark Theme - Default)

| Token | Hex | Usage |
|-------|-----|-------|
| `--sx-bg` | `#0A0A0A` | Page background (near-black, not pure black) |
| `--sx-bg-elevated` | `#141414` | Cards, panels, elevated surfaces |
| `--sx-bg-hover` | `#1A1A1A` | Hover states on surfaces |
| `--sx-fg` | `#FAFAFA` | Primary text |
| `--sx-fg-muted` | `#888888` | Secondary text, descriptions |
| `--sx-fg-subtle` | `#555555` | Tertiary text, metadata |
| `--sx-border` | `#222222` | Default borders |
| `--sx-border-hover` | `#333333` | Hover borders |

### Accent Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `--sx-accent` | `#00E5A0` | Primary accent - mint/emerald green (CTA, active states) |
| `--sx-accent-hover` | `#00CC8E` | Accent hover state |
| `--sx-accent-muted` | `rgba(0, 229, 160, 0.12)` | Accent backgrounds (badges, highlights) |
| `--sx-warning` | `#F5A623` | Warnings, trending indicators |
| `--sx-error` | `#EF4444` | Errors, security alerts |
| `--sx-info` | `#3B82F6` | Info badges, links |

### Semantic Phase Colors (from skillsmp.com patterns)

| Phase | Color | Background |
|-------|-------|------------|
| Planning | `#3B82F6` | `rgba(59, 130, 246, 0.08)` |
| Implementation | `#8B5CF6` | `rgba(139, 92, 246, 0.08)` |
| Testing | `#10B981` | `rgba(16, 185, 129, 0.08)` |
| Security | `#F59E0B` | `rgba(245, 158, 11, 0.08)` |
| DevOps | `#EC4899` | `rgba(236, 72, 153, 0.08)` |

### Light Theme (Optional)

| Token | Hex |
|-------|-----|
| `--sx-bg` | `#FAFAFA` |
| `--sx-bg-elevated` | `#FFFFFF` |
| `--sx-fg` | `#0A0A0A` |
| `--sx-fg-muted` | `#666666` |
| `--sx-border` | `#E5E5E5` |

**Rule:** Dark theme is default. Green accent chosen to differentiate from skillsmp.com's purple and skills.sh's neutral monochrome. Green signals "go", "execute", "active" - fitting for a runtime tool.

---

## 3. Typography

### Font Stack

| Role | Font | Fallback |
|------|------|----------|
| Display / Headings | **Geist Sans** | `system-ui, -apple-system, sans-serif` |
| Body | **Geist Sans** | `system-ui, -apple-system, sans-serif` |
| Code / Terminal | **Geist Mono** | `'Fira Mono', 'JetBrains Mono', monospace` |

### Scale

| Token | Size | Weight | Use |
|-------|------|--------|-----|
| `--text-hero` | `48px / 3rem` | 700 | Hero headline |
| `--text-h1` | `36px / 2.25rem` | 700 | Page titles |
| `--text-h2` | `24px / 1.5rem` | 600 | Section headers |
| `--text-h3` | `18px / 1.125rem` | 600 | Subsection headers |
| `--text-body` | `16px / 1rem` | 400 | Body text |
| `--text-sm` | `14px / 0.875rem` | 400 | Secondary text, metadata |
| `--text-xs` | `12px / 0.75rem` | 500 | Badges, labels |
| `--text-mono` | `14px / 0.875rem` | 400 | Code, commands, terminal |

### Rules

- Headings use `tracking-tight` (letter-spacing: -0.02em)
- Labels/badges use `uppercase tracking-wide` (letter-spacing: 0.05em) in mono
- Body text `leading-relaxed` (line-height: 1.625)
- No Inter, Roboto, or Arial anywhere

---

## 4. Spacing & Layout

### Spacing Scale (4px base)

```
4px  | 0.25rem | --space-1
8px  | 0.5rem  | --space-2
12px | 0.75rem | --space-3
16px | 1rem    | --space-4
24px | 1.5rem  | --space-6
32px | 2rem    | --space-8
48px | 3rem    | --space-12
64px | 4rem    | --space-16
96px | 6rem    | --space-24
```

### Container

- Max width: `1200px` (max-w-6xl)
- Horizontal padding: `16px` mobile, `24px` tablet, `32px` desktop
- Centered with `mx-auto`

### Grid System

- **Skill cards:** `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4`
- **Leaderboard:** Single column, full-width table
- **Hero:** `grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-10 lg:gap-14`
- **Dashboard:** `grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6` (sidebar + main)

---

## 5. Components

### Navigation Bar

```
Height: 56px (h-14)
Position: sticky top-0 z-50
Background: --sx-bg with backdrop-blur-md
Border: 1px solid --sx-border (bottom)
Layout: flex items-center justify-between px-4 gap-6
```

- Left: Logo (ASCII "X" glyph or wordmark) + "SkillX" in mono
- Center: nav links (Leaderboard, Search, Categories, Docs)
- Right: GitHub link + "Get API Key" CTA button

### Hero Section

- ASCII art treatment for "SKILLX" brand (block characters, inspired by skills.sh)
- Tagline in mono uppercase with tracking-wide
- Description in `text-xl` to `text-3xl`, muted color, leading-tight
- Command box: dark elevated surface with mono text + copy button
  ```
  $ npx skillx-sh search "deploy to cloudflare"
  ```
- Stats row: total skills count, total installs, agents supported

### Skill Cards

```
Background: --sx-bg-elevated
Border: 1px solid --sx-border
Border-radius: 8px (rounded-lg)
Padding: 16px
Hover: border-color transitions to --sx-border-hover, subtle shadow
```

Content:
- **Header row:** Skill name (semibold) + source badge (GitHub org)
- **Description:** 2 lines max, truncated with ellipsis
- **Tags:** Pill badges with category colors (phase-based)
- **Footer row:** Install count + rating (S/A/B/C tier) + compatibility icons
- **Action:** "Install" button or `npx skillx-sh use <name>` copyable

### Leaderboard Table (from skills.sh)

```
Columns: Rank | Skill | Source | Installs | Rating | Actions
Row height: 48px
Alternating: subtle bg difference (--sx-bg vs --sx-bg-elevated)
Hover: full row highlight
Sticky header: yes
```

- Rank numbers: mono, muted color, right-aligned
- Top 3: accent color highlight or medal indicators
- Install counts: formatted with K/M suffix
- Sorting: clickable column headers

### Search Input

```
Background: --sx-bg-elevated
Border: 1px solid --sx-border
Border-radius: 8px
Padding: 12px 16px
Font: mono, --text-sm
Placeholder: "Search skills... (semantic + RAG)"
```

- Keyboard shortcut indicator: `/` key badge (right side)
- Active: border-color transitions to --sx-accent
- Results: dropdown overlay with skill previews

### Filter Tabs (from skills.sh)

```
Layout: inline-flex gap-1
Active tab: --sx-accent-muted background + --sx-accent text
Inactive: transparent bg + --sx-fg-muted text
Border-radius: 6px (rounded-md)
Padding: 6px 12px
Font: mono, text-xs, uppercase
```

Tabs: All Time | Trending (24h) | Hot | Top Rated | New

### Buttons

**Primary (CTA):**
```
Background: --sx-accent
Color: #0A0A0A (dark text on green)
Border-radius: 6px
Padding: 8px 16px
Font: text-sm, font-medium
Hover: --sx-accent-hover
```

**Secondary:**
```
Background: transparent
Border: 1px solid --sx-border
Color: --sx-fg
Hover: --sx-bg-hover, border --sx-border-hover
```

**Ghost:**
```
Background: transparent
Color: --sx-fg-muted
Hover: color --sx-fg
```

### Badges / Pills

```
Background: phase-specific color at 8% opacity
Color: phase-specific color at full opacity
Border-radius: 9999px (rounded-full)
Padding: 2px 8px
Font: text-xs, font-medium, mono
```

### Rating System

| Tier | Color | Label |
|------|-------|-------|
| S | `#FFD700` (gold) | Elite |
| A | `#00E5A0` (accent green) | Excellent |
| B | `#3B82F6` (blue) | Good |
| C | `#888888` (muted) | Average |

Display as mono-styled badge: `S 9.2` or `A 8.1`

### Code Blocks / Command Box

```
Background: --sx-bg-elevated with 80% opacity
Border: 1px solid --sx-border
Border-radius: 6px
Padding: 12px 16px
Font: Geist Mono, --text-mono
```

- `$` prompt indicator in --sx-fg-subtle
- Command text in --sx-fg
- Copy button: ghost style, right-aligned

---

## 6. Animations & Transitions

### Principles

- CSS-first; JS only for complex orchestrations
- Subtle, purposeful motion - no gratuitous animation
- Performance: prefer `transform` and `opacity` (GPU-composited)

### Tokens

| Property | Duration | Easing |
|----------|----------|--------|
| Color/border | `150ms` | `ease` |
| Background | `150ms` | `ease` |
| Transform | `200ms` | `cubic-bezier(0.4, 0, 0.2, 1)` |
| Layout shift | `300ms` | `cubic-bezier(0.4, 0, 0.2, 1)` |
| Page enter | `400ms` | `cubic-bezier(0, 0, 0.2, 1)` |

### Patterns

- **Hover states:** `transition-colors duration-150`
- **Card hover:** slight `translateY(-2px)` + shadow increase
- **Page load:** staggered fade-in for card grid (50ms delay between items)
- **Search focus:** border color + subtle glow ring `box-shadow: 0 0 0 2px var(--sx-accent-muted)`
- **Tab switch:** content crossfade with 200ms transition
- **Copy button:** brief checkmark animation on copy success

---

## 7. Backgrounds & Visual Effects

### Page Background

- Near-black `#0A0A0A` base
- Optional: subtle noise texture overlay at 3-5% opacity for depth
- Optional: faint radial gradient from center (`rgba(0, 229, 160, 0.03)` accent glow)

### Surface Hierarchy

```
Level 0: --sx-bg (#0A0A0A)        — page background
Level 1: --sx-bg-elevated (#141414) — cards, panels, dropdowns
Level 2: --sx-bg-hover (#1A1A1A)   — interactive surface hover
Level 3: #222222                    — nested elements within cards
```

### Effects

- `backdrop-filter: blur(12px)` on sticky nav
- Subtle `box-shadow` on elevated cards: `0 1px 3px rgba(0,0,0,0.3)`
- Focus rings: `0 0 0 2px var(--sx-accent-muted)` for accessibility
- No gradients on text (anti-pattern)

---

## 8. Responsive Breakpoints

| Breakpoint | Width | Layout Changes |
|------------|-------|----------------|
| Mobile | `<640px` | Single column, stacked nav, full-width cards |
| Tablet | `640-1024px` | 2-column grid, horizontal nav |
| Desktop | `1024-1200px` | 3-column grid, sidebar option |
| Wide | `>1200px` | Max-width container, centered |

### Mobile-specific

- Hamburger menu replaces horizontal nav
- Touch targets minimum `44px`
- Command box scrolls horizontally
- Cards go full-width with reduced padding

---

## 9. Iconography

- Prefer monoline icons (Lucide icon set)
- Size: 16px inline, 20px in buttons, 24px standalone
- Color: inherits text color (`currentColor`)
- Agent platform logos: grayscale by default, color on hover

---

## 10. Accessibility

- Contrast ratio: minimum 4.5:1 for text, 3:1 for large text
- Focus indicators: visible ring on all interactive elements
- Keyboard navigation: all interactive elements reachable via Tab
- Screen reader: semantic HTML, ARIA labels on icon-only buttons
- Reduced motion: respect `prefers-reduced-motion` media query

---

## 11. Key Design Principles

1. **Terminal aesthetics, web polish** — Mono fonts and CLI patterns ground the brand in developer culture; clean layout and micro-interactions add refinement.

2. **Content density over decoration** — Show more skills, data, and actions per viewport. No hero images, no stock photos, no illustrations.

3. **Speed as a feature** — Minimal payload, no heavy fonts/images. The design itself should feel fast - tight spacing, immediate feedback, no loading spinners where possible.

4. **One-command philosophy** — Every skill interaction should feel reducible to a single CLI command. The UI mirrors this: minimal clicks, immediate action.

5. **Monochrome + one accent** — Near-black canvas with green accent creates focus and hierarchy without visual noise.

---

## 12. Anti-Patterns (Avoid)

- Purple gradients on white (generic SaaS look)
- Inter, Roboto, Arial font families
- Rounded-full buttons with gradient backgrounds
- Hero sections with abstract 3D illustrations
- Cookie-cutter card grids with equal spacing on all sides
- Overuse of shadows (subtle only)
- Animated backgrounds, particles, or blobs
- Emoji as primary navigation icons
- Blue-link-on-white defaults

---

## Sources

- [skills.sh](https://skills.sh/) — Open agent skills ecosystem (Vercel), dark terminal aesthetic, leaderboard patterns, ASCII branding
- [skillsmp.com](https://skillsmp.com/) — Agent skills marketplace, category-based phase colors, purple accent, card-grid browsing
- [SkillHub](https://www.skillhub.club/) — Skills marketplace, rating tiers (S/A/B/C), semantic search, agent compatibility
- [SmartScope SkillsMP Guide](https://smartscope.blog/en/blog/skillsmp-marketplace-guide/) — SDLC phase color coding, scannability-first design
