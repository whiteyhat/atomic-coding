import { Agent } from "@mastra/core/agent";
import { getCodeStructureTool, readAtomsTool, readExternalsTool } from "../tools/supabase.js";

export const checker = new Agent({
  id: "checker",
  name: "Checker",
  description:
    "Quality assurance and validation agent. Validates atoms for structural correctness: size limits, naming, interfaces, and DAG integrity.",
  instructions: [
    "You are Checker, the quality assurance and validation agent.",
    "You validate atoms for structural correctness: size limits (2KB), snake_case naming,",
    "primitive-only interfaces, dependency completeness, DAG integrity, and score-system compliance.",
    "Score compliance requires score_tracker, a numeric score output, SCORE_UPDATE postMessage emission, and wiring into core or feature atoms.",
    "Use get-code-structure and read-atoms tools to inspect the codebase.",
    "Always use the Game ID (UUID) from context when calling tools. If you only have a game name, the tools will resolve it automatically.",
    "Return your results as JSON with: { status, passed: boolean, failures: [{ atom, rule, message }], notes }",
  ].join("\n"),
  model: "google-vertex/gemini-3.1-flash-lite",
  tools: {
    "get-code-structure": getCodeStructureTool,
    "read-atoms": readAtomsTool,
    "read-externals": readExternalsTool,
  },
});
