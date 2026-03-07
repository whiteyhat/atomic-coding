# Deployment Guide

This project has two backend services that need to be deployed independently.

---

## 1. Mastra Orchestrator (Railway)

The Mastra server is a Dockerized Node.js application deployed to Railway. It runs on port 4500 and serves the AI orchestration layer.

**Production URL:** `https://incredible-happiness-production.up.railway.app`

### Prerequisites

- Install Railway CLI: `npm i -g @railway/cli`

### One-Time Setup

```bash
# Login to Railway (opens browser for auth)
railway login

# Navigate to the mastra directory
cd mastra

# Link to the Railway project — select "incredible-happiness"
railway link
```

### Deploy

From the project root:

```bash
cd mastra
railway up
```

This builds the Docker image (`mastra/Dockerfile`), pushes it to Railway, and deploys. The build compiles TypeScript via `tsc` and runs `node dist/index.js` in production.

---

## 2. Supabase (Edge Functions + Database Migrations)

Supabase hosts the Edge Functions (Deno + Hono) and the PostgreSQL database.

**Project Ref:** `wgujqteirximgettseux`
**Dashboard:** `https://supabase.com/dashboard/project/wgujqteirximgettseux`

### Prerequisites

- Install Supabase CLI: `npm i -g supabase`
- Set the access token as an environment variable:

```bash
export SUPABASE_ACCESS_TOKEN=sbp_31e12abe9644f9057eaa1f881c2940389f46eeb4
```

### Deploy Edge Functions

Deploys all Edge Functions in `supabase/functions/`:

- `api` — main API
- `buu-mcp` — MCP server (Buu)
- `mcp-server` — MCP server
- `rebuild-bundle` — game bundle rebuilder
- `warroom-orchestrator` — war room task orchestrator

```bash
supabase functions deploy --project-ref wgujqteirximgettseux
```

### Push Database Migrations

Applies any new migrations from `supabase/migrations/` to the remote database:

```bash
supabase db push --project-ref wgujqteirximgettseux
```

---

## Quick Reference

### Deploy everything (copy-paste)

```bash
# 1. Mastra orchestrator
cd mastra && railway up && cd ..

# 2. Supabase
export SUPABASE_ACCESS_TOKEN=sbp_31e12abe9644f9057eaa1f881c2940389f46eeb4
supabase db push --project-ref wgujqteirximgettseux
supabase functions deploy --project-ref wgujqteirximgettseux
```
