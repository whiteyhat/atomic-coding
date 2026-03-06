# Atomic Coding - Repository Documentation

## Table of Contents

- [1. Project Overview](#1-project-overview)
- [2. Tech Stack](#2-tech-stack)
- [3. Directory Structure](#3-directory-structure)
- [4. Core Concept: Atoms](#4-core-concept-atoms)
- [5. Database Schema](#5-database-schema)
- [6. MCP Tools](#6-mcp-tools)
- [7. Rebuild Pipeline](#7-rebuild-pipeline)
- [8. Game Player](#8-game-player-game-playerhtml)
- [9. Frontend Architecture](#9-frontend-architecture)
- [10. Backend Architecture](#10-backend-architecture)
- [11. AI Agent System](#11-ai-agent-system)
- [12. Environment Variables](#12-environment-variables)
- [13. Data Flow Diagrams](#13-data-flow-diagrams)

---

## 1. Project Overview

**Atomic Coding** is an AI-native game development platform. Users build Three.js games by chatting with an AI agent instead of writing code in a traditional editor. The AI creates and modifies small code units called **atoms** (pure JavaScript functions, max 2KB each), which are automatically assembled into a runnable game bundle.

### What Makes It Different

- **Code is data.** Atoms live in a database, not on disk. Each atom is a row with typed metadata (inputs, outputs, dependencies).
- **AI-first workflow.** Users describe what they want in natural language. The AI plans and executes changes via MCP tools.
- **Live hot-reload.** Every atom change triggers an automatic rebuild. The game iframe detects the new build via Supabase Realtime and reloads instantly.
- **Composable by design.** Atoms are forced to be small, pure functions with primitive-only interfaces. No classes, no objects, no side-effect coupling.

### High-Level Architecture

```
User (Browser)
    |
    v
Next.js Frontend (web/)
    |
    |-- Chat UI -----> POST /api/chat -----> AI Agent (Claude/Gemini via OpenRouter)
    |                                             |
    |                                             |-- MCP Client --> atomic-coding MCP Server
    |                                             |                      |
    |                                             |                      |--> Supabase DB (atoms, builds, etc.)
    |                                             |                      |--> Rebuild Pipeline --> Storage (latest.js)
    |                                             |
    |                                             |-- MCP Client --> buu-tools MCP Server
    |                                                                    |
    |                                                                    |--> buu.fun API (3D model generation)
    |
    |-- Game Iframe --> game-player.html
                            |
                            |-- Fetch manifest.json + latest.js from Supabase Storage
                            |-- Supabase Realtime (watches builds table for status=success)
                            |-- Auto-reloads bundle on new successful build
```

---

## 2. Tech Stack

### Frontend (`web/`)

| Category | Technology | Version | Purpose |
|----------|-----------|---------|---------|
| Framework | Next.js | 16.1.6 | App Router, SSR, API routes |
| UI Library | React | 19.2.3 | Component rendering |
| Language | TypeScript | 5.x | Type safety |
| Styling | Tailwind CSS | 4.x | Utility-first CSS |
| Component Library | shadcn/ui + Radix UI | 1.4.x | Accessible UI primitives |
| Icons | lucide-react | 0.563.0 | Icon set |
| AI/Chat | @ai-sdk/react | 3.0.x | React hooks for AI streaming |
| AI/MCP | @ai-sdk/mcp | 1.0.x | MCP client for tool use |
| AI/Core | ai (Vercel AI SDK) | 6.0.x | Agent framework |
| Model Provider | @openrouter/ai-sdk-provider | 2.1.x | Multi-model access |
| Code Highlighting | shiki | 3.22.x | Syntax highlighting |
| Markdown Rendering | streamdown | 2.1.x | Streaming markdown + code/math/mermaid |
| Database Client | @supabase/supabase-js | 2.95.x | Supabase browser client |
| Layout | react-resizable-panels | 4.6.x | Resizable split panes |
| Scrolling | use-stick-to-bottom | 1.1.x | Auto-scroll chat to bottom |
| Utilities | nanoid, clsx, tailwind-merge | various | IDs, classnames, CSS merging |

### Backend (`supabase/functions/`)

| Category | Technology | Purpose |
|----------|-----------|---------|
| Runtime | Deno | Edge Function runtime |
| HTTP Framework | Hono | Lightweight router |
| Validation | Zod | Schema validation for MCP tool inputs |
| Database | Supabase (PostgreSQL) | Data storage, auth, realtime, storage |
| Vector Search | pgvector | Semantic search via embeddings |
| Embeddings | OpenRouter (text-embedding-3-small) | Generate 1536-dim vectors for atoms |
| MCP Protocol | @anthropic-ai/sdk (MCP) | Tool exposure via Model Context Protocol |
| 3D Generation | buu.fun API | AI-generated 3D models and worlds |

---

## 3. Directory Structure

```
atomic-coding/
├── README.md                              # High-level project overview
├── .env.example                           # Required environment variables
├── .gitignore
│
├── docs/
│   ├── AGENT_SYSTEM_PROMPT.md             # AI agent behavior documentation
│   ├── MCP_SERVER.md                      # MCP tool API reference
│   └── prompts/
│       ├── builder.md                     # Builder agent prompt
│       ├── planner.md                     # Planner agent prompt
│       └── researcher.md                  # Researcher agent prompt
│
├── frontend/
│   ├── index.html                         # Standalone game player (legacy/reference)
│   └── style.css                          # Minimal dark UI styles
│
├── supabase/
│   ├── config.toml                        # Local dev config (ports, auth, etc.)
│   │
│   ├── migrations/                        # Database schema evolution
│   │   ├── 001_initial_schema.sql         # atoms, atom_dependencies, builds, pgvector
│   │   ├── 002_games_and_snapshots.sql    # Multi-game support, atom snapshots
│   │   ├── 003_external_dependencies.sql  # External library registry + installs
│   │   ├── 004_atomic_assets_registry.sql # Atomic Assets library entry
│   │   ├── 005_module_externals_gltf.sql  # GLTF loader, module-type externals
│   │   ├── 006_buu_assets_registry.sql    # BUU 3D assets library
│   │   ├── 007-010_buu_updates.sql        # BUU version pins + CDN updates
│   │   ├── 009_gaussian_splats.sql        # Gaussian splat support
│   │   └── 011_chat_sessions.sql          # Chat session + message tables
│   │
│   └── functions/                         # Supabase Edge Functions (Deno)
│       ├── deno.json                      # Deno dependencies
│       │
│       ├── _shared/                       # Shared utilities across functions
│       │   ├── supabase-client.ts         # Singleton client (service role key)
│       │   ├── logger.ts                  # Structured JSON logging + timing
│       │   ├── openai.ts                  # Embedding generation (OpenRouter)
│       │   ├── topological-sort.ts        # Kahn's algorithm for atom ordering
│       │   └── services/                  # Business logic layer
│       │       ├── atoms.ts               # Atom CRUD, semantic search, embeddings
│       │       ├── builds.ts              # Build management, snapshots, rollback
│       │       ├── externals.ts           # Library registry + installations
│       │       ├── games.ts               # Game CRUD, validation
│       │       └── chat.ts                # Chat sessions + messages
│       │
│       ├── api/
│       │   └── index.ts                   # REST API (Hono) - all CRUD endpoints
│       │
│       ├── mcp-server/
│       │   └── index.ts                   # MCP server - 6 tools for AI agent
│       │
│       ├── rebuild-bundle/
│       │   └── index.ts                   # Bundle assembler (topo sort + IIFE)
│       │
│       └── buu-mcp/
│           └── index.ts                   # BUU 3D generation proxy (2 tools)
│
└── web/                                   # Next.js frontend application
    ├── package.json
    ├── next.config.ts                     # Minimal (defaults)
    ├── tsconfig.json                      # Strict, path alias @/* -> ./src/*
    ├── postcss.config.mjs                 # @tailwindcss/postcss
    ├── eslint.config.mjs                  # next/core-web-vitals + typescript
    ├── components.json                    # shadcn/ui configuration
    │
    ├── public/
    │   └── game-player.html               # Standalone game loader (iframe target)
    │
    └── src/
        ├── app/
        │   ├── layout.tsx                 # Root: Geist fonts, dark mode, TooltipProvider
        │   ├── page.tsx                   # Home: game listing grid (SSR)
        │   ├── globals.css                # Tailwind imports, CSS variables, theme
        │   ├── api/
        │   │   └── chat/
        │   │       └── route.ts           # POST /api/chat - streaming AI endpoint
        │   └── games/
        │       └── [name]/
        │           └── page.tsx           # Game workspace page (SSR, dynamic route)
        │
        ├── components/
        │   ├── workspace/
        │   │   └── game-workspace.tsx     # Main layout: header + sidebar + iframe
        │   │
        │   ├── chat/
        │   │   ├── chat-panel.tsx         # AI chat: streaming, persistence, sessions
        │   │   └── tool-call.tsx          # Collapsible tool invocation display
        │   │
        │   ├── console/
        │   │   ├── actions-console.tsx    # Tab container for config panels
        │   │   ├── atoms-tab.tsx          # Browse atoms by type with signatures
        │   │   ├── builds-tab.tsx         # Build history, rebuild, rollback
        │   │   ├── externals-tab.tsx      # Install/uninstall libraries
        │   │   └── settings-tab.tsx       # Game info (read-only)
        │   │
        │   ├── playground/
        │   │   └── game-frame.tsx         # <iframe> wrapper for game-player.html
        │   │
        │   ├── ai-elements/
        │   │   ├── conversation.tsx       # Auto-scroll container + helpers
        │   │   ├── message.tsx            # Message rendering + branching
        │   │   ├── code-block.tsx         # Shiki syntax highlighting
        │   │   ├── tool.tsx               # Tool result formatting
        │   │   ├── model-selector.tsx     # AI model picker dropdown
        │   │   └── prompt-input.tsx       # Chat input: textarea, file drop, submit
        │   │
        │   ├── games/
        │   │   ├── games-header.tsx       # Title + create game button
        │   │   ├── game-card.tsx          # Game listing card
        │   │   └── create-game-dialog.tsx # New game modal form
        │   │
        │   └── ui/                        # 25+ shadcn/ui primitives
        │       ├── button.tsx, dialog.tsx, input.tsx, tabs.tsx, ...
        │       └── (badge, card, collapsible, label, scroll-area,
        │            select, separator, tooltip, etc.)
        │
        └── lib/
            ├── agent.ts                   # AI agent factory (MCP client setup)
            ├── api.ts                     # Frontend API client (18 functions)
            ├── constants.ts               # Models, URLs, defaults
            ├── supabase.ts                # Browser Supabase client
            ├── system-prompt.ts           # AI agent instructions (80 lines)
            ├── types.ts                   # TypeScript interfaces
            └── utils.ts                   # cn() helper (clsx + tailwind-merge)
```

---

## 4. Core Concept: Atoms

An **atom** is the fundamental unit of code in Atomic Coding. It is a single JavaScript function stored as a database record with typed metadata.

### What an Atom Looks Like

```json
{
  "name": "player_jump",
  "type": "feature",
  "code": "function player_jump(velocity_y, is_grounded) {\n  if (!is_grounded) return velocity_y;\n  const config = physics_config();\n  return config.jump_force;\n}",
  "inputs": [
    { "name": "velocity_y", "type": "number", "description": "Current Y velocity" },
    { "name": "is_grounded", "type": "boolean", "description": "Whether player is on ground" }
  ],
  "outputs": [
    { "name": "new_velocity_y", "type": "number", "description": "Y velocity after jump" }
  ],
  "dependencies": ["physics_config"],
  "description": "Apply upward force when the player is grounded",
  "version": 3
}
```

### Atom Constraints

| Rule | Detail |
|------|--------|
| **One job per atom** | Each atom does exactly one thing |
| **Max 2KB** | Code must be under 2048 bytes (~50 lines). Decompose if larger |
| **Primitives only** | Inputs/outputs use only: `number`, `string`, `boolean`, `number[]`, `string[]`, `boolean[]`, `void` |
| **No classes** | Every atom is a plain function |
| **Explicit dependencies** | All atom-to-atom calls must be declared. Missing dependencies break builds |
| **snake_case names** | Pattern: `^[a-z][a-z0-9_]*$` (e.g. `player_jump`, `math_clamp`) |
| **Bottom-up creation** | Create utils first, then features, then core |

### Atom Types

| Type | Purpose | Examples |
|------|---------|---------|
| `core` | Entry points, system-level | `game_loop`, `main`, `create_scene` |
| `feature` | Game mechanics, behaviors | `player_jump`, `spawn_enemy`, `handle_collision` |
| `util` | Pure helpers, configs | `math_clamp`, `physics_config`, `color_lerp` |

### Why Primitives Only?

Forcing primitive interfaces means atoms are truly composable and decoupled:
- No shared mutable state via object references
- Vectors are three `number` inputs (x, y, z)
- Colors are `number[]` for RGBA
- Configuration is returned from util atoms, not passed as objects
- The AI can reason about interfaces without understanding complex types

### How Atoms Compose

Atoms call other atoms by name. Dependencies form a directed acyclic graph (DAG) that is topologically sorted at build time:

```
math_clamp (util)          physics_config (util)
      \                          /
       \                        /
        v                      v
     apply_gravity (feature)  player_jump (feature)
              \                    /
               \                  /
                v                v
              game_loop (core) <--- entry point
```

---

## 5. Database Schema

All data lives in **Supabase (PostgreSQL)** with pgvector enabled for semantic search.

### Tables

#### `games`
The top-level entity. All other data is game-scoped.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID (PK) | Auto-generated |
| `name` | TEXT (UNIQUE) | Human-readable game identifier |
| `description` | TEXT | Optional |
| `active_build_id` | UUID (FK -> builds.id) | Currently deployed build |
| `created_at` | TIMESTAMPTZ | Auto-set |
| `updated_at` | TIMESTAMPTZ | Auto-updated via trigger |

#### `atoms`
Individual code functions.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID (PK) | Auto-generated |
| `game_id` | UUID (FK -> games.id) | Scoped to a game |
| `name` | TEXT | snake_case identifier |
| `type` | TEXT | `core`, `feature`, or `util` |
| `code` | TEXT | Function source code (max 2048 bytes) |
| `inputs` | JSONB | Array of Port objects |
| `outputs` | JSONB | Array of Port objects |
| `description` | TEXT | Natural language description |
| `embedding` | vector(1536) | pgvector embedding for semantic search |
| `version` | INT | Auto-incremented on update |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

Unique constraint: `(game_id, name)`

#### `atom_dependencies`
Edges in the atom dependency graph.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID (PK) | |
| `game_id` | UUID (FK) | |
| `atom_name` | TEXT (FK -> atoms.name) | The atom that depends |
| `depends_on` | TEXT (FK -> atoms.name) | The atom being depended on |

Constraints: unique(atom_name, depends_on), no self-references. CASCADE on atom_name delete, RESTRICT on depends_on delete.

#### `builds`
Build history with rollback support.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID (PK) | |
| `game_id` | UUID (FK) | |
| `status` | TEXT | `building`, `success`, or `error` |
| `bundle_url` | TEXT | Public URL to latest.js |
| `atom_count` | INT | Number of atoms in this build |
| `error_message` | TEXT | Error details if status=error |
| `build_log` | JSONB | Detailed log (atom order, timestamps) |
| `atom_snapshot` | JSONB | Full atom state for rollback |
| `created_at` | TIMESTAMPTZ | |

Realtime enabled: the game player subscribes to UPDATE events where status=success.

#### `external_registry`
Global curated list of available libraries (not game-scoped).

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID (PK) | |
| `name` | TEXT (UNIQUE) | Registry key (e.g. `three_js`) |
| `display_name` | TEXT | Human name (e.g. "Three.js") |
| `package_name` | TEXT | npm package name |
| `version` | TEXT | Pinned version |
| `cdn_url` | TEXT | Script/module CDN URL |
| `global_name` | TEXT | window global (e.g. `THREE`) |
| `description` | TEXT | What the library does |
| `api_surface` | TEXT | Documented API for AI consumption |
| `load_type` | TEXT | `script` (UMD) or `module` (ESM) |
| `module_imports` | JSONB | Import map entries for ESM |

#### `game_externals`
Per-game library installations.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID (PK) | |
| `game_id` | UUID (FK) | |
| `registry_id` | UUID (FK -> external_registry.id) | |
| `installed_at` | TIMESTAMPTZ | |

Unique constraint: `(game_id, registry_id)`. Installing/uninstalling triggers a rebuild.

#### `chat_sessions`
AI chat conversation sessions.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID (PK) | |
| `game_id` | UUID (FK) | |
| `title` | TEXT | Auto-set from first user message |
| `model` | TEXT | AI model used |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

#### `chat_messages`
Individual messages within a session.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID (PK) | |
| `session_id` | UUID (FK -> chat_sessions.id, CASCADE) | |
| `message_id` | TEXT | Client-generated ID for deduplication |
| `role` | TEXT | `user` or `assistant` |
| `parts` | JSONB | Message content parts (text, tool calls, etc.) |
| `created_at` | TIMESTAMPTZ | |

Upsert by `(session_id, message_id)` to avoid duplicates.

### Key Database Functions

- **`match_atoms(query_embedding, threshold, limit)`** - pgvector cosine similarity search for atoms. Used by the semantic_search MCP tool. Match threshold: 0.3.
- **`validate_atom_ports(jsonb)`** - Validates that inputs/outputs have valid primitive types.
- **`update_updated_at()`** - Trigger that auto-increments atom version and updates timestamps.

### Relationships Diagram

```
games (1) ----< atoms (many)
games (1) ----< builds (many)
games (1) ----< game_externals (many) >---- external_registry
games (1) ----< chat_sessions (many) ----< chat_messages (many)
atoms (1) ----< atom_dependencies (many) >---- atoms (depends_on)
games (1) ---- active_build_id ----> builds (1, nullable)
```

---

## 6. MCP Tools

The AI agent interacts with the codebase through **Model Context Protocol (MCP)** tools. There are two MCP servers.

### Atomic Coding MCP Server (`supabase/functions/mcp-server/`)

Exposed at: `{SUPABASE_URL}/functions/v1/mcp-server`
Auth: `x-game-id` header scopes all operations to a specific game.

#### Tool 1: `get_code_structure`

Returns a map of all atoms and installed externals without source code. Used by the AI to understand the current state of the game.

**Input:**
```json
{ "type_filter": "feature" }   // optional: "core" | "feature" | "util"
```

**Output:**
```json
{
  "externals": [
    { "name": "three_js", "global_name": "THREE", "version": "0.160.0", "description": "..." }
  ],
  "atoms": [
    {
      "name": "player_jump",
      "type": "feature",
      "inputs": [{ "name": "velocity_y", "type": "number" }],
      "outputs": [{ "name": "new_velocity_y", "type": "number" }],
      "depends_on": ["physics_config"]
    }
  ]
}
```

#### Tool 2: `read_atoms`

Reads full source code and metadata for specific atoms.

**Input:**
```json
{ "names": ["player_jump", "physics_config"] }
```

**Output (formatted text):**
```
// === player_jump (feature) v3 ===
// Apply upward force when grounded
// Signature: (velocity_y: number, is_grounded: boolean) => number
// Depends on: [physics_config]
function player_jump(velocity_y, is_grounded) { ... }
```

#### Tool 3: `semantic_search`

Finds atoms by natural language using pgvector embeddings (text-embedding-3-small, 1536 dimensions).

**Input:**
```json
{ "query": "jump logic for players", "limit": 5 }
```

**Output:** Same format as `read_atoms` but with similarity scores, ranked by relevance. Threshold: 0.3 cosine similarity.

#### Tool 4: `read_externals`

Returns the full API surface documentation for installed libraries.

**Input:**
```json
{ "names": ["three_js"] }
```

**Output:** Formatted text with library name, version, CDN URL, and full `api_surface` documentation.

#### Tool 5: `upsert_atom`

Creates or updates an atom. Triggers a rebuild automatically.

**Input:**
```json
{
  "name": "player_jump",
  "type": "feature",
  "code": "function player_jump(velocity_y, is_grounded) { ... }",
  "inputs": [{ "name": "velocity_y", "type": "number" }],
  "outputs": [{ "name": "new_velocity_y", "type": "number" }],
  "dependencies": ["physics_config"],
  "description": "Apply jump force when grounded"
}
```

**Validation:**
- Name matches `^[a-z][a-z0-9_]*$`
- Code is under 2048 bytes
- All listed dependencies must already exist in the database
- Port types must be valid primitives

**Side effects:** Generates embedding, upserts to DB, replaces dependency records, fires async rebuild.

#### Tool 6: `delete_atom`

Removes an atom. Fails if other atoms depend on it.

**Input:**
```json
{ "name": "old_function" }
```

**Error case:** `"Cannot delete 'physics_config': used by [player_jump, gravity_apply]"`

### BUU Tools MCP Server (`supabase/functions/buu-mcp/`)

Exposed at: `{SUPABASE_URL}/functions/v1/buu-mcp`
Auth: `x-buu-api-key` header with Bearer token.

#### Tool 7: `generate_model`

Generates a 3D model via buu.fun AI.

**Input:**
```json
{ "prompt": "a low-poly sword with a blue gem" }
```

**Output:** JSON with `modelId` from buu.fun. Atoms reference it via `BUU.loadModel(modelId, options)`.

#### Tool 8: `generate_world`

Generates a 3D world/environment as a Gaussian splat.

**Input:**
```json
{ "prompt": "a medieval castle courtyard", "display_name": "Castle", "seed": 42 }
```

**Output:** JSON with `worldId`. Atoms reference it via `BUU.loadWorldSplat(worldId, options)`.

---

## 7. Rebuild Pipeline

Located at: `supabase/functions/rebuild-bundle/index.ts`

The rebuild pipeline transforms atoms from database records into a runnable JavaScript bundle. It is triggered automatically (fire-and-forget) whenever an atom is created, updated, or deleted.

### Step-by-Step Process

```
1. Receive game_id
        |
2. Create build record (status: "building")
        |
3. Snapshot current atoms (for rollback)
        |
4. Fetch all atoms for game
        |
5. Fetch all atom_dependencies for game
        |
6. Topological sort (Kahn's algorithm)
        |   - Orders atoms so dependencies come before dependents
        |   - Detects cycles (would cause build error)
        |
7. Generate bundle (IIFE)
        |   (function() {
        |     "use strict";
        |     // --- [util] math_clamp ---
        |     function math_clamp(...) { ... }
        |     // --- [feature] player_jump ---
        |     function player_jump(...) { ... }
        |     // --- [core] game_loop ---
        |     function game_loop() { ... }
        |     // Boot
        |     if (typeof game_loop === 'function') game_loop();
        |   })();
        |
8. Fetch installed externals for manifest
        |
9. Generate manifest.json
        |   {
        |     "externals": [{ name, cdn_url, global_name, load_type, module_imports }],
        |     "bundle_url": "latest.js",
        |     "built_at": "ISO timestamp"
        |   }
        |
10. Upload to Supabase Storage (bucket: "bundles")
        |   - {gameName}/latest.js        (no cache)
        |   - {gameName}/build_{id}.js    (1hr cache, archival)
        |   - {gameName}/manifest.json    (no cache)
        |
11. Update build record (status: "success", bundle_url, atom_count)
        |
12. Supabase Realtime broadcasts UPDATE to builds table
        |
13. Game player detects status=success -> reloads bundle
```

### Bundle Format

The generated `latest.js` looks like this:

```javascript
// === Atomic Coding Bundle ===
// Game: my-game
// Generated: 2026-03-05T12:00:00Z
// Atoms: 5
// Order: math_clamp, physics_config, player_jump, apply_gravity, game_loop
(function() {
  "use strict";

  // --- [util] math_clamp ---
  function math_clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  // --- [util] physics_config ---
  function physics_config() {
    return { gravity: -9.8, jump_force: 12 };
  }

  // --- [feature] player_jump ---
  function player_jump(velocity_y, is_grounded) {
    if (!is_grounded) return velocity_y;
    const config = physics_config();
    return config.jump_force;
  }

  // --- [core] game_loop ---
  function game_loop() {
    const canvas = document.getElementById('game-canvas');
    // ... Three.js rendering logic ...
  }

  // Boot
  if (typeof game_loop === 'function') game_loop();
})();
```

### Error Handling

If any step fails, the build record is updated with `status: "error"` and `error_message`. The previous `latest.js` is **not** overwritten, preserving the last working version.

### Rollback

Every build stores an `atom_snapshot` (full atom state at build time). Rolling back to a previous build:
1. Reads the snapshot from the target build record
2. Restores all atoms from the snapshot
3. Triggers a fresh rebuild

---

## 8. Game Player (`game-player.html`)

Located at: `web/public/game-player.html`

This is a **standalone HTML file** that runs inside an `<iframe>`. It loads external libraries and the atom bundle, then executes the game. It has no React dependencies - it's pure vanilla JavaScript with Supabase's UMD client.

### Page Structure

```html
<body style="background: #0a0a0a;">
  <div id="status"><!-- Status indicator: dot + text --></div>
  <canvas id="game-canvas"></canvas>
  <script src="supabase-js UMD bundle"></script>
  <script>/* Game loader logic */</script>
</body>
```

### Lifecycle

#### Phase 1: Read Configuration from URL

```
game-player.html?game=my-game&supabaseUrl=https://...&supabaseKey=eyJ...
```

Derives storage paths:
- `STORAGE_BASE = {supabaseUrl}/storage/v1/object/public/bundles/{gameName}`
- `MANIFEST_URL = {STORAGE_BASE}/manifest.json`
- `BUNDLE_URL = {STORAGE_BASE}/latest.js`

#### Phase 2: Load External Libraries

The manifest lists externals with their `load_type`. Three loading strategies handle different library formats:

**A. UMD/IIFE Scripts** (`load_type: "script"`)
- Injected via `<script src="cdn_url">` tag
- Creates a window global (e.g., `window.THREE`)

**B. ES Module with Import Map Shims** (`load_type: "module"` with `module_imports`)
- First loads UMD scripts that create globals
- Then creates an import map that shims `import { Scene } from 'three'` to read from `window.THREE.Scene`
- Uses blob URLs to create ES module re-exporters

**C. Dynamic Import** (`load_type: "module"`)
- Uses `await import(cdn_url)`
- Copies exported members to window global

**Load order matters:** All UMD scripts load first (parallel), then import map is injected, then ES modules load sequentially.

#### Phase 3: Load and Execute Bundle

1. Fetch `manifest.json` (cache-busted with `?t=timestamp`)
2. Load all externals from manifest
3. Fetch `latest.js` (cache-busted)
4. If 404: display "No bundle yet. Create some atoms!"
5. If empty: display "Empty bundle"
6. Otherwise: inject as `<script>` tag into `<body>` (executes immediately in global scope)

#### Phase 4: Realtime Hot-Reload

```javascript
supabase
  .channel('builds')
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'builds',
    filter: 'status=eq.success'
  }, () => loadBundle())  // Re-execute full load sequence
  .subscribe();
```

When a new successful build is detected:
1. Previous `<script>` tag is removed from DOM
2. External globals are cleared
3. Fresh manifest + bundle fetched and injected

#### Status Indicator

A small pill in the top-right corner shows connection state:
- **Green dot** + "Connected" / "Loaded (N ext, HH:MM:SS)" - everything working
- **Orange dot** (pulsing) + "Loading bundle..." - fetching in progress
- **Red dot** + error message - network/config failure

---

## 9. Frontend Architecture

### Pages and Routing (Next.js App Router)

| Route | File | Rendering | Purpose |
|-------|------|-----------|---------|
| `/` | `src/app/page.tsx` | SSR (`force-dynamic`) | Game listing grid |
| `/games/[name]` | `src/app/games/[name]/page.tsx` | SSR (`force-dynamic`) | Game workspace |
| `/api/chat` | `src/app/api/chat/route.ts` | API route | Streaming AI chat endpoint |

### Root Layout (`src/app/layout.tsx`)

- Loads **Geist** fonts (Sans + Mono) via `next/font/google`
- Hard-coded dark mode: `className="dark"` on `<html>`
- Wraps app in `<TooltipProvider>` (200ms delay)
- Metadata: "Atomic Coding - AI-powered game development with atoms"

### Home Page (`/`)

Server-rendered. Fetches all games via `listGames()` and renders:
- `<GamesHeader>` - Title "Atomic Coding" + `<CreateGameDialog>` (modal form)
- Responsive grid of `<GameCard>` components (1/2/3 columns)
- Empty state message when no games exist

### Game Workspace (`/games/[name]`)

The main IDE-like view. Structured as:

```
+--------------------------------------------------+
| [<-] Game Name                         (top bar) |
+------------------+-------------------------------+
|  [Chat] [Config] |                               |
|                   |                               |
|  Chat Panel       |     Game Frame (iframe)       |
|  or               |     game-player.html          |
|  Actions Console  |                               |
|                   |                               |
|  [Input Bar]      |                               |
+------------------+-------------------------------+
     420px wide               flex-1
```

### Key Components

#### `GameWorkspace` (`src/components/workspace/game-workspace.tsx`)
- Props: `{ gameId, gameName }`
- State: `tab: "chat" | "config"` (sidebar toggle)
- Renders header (back button + game name), tabbed sidebar, game iframe

#### `ChatPanel` (`src/components/chat/chat-panel.tsx`)
- Props: `{ gameId, gameName }`
- The heart of the AI interaction. Manages:
  - **Session management:** Creates or loads chat sessions from Supabase
  - **Streaming chat:** Uses `useChat()` hook from `@ai-sdk/react` with transport to `/api/chat`
  - **Message persistence:** `onFinish` callback saves new messages to Supabase. Tracks saved count to avoid duplicates.
  - **Model selection:** Dropdown to switch between Gemini 3 Pro and Claude Opus 4.6

**Chat initialization flow:**
1. Check for existing sessions (`listChatSessions(gameName, 1)`)
2. If found: load previous messages (`getChatMessages()`)
3. If none: create fresh session (`createChatSession()`)

**Message display:**
- `<Conversation>` container with `use-stick-to-bottom` auto-scrolling
- User messages: right-aligned, gray background
- Assistant messages: left-aligned, rendered with `<MessageResponse>` (Streamdown markdown with code/math/mermaid plugins)
- Tool calls: collapsible `<ToolCall>` components showing tool name, input JSON, output, and status (running/done/error)

#### `ActionsConsole` (`src/components/console/actions-console.tsx`)
Tabbed panel with four sub-views:

1. **Externals Tab** - Install/uninstall libraries from a curated registry. Shows installed libraries with name, version, global_name, load_type.
2. **Builds Tab** - Build history with status badges (success=green, building=clock, error=red). Trigger rebuild button. Rollback to previous successful builds.
3. **Atoms Tab** - Browse all atoms grouped by type (core/feature/util). Shows each atom's name, inputs, outputs, and dependencies.
4. **Settings Tab** - Read-only game info: name, description, ID, created date, active build ID, bundle URL.

#### `GameFrame` (`src/components/playground/game-frame.tsx`)
- Renders `<iframe src="/game-player.html?game={name}&supabaseUrl={url}&supabaseKey={key}">`
- Full-width, full-height, black background
- Allows autoplay and fullscreen

### State Management

No Redux or Zustand. State is managed through:

- **React hooks** (`useState`, `useRef`, `useCallback`) for local component state
- **`useChat()` hook** (from `@ai-sdk/react`) for chat messages, streaming status, and transport
- **Next.js Server Components** for initial data fetching (games, game details)
- **Supabase Realtime** (in game-player.html) for live build updates
- **Refs** for cross-render tracking (model selection, session ID, saved message count)

### Styling

- **Tailwind CSS 4** with OKLCH color space
- **Dark mode by default** (`.dark` class on `<html>`)
- **shadcn/ui** components with Class Variance Authority for variants
- **CSS Variables** for theme tokens:
  - Background: `oklch(0.145 0 0)` (near-black)
  - Foreground: `oklch(0.985 0 0)` (near-white)
  - Primary: `oklch(0.922 0 0)` (light gray)
  - Border radius scale from `--radius` base (0.625rem)
- **Fonts:** Geist Sans (body) + Geist Mono (code)

---

## 10. Backend Architecture

All backend logic runs as **Supabase Edge Functions** (Deno runtime).

### Edge Functions

| Function | Path | Framework | Purpose |
|----------|------|-----------|---------|
| `api` | `/functions/v1/api` | Hono | REST API for all CRUD operations |
| `mcp-server` | `/functions/v1/mcp-server` | MCP SDK | 6 tools for AI agent |
| `rebuild-bundle` | `/functions/v1/rebuild-bundle` | Raw Deno.serve | Bundle assembler |
| `buu-mcp` | `/functions/v1/buu-mcp` | MCP SDK | 2 tools for 3D generation |

### REST API Endpoints (`supabase/functions/api/index.ts`)

Built with **Hono**. Middleware: request logging (timing) + CORS (all origins).

#### Games

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/games` | Create a new game `{ name, description? }` |
| `GET` | `/games` | List all games with active build info |
| `GET` | `/games/:name` | Get single game by name (middleware resolves to game_id) |

#### Atoms

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/games/:name/structure` | Get atom map (names, types, ports, deps). Optional `?type=` filter |
| `POST` | `/games/:name/atoms/read` | Read full code for atoms `{ names: [] }` |
| `POST` | `/games/:name/atoms/search` | Semantic search `{ query, limit? }` |
| `PUT` | `/games/:name/atoms/:atom_name` | Create/update atom (triggers rebuild) |
| `DELETE` | `/games/:name/atoms/:atom_name` | Delete atom (fails if depended on) |

#### External Libraries

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/registry/externals` | List all available libraries (global registry) |
| `GET` | `/games/:name/externals` | List installed externals for game |
| `POST` | `/games/:name/externals` | Install external `{ name }` (triggers rebuild) |
| `DELETE` | `/games/:name/externals/:ext_name` | Uninstall external (triggers rebuild) |

#### Builds

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/games/:name/builds` | List build history `?limit=20` |
| `POST` | `/games/:name/builds` | Trigger manual rebuild |
| `POST` | `/games/:name/builds/:id/rollback` | Restore atoms from build snapshot |

#### Chat

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/games/:name/chat/sessions` | List sessions (most recent first) `?limit=20` |
| `POST` | `/games/:name/chat/sessions` | Create session `{ model?, title? }` |
| `DELETE` | `/games/:name/chat/sessions/:id` | Delete session (cascades messages) |
| `GET` | `/games/:name/chat/sessions/:id/messages` | Get all messages (chronological) |
| `POST` | `/games/:name/chat/sessions/:id/messages` | Save messages (upsert by message_id) |

### Services Layer (`supabase/functions/_shared/services/`)

Business logic is separated into service modules, each wrapping Supabase queries:

- **`games.ts`** - `createGame`, `listGames`, `getGame`, `resolveGameId`, `validateGameId`
- **`atoms.ts`** - `getCodeStructure`, `readAtoms`, `semanticSearch`, `upsertAtom`, `deleteAtom`, `triggerRebuild`, `formatSignature`
- **`builds.ts`** - `listBuilds`, `snapshotCurrentAtoms`, `rollbackBuild`
- **`externals.ts`** - `listRegistry`, `installExternal`, `uninstallExternal`, `getInstalledExternals`, `readExternals`
- **`chat.ts`** - `listSessions`, `createSession`, `getSession`, `updateSessionTitle`, `deleteSession`, `getMessages`, `saveMessages`

### Shared Utilities (`supabase/functions/_shared/`)

- **`supabase-client.ts`** - Singleton Supabase client using `SUPABASE_SERVICE_ROLE_KEY` (bypasses Row Level Security)
- **`logger.ts`** - Structured JSON logging with `withLog(label, params, fn)` wrapper for timing + error capture
- **`openai.ts`** - `generateEmbedding(text)` using OpenRouter's text-embedding-3-small model (1536 dimensions, truncates to 30K chars)
- **`topological-sort.ts`** - Kahn's algorithm implementation for ordering atoms by dependencies

---

## 11. AI Agent System

### Agent Setup (`web/src/lib/agent.ts`)

The `createAtomicAgent(modelId, gameId)` function creates a fully configured AI agent:

1. **Creates two MCP clients:**
   - `atomic-coding` → `{SUPABASE_URL}/functions/v1/mcp-server` with `x-game-id` header
   - `buu-tools` → `{SUPABASE_URL}/functions/v1/buu-mcp` with `x-buu-api-key` header

2. **Fetches tools** from both MCP servers and merges them

3. **Creates a `ToolLoopAgent`** with:
   - Model: OpenRouter provider (`openrouter(modelId)`)
   - Instructions: The system prompt (see below)
   - Tools: Combined from both MCP servers
   - Stop condition: `stepCountIs(30)` - max 30 tool-calling steps

4. **Returns** `{ agent, cleanup }` where cleanup closes MCP connections

### Chat API Route (`web/src/app/api/chat/route.ts`)

**POST /api/chat** handles the streaming conversation:

1. Receives: `{ messages, model, gameId, gameName, sessionId }`
2. If `sessionId` provided, loads existing messages from DB and merges with client messages (deduplication by message_id)
3. Creates agent via `createAtomicAgent()`
4. Streams response via `createAgentUIStreamResponse()`
5. Uses a `TransformStream` to intercept stream completion and trigger MCP cleanup
6. Max duration: 120 seconds

### Available Models (`web/src/lib/constants.ts`)

```typescript
MODELS = [
  { id: "google/gemini-3-pro-preview", name: "Gemini 3 Pro", provider: "Google" },
  { id: "anthropic/claude-opus-4.6",   name: "Claude Opus 4.6", provider: "Anthropic" }
]
DEFAULT_MODEL = "google/gemini-3-pro-preview"
```

All models accessed through **OpenRouter**, enabling easy addition of new providers.

### System Prompt (`web/src/lib/system-prompt.ts`)

The system prompt (~80 lines) defines the AI agent's behavior. Key sections:

**Workflow (8 steps):**
1. Understand the user's request
2. Read code structure (`get_code_structure` - call once per conversation, cache result)
3. Semantic search for relevant atoms
4. Read atoms to understand full code
5. Check if enough info to plan
6. Create implementation plan (ordered list of `upsert_atom` calls)
7. Review plan with user before executing
8. Execute upserts in dependency order, verify results

**Hard constraints enforced by prompt:**
- One job per atom, 2KB max, primitives only, declare all dependencies
- Write descriptions (improves semantic search quality)
- snake_case names, no classes, bottom-up creation order
- Always read externals before using their API (`read_externals(["three_js"])`)

**External library usage:**
- Canvas element: `document.getElementById('game-canvas')`
- Only use classes/methods documented in `api_surface`
- Vectors as three number inputs, colors as number arrays

**3D asset generation:**
- `generate_model({ prompt })` -> modelId for GLTF models
- `generate_world({ prompt })` -> worldId for Gaussian splats
- Required externals: `three_js`, `three_gltf_loader`, `buu_assets` (and optionally `gaussian_splats_3d`)

---

## 12. Environment Variables

### Frontend (`web/.env.local`)

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL (also used by game-player.html) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Public anonymous key for browser client |
| `SUPABASE_URL` | Yes | Same URL, used server-side (API route) |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service role key for server-side operations |
| `BUU_API_KEY` | For 3D | buu.fun API key for model/world generation |

### Backend (Supabase Edge Functions)

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Auto | Set automatically by Supabase runtime |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto | Set automatically by Supabase runtime |
| `OPENROUTER_API_KEY` | Yes | OpenRouter key for embeddings (text-embedding-3-small) |
| `BUU_API_KEY` | For 3D | buu.fun API key (passed via MCP header) |

---

## 13. Data Flow Diagrams

### Flow 1: Chat Message -> Game Update

```
User types "add a spinning cube"
        |
        v
ChatPanel.useChat() sends POST /api/chat
  body: { messages, model, gameId, gameName, sessionId }
        |
        v
API route loads DB messages, creates ToolLoopAgent
  connects to atomic-coding MCP + buu-tools MCP
        |
        v
Agent streams response, calling tools:
  1. get_code_structure()     -> understands current state
  2. semantic_search("cube")  -> finds related atoms
  3. read_atoms(["game_loop"])-> reads existing code
  4. upsert_atom("spinning_cube", { code, type: "feature", ... })
  5. upsert_atom("game_loop", { code updated to call spinning_cube, ... })
        |
        v
Each upsert_atom triggers:
  1. Validate code + deps
  2. Generate embedding
  3. Store in DB
  4. Fire-and-forget triggerRebuild(gameId)
        |
        v
Rebuild pipeline:
  1. Fetch all atoms
  2. Topological sort
  3. Generate IIFE bundle
  4. Upload latest.js + manifest.json to Storage
  5. Update build record (status: "success")
        |
        v
Supabase Realtime broadcasts build update
        |
        v
game-player.html detects status=success
  1. Clear old externals + script
  2. Fetch manifest.json
  3. Load externals
  4. Fetch + inject latest.js
        |
        v
Spinning cube appears in the canvas
```

### Flow 2: Game Page Load

```
User navigates to /games/my-game
        |
        v
Next.js SSR: getGame("my-game") -> GameWithBuild
        |
        v
Renders GameWorkspace({ gameId, gameName })
        |
        +--> Sidebar: ChatPanel initializes
        |      |
        |      +--> listChatSessions(gameName, 1)
        |      |     -> found? getChatMessages() : createChatSession()
        |      |
        |      +--> Renders message history + input bar
        |
        +--> Main: GameFrame renders <iframe>
               |
               +--> game-player.html loads
               |     1. Read URL params (game, supabaseUrl, supabaseKey)
               |     2. setupRealtime() -> subscribe to builds table
               |     3. loadBundle()
               |        a. Fetch manifest.json
               |        b. Load externals (UMD scripts, ES modules)
               |        c. Fetch latest.js
               |        d. Inject as <script> -> game runs
               |
               +--> Status: green dot "Loaded (2 ext, 12:00:00)"
```

### Flow 3: Build and Rollback

```
Trigger (any of):
  - upsert_atom() / delete_atom() -> auto-triggers
  - User clicks "Rebuild" button -> POST /games/:name/builds
        |
        v
rebuild-bundle Edge Function:
  1. Create build record (status: building)
  2. Snapshot current atoms
  3. Fetch + sort + bundle
  4. Upload to Storage
  5. Update build (status: success | error)
        |
        v
Build appears in Builds Tab with status badge
        |
        v
User clicks "Rollback" on older successful build
        |
        v
POST /games/:name/builds/:id/rollback
  1. Read atom_snapshot from target build
  2. Restore atoms to that state
  3. Trigger fresh rebuild
        |
        v
New build created from restored atoms
```

### Flow 4: External Library Installation

```
User selects "three_js" in Externals Tab
        |
        v
POST /games/:name/externals { name: "three_js" }
        |
        v
externals.installExternal():
  1. Lookup "three_js" in external_registry
  2. INSERT into game_externals (game_id, registry_id)
  3. triggerRebuild(gameId) -> regenerates manifest.json
        |
        v
manifest.json now includes:
  { externals: [{ name: "three_js", cdn_url: "...", global_name: "THREE", load_type: "script" }] }
        |
        v
Next bundle reload: game-player.html loads Three.js before bundle
  -> window.THREE is now available
  -> Atoms can call THREE.Scene(), THREE.Mesh(), etc.
```
