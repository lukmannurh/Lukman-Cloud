# SkillX Database Seeding

Quick reference for seeding the SkillX database with AI agent skills.

## Prerequisites

1. Set `ADMIN_SECRET` environment variable
2. Ensure web app is running (local) or deployed (production)

## Commands

### Local Development

```bash
# Start dev server
pnpm dev

# Seed database (in another terminal)
ADMIN_SECRET=your-secret-here pnpm seed
```

### Production

```bash
API_URL=https://skillx.sh ADMIN_SECRET=your-prod-secret pnpm seed
```

## What Gets Seeded

- **30 curated AI agent skills**
- **5 categories**: devops, implementation, testing, security, planning
- **23 free + 7 paid** skills ($24.99-$79.99)
- **~127 vectors** (avg 4.2 chunks per skill)

## Pipeline

```
seed-skills.mjs
  ↓
POST /api/admin/seed (X-Admin-Secret: xxx)
  ↓
For each skill:
  1. Upsert to D1 database (Drizzle ORM)
  2. Chunk text (512 tokens, 10% overlap)
  3. Generate embeddings (Workers AI)
  4. Index vectors (Vectorize)
```

## Response

```json
{
  "skills": 30,
  "vectors": 127
}
```

## Idempotency

Safe to run multiple times:
- D1 upserts on `slug` conflict
- Vectorize replaces vectors by ID

## Files

- **scripts/seed-data.json** - 30 curated skills
- **scripts/seed-skills.mjs** - Seed script
- **scripts/README.md** - Full documentation

## Troubleshooting

**401 Unauthorized**
- Check `ADMIN_SECRET` matches wrangler.jsonc

**Connection refused**
- Ensure `pnpm dev` is running (local)
- Check `API_URL` is correct (production)

**No data returned from AI model**
- Workers AI binding not configured
- Check wrangler.jsonc has `ai.binding = "AI"`

For detailed docs, see `scripts/README.md`
