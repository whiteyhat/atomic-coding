# Atomic Coding

> Source of truth: see [docs/system-architecture.md](docs/system-architecture.md).
> This README is a historical quickstart and no longer reflects the full current architecture. The active system now includes the Next.js `web/` app, the `mastra/` orchestration service, Supabase REST APIs, and a six-tool MCP server.

Atomic Coding started as an atom-centric game development platform where code lived as **atoms** (individual functions) in Supabase and an AI agent manipulated them through a small MCP tool surface. The current production architecture is broader; use [docs/system-architecture.md](docs/system-architecture.md) for the up-to-date system.

## Original Minimal Architecture

```
AI Agent (Cursor) --> MCP Server (5 tools) --> Supabase (atoms DB + pgvector)
                                                    |
                                              Rebuild Pipeline
                                                    |
                                              Supabase Storage (latest.js)
                                                    |
                                              Frontend (Three.js)
```

## Original 5-Tool View

| Tool | Role | Description |
|------|------|-------------|
| `get_code_structure` | The Map | Lists all atoms with types, inputs/outputs, and dependencies. No code. |
| `read_atoms` | The Magnifier | Reads full source code of specific atoms by name. |
| `semantic_search` | The Compass | Finds atoms by meaning using vector similarity search. |
| `upsert_atom` | The Brush | Creates or updates an atom with typed interface and code. |
| `delete_atom` | The Eraser | Removes an atom (blocked if others depend on it). |

## Type System

Only JS primitives -- keeps atoms truly atomic:

- `number`, `string`, `boolean`
- `number[]`, `string[]`, `boolean[]`
- `void`

No classes, no custom objects. A Vector3 is three `number` inputs. A color is a `number[]`.

## Setup

### 1. Supabase Project

Create a Supabase project at [supabase.com](https://supabase.com).

### 2. Environment Variables

```bash
cp .env.example .env
# Fill in your values:
# - SUPABASE_URL
# - SUPABASE_ANON_KEY
# - SUPABASE_SERVICE_ROLE_KEY
# - OPENROUTER_API_KEY
```

### 3. Database Migration

Run the migration in your Supabase SQL Editor or via CLI:

```bash
supabase db push
```

Or paste the contents of `supabase/migrations/001_initial_schema.sql` into the SQL Editor.

### 4. Deploy Edge Functions

```bash
supabase functions deploy mcp-server --no-verify-jwt
supabase functions deploy rebuild-bundle --no-verify-jwt
```

Set secrets:

```bash
supabase secrets set OPENROUTER_API_KEY=sk-or-v1-your-key
```

### 5. Configure Cursor MCP

Update `.cursor/mcp.json` with your Supabase URL:

```json
{
  "mcpServers": {
    "atomic-coding": {
      "type": "streamable-http",
      "url": "https://your-project.supabase.co/functions/v1/mcp-server"
    }
  }
}
```

### 6. Frontend

Update `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `frontend/index.html`, then open it in a browser.

## Project Structure

```
atomic-coding/
  supabase/
    config.toml                         # Supabase local config
    migrations/
      001_initial_schema.sql            # Tables, indexes, functions, triggers
    functions/
      _shared/
        supabase-client.ts              # Singleton Supabase client
        openai.ts                       # Embedding generation
        topological-sort.ts             # Dependency graph sorting
      mcp-server/
        index.ts                        # MCP server with 5 tools
      rebuild-bundle/
        index.ts                        # Bundle assembler
  frontend/
    index.html                          # Three.js loader + Realtime
    style.css                           # Minimal dark UI
  .cursor/
    mcp.json                            # MCP server config for Cursor
  .env.example
  README.md
```

## How It Works

1. The AI agent uses `get_code_structure` to see the map of all atoms
2. Uses `read_atoms` or `semantic_search` to inspect specific code
3. Uses `upsert_atom` to create/edit atoms with typed interfaces
4. Every `upsert_atom` triggers `rebuild-bundle` automatically
5. The rebuild sorts atoms topologically and uploads `latest.js`
6. The frontend detects new builds via Supabase Realtime and hot-reloads
