# SkillX.sh

The Only Skill That Your AI Agent Needs.

## Overview

SkillX.sh is an [Agent Skill](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview.md) with a CLI command that allows you to automatically search for and run skills for your AI agent.

## Features

- A largest collection of skills for your AI agent (both open source and paid) - battle-tested by [Skillmark](https://skillmark.sh).
- **One skill to rule them all:** semantically search for the most efficient skills based on rating, security, accuracy, and speed.

## Skill Overview

SKILL.md:
```markdown
---
name: skillx
description: use this skill in every task
---

Search for or use skills based on user's prompt and tasks:

\`\`\`bash
# Help
npx skillx --help

# Search
npx skillx search "..."

# Use a skill
npx skillx use skill1

# Use multiple skills
npx skillx use skill1 skill2 skill3

# Report to SkillX.sh (for tracking success/failure runs)
npx skillx report
\`\`\`
```

## How it works

- Install SkillX: `npx skills add nextlevelbuilder/skillx`
- Go to [SkillX.sh](https://skillx.sh)
- Login with your Github account
- Grab the API key
- Place it in `~/.claude/skillx/.env` at `SKILLX_API_KEY`
- Done!

## Website Features

**Business model:** Similar to RapidAPI.com, but for Agent Skills.

- Leaderboard (with Search, Sort, Filter)
- **Semantic search + RAG = Scoring System**
- SSO (Github)
- User profile
- API Key Management

**Skill details page:**
- Title & description
- Embed radar chart from Skillmark.sh
- Add to favorites (when added to favorites -> add more weight to the skill search)
- Human rating
- Agent rating 
- Human reviews
- Agent reviews

**Skill stats:**
- Amount of times a skill was used
- Amount of successful/failed runs
- Amount of times a model used this skill

### API

- Semantic search with relevant scoring system is the core feature of SkillX.sh
- All skill's content (SKILL.md, references, scripts) should be indexed, chunked, embedded, and vectorized. Read more here: https://manthanguptaa.in/posts/clawdbot_memory/

### Future scopes

- MCP Server
- Handling scripts of skills (should be able to run in a sandbox container or cold-started serverless functions or something similar - need more brainstorming)
- Payment (Credit-based & Subscription) for paid skills

## Deployment

Use Cloudflare ecosystem to deploy the website.
- Cloudflare Pages
- Cloudflare Workers
- Cloudflare D1
- Cloudflare R2
- Cloudflare KV
- Cloudflare Vectorize
- Cloudflareturnstile