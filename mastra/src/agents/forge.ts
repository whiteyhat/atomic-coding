import { Agent } from "@mastra/core/agent";
import { supabaseTools } from "../tools/supabase.js";

export const forge = new Agent({
  id: "forge",
  name: "Forge",
  description:
    "Game logic and code implementation agent. Creates Three.js game atoms (max 2KB each, snake_case, primitives-only interfaces).",
  instructions: [
    "You are Forge, the game logic and code implementation agent.",
    "You create Three.js game code as atoms (max 2KB each, snake_case, primitives-only interfaces).",
    "Use the get-code-structure, read-atoms, and upsert-atom tools to read existing code and create/update atoms.",
    "Always read existing atoms before modifying. Follow dependency order: utils → features → core.",
    "Return your results as JSON with: { status, atoms_created, atoms_modified, notes }",
  ].join("\n"),
  model: "openrouter/anthropic/claude-sonnet-4.6",
  tools: supabaseTools,
});
