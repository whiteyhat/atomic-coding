import { ToolLoopAgent, stepCountIs } from "ai";
import { createMCPClient, type MCPClient } from "@ai-sdk/mcp";
import { openrouter } from "@openrouter/ai-sdk-provider";
import { SYSTEM_PROMPT, getGenreContext } from "./system-prompt";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const BUU_API_KEY = process.env.BUU_API_KEY!;

export interface AgentContext {
  agent: ToolLoopAgent;
  cleanup: () => Promise<void>;
}

export async function createAtomicAgent(
  modelId: string,
  gameId: string,
  genre?: string | null,
  gameFormat?: "2d" | "3d" | null,
): Promise<AgentContext> {
  const clients: MCPClient[] = [];

  console.log("[agent] Creating agent", { modelId, gameId });

  // Connect to atomic-coding MCP server
  console.log("[agent] Connecting to atomic-coding MCP...");
  const atomicClient = await createMCPClient({
    transport: {
      type: "http",
      url: `${SUPABASE_URL}/functions/v1/mcp-server`,
      headers: { "x-game-id": gameId },
    },
  });
  clients.push(atomicClient);
  console.log("[agent] atomic-coding MCP connected");

  // Connect to buu-tools MCP server
  console.log("[agent] Connecting to buu-tools MCP...");
  const buuClient = await createMCPClient({
    transport: {
      type: "http",
      url: `${SUPABASE_URL}/functions/v1/buu-mcp`,
      headers: { "x-buu-api-key": BUU_API_KEY },
    },
  });
  clients.push(buuClient);
  console.log("[agent] buu-tools MCP connected");

  // Get tools from both MCP servers
  const [atomicTools, buuTools] = await Promise.all([
    atomicClient.tools(),
    buuClient.tools(),
  ]);

  const atomicToolNames = Object.keys(atomicTools);
  const buuToolNames = Object.keys(buuTools);
  console.log("[agent] Tools loaded", {
    atomic: atomicToolNames,
    buu: buuToolNames,
    total: atomicToolNames.length + buuToolNames.length,
  });

  const agent = new ToolLoopAgent({
    model: openrouter(modelId),
    instructions: SYSTEM_PROMPT + getGenreContext(genre ?? null, gameFormat ?? null),
    tools: {
      ...atomicTools,
      ...buuTools,
    },
    stopWhen: stepCountIs(30),
  });

  console.log("[agent] Agent ready", { modelId, maxSteps: 30 });

  return {
    agent,
    cleanup: async () => {
      console.log("[agent] Closing MCP clients...");
      await Promise.all(clients.map((c) => c.close()));
      console.log("[agent] MCP clients closed");
    },
  };
}
