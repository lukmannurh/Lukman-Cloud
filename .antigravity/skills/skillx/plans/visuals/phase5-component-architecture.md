# Phase 5: Component Architecture

## Component Hierarchy

```
root.tsx (Layout wrapper)
├── Navbar (sticky header)
├── main (flex-1)
│   └── Routes
│       ├── home.tsx
│       │   ├── CommandBox
│       │   └── Stats cards (placeholder)
│       ├── leaderboard.tsx
│       │   ├── PageContainer
│       │   ├── FilterTabs
│       │   └── LeaderboardTable
│       │       └── RatingBadge
│       ├── search.tsx
│       │   ├── PageContainer
│       │   ├── SearchInput
│       │   ├── FilterTabs
│       │   └── SkillCard (grid)
│       │       ├── RatingBadge
│       │       └── Copy button
│       ├── skill-detail.tsx
│       │   ├── PageContainer
│       │   ├── RatingBadge
│       │   └── CommandBox
│       ├── profile.tsx
│       │   └── PageContainer
│       └── settings.tsx
│           └── PageContainer
└── Footer
```

## Component Categories

### Layout Components (3)
```
layout/
├── navbar.tsx        - Sticky header with navigation
├── footer.tsx        - Footer with links
└── page-container.tsx - Max-width content wrapper
```

### Shared UI Components (6)
```
components/
├── rating-badge.tsx    - Tier-based rating display (S/A/B/C)
├── command-box.tsx     - Copyable command display
├── filter-tabs.tsx     - Tab navigation for filtering
├── search-input.tsx    - Search with "/" shortcut
├── skill-card.tsx      - Skill display card
└── leaderboard-table.tsx - Sortable skills table
```

### Route Pages (6)
```
routes/
├── home.tsx           - Hero + stats + featured skills
├── leaderboard.tsx    - Top skills table
├── search.tsx         - Search interface + results
├── skill-detail.tsx   - Individual skill page
├── profile.tsx        - User favorites + history
└── settings.tsx       - API key management
```

## Data Flow

```
User Interaction → Component State → Navigation/Copy
                                   ↓
                            Mock Data (for now)
                                   ↓
                            UI Components
                                   ↓
                            Visual Feedback
```

## Design Token Usage

### Colors
- `sx-bg` - Main background (#0A0A0A)
- `sx-bg-elevated` - Cards, modals (#141414)
- `sx-bg-hover` - Hover states (#1A1A1A)
- `sx-fg` - Primary text (#FAFAFA)
- `sx-fg-muted` - Secondary text (#888888)
- `sx-accent` - Primary accent (#00E5A0)
- `sx-border` - Border color (#222222)

### Phase Colors (Category Badges)
- `phase-planning` - Blue (#3B82F6)
- `phase-impl` - Purple (#8B5CF6)
- `phase-testing` - Green (#10B981)
- `phase-security` - Orange (#F59E0B)
- `phase-devops` - Pink (#EC4899)

### Tier Colors (Rating Badges)
- `tier-s` - Gold (#FFD700) - Score ≥ 9.0
- `tier-a` - Green (#00E5A0) - Score ≥ 7.5
- `tier-b` - Blue (#3B82F6) - Score ≥ 6.0
- `tier-c` - Gray (#888888) - Score < 6.0

## Responsive Breakpoints

```
Mobile (default)    - Single column
Tablet (md: 768px)  - 2 columns for grids
Desktop (lg: 1024px) - 3 columns for grids
```

## Key Features

### Navbar
- Logo links to home
- Desktop: inline nav links
- Mobile: hamburger menu
- "Get API Key" CTA button

### SearchInput
- Keyboard shortcut: "/" to focus
- Submit on Enter
- Navigates to /search?q=value
- Visual keyboard hint badge

### SkillCard
- Hover: lift effect + border highlight
- Copy install command with visual feedback
- Category badge with phase colors
- Rating badge with tier colors
- Install count formatting (K/M)

### LeaderboardTable
- Sticky header
- Top 3 rank highlighting
- Sortable columns (visual only)
- Hover: full row highlight
- Responsive layout

## Mock Data Structure

### Skill
```typescript
{
  slug: string
  name: string
  author: string
  description: string
  category: string
  installs: number
  rating: number
}
```

### Leaderboard Entry
```typescript
{
  rank: number
  slug: string
  name: string
  author: string
  installs: number
  rating: number
}
```

## Future Enhancements
- Connect to real API endpoints
- Add loading states
- Add error boundaries
- Implement authentication
- Add pagination
- Add skeleton loaders
- Add animations/transitions
