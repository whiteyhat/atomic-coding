import { Agent } from "@mastra/core/agent";
import { supabaseTools } from "../tools/supabase.js";

export const forge = new Agent({
  id: "forge",
  name: "Forge",
  description:
    "Game logic and code implementation agent. Creates runtime-aware game atoms for Phaser or Three.js builds (max 2KB each, snake_case, primitives-only interfaces).",
  instructions: [
    "You are Forge, the game logic and code implementation agent.",
    "You create Phaser or Three.js game code as atoms (max 2KB each, snake_case, primitives-only interfaces).",
    "Use the get-code-structure, read-atoms, and upsert-atom tools to read existing code and create/update atoms.",
    "Always read existing atoms before modifying. Follow dependency order: utils → features → core.",
    "Every game must preserve a compliant score system via score_tracker and SCORE_UPDATE postMessage emission.",
    "Return your results as JSON with: { status, atoms_created, atoms_modified, notes }",
  ].join("\n"),
  model: "openrouter/anthropic/claude-sonnet-4.6",
  tools: supabaseTools,
});
