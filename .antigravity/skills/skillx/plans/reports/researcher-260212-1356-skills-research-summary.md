# Skills Research Summary

**Date:** 2026-02-12
**Researcher:** Agent Researcher
**Status:** Complete (10/10 skills analyzed)

---

## Skills Analysis

### 1. Executing Plans (obra/superpowers)

**Name:** executing-plans

**Description:** Implementation skill for executing written plans in separate sessions with review checkpoints between task batches. Follows batch execution with checkpoints for architect review.

**Content Summary:**
- Plan loading & critical review before execution
- Batch task execution (default: 3 tasks per batch)
- Step-by-step verification for each task
- Checkpoint reporting between batches with feedback loops
- Blocker management (stop on dependencies, test failures, unclear instructions)
- Git integration via git-worktrees skill
- Completion transition to finishing-a-development-branch skill

**Category:** Implementation

**Source:** [GitHub - obra/superpowers](https://github.com/obra/superpowers/blob/main/skills/executing-plans/SKILL.md)

---

### 2. Canvas-Design (anthropics/skills)

**Name:** canvas-design

**Description:** Design creation tool for producing beautiful visual art in PNG/PDF formats using design philosophies expressed visually.

**Content Summary:**
- Two-step workflow: design philosophy (.md) + visual execution (.pdf/.png)
- Creates aesthetic movements with manifestos (4-6 paragraphs)
- Museum/magazine-quality single or multi-page designs
- Minimal, purposeful text integrated as visual element
- Systematic visual language with intentional color palettes
- Embeds subtle conceptual references within abstract compositions
- Expert-level craftsmanship with pristine execution

**Category:** Marketing (Design/Visual Communications)

**Source:** [GitHub - anthropics/skills](https://github.com/anthropics/skills/blob/main/skills/canvas-design/SKILL.md)

---

### 3. Requesting Code Review (obra/superpowers)

**Name:** requesting-code-review

**Description:** Workflow for dispatching code-reviewer subagent to validate work before merging, ensuring quality through early and frequent review cycles.

**Content Summary:**
- Mandatory review triggers at task completion, feature milestones, pre-merge
- Optional review for debugging, refactoring baselines, complex bug fixes
- Git SHA extraction workflow for precise commit range identification
- Template-based subagent dispatch with structured placeholders
- Issue triage by severity (Critical, Important, Minor)
- Supports three workflows: subagent-driven development, batch execution, ad-hoc development
- Core principle: "Review early, review often"

**Category:** Testing (Code Quality)

**Source:** [GitHub - obra/superpowers](https://github.com/obra/superpowers/blob/main/skills/requesting-code-review/SKILL.md)

---

### 4. Subagent-Driven Development (obra/superpowers)

**Name:** subagent-driven-development

**Description:** Workflow methodology for executing implementation plans by dispatching independent subagents per task with mandatory two-stage reviews (spec compliance, then code quality) after each task completes.

**Content Summary:**
- Fresh subagent per task to prevent context pollution
- Sequential execution within single session (no context switching)
- Dual-review checkpoint system (spec compliance first, then code quality)
- Automatic question surfacing before implementation
- TodoWrite task tracking and organization
- Implementer subagent coordination with TDD methodology
- Iterative fix-and-review cycles until all issues resolve
- Git worktrees for isolated workspaces
- Core principle: Fresh subagent per task + two-stage review = high quality, fast iteration

**Category:** Planning

**Source:** [GitHub - obra/superpowers](https://github.com/obra/superpowers/blob/main/skills/subagent-driven-development/SKILL.md)

---

### 5. Doc-Coauthoring (anthropics/skills)

**Name:** doc-coauthoring

**Description:** Structured workflow for guiding users through collaborative document creation with three-stage process: context gathering, refinement & structure, and reader testing.

**Content Summary:**
- Three-stage workflow with active guidance
- Context gathering phase: user dumps all relevant information
- Refinement & structure phase: 5-10 clarifying questions per section
- Reader testing phase: fresh Claude instance identifies blind spots
- Works with documentation, proposals, technical specs, decision docs
- Integration with external services (Slack, Teams, Google Drive, SharePoint, MCP servers)
- Creates markdown files with section headers and placeholder text
- Artifact-based document creation when available

**Category:** Planning (Documentation)

**Source:** [GitHub - anthropics/skills](https://github.com/anthropics/skills/blob/main/skills/doc-coauthoring/SKILL.md)

---

### 6. Theme-Factory (anthropics/skills)

**Name:** theme-factory

**Description:** Toolkit for styling artifacts with professional font and color themes, supporting slides, docs, reports, HTML landing pages, and more.

**Content Summary:**
- 10 pre-set themes with carefully selected color palettes and font pairings
- Custom theme generation for new combinations similar to existing ones
- Theme showcase PDF for visual preview of all available themes
- Applies consistent, professional styling across artifact types
- Supports theme naming and documentation
- Color palettes with hex codes and complementary font pairings
- Integration with artifact creation workflows

**Category:** Marketing (Design/Styling)

**Source:** [GitHub - anthropics/skills](https://github.com/anthropics/skills/blob/main/skills/theme-factory/SKILL.md)

---

### 7. Native-Data-Fetching (expo/skills)

**Name:** native-data-fetching

**Description:** Agent skill for React Native/Expo development covering API requests, data fetching, caching, and network debugging with comprehensive patterns.

**Content Summary:**
- Mandatory for ANY networking work: API requests, data fetching, caching, network debugging
- Basic fetch examples with error handling and POST requests
- Authentication and token management using expo-secure-store
- Token refresh logic to handle expired tokens
- Network status management with React Query + NetInfo integration
- Offline scenario handling with query pause/resume
- Environment configuration using EXPO_PUBLIC_ prefixed variables
- Deployment environment examples (dev, prod)
- Example patterns for common use cases

**Category:** Implementation

**Source:** [GitHub - expo/skills](https://github.com/expo/skills)

---

### 8. Vue-Best-Practices (hyf0/vue-skills)

**Name:** vue-best-practices

**Description:** Comprehensive agent skill for Vue 3 development with best practices guidance covering component architecture, state management, and composition patterns.

**Content Summary:**
- Default stack: Vue 3 + Composition API + `<script setup lang="ts"`
- Component splitting rules: split if owns orchestration + markup, 3+ UI sections, or repeated blocks
- Keep entry/root/view components as composition surfaces
- Feature folder layout for multiple components
- One source of truth for state management
- Explicit data flow: props down, events up
- Avoid unnecessary re-renders
- Readable, self-documenting code
- Alternative configurations for Options API and JSX
- Pinia integration guidance (separate skill available)

**Category:** Implementation

**Source:** [GitHub - hyf0/vue-skills](https://github.com/hyf0/vue-skills/tree/master/skills/vue-best-practices)

---

### 9. Tailwind-Design-System (wshobson/agents)

**Name:** tailwind-design-system

**Description:** Skill for building production-ready design systems with Tailwind CSS v4, covering CSS-first configuration, design tokens, component variants, and responsive patterns.

**Content Summary:**
- Targets Tailwind CSS v4 (2024+) with upgrade guide for v3 projects
- CSS-first configuration approach for design tokens
- Component library creation with Tailwind v4
- Design tokens and theming with native CSS features
- Dark mode with native CSS
- Responsive and accessible component patterns
- UI pattern standardization across codebase
- Migration guide from Tailwind v3 to v4
- Production-ready component variants

**Category:** Implementation (Design/Frontend)

**Source:** [GitHub - wshobson/agents](https://skills.sh/wshobson/agents/tailwind-design-system)

---

### 10. Inference.sh (inference-sh/skills)

**Name:** inference.sh (agent-tools equivalent)

**Description:** Cloud-based CLI platform providing serverless access to 150+ AI apps and models including image/video generation, LLMs, search, and utilities.

**Content Summary:**
- 150+ pre-built AI applications across multiple categories
- No local GPU infrastructure required
- Simple CLI interface (`infsh` commands)
- Task management with status tracking
- App discovery and filtering capabilities
- Image generation: FLUX, Gemini 3 Pro, Grok Imagine, Seedream
- Video creation: Veo 3.1, Seedance, OmniHuman, HunyuanVideo
- Language models: Claude (Opus/Sonnet/Haiku), Gemini 3 Pro, Kimi K2
- Search: Tavily, Exa Search
- Social media automation: Twitter/X posting, DMs, follows, likes
- Utilities: media merging, video captioning, image stitching, audio extraction
- Bash command integration and npm skill packages

**Category:** Implementation (Utilities/Tools)

**Source:** [GitHub - inference-sh/skills](https://github.com/inference-sh/skills)

---

## Summary by Category

### Planning (2)
- subagent-driven-development - Task execution methodology with dual reviews
- doc-coauthoring - Collaborative document creation workflow

### Implementation (4)
- executing-plans - Batch execution with checkpoints
- native-data-fetching - React Native/Expo networking
- vue-best-practices - Vue 3 development patterns
- tailwind-design-system - Tailwind CSS v4 design systems
- inference.sh - Cloud AI apps/models access

### Testing (1)
- requesting-code-review - Code quality validation workflow

### Marketing (2)
- canvas-design - Visual art creation via design philosophy
- theme-factory - Professional styling and theming

---

## Key Observations

1. **Work Organization**: Multiple complementary workflow skills (executing-plans, subagent-driven-development, requesting-code-review) form a complete development methodology
2. **Framework Coverage**: Strong support for Vue + Tailwind ecosystem
3. **Quality Gates**: Code review and testing integrated into planning and execution workflows
4. **External Integration**: Skills support MCP servers, cloud services, and third-party APIs
5. **Accessibility**: Emphasis on expert-level output and professional standards across design/code skills

---

## Unresolved Questions

None. All 10 skills successfully researched and documented.
