import { createTool } from "@mastra/core/tools";
import { z } from "zod";

/** Call a buu.fun API endpoint */
async function callBuu(path: string, body: Record<string, unknown>) {
  const apiUrl = process.env.BUU_API_URL ?? "https://dev.api.buu.fun";
  const apiKey = process.env.BUU_API_KEY ?? "";
  if (!apiKey) {
    throw new Error("BUU_API_KEY is not configured");
  }

  const res = await fetch(`${apiUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  const data = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    const msg = data?.message || data?.error || JSON.stringify(data);
    throw new Error(`buu.fun ${res.status}: ${msg}`);
  }
  return data;
}

export const generateModelTool = createTool({
  id: "generate_model",
  description:
    "Generate a 3D model from a text prompt via buu.fun. Returns a model ID that can be used with BUU.loadModel() to load the model in-game. The model is generated asynchronously — use BUU.loadModel with polling to wait for it.",
  inputSchema: z.object({
    prompt: z
      .string()
      .describe("Text description of the 3D model to generate"),
  }),
  outputSchema: z.object({
    result: z.any(),
  }),
  execute: async ({ prompt }) => {
    const result = await callBuu("/v1/tools/generate-model-from-prompt", {
      prompt,
      options: {
        isPublic: true,
        texture: "fast",
        numberOfModels: 1,
        modelType: "buu_v1",
      },
    });
    return { result };
  },
});

export const generateWorldTool = createTool({
  id: "generate_world",
  description:
    "Generate a 3D world/environment from a text prompt via buu.fun. Returns a world ID that can be used with BUU.loadWorld() to load the world in-game. The world is generated asynchronously — use BUU.loadWorld with polling to wait for it.",
  inputSchema: z.object({
    prompt: z
      .string()
      .describe("Text description of the world to generate"),
    display_name: z
      .string()
      .optional()
      .describe("Display name for the world"),
    seed: z.number().optional().describe("Random seed for reproducibility"),
  }),
  outputSchema: z.object({
    result: z.any(),
  }),
  execute: async ({ prompt, display_name, seed }) => {
    const body: Record<string, unknown> = {
      textPrompt: prompt,
      modelType: "world-v1-micro",
    };
    if (display_name) body.displayName = display_name;
    if (seed !== undefined) body.seed = seed;

    const result = await callBuu(
      "/v1/tools/generate-world-from-prompt",
      body,
    );
    return { result };
  },
});

export const buuTools = {
  generate_model: generateModelTool,
  generate_world: generateWorldTool,
};
