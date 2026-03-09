# Game Maker — Progress & Remaining Todos

Compares the original "Game Maker: Full Detailed Plan" against the current codebase on `feat/remastered`. OpenClaw has been fully replaced by Mastra. Trello integration was dropped in favor of the internal War Room task system.

---

## 1. Orchestration (Mastra on Railway)

### Done
- [x] Replaced OpenClaw with self-hosted Mastra server (`mastra/` directory)
- [x] Mastra instance registers 4 agents + Supabase tools (`mastra/src/mastra.ts`)
- [x] Hono HTTP server on port 4500 with CORS (`mastra/src/index.ts`)
- [x] `/chat/stream` — SSE streaming chat with Jarvis agent
- [x] `/chat/generate` — non-streaming chat with any agent
- [x] `/pipeline/run` — fire-and-forget pipeline trigger
- [x] `/health` — health check returning agent list
- [x] War Room 12-task pipeline with fixed dependency graph (`mastra/src/pipeline/orchestrator.ts`)
- [x] Dependency-based dispatch — runs independent tasks in parallel
- [x] Retry logic for task 10 (fix failures) — max 3 cycles
- [x] Pipeline stuck detection (no runnable + no running → fail)
- [x] `warroom-orchestrator` Supabase Edge Function as thin Mastra proxy
- [x] Fire-and-forget pattern for long-running orchestration
- [x] Agent heartbeat tracking (idle/working/error/timeout)
- [x] SSE event stream for real-time frontend updates (`/warrooms/:id/events`)
- [x] Docker deployment on Railway (`mastra/Dockerfile`)

### Todo
- [ ] Jarvis agent heartbeat polling every 3s (plan spec) — currently heartbeats are updated on task start/end, not on a fixed interval
- [ ] Agent-level error recovery — if an agent crashes mid-task, auto-retry that individual task
- [ ] Pipeline cancellation — allow users to cancel a running war room from the UI
- [ ] Concurrent war room limits — prevent multiple simultaneous war rooms per game

---

## 2. Agents & Models

### Done
- [x] **Jarvis** agent — orchestrator & coordinator (`mastra/src/agents/jarvis.ts`)
  - Model: `claude-sonnet-4.6` (plan originally said Gemini Flash Lite — upgraded)
  - Tasks: #1 (parse scope), #12 (deliver + suggest prompts)
  - Tools: get-code-structure, read-atoms, upsert-atom
- [x] **Forge** agent — game logic & code implementation (`mastra/src/agents/forge.ts`)
  - Model: `claude-sonnet-4.6` (matches plan)
  - Tasks: #2, #4, #5, #6, #10
  - Tools: get-code-structure, read-atoms, upsert-atom
  - 25 max steps for complex multi-atom work
- [x] **Pixel** agent — visual asset generation (`mastra/src/agents/pixel.ts`)
  - Model: `gemini-2.0-flash-001`
  - Tasks: #7 (UI assets), #8 (game sprites)
  - Local tool bundle: read-only code inspection + `generate-polished-visual-pack`
  - Image generation model is configurable through `OPENROUTER_IMAGE_MODEL`
- [x] **Checker** agent — QA & validation (`mastra/src/agents/checker.ts`)
  - Model: `gemini-2.5-pro-preview-06-05`
  - Tasks: #3 (write specs), #9 (run validation), #11 (final validation)
  - Read-only tool access (get-code-structure, read-atoms only)
- [x] Strict pipeline order enforced by dependency graph
- [x] Agent output stored as JSONB in `war_room_tasks.output`
- [x] System prompt with 8-step atomic workflow (`mastra/src/lib/system-prompt.ts`)

### Todo
- [x] **Pixel: actual image generation** — OpenRouter-backed image generation now exists via `generate-polished-visual-pack`; the model is configurable and defaults to `google/gemini-3.1-flash-image-preview`
- [ ] **Pixel: sprite output pipeline** — generate base64 PNG sprites optimized for Three.js `TextureLoader` / `SpriteMaterial`
- [ ] **Pixel: asset storage** — upload generated assets to R2/Supabase Storage and return CDN URLs
- [x] **Pixel: menus/HUDs/buttons** — task 7 now has explicit UI-pack generation and polish rules (hover/pressed states, safe text zones, contrast, hierarchy)
- [ ] **Checker: Jest test suite generation** — plan says Checker writes full Jest tests + Three.js scene validators; currently only does structural validation rules
- [ ] **Checker: runtime validators** — frame-time, collision detection, memory usage checks
- [ ] **Checker: CI enforcement loop** — block merge until 100% pass (currently validation is advisory)
- [ ] **Forge: boilerplate fetch from R2** — plan says Forge `fetch()`s boilerplate.js + template.md from CDN on task start; currently uses DB-stored boilerplate data
- [ ] **Jarvis: suggested prompt quality** — auto-generate 2 context-aware follow-up prompts based on completed game state (basic version exists, needs refinement)
- [ ] **Buu MCP integration for Pixel** — wire `generate_model` / `generate_world` tools from `buu-mcp` into Pixel agent's tool set

---

## 3. Genre Boilerplates

### Done
- [x] Database schema for `genre_boilerplates` table (migration 013)
- [x] 5 genre seeds in DB: hex-grid-tbs, side-scroller-2d-3d, 3d-roguelike-deckbuilder, arena-dogfighter, base-builder (migration 014)
- [x] Custom genre option (blank Three.js canvas)
- [x] Genre selector UI component (`web/src/components/games/genre-selector.tsx`)
- [x] Genre context injected into system prompts per genre
- [x] Boilerplate seeding on game creation (`boilerplates.ts` service)
- [x] Service layer: list boilerplates, get by slug, seed game from boilerplate

### Todo
- [ ] **R2 CDN hosting** — upload actual `boilerplate.js` files to `buu-ai-game-maker/boilerplates/{slug}/` on Cloudflare R2
- [ ] **boilerplate.js per genre** — complete Three.js scene skeleton: Scene + PerspectiveCamera + WebGLRenderer + Clock + requestAnimationFrame + OrbitControls + empty `gameLoop(delta)` + `entities = []`
- [ ] **template.md per genre** — locked system prompt with genre-specific rules, win/lose conditions, TDD hooks
- [ ] **utils/ per genre** — `coords.js`, `input.js`, `entity.js` (ECS-lite helpers)
- [ ] **example-scene.json per genre** — starter objects for each genre
- [ ] **Hex-Grid TBS boilerplate** — custom HexGeometry (redblobgames axial coords), InstancedMesh 64x64 grid, A* pathfinding, turn manager, unit selection raycaster
- [ ] **Side-Scroller boilerplate** — OrthographicCamera, SpriteMaterial characters, platformer physics (velocity + gravity), parallax layers
- [ ] **Roguelike Deckbuilder boilerplate** — 3D grid InstancedMesh, card meshes (PlaneGeometry), deck array + draw logic, procedural room generator (BSP)
- [ ] **Arena Dogfighter boilerplate** — quaternion flight physics (throttle/pitch/roll/yaw), drag + lift, chase camera, arena boundary
- [ ] **Base Builder boilerplate** — procedural grid with raycast placement, building snap, resource manager
- [ ] **CDN URL pattern** — `https://pub-...r2.dev/boilerplates/{slug}/boilerplate.js` with 1h cache
- [ ] **Forge auto-fetch** — Forge agent fetches both boilerplate.js + template.md from CDN on task #2 start

---

## 4. Game Flow (Chat to Playable Board)

### Done
- [x] User input: genre dropdown + prompt in chat panel
- [x] War Room mode toggle in chat input (amber visual treatment)
- [x] War Room creation from chat → `createWarRoom()` API call
- [x] Auto-switch to War Room tab on creation
- [x] Live SSE status in frontend dropdown (task progress, agent activity)
- [x] Task card UI with status icons, agent badges, timestamps, expandable output
- [x] Agent health bar with colored status dots + pulse animation
- [x] Progress bar tracking completed/total tasks
- [x] Suggested prompts after completion (task 12 output)
- [x] Game iframe (`game-player.html`) with `window.GAME` API
- [x] Input API (keys, justPressed, justReleased), Mouse API (coords, buttons), Time API (delta, elapsed, frame)
- [x] Dynamic bundle loading from Supabase Storage (manifest.json → externals → latest.js)
- [x] External library loading (Three.js, etc.) via CDN script tags + ES module shimming
- [x] Hot-reload via Supabase Realtime (watches `builds` table for new successful builds)
- [x] Atom CRUD with typed ports (inputs/outputs), dependency tracking, embedding search
- [x] Rebuild-bundle Edge Function (topological sort → IIFE → upload to Storage)
- [x] Build history with rollback support (atom snapshots per build)
- [x] Chat session management (create, list, delete, switch sessions)
- [x] AI model selector (Gemini 3 Pro, Claude Opus 4.6)
- [x] 3D asset model library browser with search + pagination
- [x] Publish game with public slug → `/play/[slug]` route
- [x] Score submission via `postMessage` from game iframe (debounced)
- [x] Leaderboard (auto-refreshing every 10s, one score per user)
- [x] Score rate limiting (1 score/sec per user per game)

### Todo
- [ ] **R2 CDN for final game bundles** — upload final `game.js` + assets to R2 `games/{userId}/{gameId}/` with permanent CDN URL
- [ ] **Permanent public URLs** — `https://buu.ai/boards/{gameId}` as the canonical published game URL
- [ ] **Secure dynamic load** — use Blob URL + dynamic `import()` instead of script tag injection for game bundle loading
- [ ] **postMessage API for parent controls** — resize, pause, save-state commands from parent to iframe
- [ ] **Score enforcement in game.js** — enforce `let playerScore = 0; function addPoints(delta)` pattern + `postMessage({type: 'SCORE_UPDATE', score, playerId})` in every game
- [ ] **End-game trigger** — standardized game-over event with final score
- [ ] **Jarvis rollback + retry button** — on pipeline failure, show retry button + full error log in chat
- [ ] **Error recovery UI** — inline error display with option to restart failed tasks

---

## 5. Game Tokenization & Web3

### Done
- [x] Database schema: `token_launches` table (migration 017) — token_name, symbol, chain_id, total_supply, leaderboard_allocation_pct, status (draft/pending/launched/failed)
- [x] Database schema: `token_distributions` table — launch_id, user_id, rank, allocation_amount, status, wallet_address
- [x] Token service: upsert token launch, get launch, get distributions (`tokens.ts`)
- [x] Launch Token dialog UI — name, symbol, supply, allocation % inputs (`launch-token-dialog.tsx`)
- [x] API endpoints: `PUT /token`, `GET /token`, `GET /token/distributions`

### Todo
- [ ] **Backend tokenization service** — new Railway Node.js + Postgres service for blockchain operations
- [ ] **Bonding curve contract** — create simple bonding curve contract (custom or forked) managed by Railway wallet
- [ ] **Token launch flow** — "Launch Token" button → modal (name/symbol + initial buy 0.1–10 ETH) → deploy contract → store `tokenAddress` + initial supply
- [ ] **Fair-launch params** — Jarvis auto-generates bonding curve parameters
- [ ] **Live leaderboard SSE** — `/leaderboard/{gameId}` SSE endpoint (updates every 2s from Postgres) while `mcap < 100k`
- [ ] **Score verification** — game-specific JWT for validating `postMessage` score updates (signed in iframe)
- [ ] **Bond-complete monitoring** — webhook from bonding curve contract on buy events
- [ ] **100k mcap threshold detection** — auto-trigger on reaching 100k market cap
- [ ] **Top-10 snapshot** — snapshot top-10 leaderboard (sorted by score, deduped by wallet)
- [ ] **LP migration** — create Uniswap V2/V3 liquidity pool, add full liquidity
- [ ] **LP token burn** — burn LP tokens after migration (immutable liquidity)
- [ ] **2% distribution** — transfer exactly 2% of total supply to top-10 wallets (on-chain tx, equal split)
- [ ] **Bond status lifecycle** — draft → pending → launched; on complete: snapshot → migrate LP → distribute → freeze leaderboard forever
- [ ] **Wallet connection** — no wallet required until token claim; connect wallet for distribution
- [ ] **On-chain audit trail** — all token states stored in both Postgres + on-chain events
- [ ] **Leaderboard freeze** — stop SSE updates and freeze leaderboard permanently after bond completion

---

## 6. Security

### Done
- [x] Privy auth token verification on all API routes
- [x] Service-role key for Edge Functions (bypasses RLS)
- [x] Score rate limiting (1/sec per user per game)
- [x] Atom size limit enforcement (2KB max)
- [x] Sandboxed game iframe (`sandbox="allow-scripts allow-same-origin"`)
- [x] Checker agent: read-only tool access (no upsert-atom)

### Todo
- [ ] **Docker sandbox per agent** — each agent runs in isolated Docker container (plan spec; currently all agents share same Mastra process)
- [ ] **Score signature verification** — game-specific JWT checked on score submission (not just rate limiting)
- [ ] **Iframe origin verification** — validate postMessage sender origin for score writes
- [ ] **Shell access whitelisting** — no direct shell unless skill explicitly whitelisted (currently N/A but plan mentions it)
- [ ] **Atom injection protection** — validate atom code doesn't contain malicious patterns (fetch to external URLs, eval, etc.)

---

## 7. Frontend & UX

### Done
- [x] Game workspace with 3-tab sidebar: Chat, War Room, Config
- [x] War Room panel: task cards, agent health, progress bar, suggested prompts
- [x] War Room list: history of all war rooms per game
- [x] Chat panel: message display, code blocks, tool call visualization
- [x] Chat session list: create/delete/switch sessions
- [x] Model selector dropdown in chat input
- [x] 3D asset model browser dialog (paginated, searchable)
- [x] Agent status dropdown in top bar
- [x] Console: Atoms tab, Builds tab, Externals tab, Settings tab
- [x] Genre selector for game creation
- [x] Publish dialog with public slug
- [x] Share card for published games
- [x] Leaderboard panel (auto-refreshing)
- [x] Score listener (postMessage from iframe → API)
- [x] Game iframe with hot-reload indicator (connecting/loading/error/connected)

### Todo
- [ ] **War Room cancel button** — UI to cancel a running pipeline
- [ ] **War Room retry button** — on failure, retry from the failed task
- [ ] **Agent log viewer** — expandable logs for each agent's tool calls and reasoning
- [ ] **Inline error display** — show pipeline errors directly in chat conversation
- [ ] **Asset preview panel** — preview Pixel-generated sprites/textures before they're committed
- [ ] **Token launch page** — full token config + deployment flow at `/games/[name]/token`
- [ ] **Wallet connect UI** — connect wallet for token claim after bond completion

---

## 8. Deployment & Infrastructure

### Done
- [x] Mastra server Dockerfile + Railway deployment
- [x] Production URL: `https://incredible-happiness-production.up.railway.app`
- [x] Supabase Edge Functions: api, buu-mcp, mcp-server, rebuild-bundle, warroom-orchestrator
- [x] 18 database migrations applied
- [x] Deployment docs (`docs/deployments.md`)
- [x] Railway CLI + Supabase CLI deploy commands documented

### Todo
- [ ] **Cloudflare R2 bucket** — create `buu-ai-game-maker` bucket for boilerplates + game bundles
- [ ] **R2 CDN configuration** — public access + caching rules (1h for boilerplates)
- [ ] **Upload pipeline** — CI/CD or script to upload boilerplate files to R2 on change
- [ ] **Game bundle CDN upload** — rebuild-bundle writes to R2 instead of (or in addition to) Supabase Storage
- [ ] **Tokenization backend** — new Railway service (Node.js + Postgres) for blockchain operations
- [ ] **Monitoring & alerts** — pipeline failure alerts, agent error rate tracking
- [ ] **Environment variable audit** — ensure all required env vars are documented and set in production

---

## Priority Order (Suggested)

1. **Pixel asset persistence + preview** — move generated art into R2/Supabase Storage and expose preview/load validation in the UI
2. **Checker agent real validation** — unblocks meaningful CI loop (tasks 3, 9, 11)
3. **R2 CDN + boilerplate files** — gives Forge real starting code per genre
4. **Score enforcement + postMessage security** — required before token launch
5. **Game bundle CDN** — permanent URLs for published games
6. **Token launch backend** — full blockchain layer
7. **Security hardening** — Docker sandboxing, JWT verification, origin checks
8. **UX polish** — cancel/retry, error display, asset preview
