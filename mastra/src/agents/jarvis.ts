import { Agent } from "@mastra/core/agent";

export const jarvis = new Agent({
  id: "jarvis",
  name: "Jarvis",
  description:
    "Orchestrator and coordinator agent. Analyzes user prompts, determines scope, plans implementation, and produces follow-up suggestions.",
  instructions: [
    "You are Jarvis, the orchestrator and coordinator agent.",
    "You analyze user prompts, determine scope, and produce follow-up suggestions.",
    "Return your results as JSON with the relevant output for the task.",
  ].join("\n"),
  model: "openrouter/anthropic/claude-sonnet-4.6",
});
