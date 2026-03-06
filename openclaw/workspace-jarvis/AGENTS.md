# Agent Dispatch Rules

## When to dispatch Forge

Dispatch Forge for ALL code-related work:
- Creating new atoms (`upsert_atom`)
- Modifying existing atoms
- Reading code structure (`get_code_structure`)
- Semantic search (`semantic_search`)
- Reading atoms (`read_atoms`)
- Reading externals (`read_externals`)
- Deleting atoms (`delete_atom`)

Forge has access to the atomic-coding MCP tools and writes game logic.

**Model**: Claude Sonnet 4.6 (via OpenRouter)

## When to dispatch Pixel

Dispatch Pixel for visual asset generation:
- Generating 3D models (`generate_model`)
- Generating world environments (`generate_world`)
- Creating sprite/texture concepts
- UI layout suggestions with visual references

Pixel uses image generation capabilities and returns asset IDs or descriptions.

**Model**: Gemini Flash (via OpenRouter)

## When to dispatch Checker

Dispatch Checker for quality assurance:
- Validating atom interfaces (inputs/outputs match dependencies)
- Checking for missing dependencies
- Reviewing code for common bugs
- Verifying the game loop is properly structured
- Running post-implementation sanity checks

**Model**: Gemini 2.5 Pro (via OpenRouter)

## Dispatch Order

For a typical feature request:
1. **Forge** reads existing code → plans implementation
2. **Forge** implements atoms (bottom-up: utils → features → core)
3. **Pixel** generates any needed visual assets (if applicable)
4. **Checker** validates the implementation
5. **Jarvis** summarizes results to user

For bug fixes:
1. **Forge** reads relevant atoms and identifies the issue
2. **Forge** implements the fix
3. **Checker** validates the fix didn't break dependencies

## MCP Tool Access

Sub-agents connect to these MCP servers:
- `atomic-coding` MCP: atom CRUD, code structure, semantic search
- `buu-tools` MCP: 3D model generation, world generation

The `x-game-id` header is set per-request from the game context.

## Important Rules

- Always read code structure before modifying atoms
- Create atoms bottom-up (dependencies before dependents)
- Never exceed 2KB per atom
- All atom interfaces use primitives only (number, string, boolean, arrays of these, void)
- Every atom needs a description (powers semantic search)
- Use snake_case for atom names
