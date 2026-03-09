# Deployment Guide

Local development is the normal validation path for this repository. Before deploying, use [local-development.md](local-development.md) to run the hybrid or parity workflow and verify your change locally.

This project has two backend services that need to be deployed independently.

---

## 1. Mastra Orchestrator (Railway)

The Mastra server is a Dockerized Node.js application deployed to Railway. It runs on port 4500 and serves the AI orchestration layer.

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

After local validation:

```bash
cd mastra
npm run build
railway up
```

This builds the Docker image (`mastra/Dockerfile`), pushes it to Railway, and deploys. The build compiles TypeScript via `tsc` and runs `node dist/index.js` in production.

---

## 2. Supabase (Edge Functions + Database Migrations)

Supabase hosts the Edge Functions (Deno + Hono) and the PostgreSQL database.

### Prerequisites

- Install Supabase CLI: `npm i -g supabase`
- Set the access token as an environment variable for the target project:

```bash
export SUPABASE_ACCESS_TOKEN=sbp_your_access_token
```

### Deploy Edge Functions

Deploys all Edge Functions in `supabase/functions/`:

- `api` — main API
- `buu-mcp` — MCP server (Buu)
- `mcp-server` — MCP server
- `rebuild-bundle` — game bundle rebuilder
- `warroom-orchestrator` — war room task orchestrator

```bash
supabase functions deploy --project-ref <your-project-ref>
```

### Push Database Migrations

Applies any new migrations from `supabase/migrations/` to the remote database:

```bash
supabase db push --project-ref <your-project-ref>
```

---

## Quick Reference

### Deploy everything (copy-paste)

```bash
# 0. Verify locally first
npm run dev:doctor
# Then use the local workflow from docs/local-development.md

# 1. Mastra orchestrator
cd mastra && npm run build && railway up && cd ..

# 2. Supabase
export SUPABASE_ACCESS_TOKEN=sbp_your_access_token
supabase db push --project-ref <your-project-ref>
supabase functions deploy --project-ref <your-project-ref>
```
