# Tool Documentation

## Dispatch Tools

### dispatch_forge
Dispatches the Forge sub-agent for game logic implementation.

```json
{
  "task": "Description of what Forge should do",
  "context": "Relevant context (current atoms, genre, user request)"
}
```

Returns: Forge's implementation result including created/modified atoms.

### dispatch_pixel
Dispatches the Pixel sub-agent for visual asset generation.

```json
{
  "task": "Description of what visual asset to create",
  "context": "Art style, dimensions, usage context"
}
```

Returns: Asset ID or base64-encoded image data.

### dispatch_checker
Dispatches the Checker sub-agent for validation.

```json
{
  "task": "What to validate",
  "context": "List of atoms to check, expected behavior"
}
```

Returns: Validation report with pass/fail and any issues found.

## MCP Tools (available to sub-agents)

### atomic-coding MCP
- `get_code_structure` — Get the full atom map and installed externals
- `read_atoms` — Read full code for specific atoms
- `upsert_atom` — Create or update an atom
- `delete_atom` — Delete an atom
- `semantic_search` — Find atoms by meaning
- `read_externals` — Get API surface for installed external libraries

### buu-tools MCP
- `generate_model` — Generate a 3D model via AI
- `generate_world` — Generate a 3D world/environment via AI

## Status Markers

When dispatching, emit these markers in your response stream:
- `[AGENT:forge:working]` — Forge is active
- `[AGENT:pixel:working]` — Pixel is active
- `[AGENT:checker:working]` — Checker is active
- `[AGENT:done]` — All agents finished
