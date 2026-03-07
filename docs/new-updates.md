# New Updates — War Room & Multi-Agent Orchestration System

This document covers the three most recent commits that introduced the War Room multi-agent orchestration system, migrated from OpenClaw to Mastra, and added foundational platform features (auth, genres, publishing, leaderboards).

---

## Commit History

| Hash | Message | Date | Scope |
|------|---------|------|-------|
| `6abb071` | feat: added war room and openclaw integration and updated the UI as well as added presets | Mar 6, 2026 | 69 files, +29,067 / -2,891 |
| `110886e` | feat: added orchestrator and warrooms supabase functions | Mar 6, 2026 | 8 files, +1,698 |
| `3ad6bfd` | feat: added mastra orchestrator and agentic development | Mar 8, 2026 | 36 files, +5,773 / -435 |

**Narrative arc:**
1. Build all platform features + War Room UI + OpenClaw agent workspace
2. Build the backend orchestration engine (12-task pipeline, SSE streaming, API routes)
3. Replace OpenClaw with Mastra for self-hosted, more controllable agent orchestration

---

## Table of Contents

1. [Why This Was Built](#1-why-this-was-built)
2. [Database & Migrations](#2-database--migrations)
3. [Supabase Edge Functions & Services](#3-supabase-edge-functions--services)
4. [The 12-Task Pipeline](#4-the-12-task-pipeline)
5. [Mastra Server](#5-mastra-server)
6. [Frontend (Next.js)](#6-frontend-nextjs)
7. [OpenClaw to Mastra Migration](#7-openclaw-to-mastra-migration)
8. [Architecture Diagram](#8-architecture-diagram)
9. [Environment Variables & Deployment](#9-environment-variables--deployment)

---

## 1. Why This Was Built

The core problem: building a game in Atomic Coding involves many sequential and parallel tasks — planning architecture, writing code atoms, generating visual assets, validating structural rules, and fixing failures. Doing this manually with a single chat agent is slow and error-prone.

**Solution: the War Room system** — a multi-agent orchestration pipeline that:
- Decomposes a user's game prompt into a fixed 12-step dependency graph
- Dispatches tasks to four specialized AI agents in dependency order
- Runs independent tasks in parallel (e.g., UI assets + game sprites)
- Validates and retries failed atoms automatically (up to 3 cycles)
- Streams real-time progress to the frontend via SSE events and agent heartbeats
- Produces follow-up prompt suggestions after completion

---

## 2. Database & Migrations

Seven new migrations were added in `supabase/migrations/`:

### Platform Foundations (012–017)

| Migration | What It Creates |
|-----------|-----------------|
| `012_auth_and_user_profiles.sql` | `user_profiles` table for Privy-based auth |
| `013_genre_boilerplates.sql` | `genre_boilerplates` table for game templates |
| `014_seed_boilerplates.sql` | Seed data for 5 built-in genres (hex-grid, side-scroller, roguelike, arena, base-builder) |
| `015_scores_and_leaderboard.sql` | `scores` + `leaderboards` tables for gameplay tracking |
| `016_game_publishing.sql` | Publishing workflow columns on games |
| `017_token_skeleton.sql` | Token economics skeleton for future Web3 features |

### War Room Schema (018)

**File:** `supabase/migrations/018_war_rooms.sql`

Creates 4 tables with Supabase Realtime enabled on the event/heartbeat tables:

#### `war_rooms`
Main war room record, one per orchestration run.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | War room identifier |
| `game_id` | UUID (FK → games) | The game being developed |
| `user_id` | TEXT (FK → user_profiles) | Who created it |
| `prompt` | TEXT | The user's original prompt |
| `genre` | TEXT | Game genre (hex-grid-tbs, side-scroller-2d-3d, etc.) |
| `status` | TEXT | `planning` / `running` / `completed` / `failed` / `cancelled` |
| `scope` | JSONB | Parsed scope from task 1 output |
| `suggested_prompts` | TEXT[] | Follow-up prompts from task 12 |
| `final_build_id` | UUID (FK → builds) | The final game bundle build |
| `created_at` | TIMESTAMPTZ | Creation time |
| `completed_at` | TIMESTAMPTZ | Completion time |

#### `war_room_tasks`
The 12 pipeline tasks per war room.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Task identifier |
| `war_room_id` | UUID (FK → war_rooms) | Parent war room |
| `task_number` | INT | 1–12 position in pipeline |
| `title` | TEXT | Human-readable task name |
| `description` | TEXT | What this task does |
| `assigned_agent` | TEXT | `jarvis` / `forge` / `pixel` / `checker` |
| `status` | TEXT | `pending` / `assigned` / `running` / `completed` / `failed` / `blocked` |
| `depends_on` | INT[] | Task numbers that must complete first |
| `output` | JSONB | Agent output stored after completion |
| `started_at` | TIMESTAMPTZ | When agent started working |
| `completed_at` | TIMESTAMPTZ | When task finished |

**Unique constraint:** `(war_room_id, task_number)` — exactly one of each task per room.

#### `war_room_events` (Realtime enabled)
Append-only log of all state changes, used for SSE streaming to the frontend.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Event identifier |
| `war_room_id` | UUID (FK) | Parent war room |
| `event_type` | TEXT | `task_assigned`, `task_running`, `task_completed`, `task_failed`, `war_room_created`, `retry_cycle`, `pipeline_error`, etc. |
| `agent` | TEXT | Which agent triggered this event |
| `task_number` | INT | Which task (if applicable) |
| `payload` | JSONB | Event metadata |
| `created_at` | TIMESTAMPTZ | Event timestamp |

#### `agent_heartbeats` (Realtime enabled)
Per-agent liveness tracking with upsert semantics.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Heartbeat identifier |
| `war_room_id` | UUID (FK) | Parent war room |
| `agent` | TEXT | `jarvis` / `forge` / `pixel` / `checker` |
| `status` | TEXT | `idle` / `working` / `error` / `timeout` |
| `last_ping` | TIMESTAMPTZ | Last heartbeat time |
| `metadata` | JSONB | Extra info (current task, error details, etc.) |

**Unique constraint:** `(war_room_id, agent)` — one heartbeat row per agent per room, upserted on each update.

---

## 3. Supabase Edge Functions & Services

### New Service Layer

All services live in `supabase/functions/_shared/services/` and follow the existing pattern of using `getSupabaseClient()` singleton with service-role key.

| Service File | Purpose |
|-------------|---------|
| `warrooms.ts` (559 lines) | Full CRUD for war rooms, tasks, events, heartbeats. Creates the 12 pipeline tasks on room creation. |
| `orchestrator.ts` (246 lines) | Dependency-based task dispatch loop with retry logic (Supabase-side version, pluggable dispatch) |
| `boilerplates.ts` (144 lines) | Genre boilerplate template CRUD |
| `scores.ts` (119 lines) | Score tracking and leaderboard queries |
| `tokens.ts` (127 lines) | Token/Web3 skeleton |
| `users.ts` (70 lines) | User profile management (Privy integration) |

### War Room Service Details (`warrooms.ts`)

**Key functions:**

| Function | Signature | What It Does |
|----------|-----------|-------------|
| `createWarRoom` | `(gameId, userId, prompt, genre) → WarRoomWithTasks` | Creates a war room + inserts all 12 pipeline tasks + records creation event |
| `getWarRoom` | `(warRoomId) → WarRoomWithTasks \| null` | Fetches war room with all tasks ordered by task_number |
| `listWarRooms` | `(gameId, limit?) → WarRoom[]` | Lists rooms for a game, newest first |
| `updateWarRoomStatus` | `(warRoomId, status, suggestedPrompts?, finalBuildId?) → WarRoom` | Updates status, sets `completed_at` on terminal states |
| `assignTask` | `(warRoomId, taskNumber, agent) → WarRoomTask` | Assigns agent to task, records `task_assigned` event |
| `updateTaskStatus` | `(warRoomId, taskNumber, status, output?) → WarRoomTask` | Updates task state, records event, sets timestamps |
| `getTasks` | `(warRoomId) → WarRoomTask[]` | Gets all tasks ordered by task_number |
| `recordEvent` | `(warRoomId, eventType, agent?, taskNumber?, payload?) → WarRoomEvent` | Appends to event log |
| `getEvents` | `(warRoomId, sinceId?) → WarRoomEvent[]` | Gets events, supports `sinceId` for SSE reconnection |
| `upsertHeartbeat` | `(warRoomId, agent, status, metadata?) → AgentHeartbeat` | Upserts heartbeat with `onConflict: "war_room_id,agent"` |
| `getHeartbeats` | `(warRoomId) → AgentHeartbeat[]` | Gets all heartbeats for a room |

### API Routes (added to `supabase/functions/api/index.ts`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/games/:name/warrooms` | Creates war room + fire-and-forget triggers orchestrator |
| `GET` | `/games/:name/warrooms` | Lists war rooms for a game |
| `GET` | `/games/:name/warrooms/:id` | Gets a war room with its tasks |
| `GET` | `/games/:name/warrooms/:id/events` | **SSE event stream** — polling-based, 2s interval, sends heartbeats, auto-closes on completion |
| `POST` | `/games/:name/warrooms/:id/heartbeat` | Agent heartbeat endpoint |
| `POST` | `/games/:name/warrooms/:id/tasks/:num/status` | Task status update |

### `warroom-orchestrator` Edge Function

**File:** `supabase/functions/warroom-orchestrator/index.ts`

A thin proxy that forwards pipeline execution requests from Supabase to the Mastra server. Called fire-and-forget by the API when a war room is created.

```
POST body: { war_room_id: string }
  → forwards to: MASTRA_SERVER_URL/pipeline/run
  → returns Mastra server response
```

The function checks for the `MASTRA_SERVER_URL` environment variable and returns a 500 if not configured.

---

## 4. The 12-Task Pipeline

Every war room creates exactly 12 tasks with a fixed dependency graph. The orchestrator dispatches tasks whose dependencies are all `completed`, running independent tasks in parallel.

| # | Title | Agent | Depends On | Purpose |
|---|-------|-------|------------|---------|
| 1 | Parse scope & plan | **Jarvis** | — | Analyze user prompt, determine required atoms and architecture |
| 2 | Load genre boilerplate | **Forge** | 1 | Load the genre template and read existing atom structure |
| 3 | Write validation specs | **Checker** | 1, 2 | Generate structural validation rules for planned atoms |
| 4 | Implement util atoms | **Forge** | 2, 3 | Create utility atoms (helpers, math, config) — bottom-up |
| 5 | Implement feature atoms | **Forge** | 4 | Create feature atoms that compose utilities into gameplay systems |
| 6 | Implement core atoms | **Forge** | 5 | Wire features into `game_loop`, `create_scene` |
| 7 | Generate UI assets | **Pixel** | 1 | Generate menus, HUDs, buttons for Three.js overlay |
| 8 | Generate game sprites | **Pixel** | 1, 5 | Generate character sprites, textures, environment assets |
| 9 | Run validation suite | **Checker** | 4, 5, 6 | Validate all atoms (size ≤ 2KB, snake_case, primitives-only, DAG integrity) |
| 10 | Fix failures | **Forge** | 9 | Re-implement atoms that failed validation **(max 3 retry cycles)** |
| 11 | Final validation | **Checker** | 10, 7, 8 | Full regression: all atoms pass, assets load, bundle builds |
| 12 | Deliver & suggest prompts | **Jarvis** | 11 | Aggregate all outputs, trigger final rebuild, generate 2 follow-up prompts |

### Parallelism

The dependency graph allows natural parallelism:
- **Tasks 7 + 8** can run alongside the code implementation chain (tasks 4→5→6)
- **Task 7** starts immediately after task 1 completes (needs only the scope plan)
- **Task 8** waits for both the plan (1) and feature atoms (5) before generating sprites

### Retry Logic

Task 10 ("Fix failures") has special retry behavior:
- When task 10 fails, the orchestrator resets **both** tasks 9 and 10 to `pending`
- This creates a validation → fix → re-validation loop
- Maximum **3 retry cycles** (`MAX_RETRY_CYCLES = 3`)
- After 3 failed cycles, task 10 is marked as `failed` and the pipeline terminates
- Each retry is recorded as a `retry_cycle` event with cycle count

### Stuck Detection

If no tasks are runnable (all dependencies unsatisfied) AND no tasks are currently running, the pipeline is considered "stuck" — the war room is marked as `failed` and a `pipeline_stuck` event is recorded.

---

## 5. Mastra Server

The Mastra server is a standalone Node.js application that replaced the OpenClaw gateway. It runs the AI agent orchestration locally using `@mastra/core`.

### Directory Structure

```
mastra/
├── src/
│   ├── agents/                  # Four specialized AI agents
│   │   ├── index.ts             # Re-exports all agents
│   │   ├── jarvis.ts            # Orchestrator & coordinator
│   │   ├── forge.ts             # Game logic & code implementation
│   │   ├── pixel.ts             # Visual asset generation
│   │   └── checker.ts           # QA & validation
│   ├── lib/
│   │   ├── system-prompt.ts     # Master instructions + genre contexts
│   │   └── supabase.ts          # Supabase client singleton
│   ├── pipeline/
│   │   ├── orchestrator.ts      # Main dispatch loop (291 lines)
│   │   ├── warrooms.ts          # War room CRUD (Node.js version)
│   │   ├── prompts.ts           # Task prompt builders
│   │   └── types.ts             # TypeScript interfaces
│   ├── routes/
│   │   ├── chat.ts              # Streaming + generate endpoints
│   │   └── pipeline.ts          # Pipeline trigger endpoint
│   ├── tools/
│   │   └── supabase.ts          # Mastra tools for agents (226 lines)
│   ├── index.ts                 # Hono server + MastraServer init
│   └── mastra.ts                # Mastra instance registration
├── Dockerfile                   # Docker deployment
├── package.json                 # Dependencies
└── .env.example                 # Required env vars
```

### The Four Agents

Each agent is defined using `@mastra/core`'s `Agent` class with a specific AI model via OpenRouter:

#### Jarvis — Orchestrator & Coordinator
- **File:** `mastra/src/agents/jarvis.ts`
- **Model:** `openrouter/anthropic/claude-sonnet-4.6`
- **Role:** Analyzes user prompts, determines scope, plans implementation strategy, produces follow-up suggestions
- **Output format:** JSON with scope analysis or suggested prompts
- **Pipeline tasks:** #1 (Parse scope & plan), #12 (Deliver & suggest prompts)

#### Forge — Game Logic & Code Implementation
- **File:** `mastra/src/agents/forge.ts`
- **Model:** `openrouter/anthropic/claude-sonnet-4.6`
- **Role:** Creates Three.js game code as atoms (max 2KB each, snake_case naming, primitives-only interfaces). Uses MCP tools to read existing code and upsert atoms.
- **Output format:** JSON with `{ status, atoms_created, atoms_modified, notes }`
- **Pipeline tasks:** #2, #4, #5, #6, #10
- **Max steps:** 25 (higher than other agents to allow complex multi-atom work)

#### Pixel — Visual Asset Generation
- **File:** `mastra/src/agents/pixel.ts`
- **Model:** `openrouter/google/gemini-2.0-flash-001`
- **Role:** Generates UI elements, sprites, textures, and HUD components. Outputs base64 PNG or reference URLs.
- **Output format:** JSON with `{ status, assets_created: [{ name, type, url_or_base64 }], notes }`
- **Pipeline tasks:** #7 (UI assets), #8 (game sprites)

#### Checker — Quality Assurance & Validation
- **File:** `mastra/src/agents/checker.ts`
- **Model:** `openrouter/google/gemini-2.5-pro-preview-06-05`
- **Role:** Validates atoms for structural correctness: size limits (2KB), snake_case naming, primitive-only interfaces, dependency completeness, DAG integrity. Uses `get-code-structure` and `read-atoms` tools.
- **Output format:** JSON with `{ status, passed: boolean, failures: [{ atom, rule, message }], notes }`
- **Pipeline tasks:** #3 (write specs), #9 (run validation), #11 (final validation)

### Mastra Instance Registration

**File:** `mastra/src/mastra.ts`

```typescript
export const mastra = new Mastra({
  agents: { jarvis, forge, pixel, checker },
  tools: supabaseTools,
  server: {
    port: parseInt(process.env.PORT || "4500"),
    host: "0.0.0.0",
    cors: { origin: "*", ... },
  },
});
```

All four agents and the Supabase tools are registered in a single `Mastra` instance. The instance is initialized by `MastraServer` from `@mastra/hono` in the server entry point.

### Mastra Tools

**File:** `mastra/src/tools/supabase.ts`

Three tools are registered via `createTool()` from `@mastra/core/tools`:

#### `get-code-structure`
- **Input:** `{ gameId, type? }` — game ID and optional atom type filter
- **Output:** `{ atoms: [{ name, type, description, inputs, outputs, depends_on }] }`
- **What it does:** Queries the `atoms` table and `atom_dependencies` junction table, returns the full atom map with dependency information

#### `read-atoms`
- **Input:** `{ gameId, names }` — game ID and array of atom names
- **Output:** `{ atoms: [{ name, type, code, description, inputs, outputs, depends_on }] }`
- **What it does:** Reads source code and metadata for specific atoms by name

#### `upsert-atom`
- **Input:** `{ gameId, name, type, code, description, inputs, outputs, depends_on }`
- **Output:** `{ success, atom: { name, type } }`
- **What it does:**
  1. Validates code size (must be ≤ 2048 bytes)
  2. Upserts the atom row with `onConflict: "game_id,name"`
  3. Replaces dependencies in the `atom_dependencies` junction table
  4. Triggers `rebuild-bundle` Edge Function (fire-and-forget)

### Pipeline Orchestrator

**File:** `mastra/src/pipeline/orchestrator.ts`

The orchestrator implements the main execution loop:

```
runPipeline(warRoomId)
  → mark war room as "running"
  → loop:
      → refresh task state from DB
      → if all tasks terminal → break
      → find runnable tasks (dependencies satisfied)
      → if none runnable + none running → pipeline stuck → fail
      → dispatch all runnable tasks in parallel via agent.generate()
      → for each dispatched task:
          → mark as "running" + upsert heartbeat (working)
          → build context from dependency outputs
          → call agent.generate() with task prompt + system instructions
          → on success: mark "completed", store output, heartbeat → idle
          → on failure (task 10): retry cycle if < 3 retries
          → on failure (other): mark "failed", heartbeat → error
      → Promise.allSettled(dispatches)
      → sleep(500ms)
  → determine final status
  → if all passed: trigger final rebuild → mark "completed"
  → if any failed: mark "failed"
```

Key difference from the Supabase Edge Function version: the Mastra orchestrator calls `agent.generate()` directly (local function calls within the same process), rather than dispatching over HTTP to an external gateway.

### HTTP Routes

**Server entry:** `mastra/src/index.ts` — Hono server on port 4500 (configurable via `PORT` env var)

| Method | Route | Handler | Description |
|--------|-------|---------|-------------|
| `POST` | `/chat/stream` | `chatRoutes` | Streaming SSE chat with Jarvis agent. Accepts `{ messages, gameId, gameName, genre?, sessionId? }`. Returns `text/event-stream` with `maxSteps: 30`. |
| `POST` | `/chat/generate` | `chatRoutes` | Non-streaming chat with any agent. Accepts `{ agent, messages, instructions? }`. Returns `{ text, usage }`. |
| `POST` | `/pipeline/run` | `pipelineRoutes` | Fire-and-forget pipeline trigger. Accepts `{ war_room_id }`. Returns `{ status: "started", war_room_id }` immediately. Pipeline runs in background. |
| `GET` | `/health` | inline | Health check. Returns `{ status: "ok", agents: ["jarvis", "forge", "pixel", "checker"] }` |

### System Prompt & Genre Contexts

**File:** `mastra/src/lib/system-prompt.ts`

The `SYSTEM_PROMPT` provides master instructions for the Forge agent's 8-step atomic workflow:
1. Understand the request
2. Read existing code structure
3. Search for relevant atoms
4. Read atom source code
5. Plan implementation
6. Review plan against constraints
7. Implement via `upsert-atom`
8. Verify the result

**Genre contexts** provide pre-loaded information for each game type:

| Genre | Key Atoms | Focus |
|-------|-----------|-------|
| `hex-grid-tbs` | `hex_grid_create`, `turn_manager` | Hex grid + turn-based mechanics |
| `side-scroller-2d-3d` | `platform_physics`, `camera_follow` | 2D platformer in 3D space |
| `3d-roguelike-deckbuilder` | `deck_manager`, `room_generator` | Card-based dungeon crawler |
| `arena-dogfighter` | `flight_controls`, `projectile_system` | Aerial combat game |
| `base-builder` | `grid_placement`, `resource_manager` | Grid-based building game |
| `custom` | (none) | Blank Three.js canvas |

---

## 6. Frontend (Next.js)

### New War Room Components

All War Room UI components live in `web/src/components/warroom/`:

#### `war-room-panel.tsx` — Main War Room View
The primary panel for viewing an active war room. Shows:
- Header with war room title (prompt snippet), status badge, and back button
- Progress bar tracking `completedCount / totalCount` tasks
- Agent health bar showing all four agent statuses
- Scrollable task card list
- Suggested prompts section (appears after completion)

#### `task-card.tsx` — Individual Task Display
Collapsible card for each of the 12 pipeline tasks:
- Status icon: checkmark (completed), spinner (running), X (failed), pause (blocked), clock (pending)
- Agent badge with color coding: Jarvis (purple), Forge (blue), Pixel (green), Checker (amber)
- Expandable details: description, start/completion timestamps, output JSON

#### `agent-health-bar.tsx` — Real-Time Agent Status
Shows all 4 agents with colored status dots:
- Green (with pulse animation) = working
- Red = error
- Amber = timeout
- Gray = idle

#### `suggested-prompts.tsx` — Follow-Up Suggestions
Appears after war room completion. Shows 2 follow-up prompts generated by task 12 (Jarvis). Users can click to potentially create new war rooms.

#### `war-room-list.tsx` — War Room History
Lists all war rooms for a game with status badges and creation timestamps. Click to view individual war room details. Shows empty state when no war rooms exist.

#### `status-badge.tsx` — Status Indicator
Visual badges for each war room status:
- `planning` / `running` — spinner icon with pulse animation
- `completed` — green checkmark
- `failed` — red X

### `useWarRoom` Hook

**File:** `web/src/lib/use-war-room.ts`

React hook that connects to a war room's SSE event stream and maintains live state:

**Returns:** `{ warRoom, tasks, events, heartbeats, suggestedPrompts, isComplete, isLoading, error, refresh }`

**How it works:**
1. On mount, fetches initial war room state via `getWarRoom()` API call
2. Opens an `EventSource` SSE connection to `/games/:name/warrooms/:id/events`
3. Listens for typed events: `task_assigned`, `task_running`, `task_completed`, `task_failed`, `war_room_created`, `war_room_running`, `war_room_completed`, `war_room_failed`, `retry_cycle`, `pipeline_error`, `pipeline_stuck`
4. Updates task state reactively when events arrive
5. Listens for `heartbeats` events to update agent status
6. On `done` event, closes connection and refreshes final state
7. Auto-disconnects when war room reaches terminal status (`completed`, `failed`, `cancelled`)

### Workspace Integration

**File:** `web/src/components/workspace/game-workspace.tsx`

The game workspace sidebar now has three tabs:
- **Chat** (MessageSquare icon) — original chat interface
- **War Room** (Swords icon) — war room view
- **Config** (Settings icon) — game configuration

When on the War Room tab:
- If no active war room is selected → shows `WarRoomList` (all war rooms for this game)
- If a war room is selected → shows `WarRoomPanel` with back button to return to list
- Creating a war room from chat auto-switches to the War Room tab

### Chat Panel War Room Mode

**File:** `web/src/components/chat/chat-panel.tsx`

The chat input has a new **War Room toggle button** (Swords icon) in the prompt footer:
- When toggled ON: input area gets an amber visual treatment (`border-amber-500/50 bg-amber-500/5`)
- Tooltip shows: "War Room mode" or "War Room mode (active)"
- When a message is submitted in war room mode:
  1. Calls `createWarRoom(gameName, message.text)` via the API client
  2. On success, calls `onWarRoomCreated(warRoom.id)` callback to switch to war room view
  3. Shows loading state via `isCreatingWarRoom`
  4. On error, re-throws to preserve input text in the UI
- Regular chat submissions continue to work normally via `sendMessage()`

### Chat API Route Modes

**File:** `web/src/app/api/chat/route.ts`

The chat API route now supports three operating modes:

1. **War Room Mode** (`body.war_room` flag) — Creates war room and returns JSON (not a stream)
2. **Mastra Proxy Mode** (when `MASTRA_SERVER_URL` is configured) — Forwards all chat requests to the Mastra server's `/chat/stream` endpoint, streams back SSE responses
3. **Local Agent Mode** (fallback) — Uses local `ToolLoopAgent` from Vercel AI SDK with MCP servers

### Mastra Client

**File:** `web/src/lib/mastra-client.ts`

HTTP client for streaming chat to the Mastra server:

```typescript
streamMastraChat(options: MastraRequestOptions): Promise<ReadableStream<Uint8Array>>
isMastraConfigured(): boolean
```

Sends POST to `${MASTRA_SERVER_URL}/chat/stream` with messages, gameId, gameName, genre, and sessionId. Returns a `ReadableStream` for SSE consumption.

### Agent Status Parsing

**File:** `web/src/lib/agent-status.ts`

The Jarvis agent emits status markers in its text stream to indicate which agent is active. The frontend parses these to show real-time agent activity:

- **Marker format:** `[AGENT:name:state]` (e.g., `[AGENT:forge:working]`)
- **Done marker:** `[AGENT:done]`
- **Parsed to:** `AgentStatus { name, state, label }`
- **Labels:** Jarvis (Planning), Forge (Coding), Pixel (Art), Checker (QA)
- **Clean text:** markers are stripped before display

### API Client Additions

**File:** `web/src/lib/api.ts`

Three new endpoints added to the `apiFetch<T>()` client:

| Function | Signature | Description |
|----------|-----------|-------------|
| `createWarRoom` | `(gameName, prompt, userId?, genre?) → WarRoom` | Creates a war room via `POST /games/:name/warrooms` |
| `getWarRoom` | `(gameName, warRoomId) → WarRoomWithTasks` | Fetches a specific war room via `GET /games/:name/warrooms/:id` |
| `listWarRooms` | `(gameName, limit?) → WarRoom[]` | Lists all war rooms via `GET /games/:name/warrooms` |

### Type Definitions

**File:** `web/src/lib/types.ts`

New types added:
- `WarRoomStatus` — `"planning" | "running" | "completed" | "failed" | "cancelled"`
- `WarRoomTaskStatus` — `"pending" | "assigned" | "running" | "completed" | "failed" | "blocked"`
- `AgentName` — `"jarvis" | "forge" | "pixel" | "checker"`
- `WarRoom`, `WarRoomTask`, `WarRoomWithTasks`, `WarRoomEvent`, `AgentHeartbeat` — full interfaces

### Other Frontend Additions

| Feature | Files | Description |
|---------|-------|-------------|
| Privy auth | `web/src/lib/auth.ts`, `privy-provider.tsx`, `middleware.ts`, `/login/page.tsx`, `user-menu.tsx` | Full Privy-based authentication flow |
| Genre selector | `genre-selector.tsx` | Genre picker for game creation |
| Publish dialog | `publish-dialog.tsx` | Game publishing workflow |
| Leaderboard | `leaderboard-panel.tsx`, `score-listener.tsx` | Score tracking and leaderboard display |
| Share card | `share-card.tsx` | Shareable game card |
| Token dialog | `launch-token-dialog.tsx` | Web3 token launch skeleton |

---

## 7. OpenClaw to Mastra Migration

### What Was OpenClaw?

OpenClaw was an external multi-agent gateway that the system dispatched tasks to over HTTP. The `warroom-orchestrator` Edge Function would send tasks to the OpenClaw `/v1/chat/completions` endpoint with agent-specific routing.

### What Was Removed
- `web/src/lib/openclaw-client.ts` (145 lines) — HTTP client for OpenClaw gateway
- OpenClaw dispatch logic in the warroom-orchestrator Edge Function
- Agent identity docs in `openclaw/workspace-jarvis/` (AGENTS.md, SOUL.md, TOOLS.md) — now superseded by Mastra agent definitions

### What Replaced It
- `mastra/` — entire new directory with self-hosted agent server
- `web/src/lib/mastra-client.ts` (68 lines) — HTTP client for Mastra server
- `warroom-orchestrator` Edge Function rewritten as a thin proxy to Mastra

### Architectural Difference

| Aspect | OpenClaw (before) | Mastra (after) |
|--------|-------------------|----------------|
| Agent execution | HTTP dispatch to external gateway | Local `agent.generate()` calls within same process |
| Model routing | Gateway-side routing by agent name | Direct model specification per agent in code |
| Tool registration | External MCP connection | `createTool()` registered on Mastra instance |
| Deployment | External SaaS | Self-hosted on Railway (Docker) |
| Control | Limited to gateway API | Full control over agent behavior, prompts, tools |
| Dependencies | External service dependency | Self-contained, only needs OpenRouter API keys |

### Why Mastra?

1. **More control** — Agent instructions, tool access, and model selection are all in-repo
2. **Fewer external dependencies** — No reliance on OpenClaw gateway availability
3. **Better debugging** — Local agent.generate() calls with full console logging
4. **Tool integration** — Mastra tools (get-code-structure, read-atoms, upsert-atom) are registered directly on the Mastra instance, avoiding MCP round-trips
5. **Streaming** — Mastra's `agent.stream()` provides native SSE streaming for the chat interface

---

## 8. Architecture Diagram

```
                    ┌──────────────────────────────────────────┐
                    │           Frontend (Next.js)             │
                    │                                          │
                    │  ChatPanel ──── War Room toggle           │
                    │       │              │                    │
                    │  sendMessage()   createWarRoom()         │
                    │       │              │                    │
                    │       ▼              ▼                    │
                    │  ┌─────────┐  ┌─────────────┐           │
                    │  │ Mastra  │  │   API Client │           │
                    │  │ Client  │  │  (api.ts)    │           │
                    │  └────┬────┘  └──────┬──────┘           │
                    │       │              │                    │
                    │       │   ┌──────────┘                   │
                    │       │   │   useWarRoom (SSE)           │
                    │       │   │      │                       │
                    │       │   │  WarRoomPanel                │
                    │       │   │   ├── TaskCard (x12)         │
                    │       │   │   ├── AgentHealthBar         │
                    │       │   │   └── SuggestedPrompts       │
                    └───────┼───┼──────────────────────────────┘
                            │   │
                ┌───────────┘   └──────────────┐
                ▼                              ▼
    ┌───────────────────┐          ┌───────────────────────┐
    │   Mastra Server   │          │  Supabase Edge Funcs  │
    │  (Railway:4500)   │          │                       │
    │                   │          │  api/index.ts          │
    │  /chat/stream     │          │   POST /warrooms      │
    │  /chat/generate   │          │   GET  /warrooms      │
    │  /pipeline/run ◄──┼──────────┤   GET  /warrooms/:id  │
    │  /health          │          │   GET  /events (SSE)   │
    │                   │          │                       │
    │  ┌─────────────┐  │          │  warroom-orchestrator  │
    │  │ Orchestrator │  │          │   → POST pipeline/run │
    │  │   Loop       │  │          └───────────┬───────────┘
    │  └──────┬──────┘  │                      │
    │         │         │                      ▼
    │  ┌──────▼──────┐  │          ┌───────────────────────┐
    │  │   Agents    │  │          │   Supabase Database   │
    │  │             │  │          │                       │
    │  │  Jarvis ────┼──┼──────────►  war_rooms            │
    │  │  Forge  ────┼──┼──────────►  war_room_tasks       │
    │  │  Pixel  ────┼──┼──────────►  war_room_events      │
    │  │  Checker ───┼──┼──────────►  agent_heartbeats     │
    │  │             │  │          │  atoms                 │
    │  └──────┬──────┘  │          │  atom_dependencies    │
    │         │         │          │  games, builds, ...   │
    │  ┌──────▼──────┐  │          └───────────────────────┘
    │  │ Mastra Tools│  │
    │  │             │  │
    │  │ get-code-   │  │          ┌───────────────────────┐
    │  │  structure  │  │          │   rebuild-bundle      │
    │  │ read-atoms  │  │          │   Edge Function       │
    │  │ upsert-atom ├──┼──────────►  (fire-and-forget)    │
    │  └─────────────┘  │          └───────────────────────┘
    └───────────────────┘
```

### End-to-End Flow

1. **User types a prompt** in the chat panel with War Room mode toggled ON
2. **Frontend calls** `createWarRoom(gameName, prompt)` → Supabase API
3. **Supabase API** creates the war room + 12 tasks in DB → fire-and-forget calls `warroom-orchestrator` Edge Function
4. **`warroom-orchestrator`** forwards `{ war_room_id }` to Mastra server's `/pipeline/run`
5. **Mastra server** starts `runPipeline()` in background, returns `{ status: "started" }` immediately
6. **Orchestrator loop** dispatches runnable tasks to agents via `agent.generate()`
7. **Agents** use Mastra tools (get-code-structure, read-atoms, upsert-atom) to read/modify game atoms
8. **Each agent completion** updates task status in DB + records event + upserts heartbeat
9. **Frontend `useWarRoom` hook** receives live updates via SSE from the events endpoint
10. **Task cards update** in real-time as events arrive (assigned → running → completed/failed)
11. **On pipeline completion**, orchestrator triggers `rebuild-bundle` to build the final game bundle
12. **Task 12 output** provides 2 follow-up prompts shown in the `SuggestedPrompts` component

---

## 9. Environment Variables & Deployment

### Mastra Server Environment

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No (default: 4500) | Server port |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service role key for DB access |
| `OPENROUTER_API_KEY` | Yes | OpenRouter key for Claude and Gemini models |

### Supabase Edge Functions Environment

| Variable | Required | Description |
|----------|----------|-------------|
| `MASTRA_SERVER_URL` | Yes | Public URL of the Mastra server (e.g., Railway deployment URL) |

### Frontend Environment

| Variable | Required | Description |
|----------|----------|-------------|
| `MASTRA_SERVER_URL` | No | If set, chat routes through Mastra instead of local agent |

### Deployment Architecture

Two independent deployments:

1. **Mastra Server → Railway** (Docker)
   - Production URL: `https://incredible-happiness-production.up.railway.app`
   - Deployed via `cd mastra && railway up`
   - Builds from `mastra/Dockerfile` → `tsc` → `node dist/index.js`

2. **Supabase → Edge Functions + Database**
   - Deployed via `supabase functions deploy` + `supabase db push`
   - Functions: `api`, `buu-mcp`, `mcp-server`, `rebuild-bundle`, `warroom-orchestrator`

See [deployments.md](./deployments.md) for full deployment commands.
