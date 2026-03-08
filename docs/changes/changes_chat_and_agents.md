# Changes — Chat Navigation, Model Selectors & Agent Tool Calls

Covers the two most recent commits on `feat/remastered`:

| Hash | Message | Date | Scope |
|------|---------|------|-------|
| `9b98811` | feat: added chat navigational panel and model selectors | Mar 8, 2026 | 12 files, +2,975 / -113 |
| `230a769` | feat: added docs and added agent tool calls | Mar 8, 2026 | 6 files, +840 / -14 |

---

## 1. Chat Session Management

### Chat Session List (`web/src/components/chat/chat-session-list.tsx`)

New navigational panel that replaces the single-session chat with a multi-session architecture:

- Lists all chat sessions for a game via `listChatSessions(gameName)`
- **Create** new sessions with the "New Chat" button → `createChatSession(gameName)`
- **Delete** sessions with a hover-reveal trash icon → `deleteChatSession(gameName, sessionId)`
- **Select** a session to open it in the `ChatPanel`
- Each row shows: session title (or "Untitled session"), model name, creation timestamp
- Model name is resolved from the `MODELS` constant array or parsed from the model ID

### Workspace Integration (`web/src/components/workspace/game-workspace.tsx`)

The Chat tab now has a two-level navigation:

1. **Session list view** (default) — shows `ChatSessionList`
2. **Active chat view** — shows `ChatPanel` with a back button to return to the list

State is managed via `activeChatSessionId`:
- `null` → session list is shown
- `string` → `ChatPanel` renders with that session, keyed to reset state on switch

---

## 2. AI Model Selection

### Model Constants (`web/src/lib/constants.ts`)

New `ModelOption` interface and `MODELS` array:

| Model ID | Display Name | Provider |
|----------|-------------|----------|
| `google/gemini-3-pro-preview` | Gemini 3 Pro | Google |
| `anthropic/claude-opus-4.6` | Claude Opus 4.6 | Anthropic |

Default model: `google/gemini-3-pro-preview`

Each model has an `icon` URL for display in the selector dropdown.

### Chat Panel Model Selector (`web/src/components/chat/chat-panel.tsx`)

- Dropdown in the chat input area to pick an AI model before sending messages
- Selected model is passed through the chat API to Mastra
- Model choice is persisted per session

### Mastra Client (`web/src/lib/mastra-client.ts`)

Updated `MastraRequestOptions` to support `assetModelIds` (optional array). The request body conditionally includes asset model IDs when provided.

---

## 3. 3D Asset Model Library

### Asset Model Dialog (`web/src/components/chat/asset-model-dialog.tsx`)

Full-featured 3D model browser dialog:

- **Search**: text filter applied client-side to loaded models (matches on `prompt` field)
- **Grid layout**: 2-column (mobile) / 3-column (desktop) thumbnail grid
- **Lazy images**: `loading="lazy"` on all thumbnails
- **Multi-select**: toggle selection with visual indicators (blue border + checkmark badge)
- **Selection count**: shown in the dialog header
- **Style badges**: each model displays its style tag (e.g., "realistic", "cartoon")
- **Load more**: pagination button at the bottom for fetching additional pages

### useAssetModels Hook (`web/src/lib/use-asset-models.ts`)

React hook for fetching 3D models from the BUU API:

- **API**: `GET https://dev.api.buu.fun/v1/models/public?limit=20&offset=N`
- **Pagination**: offset-based with `PAGE_SIZE = 20`, tracks `hasMore` from `metadata.numElements`
- **Search**: client-side filtering on the `prompt` field (case-insensitive)
- **Returns**: `{ items, filteredItems, search, setSearch, isLoading, error, hasMore, loadMore }`

### Type Definitions (`web/src/lib/types.ts`)

New types added:

```typescript
interface ChatSession {
  id: string;
  title: string | null;
  model: string | null;
  created_at: string;
}

interface AssetModel {
  _id: string;
  prompt: string | null;
  style: string | null;
  image: { url: string } | null;
}

interface AssetModelPage {
  items: AssetModel[];
  metadata: { numElements: number };
}
```

---

## 4. Agent Tool Call Enhancements

### Jarvis Agent (`mastra/src/agents/jarvis.ts`)

- Model: `openrouter/anthropic/claude-sonnet-4.6`
- Updated instructions to explicitly list available tools: `get-code-structure`, `read-atoms`, `upsert-atom`
- Clarified role as orchestrator that analyzes prompts, determines scope, and produces follow-up suggestions
- Output format: JSON with relevant task output

### Forge Agent (`mastra/src/agents/forge.ts`)

- Model: `openrouter/anthropic/claude-sonnet-4.6`
- Enhanced instructions with explicit tool usage guidance and dependency ordering (`utils → features → core`)
- Added "always read existing atoms before modifying" directive
- Output format: `{ status, atoms_created, atoms_modified, notes }`

### Checker Agent (`mastra/src/agents/checker.ts`)

- Model: `openrouter/google/gemini-2.5-pro-preview-06-05`
- Restricted tool access: only `get-code-structure` and `read-atoms` (no `upsert-atom` — read-only by design)
- Detailed validation rules in instructions: size limits (2KB), snake_case naming, primitive-only interfaces, dependency completeness, DAG integrity
- Output format: `{ status, passed: boolean, failures: [{ atom, rule, message }], notes }`

### Chat Route (`mastra/src/routes/chat.ts`)

Two endpoints on the Mastra server:

| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/chat/stream` | SSE streaming with Jarvis. Injects `SYSTEM_PROMPT + genreContext + gameContext`. Uses `agent.stream()` with `maxSteps: 30`. Converts to AI SDK UI message stream protocol via `toAISdkStream`. |
| `POST` | `/chat/generate` | Non-streaming with any agent. Accepts `{ agent, messages, instructions? }`. Uses `agent.generate()` with `maxSteps: 10`. Returns `{ text, usage }`. |

---

## 5. Documentation Added

| File | Description |
|------|-------------|
| `docs/deployments.md` | Deployment guide for Mastra (Railway/Docker) and Supabase (Edge Functions + DB) |
| `docs/new-updates.md` | Comprehensive 724-line changelog covering the War Room system, Mastra migration, and platform foundations (commits `6abb071` through `3ad6bfd`) |

---

## File Summary

### New Files
| File | Lines | Purpose |
|------|-------|---------|
| `web/src/components/chat/chat-session-list.tsx` | 147 | Chat session navigation panel |
| `web/src/components/chat/asset-model-dialog.tsx` | 161 | 3D model library browser |
| `web/src/lib/use-asset-models.ts` | 81 | Asset models fetch hook |
| `docs/deployments.md` | ~95 | Deployment documentation |
| `docs/new-updates.md` | ~724 | System changelog |

### Modified Files
| File | Change |
|------|--------|
| `web/src/components/workspace/game-workspace.tsx` | Added chat session list navigation with `activeChatSessionId` state |
| `web/src/components/chat/chat-panel.tsx` | Added model selector dropdown, asset model dialog integration |
| `web/src/lib/constants.ts` | Added `ModelOption` interface and `MODELS` array |
| `web/src/lib/types.ts` | Added `ChatSession`, `AssetModel`, `AssetModelPage` types |
| `web/src/lib/mastra-client.ts` | Added `assetModelIds` to request options |
| `mastra/src/agents/jarvis.ts` | Refined instructions with tool call guidance |
| `mastra/src/agents/forge.ts` | Refined instructions with dependency ordering |
| `mastra/src/agents/checker.ts` | Restricted to read-only tools, detailed validation rules |
| `mastra/src/routes/chat.ts` | Streaming + generate endpoints |
| `mastra/src/lib/system-prompt.ts` | Expanded agent context |
