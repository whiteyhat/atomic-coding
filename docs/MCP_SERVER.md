# Atomic Coding MCP Server -- Developer Documentation

> Source of truth: see [system-architecture.md](system-architecture.md) for the current end-to-end system architecture and interface boundaries.
> This document is a narrower MCP reference and may lag the canonical architecture doc.
> Drift note: the live `mcp-server` currently exposes 6 tools, including `read_externals`. The sections below were originally written against the earlier 5-tool surface.

## Overview

The Atomic Coding MCP server exposes 5 tools for managing **atoms** -- individual JavaScript functions stored in Supabase. Each atom has a name, typed interface (inputs/outputs), source code, and a dependency graph connecting it to other atoms.

The server follows the [Model Context Protocol](https://modelcontextprotocol.io/) specification using Streamable HTTP transport, deployed as a Supabase Edge Function.

---

## Connection

### Endpoint

```
https://<your-project>.supabase.co/functions/v1/mcp-server
```

### Cursor IDE

Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "atomic-coding": {
      "type": "streamable-http",
      "url": "https://<your-project>.supabase.co/functions/v1/mcp-server"
    }
  }
}
```

### MCP Inspector (Testing)

```bash
npx -y @modelcontextprotocol/inspector
```

Enter the endpoint URL in the inspector UI.

### Health Check

```bash
curl https://<your-project>.supabase.co/functions/v1/mcp-server
# => {"status":"ok","server":"atomic-coding-mcp","version":"1.0.0"}
```

---

## Core Concepts

### Atom

A single JavaScript function stored as a row in Supabase. Each atom has:

| Field | Type | Description |
|-------|------|-------------|
| `name` | `string` | Unique identifier, snake_case (e.g., `player_jump`) |
| `type` | `enum` | Category: `core`, `feature`, or `util` |
| `code` | `string` | Complete JS source code (**max 2KB**) |
| `inputs` | `Port[]` | Typed input parameters |
| `outputs` | `Port[]` | Typed return values |
| `dependencies` | `string[]` | Names of atoms this one calls |
| `description` | `string?` | Natural language explanation (used for search) |
| `version` | `number` | Auto-incremented on each update |

### Atom Types

| Type | Purpose | Examples |
|------|---------|---------|
| `core` | System-level, entry points, game loop | `game_loop`, `main`, `scene_manager` |
| `feature` | Game mechanics, player-facing logic | `player_jump`, `spawn_enemy`, `score_counter` |
| `util` | Helpers, configs, pure functions | `math_clamp`, `physics_config`, `color_lerp` |

### Port (Input/Output)

Each port describes a typed parameter:

```json
{
  "name": "velocity_y",
  "type": "number",
  "description": "Current Y velocity",
  "optional": false
}
```

### Type System

Only JS primitives are allowed. This forces atoms to stay flat, composable, and decoupled from classes or complex objects.

| Type | JS Equivalent | Example Values |
|------|--------------|----------------|
| `number` | `number` | `42`, `3.14`, `-1` |
| `string` | `string` | `"hello"`, `"player_1"` |
| `boolean` | `boolean` | `true`, `false` |
| `number[]` | `number[]` | `[1, 2, 3]`, `[0.5, 0.8, 1.0]` |
| `string[]` | `string[]` | `["fire", "ice"]` |
| `boolean[]` | `boolean[]` | `[true, false, true]` |
| `void` | `undefined` | No return value |

### Size Limit

Every atom's code is capped at **2,048 bytes (2KB)**. This is a deliberate design constraint, not a technical limitation. If your function doesn't fit in 2KB (~50-60 lines), it's doing too much -- break it into smaller atoms and compose them with dependencies.

The limit is enforced at two levels:
- **MCP server**: Returns a clear error with the exact byte count before hitting the database
- **Postgres CHECK constraint**: Hard stop at the database level as a safety net

**Design patterns:**
- A position is three `number` inputs (`x`, `y`, `z`), not a `Vector3` object
- A color is a `number[]` input (`[r, g, b]` or `[r, g, b, a]`)
- An entity ID is a `string` or `number`, not an Entity class
- If you need complex data, break it into smaller atoms that pass primitives

### Dependency Graph

Atoms declare which other atoms they call. This graph is used to:
- Order atoms correctly in the output bundle (topological sort)
- Prevent deletion of atoms that others depend on (referential integrity)
- Help the agent understand code relationships

---

## Tools Reference

### 1. `get_code_structure`

> **The Map** -- See everything that exists without reading code.

Returns the full structure of all atoms: names, types, typed interfaces, and dependency edges. Does **not** return source code.

**When to use:** First thing when exploring the codebase. Before creating a new atom (to check what already exists). Before editing (to understand the dependency graph).

#### Input

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `type_filter` | `"core" \| "feature" \| "util"` | No | Filter atoms by category |

#### Output

JSON array of atom structures:

```json
[
  {
    "name": "player_jump",
    "type": "feature",
    "inputs": [
      { "name": "velocity_y", "type": "number", "description": "Current Y velocity" },
      { "name": "is_grounded", "type": "boolean", "description": "Whether entity is on ground" },
      { "name": "force_multiplier", "type": "number", "optional": true }
    ],
    "outputs": [
      { "name": "new_velocity_y", "type": "number", "description": "Y velocity after jump" }
    ],
    "depends_on": ["physics_config"]
  },
  {
    "name": "physics_config",
    "type": "util",
    "inputs": [],
    "outputs": [
      { "name": "gravity", "type": "number" },
      { "name": "jump_force", "type": "number" },
      { "name": "max_speed", "type": "number" }
    ],
    "depends_on": []
  }
]
```

#### Example (curl)

```bash
curl -X POST 'https://<project>.supabase.co/functions/v1/mcp-server' \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "get_code_structure",
      "arguments": {}
    }
  }'
```

With filter:

```bash
# Only core atoms
"arguments": { "type_filter": "core" }
```

---

### 2. `read_atoms`

> **The Magnifier** -- Inspect the source code and full context of specific atoms.

Returns full source code, typed signature, description, version, and dependencies for one or more atoms.

**When to use:** After `get_code_structure` identified atoms you need to inspect. When you need to understand how a specific atom works before modifying it.

#### Input

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `names` | `string[]` | Yes (min 1) | Array of atom names to read |

#### Output

Formatted code blocks with metadata headers:

```
// === player_jump (feature) v3 ===
// Applies upward force when entity is grounded
// Signature: (velocity_y: number, is_grounded: boolean, force_multiplier: number?) => number
// Depends on: [physics_config]
function player_jump(velocity_y, is_grounded, force_multiplier = 1.0) {
  if (!is_grounded) return velocity_y;
  const config = physics_config();
  return config.jump_force * force_multiplier;
}

// === physics_config (util) v1 ===
// Returns physics constants
// Signature: () => { gravity: number, jump_force: number, max_speed: number }
// Depends on: []
function physics_config() {
  return { gravity: -9.8, jump_force: 12, max_speed: 15 };
}
```

#### Example (curl)

```bash
"params": {
  "name": "read_atoms",
  "arguments": {
    "names": ["player_jump", "physics_config"]
  }
}
```

#### Errors

| Error | Cause |
|-------|-------|
| `No atoms found with names: ...` | One or more names don't exist in the database |

---

### 3. `semantic_search`

> **The Compass** -- Find atoms by meaning when you don't know the name.

Uses OpenAI embeddings + pgvector cosine similarity to find atoms conceptually matching a natural language query. Returns source code, signature, dependencies, and a similarity score.

**When to use:** When you know *what* you're looking for but not *what it's called*. When exploring a new codebase. When looking for related functionality.

#### Input

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | `string` | Yes | -- | Natural language description |
| `limit` | `number` | No | `5` | Max results (1-20) |

#### Output

Results ranked by similarity:

```
// player_jump (feature) [similarity: 0.847]
// Applies upward force when entity is grounded
// Signature: (velocity_y: number, is_grounded: boolean) => number
// Depends on: [physics_config]
function player_jump(velocity_y, is_grounded) { ... }

// gravity_apply (core) [similarity: 0.721]
// Applies gravity to an entity's velocity each frame
// Signature: (velocity_y: number, dt: number) => number
// Depends on: [physics_config]
function gravity_apply(velocity_y, dt) { ... }
```

#### Example Queries

| Query | What it finds |
|-------|---------------|
| `"jump logic"` | `player_jump`, `double_jump` |
| `"how damage is calculated"` | `calculate_damage`, `armor_reduction` |
| `"keyboard input handling"` | `input_manager`, `key_bindings` |
| `"function that returns a number[]"` | Atoms with `number[]` outputs |
| `"configuration constants"` | `physics_config`, `game_settings` |

#### Notes

- Similarity threshold is `0.3` (returns even loosely related results)
- The embedding is generated from: `name(inputs) => outputs: description\ncode`
- Including type information in your query helps (e.g., "takes two numbers" finds typed atoms)

---

### 4. `upsert_atom`

> **The Brush** -- Create new atoms or update existing ones.

Creates a new atom or overwrites an existing one (matched by `name`). Automatically:
1. Validates all declared dependencies exist
2. Generates an embedding for semantic search
3. Saves the atom with typed interface
4. Updates the dependency graph
5. Triggers a bundle rebuild

**When to use:** Creating a new function. Modifying existing code. Changing an atom's interface or dependencies.

#### Input

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `name` | `string` | Yes | -- | Unique name, must be `snake_case` (`^[a-z][a-z0-9_]*$`) |
| `code` | `string` | Yes | -- | Complete JS source code (**max 2,048 bytes**) |
| `type` | `"core" \| "feature" \| "util"` | Yes | -- | Atom category |
| `inputs` | `Port[]` | No | `[]` | Typed input parameters |
| `outputs` | `Port[]` | No | `[]` | Typed return values |
| `dependencies` | `string[]` | No | `[]` | Names of atoms this code calls |
| `description` | `string` | No | -- | Brief explanation (improves search) |

#### Port Schema

```json
{
  "name": "velocity_y",                          // required
  "type": "number",                              // required, one of the 7 primitive types
  "description": "Current vertical velocity",    // optional
  "optional": false                              // optional, defaults to false
}
```

#### Output (Success)

```
Atom "player_jump" saved (feature). Signature: (velocity_y: number, is_grounded: boolean) => number. Dependencies: [physics_config]. Rebuild triggered.
```

#### Errors

| Error | Cause | Resolution |
|-------|-------|------------|
| `code is N bytes (limit: 2048)` | Code exceeds 2KB limit | Break the function into smaller atoms and compose with dependencies |
| `dependencies not found: X, Y` | Declared deps don't exist yet | Create those atoms first, or check names with `get_code_structure` |
| `Error: new row violates check constraint "chk_inputs_valid"` | Invalid type in inputs/outputs | Use one of: `number`, `string`, `boolean`, `number[]`, `string[]`, `boolean[]`, `void` |
| `Error: duplicate key value violates unique constraint` | Internal conflict | Retry -- the upsert should handle this automatically |

#### Examples

**Create a simple utility:**

```json
{
  "name": "math_clamp",
  "type": "util",
  "code": "function math_clamp(value, min, max) {\n  return Math.min(Math.max(value, min), max);\n}",
  "inputs": [
    { "name": "value", "type": "number" },
    { "name": "min", "type": "number" },
    { "name": "max", "type": "number" }
  ],
  "outputs": [
    { "name": "clamped", "type": "number" }
  ],
  "description": "Clamp a number between min and max"
}
```

**Create an atom with dependencies:**

```json
{
  "name": "player_movement",
  "type": "feature",
  "code": "function player_movement(x, y, dx, dy, dt) {\n  const speed = physics_config().max_speed;\n  const nx = math_clamp(x + dx * speed * dt, -100, 100);\n  const ny = math_clamp(y + dy * speed * dt, -100, 100);\n  return { x: nx, y: ny };\n}",
  "inputs": [
    { "name": "x", "type": "number", "description": "Current X position" },
    { "name": "y", "type": "number", "description": "Current Y position" },
    { "name": "dx", "type": "number", "description": "Input direction X (-1 to 1)" },
    { "name": "dy", "type": "number", "description": "Input direction Y (-1 to 1)" },
    { "name": "dt", "type": "number", "description": "Delta time in seconds" }
  ],
  "outputs": [
    { "name": "x", "type": "number" },
    { "name": "y", "type": "number" }
  ],
  "dependencies": ["physics_config", "math_clamp"],
  "description": "Move player based on input direction, clamped to world bounds"
}
```

**Update existing atom (just change the code):**

```json
{
  "name": "physics_config",
  "type": "util",
  "code": "function physics_config() {\n  return { gravity: -15, jump_force: 18, max_speed: 20 };\n}",
  "outputs": [
    { "name": "gravity", "type": "number" },
    { "name": "jump_force", "type": "number" },
    { "name": "max_speed", "type": "number" }
  ],
  "description": "Returns physics constants for the game"
}
```

---

### 5. `delete_atom`

> **The Eraser** -- Remove an atom from the system.

Deletes an atom by name. Protected by referential integrity: if any other atom lists this one as a dependency, the deletion is **blocked**.

**When to use:** Removing unused code. Cleaning up after refactoring.

#### Input

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | `string` | Yes | Name of the atom to delete |

#### Output (Success)

```
Atom "old_function" deleted. Rebuild triggered.
```

#### Errors

| Error | Cause | Resolution |
|-------|-------|------------|
| `Cannot delete "X": used by [A, B]` | Other atoms depend on this one | Delete or update the dependents first |
| `Atom "X" not found` | No atom with that name exists | Check the name with `get_code_structure` |

---

## Automatic Rebuild

Every `upsert_atom` and `delete_atom` triggers a rebuild automatically. The rebuild pipeline:

1. Fetches all atoms from the database
2. Sorts them topologically (dependencies first)
3. Wraps all code in an IIFE with `"use strict"`
4. Uploads as `latest.js` to Supabase Storage
5. Logs the build in the `builds` table

The generated bundle looks like:

```javascript
// === Atomic Coding Bundle ===
// Generated: 2026-02-08T12:00:00Z
// Atoms: 5
// Order: math_clamp -> physics_config -> player_jump -> player_movement -> game_loop
(function() {
  "use strict";

  // --- [util] math_clamp ---
  function math_clamp(value, min, max) { ... }

  // --- [util] physics_config ---
  function physics_config() { ... }

  // --- [feature] player_jump ---
  function player_jump(velocity_y, is_grounded) { ... }

  // --- [feature] player_movement ---
  function player_movement(x, y, dx, dy, dt) { ... }

  // --- [core] game_loop ---
  function game_loop() { ... }

  // Boot
  if (typeof game_loop === 'function') game_loop();
})();
```

**Entry point detection:** The bundler looks for a `core` atom named `game_loop` or `main`. If neither exists, it falls back to the last `core` atom in topological order.

---

## Workflow Recipes

### Recipe 1: "Make the cube jump higher"

```
1. semantic_search("jump logic height")
   -> Finds: player_jump, physics_config

2. read_atoms(["player_jump", "physics_config"])
   -> Sees: player_jump uses physics_config().jump_force

3. upsert_atom(physics_config, with jump_force: 18 instead of 12)
   -> Saved, rebuild triggered, frontend reloads
```

### Recipe 2: "Add a double jump mechanic"

```
1. get_code_structure(type_filter: "feature")
   -> Sees all feature atoms and their interfaces

2. read_atoms(["player_jump"])
   -> Understands current jump logic and dependencies

3. upsert_atom("double_jump", ...)
   -> Creates new atom with inputs: velocity_y, is_grounded, jumps_remaining
   -> Dependencies: [physics_config]

4. upsert_atom("player_jump", updated to call double_jump)
   -> Updates dependencies: [physics_config, double_jump]
```

### Recipe 3: "Refactor: extract a shared helper"

```
1. semantic_search("duplicated calculation")
   -> Finds two atoms with similar code patterns

2. read_atoms(["atom_a", "atom_b"])
   -> Identifies the shared logic

3. upsert_atom("shared_helper", ..., type: "util")
   -> Creates the extracted helper

4. upsert_atom("atom_a", updated, dependencies: ["shared_helper"])
5. upsert_atom("atom_b", updated, dependencies: ["shared_helper"])
   -> Both now use the helper
```

### Recipe 4: "Remove unused code"

```
1. get_code_structure()
   -> Find atoms with no dependents (nothing depends on them)

2. delete_atom("unused_function")
   -> If it has dependents, you'll get an error listing them
   -> If not, it's deleted and rebuild is triggered
```

---

## Error Handling

All tools return errors in MCP format:

```json
{
  "content": [{ "type": "text", "text": "Error: descriptive message" }],
  "isError": true
}
```

Common errors across tools:

| Error Pattern | Meaning |
|---------------|---------|
| `code is N bytes (limit: 2048)` | Atom code exceeds 2KB -- break it up |
| `Error: dependencies not found: X` | Atom X doesn't exist yet |
| `Cannot delete "X": used by [A, B]` | Referential integrity block |
| `No atoms found with names: X` | Atom name doesn't exist |
| `No atoms found matching: "..."` | Semantic search returned no results |
| `Error: new row violates check constraint` | Invalid type in inputs/outputs |
| `OpenRouter embedding error (429)` | Rate limited -- wait and retry |

---

## Database Schema Quick Reference

### `atoms`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `UUID` | Auto-generated |
| `name` | `TEXT UNIQUE` | Primary identifier, snake_case |
| `type` | `TEXT` | `core`, `feature`, or `util` |
| `code` | `TEXT` | JS source code |
| `description` | `TEXT` | For embedding + search |
| `inputs` | `JSONB` | Array of Port objects |
| `outputs` | `JSONB` | Array of Port objects |
| `embedding` | `vector(1536)` | Auto-generated via OpenRouter |
| `version` | `INT` | Auto-incremented on update |
| `created_at` | `TIMESTAMPTZ` | Auto-set |
| `updated_at` | `TIMESTAMPTZ` | Auto-updated on change |

### `atom_dependencies`

| Column | Type | Notes |
|--------|------|-------|
| `atom_name` | `TEXT` | FK -> atoms.name, CASCADE on delete |
| `depends_on` | `TEXT` | FK -> atoms.name, RESTRICT on delete |

### `builds`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `UUID` | Auto-generated |
| `status` | `TEXT` | `building`, `success`, or `error` |
| `bundle_url` | `TEXT` | Public URL to latest.js |
| `atom_count` | `INT` | Number of atoms in bundle |
| `build_log` | `JSONB` | Ordered list of atom names |
| `error_message` | `TEXT` | If status is `error` |
| `created_at` | `TIMESTAMPTZ` | Auto-set |
