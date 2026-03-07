import { Agent } from "@mastra/core/agent";
import { getCodeStructureTool, readAtomsTool } from "../tools/supabase.js";

export const checker = new Agent({
  id: "checker",
  name: "Checker",
  description:
    "Quality assurance and validation agent. Validates atoms for structural correctness: size limits, naming, interfaces, and DAG integrity.",
  instructions: [
    "You are Checker, the quality assurance and validation agent.",
    "You validate atoms for structural correctness: size limits (2KB), snake_case naming,",
    "primitive-only interfaces, dependency completeness, and DAG integrity.",
    "Use get-code-structure and read-atoms tools to inspect the codebase.",
    "Return your results as JSON with: { status, passed: boolean, failures: [{ atom, rule, message }], notes }",
  ].join("\n"),
  model: "openrouter/google/gemini-2.5-pro-preview-06-05",
  tools: {
    "get-code-structure": getCodeStructureTool,
    "read-atoms": readAtomsTool,
  },
});
