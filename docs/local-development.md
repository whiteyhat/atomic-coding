# Local Development

This project supports two local development loops:

- **Hybrid mode**: local `web` + local `mastra` against a dedicated remote dev Supabase project
- **Parity mode**: local `web` + local `mastra` + local Supabase + locally served Edge Functions

Hybrid mode is the default and should be used for most `mastra/` and UI work. Parity mode exists for backend-heavy changes that need local control over Supabase schema, Edge Functions, or local rebuild behavior.

## Prerequisites

- Node.js 22+
- npm
- Supabase CLI
- Railway CLI
- Docker Desktop or Docker Engine for parity mode only

Check your machine:

```bash
npm run dev:doctor
```

## Configuration Model

The source input for local setup is a single root file:

- checked in: `.env.development.example`
- local copy: `.env.development.local`

Generated files:

- `web/.env.local`
- `mastra/.env.local`
- `supabase/.env.local`

Start by copying the template:

```bash
cp .env.development.example .env.development.local
```

Required values for the default hybrid loop:

- `DEV_SUPABASE_URL`
- `DEV_SUPABASE_ANON_KEY`
- `DEV_SUPABASE_SERVICE_ROLE_KEY`
- `OPENROUTER_API_KEY`

Optional values:

- `BUU_API_KEY`
- `NEXT_PUBLIC_PRIVY_APP_ID`
- `PRIVY_APP_SECRET`
- `SUPABASE_ACCESS_TOKEN`

Defaults that should usually stay as-is:

- `MASTRA_SERVER_URL=http://127.0.0.1:4500`
- `DEV_AUTH_BYPASS=true`
- `DEV_AUTH_BYPASS_USER_ID=did:dev:local-user`
- `DEV_AUTH_BYPASS_TOKEN=dev-bypass`
- `PORT=4500`

## Dev Auth Bypass

Local development includes a strict local-only auth bypass so protected workspace routes and `/api/chat` can be used without Privy during day-to-day development.

Safety rules:

- The bypass requires `DEV_AUTH_BYPASS=true`
- The web app only enables it on local hosts such as `localhost` and `127.0.0.1`
- Supabase auth helpers only honor it for requests that originate from local hosts
- Protected API writes still require the synthetic bearer token `DEV_AUTH_BYPASS_TOKEN`
- It uses a deterministic synthetic user ID: `did:dev:local-user`

This keeps local chat, war-room writes, and local protected flows consistent without making deployed environments less safe.

## Hybrid Mode

Use this for most `mastra/` and `web/` work.

Generate service env files:

```bash
npm run dev:env:hybrid
```

Run the local stack:

```bash
npm run dev:hybrid
```

What this starts:

- local Mastra on `http://127.0.0.1:4500`
- local Next.js web app on `http://127.0.0.1:3002`

What remains remote:

- Supabase database
- Supabase Storage
- Supabase Realtime
- deployed Supabase Edge Functions

Hybrid-mode requirement for protected write routes:

- The dedicated remote dev Supabase project must have `DEV_AUTH_BYPASS=true`
- It must also have the same `DEV_AUTH_BYPASS_TOKEN` value as your local `.env.development.local`
- The deployed `api` function must include the localhost-origin bypass helper from this repository revision

Without that, reads still work, but protected writes such as session saves, score posts, and war-room creation will return `401`.

Expected behavior:

- the workspace loads locally without Privy when bypass is enabled
- `/api/chat` proxies to local Mastra
- war-room creation still uses the remote dev Supabase project
- remote builds and stored bundles remain visible in the iframe player

## Parity Mode

Use this when you need local control over Supabase schema or Edge Functions.

Start local Supabase:

```bash
npm run dev:supabase:start
```

Reset local schema to current migrations:

```bash
npm run dev:supabase:reset
```

Generate local service env files from `supabase status -o env`:

```bash
npm run dev:env:local
```

Run the local stack:

```bash
npm run dev:local
```

What parity mode runs:

- local Supabase containers
- locally served Edge Functions
- local Mastra
- local web

If you want to run only the functions server separately:

```bash
npm run dev:supabase:functions
```

## Available Commands

```bash
npm run dev:doctor
npm run dev:env:hybrid
npm run dev:env:local
npm run dev:web
npm run dev:mastra
npm run dev:hybrid
npm run dev:supabase:start
npm run dev:supabase:reset
npm run dev:supabase:functions
npm run dev:local
```

## Smoke Test Checklist

### Hybrid mode

1. Run `npm run dev:doctor`
2. Run `npm run dev:env:hybrid`
3. Run `npm run dev:hybrid`
4. Open `http://localhost:4500/health`
5. Open `http://localhost:3002`
6. Confirm the protected workspace is accessible without Privy
7. Confirm `/api/chat` reaches local Mastra
8. Create a war room from the workspace and confirm SSE updates arrive
9. Confirm remote bundles still load in the game iframe

### Parity mode

1. Run `npm run dev:supabase:start`
2. Run `npm run dev:supabase:reset`
3. Run `npm run dev:env:local`
4. Run `npm run dev:local`
5. Confirm local Edge Functions respond
6. Confirm the workspace and chat run locally at `http://localhost:3002`
7. Make an atom or external change and verify a local rebuild happens
8. Confirm war-room task, event, and heartbeat updates work end-to-end

## Railway Handoff

Local verification should happen before any Mastra deployment.

Recommended deploy gate:

```bash
cd mastra
npm run build
railway up
```

Use [deployments.md](deployments.md) for the deployment commands after local verification succeeds.
