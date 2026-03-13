// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { McpServer } from "npm:@modelcontextprotocol/sdk@1.25.3/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "npm:@modelcontextprotocol/sdk@1.25.3/server/webStandardStreamableHttp.js";
import { Hono } from "npm:hono@^4.9.7";
import { z } from "npm:zod@^4.1.13";

// =============================================================================
// Buu.fun MCP Server
//
// Thin proxy that exposes buu.fun generation APIs as MCP tools.
// Reads x-buu-api-key header for auth and x-buu-api-url for the API base.
// =============================================================================

const DEFAULT_API_URL = "http://localhost:4001";

function createMcpServer(apiKey: string, apiUrl: string): McpServer {
  const server = new McpServer({
    name: "buu-tools",
    version: "1.0.0",
  });

  /** Helper: call a buu.fun endpoint */
  async function callBuu(path: string, body: Record<string, unknown>) {
    const url = `${apiUrl}${path}`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!res.ok) {
      const msg = data?.message || data?.error || JSON.stringify(data);
      throw new Error(`buu.fun ${res.status}: ${msg}`);
    }
    return data;
  }

  // ---------------------------------------------------------------------------
  // Tool 1: generate_model
  // ---------------------------------------------------------------------------
  server.registerTool(
    "generate_model",
    {
      title: "Generate 3D Model",
      description:
        "Generate a 3D model from a text prompt via buu.fun. Returns a model ID that can be used with BUU.loadModel() to load the model in-game. The model is generated asynchronously — use BUU.loadModel with polling to wait for it.",
      inputSchema: {
        prompt: z.string().describe("Text description of the 3D model to generate"),
      },
    },
    async ({ prompt }) => {
      try {
        const result = await callBuu("/v1/tools/generate-model-from-prompt", {
          prompt,
          options: {
            isPublic: true,
            texture: "fast",
            numberOfModels: 1,
            modelType: "buu_v1",
          },
        });

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `Error: ${(err as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  // ---------------------------------------------------------------------------
  // Tool 2: generate_world
  // ---------------------------------------------------------------------------
  server.registerTool(
    "generate_world",
    {
      title: "Generate 3D World",
      description:
        "Generate a 3D world/environment from a text prompt via buu.fun. Returns a world ID that can be used with BUU.loadWorld() to load the world in-game. The world is generated asynchronously — use BUU.loadWorld with polling to wait for it.",
      inputSchema: {
        prompt: z.string().describe("Text description of the world to generate"),
        display_name: z.string().optional().describe("Display name for the world"),
        seed: z.number().optional().describe("Random seed for reproducibility"),
      },
    },
    async ({ prompt, display_name, model_type, seed }) => {
      try {
        const body: Record<string, unknown> = {
          textPrompt: prompt,
          modelType: "world-v1-micro",
        };
        if (display_name) body.displayName = display_name;
        if (seed !== undefined) body.seed = seed;

        const result = await callBuu("/v1/tools/generate-world-from-prompt", body);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `Error: ${(err as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  return server;
}

// =============================================================================
// HTTP Server
// =============================================================================

const app = new Hono();

app.get("/", (c) =>
  c.json({ status: "ok", server: "buu-tools-mcp", version: "1.0.0" }),
);

app.all("*", async (c) => {
  const apiKey = c.req.header("x-buu-api-key");
  if (!apiKey) {
    return c.json(
      { error: "Missing x-buu-api-key header. Set it in your MCP client config." },
      400,
    );
  }

  const apiUrl = c.req.header("x-buu-api-url") || DEFAULT_API_URL;

  const server = createMcpServer(apiKey, apiUrl);
  const transport = new WebStandardStreamableHTTPServerTransport();
  await server.connect(transport);
  return transport.handleRequest(c.req.raw);
});

Deno.serve(app.fetch);
