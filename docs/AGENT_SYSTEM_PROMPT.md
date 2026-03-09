# Atomic Coding -- Legacy Agent System Prompts

> Historical reference only.
> This document describes the older `Researcher / Planner / Builder` prompt flow for MCP-driven editing.
> It is not the source of truth for the current production Mastra pipeline.
>
> Current source of truth:
> - [system-architecture.md](system-architecture.md)
> - [agent-role-skill-matrix.md](agent-role-skill-matrix.md)

Three specialized roles for AI agents building games with the Atomic Coding MCP server.

```
User Request
    |
    v
[Researcher] -- understands the codebase (read-only)
    |
    v
Context Report
    |
    v
[Planner] -- designs the changes (read-only)
    |
    v
Execution Plan
    |
    v
[Builder] -- writes the code (read + write)
    |
    v
Game Rebuilt
```

## Roles

| Role | Purpose | Read Tools | Write Tools |
|------|---------|------------|-------------|
| [Researcher](prompts/researcher.md) | Understand the codebase, map dependencies, find relevant atoms | `get_code_structure`, `read_atoms`, `semantic_search` | None |
| [Planner](prompts/planner.md) | Design atom changes, specify interfaces, order steps | `get_code_structure`, `read_atoms`, `semantic_search` | None |
| [Builder](prompts/builder.md) | Write JS code, save atoms, fix runtime bugs | `get_code_structure`, `read_atoms`, `semantic_search` | `upsert_atom`, `delete_atom` |

## Tool Access

All three roles have access to all read tools (`get_code_structure`, `read_atoms`, `semantic_search`). Only the Builder has write tools (`upsert_atom`, `delete_atom`).

This means:
- The Researcher and Planner can verify, investigate, and supplement their knowledge at any time
- The Planner can double-check the Researcher's report by reading atoms directly
- The Builder can investigate runtime bugs and read code before fixing it
- But only the Builder can actually change code

## When to Use Each Role

- **New feature request** -- Full pipeline: Researcher -> Planner -> Builder
- **Bug fix with known location** -- Builder alone (runtime fix mode)
- **Bug fix with unknown location** -- Researcher -> Builder (skip Planner for simple fixes)
- **"What does X do?"** -- Researcher alone
- **Refactoring / architecture review** -- Researcher -> Planner (Builder optional until approved)

## Single-Agent Mode

For AI systems that use one agent (like Cursor), the agent should think through all three phases internally:

1. **Think as Researcher**: "Let me check what exists..." (use read tools)
2. **Think as Planner**: "Here's what I need to create/change..." (design before writing)
3. **Think as Builder**: "Now I'll execute step by step..." (write atoms in order)

The key discipline: **never start building until you've researched and planned.**
