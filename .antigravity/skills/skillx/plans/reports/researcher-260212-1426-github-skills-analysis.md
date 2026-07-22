# GitHub Skills Analysis Report

**Date:** 2026-02-12 | **Analyst:** researcher | **Status:** Complete

---

## Executive Summary

Analyzed 12 AI agent skills from 2 GitHub organizations (coreyhaines31/marketingskills, obra/superpowers). Skills span marketing operations, product strategy, and development discipline. All skills follow test-driven documentation patterns with trigger-based descriptions for discovery optimization.

---

## Skills Inventory

### Marketing Operations (coreyhaines31/marketingskills)

All skills hosted in: `https://github.com/coreyhaines31/marketingskills/tree/main/skills/`

#### 1. Marketing Ideas
- **Name:** marketing-ideas
- **Version:** 1.0.0
- **Description:** Strategic approach to finding and implementing proven marketing tactics. Library of 139 marketing approaches organized by category (content/SEO, paid ads, partnerships, launches, etc.)
- **Key Features:**
  - 139 categorized marketing tactics
  - Stage-specific recommendations (pre-launch, early, growth, scale)
  - Budget-aware approach (free, low, medium, high)
  - Timeline consideration (quick wins, medium-term, long-term)
  - Use case matching (leads, authority, low-budget growth, product-led)
  - Related skills: programmatic-seo, email-sequence, free-tool-strategy
- **Category:** Marketing
- **Trigger:** When user needs marketing ideas, inspiration, or strategies for SaaS/software

#### 2. Social Content
- **Name:** social-content
- **Version:** 1.0.0
- **Description:** Expert social media strategy covering content creation, repurposing, and platform-specific tactics for LinkedIn, Twitter/X, Instagram, TikTok, Facebook.
- **Key Features:**
  - Platform quick reference (frequency, best formats)
  - Content pillars framework (3-5 pillar structure)
  - Hook formulas (curiosity, story, value, contrarian)
  - Content repurposing system (blog → multiple platforms)
  - Weekly content calendar templates
  - Engagement strategy (daily routine, quality comments, relationship building)
  - Analytics & optimization (metrics, weekly review, performance analysis)
  - Reverse engineering viral content methodology
- **Category:** Marketing
- **Trigger:** Creating, scheduling, or optimizing social content; mentions of "LinkedIn post," "Twitter thread," "social scheduling"

#### 3. Pricing Strategy
- **Name:** pricing-strategy
- **Version:** 1.0.0
- **Description:** Expert SaaS pricing and monetization strategy covering research, tier structure, and packaging for capturing value aligned with customer willingness to pay.
- **Key Features:**
  - Three pricing axes: packaging, pricing metric, price point
  - Value-based pricing methodology
  - Value metrics guide (per-user, usage, feature, contact, transaction, flat)
  - Good-better-best tier framework
  - Van Westendorp pricing research method
  - MaxDiff analysis for feature prioritization
  - Price increase triggers and strategies
  - Pricing page psychology (anchoring, decoy effect, charm pricing)
  - Pricing checklist for launch readiness
- **Category:** Marketing
- **Trigger:** Pricing decisions, packaging, monetization strategy, price increases, willingness to pay

#### 4. Copy Editing
- **Name:** copy-editing
- **Version:** 1.0.0
- **Description:** Systematic approach to editing marketing copy through seven focused passes (clarity, voice/tone, so what, prove it, specificity, emotion, zero risk).
- **Key Features:**
  - Seven sweeps framework (each addressing one dimension)
  - Clarity sweep (understandability, jargon removal)
  - Voice & tone sweep (consistency, personality)
  - "So what" sweep (benefits extraction)
  - "Prove it" sweep (substantiation and social proof)
  - Specificity sweep (vague → concrete language)
  - Heightened emotion sweep (resonance and feeling)
  - Zero risk sweep (objection handling, trust signals)
  - Quick-pass editing checks (word, sentence, paragraph level)
  - Common copy problems and fixes
- **Category:** Marketing
- **Trigger:** Edit, review, or improve existing marketing copy; mentions of "edit copy," "copy feedback," "proofread"

#### 5. Content Strategy
- **Name:** content-strategy
- **Version:** 1.0.0
- **Description:** Planning content strategy that drives traffic, builds authority, and generates leads through searchable and/or shareable content.
- **Key Features:**
  - Searchable vs. shareable content framework
  - Content types: use-case, hub-and-spoke, template libraries, thought leadership, data-driven, expert roundups, case studies
  - Content pillars (3-5 core topics) and topic clusters
  - Keyword research by buyer stage (awareness, consideration, decision, implementation)
  - Content ideation from 6 sources: keyword data, call transcripts, surveys, forums, competitor analysis, sales input
  - Prioritization scoring (customer impact 40%, content-market fit 30%, search potential 20%, resources 10%)
  - Topic cluster mapping
  - Related skills: copywriting, seo-audit, programmatic-seo, email-sequence
- **Category:** Marketing
- **Trigger:** Planning content strategy, deciding what content to create, figuring out topics

#### 6. Page CRO
- **Name:** page-cro
- **Version:** 1.0.0
- **Description:** Conversion rate optimization expert analyzing marketing pages (homepage, landing, pricing, feature, blog) with actionable recommendations.
- **Key Features:**
  - CRO analysis framework ordered by impact: value prop clarity, headline effectiveness, CTA placement/copy/hierarchy, visual hierarchy, trust signals, objection handling, friction points
  - Page-specific frameworks: homepage, landing, pricing, feature, blog
  - Quick wins vs. high-impact changes
  - Copy alternatives and rationale
  - A/B testing ideas by page type
  - Output format with recommendations structure
  - Related skills: signup-flow-cro, form-cro, popup-cro, copywriting, ab-test-setup
- **Category:** Marketing
- **Trigger:** Optimize/improve conversions on marketing pages; mentions of "CRO," "conversion rate optimization," "page isn't converting"

#### 7. Launch Strategy
- **Name:** launch-strategy
- **Version:** 1.0.0
- **Description:** Expert in SaaS product launches and feature announcements covering phased launches, channel strategy, and momentum building.
- **Key Features:**
  - ORB framework: Owned channels (email, blog, community), Rented channels (social, marketplaces), Borrowed channels (guest content, collaborations)
  - Five-phase launch approach: internal, alpha, beta, early access, full launch
  - Product Hunt launch strategy with case studies (SavvyCal, Reform)
  - Post-launch product marketing (education, reinforcement, differentiation)
  - Ongoing launch strategy (prioritization matrix, announcement tactics)
  - Launch checklist (pre-launch, launch day, post-launch)
  - Related skills: marketing-ideas, email-sequence, page-cro, marketing-psychology
- **Category:** Marketing
- **Trigger:** Planning product launch, feature announcement, release strategy, go-to-market, beta launch

#### 8. Product Marketing Context
- **Name:** product-marketing-context
- **Version:** 1.0.0
- **Description:** Create and maintain product marketing context document capturing foundational positioning and messaging information referenced by other marketing skills.
- **Key Features:**
  - Auto-draft from codebase (README, landing pages, marketing copy) vs. start from scratch options
  - 12 sections: product overview, target audience, personas, problems & pain points, competitive landscape, differentiation, objections & anti-personas, switching dynamics (JTBD Four Forces), customer language, brand voice, proof points, goals
  - Focus on verbatim customer language
  - Stored at `.claude/product-marketing-context.md`
  - Referenced by other marketing skills (marketing-ideas, social-content, pricing-strategy, etc.)
- **Category:** Marketing
- **Trigger:** Creating or updating product marketing context, setting up positioning documentation

#### 9. Analytics Tracking
- **Name:** analytics-tracking
- **Version:** 1.0.0
- **Description:** Analytics implementation and measurement setup covering event tracking, GA4, GTM, UTM parameters, and measurement strategy.
- **Key Features:**
  - Core principles: track for decisions, start with questions, consistent naming, data quality
  - Tracking plan framework with event naming conventions (object-action format)
  - Essential events for marketing sites and products
  - Event properties (standard: page, user, campaign, product)
  - GA4 implementation (custom events, gtag.js)
  - Google Tag Manager setup (tags, triggers, variables, data layer)
  - UTM parameter strategy with naming conventions
  - Debugging and validation tools
  - Privacy and compliance considerations
  - Tool integrations (GA4, Mixpanel, Amplitude, PostHog, Segment)
  - Related skills: ab-test-setup, seo-audit, page-cro
- **Category:** Marketing
- **Trigger:** Set up, improve, or audit analytics; mentions of "GA4," "tracking," "event tracking," "UTM parameters"

---

### Development Discipline (obra/superpowers)

All skills hosted in: `https://github.com/obra/superpowers/tree/main/skills/`

#### 10. Using Superpowers
- **Name:** using-superpowers
- **Description:** EXTREMELY-IMPORTANT: Use when starting any conversation - establishes how to find and use skills, requiring Skill tool invocation before ANY response including clarifying questions.
- **Key Features:**
  - Core rule: Invoke relevant skills BEFORE any response/action (1% chance = invoke)
  - Skill priority order: process skills first (brainstorming, debugging), implementation skills second
  - Red flags preventing rationalizations (simple question, need context first, explore codebase first)
  - Skill types: rigid (TDD, debugging - follow exactly), flexible (patterns - adapt to context)
  - Decision flowchart for skill application
  - Anti-rationalization messaging with 1% rule enforcement
  - Non-negotiable protocol enforcement
- **Category:** Implementation / Development Discipline
- **Trigger:** Starting any conversation - MANDATORY skill invocation protocol

#### 11. Verification Before Completion
- **Name:** verification-before-completion
- **Description:** Use when about to claim work is complete, fixed, or passing - requires running verification commands and confirming output before making success claims.
- **Key Features:**
  - Iron Law: NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE
  - Gate function: identify verification command → run full command → read output → verify claim → only then claim
  - Common failures table (tests pass, linter clean, build, bug fix, regression test, agent completed, requirements met)
  - Red flags - STOP list with rationalization prevention
  - Rationalization table (should/probably, confidence, just this once, partial checks)
  - Key patterns for tests, regression tests (red-green cycle), build, requirements, agent delegation
  - Evidence-before-assertions principle
  - Violation consequences (broken trust, undefined functions shipping, missing requirements)
  - Application triggers: before ANY success claims, completion claims, satisfaction expressions
  - Non-negotiable protocol
- **Category:** Development Discipline
- **Trigger:** About to claim work complete, fixed, or passing; before commits/PRs

#### 12. Writing Skills
- **Name:** writing-skills
- **Description:** Use when creating new skills, editing existing skills, or verifying skills work before deployment - applies TDD to process documentation.
- **Key Features:**
  - Test-Driven Development for skill documentation (RED-GREEN-REFACTOR)
  - When to create skills (technique wasn't intuitive, would reference again, applies broadly)
  - Skill types: technique, pattern, reference
  - SKILL.md structure: YAML frontmatter (name, description), overview, when to use, core pattern, quick reference, implementation, common mistakes
  - Claude Search Optimization (CSO): rich descriptions, keyword coverage, descriptive naming, token efficiency
  - Critical: description = "Use when..." (triggering conditions only), NOT workflow summary
  - File organization: self-contained, with reusable tool, with heavy reference
  - Iron Law: NO SKILL WITHOUT A FAILING TEST FIRST
  - Testing methodology: discipline-enforcing, technique, pattern, reference skills
  - Rationalization bulletproofing: close every loophole, address spirit vs. letter, rationalization table, red flags
  - RED phase (baseline testing), GREEN phase (write minimal skill), REFACTOR phase (close loopholes)
  - Skill creation checklist (TDD adapted with TodoWrite todos)
  - Anti-patterns: narrative examples, multi-language dilution, code in flowcharts, generic labels
  - Required background: superpowers:test-driven-development
- **Category:** Implementation / Development Discipline
- **Trigger:** Creating new skills, editing skills, verifying skill effectiveness before deployment

---

## Cross-Cutting Patterns

### Discovery & Trigger Optimization
All skills use "Use when..." triggering conditions in descriptions for Claude Search Optimization (CSO). Descriptions focus on symptoms and contexts, never workflow summaries.

### Skill Interconnections
Marketing skills explicitly reference each other:
- Content strategy → copywriting (individual pieces)
- Social content → copywriting (longer-form feeding social)
- Page CRO → copy-editing (copy optimization)
- Pricing strategy → page-cro (pricing page optimization)
- Launch strategy → social-content, email-sequence (coordinating channels)

### TDD Philosophy
Both marketingskills and superpowers frameworks apply test-driven thinking:
- Writing skills: TDD for documentation (red-green-refactor cycle)
- Verification before completion: iron law of evidence-based claims
- Using superpowers: non-negotiable skill invocation discipline

### Customer Language Emphasis
Multiple skills emphasize verbatim customer language:
- Marketing ideas: "Check for product marketing context first"
- Product marketing context: "Push for verbatim customer language"
- Content strategy: "Extract exact phrases to use (voice of customer)"
- Social content: "Hook formulas starting with common language patterns"

---

## Summary by Category

| Category | Count | Skills | Focus |
|----------|-------|--------|-------|
| Marketing | 9 | marketing-ideas, social-content, pricing-strategy, copy-editing, content-strategy, page-cro, launch-strategy, product-marketing-context, analytics-tracking | Demand generation, monetization, messaging, optimization |
| Implementation | 2 | using-superpowers, verification-before-completion, writing-skills | Quality, discipline, skill authoring |
| Development Discipline | 1 | writing-skills | (counted above) |

---

## Key Insights

1. **Marketing Skills Are Interconnected:** Marketing operations flow from context (product-marketing-context) through strategy (content, social, pricing, launch) to optimization (copy-editing, page-cro) and measurement (analytics-tracking).

2. **Evidence-Based Approach:** Skills emphasize verification, proof points, and customer research before claims. No speculation; all recommendations backed by data or research frameworks.

3. **Stage & Audience Specificity:** Rather than generic advice, skills tailor by stage (pre-launch, early, growth, scale), audience type, budget, and timeline. Product-marketing-context enables this by centralizing positioning.

4. **Reusability Over Narrative:** Skills document patterns and frameworks, not one-off solutions. Each skill is structured for application to new scenarios, not storytelling about past projects.

5. **Friction Reduction:** All skills follow similar structure (overview, quick reference, patterns, common mistakes) making them scannable and immediately applicable. No lengthy prose; maximum information density.

6. **Discipline as Core:** Development discipline skills (using-superpowers, verification-before-completion, writing-skills) are foundational. They enforce protocols preventing rationalization, shipped untested code, and unverified claims.

---

## Unresolved Questions

None identified. All skills successfully fetched and analyzed. Repository structure, naming, and content patterns are consistent and well-documented.

---

## Sources

- [GitHub - coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills)
- [GitHub - obra/superpowers](https://github.com/obra/superpowers)
