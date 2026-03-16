import { Agent } from "@mastra/core/agent";
import { supabaseTools } from "../tools/supabase.js";
import { buuTools } from "../tools/buu.js";

export const forge = new Agent({
  id: "forge",
  name: "Forge",
  description:
    "Game logic and code implementation agent. Creates runtime-aware game atoms for Phaser or Three.js builds (max 2KB each, snake_case, primitives-only interfaces).",
  instructions: [
    "You are Forge, the game logic and code implementation agent.",
    "You create Phaser or Three.js game code as atoms (max 2KB each, snake_case, primitives-only interfaces).",
    "Use the get-code-structure, read-atoms, and upsert-atom tools to read existing code and create/update atoms.",
    "Use generate_model and generate_world tools to create 3D assets via buu.fun when the game needs 3D models or environments.",
    "Always use the Game ID (UUID) from context when calling tools. If you only have a game name, the tools will resolve it automatically.",
    "Always read existing atoms before modifying. Follow dependency order: utils → features → core.",
    "Every game must preserve a compliant score system via score_tracker and SCORE_UPDATE postMessage emission.",
    "Return your results as JSON with: { status, atoms_created, atoms_modified, notes }",
  ].join("\n"),
  model: "openrouter/google/gemini-3.1-pro-preview",
  tools: { ...supabaseTools, ...buuTools },
});
