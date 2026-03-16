import { Agent } from "@mastra/core/agent";
import { supabaseTools } from "../tools/supabase.js";
import { buuTools } from "../tools/buu.js";

export const jarvis = new Agent({
  id: "jarvis",
  name: "Jarvis",
  description:
    "Orchestrator and coordinator agent. Analyzes user prompts, determines scope, plans implementation, and produces follow-up suggestions.",
  instructions: [
    "You are Jarvis, the orchestrator and coordinator agent.",
    "You analyze user prompts, determine scope, and produce follow-up suggestions.",
    "You can use get-code-structure, read-atoms, and upsert-atom tools to inspect and modify game code.",
    "You can use generate_model and generate_world tools to create 3D assets via buu.fun.",
    "Always use the Game ID (UUID) from context when calling tools. If you only have a game name, the tools will resolve it automatically.",
    "Every pipeline outcome must keep score_tracker-based score reporting intact for leaderboards.",
    "Return your results as JSON with the relevant output for the task.",
  ].join("\n"),
  model: "google-vertex/gemini-3.1-pro",
  tools: { ...supabaseTools, ...buuTools },
});
