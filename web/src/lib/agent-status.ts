/**
 * Agent status types and parsing for OpenClaw multi-agent streaming.
 * The Jarvis agent emits status markers like [AGENT:forge:working] in
 * its text stream. The frontend parses these to show agent activity.
 */

export type AgentName = "jarvis" | "forge" | "pixel" | "checker";
export type AgentState = "idle" | "working" | "done";

export interface AgentStatus {
  name: AgentName;
  state: AgentState;
  label: string;
}

const AGENT_LABELS: Record<AgentName, string> = {
  jarvis: "Jarvis (Planning)",
  forge: "Forge (Coding)",
  pixel: "Pixel (Art)",
  checker: "Checker (QA)",
};

const AGENT_MARKER_REGEX = /\[AGENT:(\w+):(\w+)\]/g;

/**
 * Parse agent status markers from a text chunk.
 * Returns any status changes found, plus the text with markers stripped.
 */
export function parseAgentStatus(text: string): {
  statuses: AgentStatus[];
  cleanText: string;
} {
  const statuses: AgentStatus[] = [];
  let match;

  while ((match = AGENT_MARKER_REGEX.exec(text)) !== null) {
    const name = match[1] as AgentName;
    const state = match[2] as AgentState;

    if (name in AGENT_LABELS) {
      statuses.push({
        name,
        state,
        label: AGENT_LABELS[name],
      });
    }
  }

  // Also handle the [AGENT:done] marker
  if (text.includes("[AGENT:done]")) {
    statuses.push({
      name: "jarvis",
      state: "done",
      label: "Done",
    });
  }

  const cleanText = text
    .replace(AGENT_MARKER_REGEX, "")
    .replace(/\[AGENT:done\]/g, "")
    .trim();

  return { statuses, cleanText };
}

/**
 * Get the currently active agent from a list of status updates.
 */
export function getActiveAgent(
  statuses: AgentStatus[]
): AgentStatus | null {
  // Return the last "working" status, or null if done/idle
  for (let i = statuses.length - 1; i >= 0; i--) {
    if (statuses[i].state === "working") return statuses[i];
  }
  return null;
}
