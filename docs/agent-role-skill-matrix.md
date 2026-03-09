# Agent Role & Skill Matrix

> Source of truth for the live Mastra war-room pipeline as of March 9, 2026.
> This document describes the current four-agent system. It does not describe the legacy `Researcher / Planner / Builder` prompt flow.

## Summary

- The current production agent system is the four-agent Mastra pipeline: `jarvis`, `forge`, `pixel`, and `checker`.
- Role definitions come from the live Mastra agent configs in `mastra/src/agents/`.
- Task ownership comes from the fixed 12-task war-room pipeline in `supabase/functions/_shared/services/warrooms.ts`.
- Recommended skills in this document mean capability modules or operating strengths the current system should emphasize.
- External UI-skill references from the older ClawHub ecosystem are listed below only as prompt/polish inspirations for Pixel. They are not installed runtime skills and they are not part of the Mastra contract.

## Live Agent Matrix

| Agent | Current role in pipeline | Owned tasks | Best 4 skills | Why these skills fit |
|---|---|---|---|---|
| `Jarvis` | Orchestrator, scope parser, pipeline planner, delivery aggregator, follow-up prompt generator | `#1 Parse scope & plan`, `#12 Deliver & suggest prompts` | `scope-intake`, `task-graph orchestration`, `delivery synthesis`, `retry-and-follow-up planning` | Matches the live role in `mastra/src/agents/jarvis.ts` and the first/last pipeline checkpoints. Also aligns with current improvement areas around better follow-up prompts and stronger orchestration quality. |
| `Forge` | Primary implementation agent for game atoms, genre bootstrap, dependency-aware gameplay composition, failure repair | `#2 Load genre boilerplate`, `#4 Implement util atoms`, `#5 Implement feature atoms`, `#6 Implement core atoms`, `#10 Fix failures` | `genre-boilerplate loading`, `atom decomposition and upsert`, `dependency-aware composition`, `validation-driven repair` | Matches the write-enabled implementation role in `mastra/src/agents/forge.ts` and the bulk of the code-generation chain. Also fits the repo priorities around boilerplate loading and repair after validation failures. |
| `Pixel` | Visual asset producer for HUD, menus, sprites, textures, and presentation-layer game assets | `#7 Generate UI assets`, `#8 Generate game sprites` | `art-direction extraction`, `HUD/UI asset generation`, `sprite-texture generation`, `asset packaging and publishing` | Matches the visual-only agent role in `mastra/src/agents/pixel.ts` and the two asset tasks. Pixel now has OpenRouter-backed image generation plus explicit polish rules; the remaining gap is asset persistence, preview, and publishing rather than basic generation. |
| `Checker` | Validation-spec author, structural QA gate, score-system compliance enforcer, final regression gatekeeper | `#3 Write validation specs`, `#9 Run validation suite`, `#11 Final validation` | `validation-spec authoring`, `structural-and-score compliance audit`, `runtime test generation`, `regression triage and gatekeeping` | Matches the read-only QA role in `mastra/src/agents/checker.ts` and the pipeline’s validation gates. It also aligns with the repo’s explicit gaps around richer runtime validators, test generation, and CI-style enforcement. |

## Validation Notes

- Role mappings above match both the live agent definitions in `mastra/src/agents/` and the fixed task assignments in `supabase/functions/_shared/services/warrooms.ts`.
- `Forge` is treated as the primary implementation agent even though `Jarvis` currently has write-tool access in code. In practice, the fixed pipeline assigns code-authoring work to `Forge`.
- Recommended skills map either to current responsibilities already present in code or to high-priority gaps documented in `docs/todos-1.md`.
- External ClawHub-style skill names below are intentionally treated as design inspiration only, not as runtime dependencies or executable agent modules.

## External UI Skill Inspirations for Pixel

These references are useful when evolving Pixel's prompt rules, review criteria, and art-direction heuristics for UI-heavy tasks:

| External skill reference | Best use inside this repo |
|---|---|
| `ui-skills` | Strongest fit for information hierarchy, readability, affordances, and practical UI/UX cleanup in game HUDs and menus. |
| `design-system-creation` | Useful for enforcing pack-level consistency: states, tokens, spacing, shared component families, and visual language. |
| `shadcn-ui` | Helpful as a component-state reference for hover/pressed/disabled patterns and composable interface structure, even when Pixel is generating art rather than JSX. |
| `frontend-builder` | Useful as an umbrella reference because it pulls together broader frontend quality patterns and can inform Pixel plus surrounding UI implementation work. |

How to apply them:

- Translate them into prompt constraints, review rubrics, and acceptance criteria for Pixel outputs.
- Prefer concrete gameplay-facing goals such as safe text zones, controller-legible hierarchy, hover/pressed states, and contrast under motion.
- Do not treat them as installable runtime skills for Mastra unless a separate integration layer is built.

## Evidence

- Live runtime roles: `mastra/src/agents/jarvis.ts`, `mastra/src/agents/forge.ts`, `mastra/src/agents/pixel.ts`, `mastra/src/agents/checker.ts`
- Fixed task ownership: `supabase/functions/_shared/services/warrooms.ts`
- Canonical architecture summary: `docs/system-architecture.md`
- Current gaps and priorities: `docs/todos-1.md`
