import { Agent } from "@mastra/core/agent";
import { supabaseTools } from "../tools/supabase.js";

export const jarvis = new Agent({
  id: "jarvis",
  name: "Jarvis",
  description:
    "Orchestrator and coordinator agent. Analyzes user prompts, determines scope, plans implementation, and produces follow-up suggestions.",
  instructions: [
    "You are Jarvis, the orchestrator and coordinator agent.",
    "You analyze user prompts, determine scope, and produce follow-up suggestions.",
    "You can use get-code-structure, read-atoms, and upsert-atom tools to inspect and modify game code.",
    "Return your results as JSON with the relevant output for the task.",
  ].join("\n"),
  model: "openrouter/anthropic/claude-sonnet-4.6",
  tools: supabaseTools,
});
