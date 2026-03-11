import { AsyncLocalStorage } from "node:async_hooks";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import {
  buildPixelAssetPrompt,
  DEFAULT_PIXEL_IMAGE_MODEL,
  sanitizeReferenceNotes,
  type PixelAspectRatio,
  type PixelImageSize,
} from "../lib/pixel-guidelines.js";
import { getCodeStructureTool, readAtomsTool } from "./supabase.js";

/**
 * Per-run registry: maps "runId:assetKey" → actual image URL/base64.
 *
 * Why a nested map keyed by runId?
 * - Multiple war rooms can run concurrently in the same process.
 * - Using AsyncLocalStorage to thread the runId through Mastra's tool
 *   execute() calls means each run's keys are fully isolated.
 * - clearPixelRegistryForRun() only wipes one run's entries, so concurrent
 *   runs can never corrupt each other's data.
 */
const pixelAssetRegistry = new Map<string, Map<string, string>>();
const runIdStorage = new AsyncLocalStorage<string>();

let _globalCounter = 0;

function currentRunId(): string {
  return runIdStorage.getStore() ?? "default";
}

function makeAssetKey(name: string): string {
  _globalCounter += 1;
  const safe = name.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 32);
  return `pxl_ref_${_globalCounter}_${safe}`;
}

function registryForRun(runId: string): Map<string, string> {
  let map = pixelAssetRegistry.get(runId);
  if (!map) {
    map = new Map();
    pixelAssetRegistry.set(runId, map);
  }
  return map;
}

/**
 * Run a pixel-agent dispatch inside a scoped context so every
 * generate-polished-visual-pack tool call within it writes to an
 * isolated per-run registry bucket.
 */
export function runWithPixelContext<T>(runId: string, fn: () => Promise<T>): Promise<T> {
  return runIdStorage.run(runId, fn);
}

/** Resolve any pxl_ref_* keys in a task output back to real URLs/base64. */
export function resolvePixelAssetKeys(
  output: Record<string, unknown>,
  runId: string,
): Record<string, unknown> {
  if (!Array.isArray(output.assets_created)) return output;
  const registry = pixelAssetRegistry.get(runId);
  let resolved = 0;
  const assets_created = (output.assets_created as unknown[]).map((asset) => {
    if (typeof asset !== "object" || !asset) return asset;
    const a = asset as Record<string, unknown>;
    const key = typeof a.url_or_base64 === "string" ? a.url_or_base64 : null;
    if (key && key.startsWith("pxl_ref_") && registry) {
      const actual = registry.get(key);
      if (actual) {
        resolved += 1;
        return { ...a, url_or_base64: actual };
      }
      console.warn("[pixel-registry] key not found in registry — asset may be missing", { key, runId });
    }
    return asset;
  });
  console.log("[pixel-registry] resolved asset keys", { runId, resolved, total: assets_created.length });
  return { ...output, assets_created };
}

/** Free all registry memory for a completed run. Call after both task 7 and task 8 have resolved. */
export function clearPixelRegistryForRun(runId: string): void {
  pixelAssetRegistry.delete(runId);
}

const OPENROUTER_CHAT_COMPLETIONS_URL =
  "https://openrouter.ai/api/v1/chat/completions";

type OpenRouterImageResponse = {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
      images?: Array<{
        type?: string;
        image_url?: { url?: string };
        imageUrl?: { url?: string };
        url?: string;
      }>;
    };
  }>;
  error?: {
    message?: string;
  };
};

const pixelAssetRequestSchema = z.object({
  name: z.string().min(1).describe("Stable asset name for the output"),
  type: z
    .enum([
      "hud",
      "menu",
      "button",
      "panel",
      "icon",
      "overlay",
      "sprite",
      "texture",
      "background",
      "cursor",
    ])
    .describe("What kind of game asset to generate"),
  brief: z.string().min(12).describe("Detailed asset brief"),
  usage: z
    .string()
    .optional()
    .describe("Where the asset appears in the game and what it communicates"),
  text_overlay: z
    .string()
    .optional()
    .describe("Exact text that must appear in the image, if any"),
  aspect_ratio: z
    .enum(["1:1", "3:2", "4:3", "16:9", "21:9", "9:16"])
    .default("1:1")
    .describe("Preferred output aspect ratio"),
  image_size: z
    .enum(["1K", "2K", "4K"])
    .default("1K")
    .describe("Output resolution tier"),
  transparent_background: z
    .boolean()
    .default(true)
    .describe("Whether the asset should be isolated on transparency"),
  polish_goals: z
    .array(z.string())
    .max(8)
    .default([])
    .describe("Specific polish requirements such as hover state, focus ring, hit flash"),
  reference_notes: z
    .array(z.string())
    .max(8)
    .default([])
    .describe("Style or reference notes to keep the pack cohesive"),
});

function getImageUrl(image: {
  image_url?: { url?: string };
  imageUrl?: { url?: string };
  url?: string;
}): string | null {
  return (
    image.image_url?.url ??
    image.imageUrl?.url ??
    image.url ??
    null
  );
}

function extractAssistantText(
  content: string | Array<{ type?: string; text?: string }> | undefined
): string | null {
  if (!content) return null;
  if (typeof content === "string") {
    return content.trim() || null;
  }

  const text = content
    .map((part) => (part.type === "text" ? part.text?.trim() ?? "" : ""))
    .filter(Boolean)
    .join("\n")
    .trim();

  return text || null;
}

async function generateSingleAsset(args: {
  model: string;
  genre?: string;
  styleDirection?: string;
  packGoal?: string;
  asset: {
    name: string;
    type: string;
    brief: string;
    usage?: string;
    text_overlay?: string;
    aspect_ratio: PixelAspectRatio;
    image_size: PixelImageSize;
    transparent_background: boolean;
    polish_goals: string[];
    reference_notes: string[];
  };
}): Promise<{
  name: string;
  type: string;
  url_or_base64: string;
  prompt_used: string;
  revised_prompt: string | null;
  aspect_ratio: PixelAspectRatio;
  image_size: PixelImageSize;
  polish_notes: string[];
  source_model: string;
}> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured for Pixel image generation");
  }

  const prompt = buildPixelAssetPrompt(
    {
      name: args.asset.name,
      type: args.asset.type,
      brief: args.asset.brief,
      usage: args.asset.usage,
      textOverlay: args.asset.text_overlay,
      aspectRatio: args.asset.aspect_ratio,
      imageSize: args.asset.image_size,
      transparentBackground: args.asset.transparent_background,
      polishGoals:
        args.asset.polish_goals.length > 0
          ? args.asset.polish_goals
          : ["Strong readability", "Clear hierarchy", "Cohesive game-ready finish"],
      referenceNotes: sanitizeReferenceNotes(args.asset.reference_notes),
    },
    {
      genre: args.genre,
      styleDirection: args.styleDirection,
      packGoal: args.packGoal,
    }
  );

  const response = await fetch(OPENROUTER_CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer":
        process.env.OPENROUTER_SITE_URL ?? "https://atomic-coding.local",
      "X-Title": process.env.OPENROUTER_APP_NAME ?? "Atomic Coding Pixel",
    },
    body: JSON.stringify({
      model: args.model,
      messages: [{ role: "user", content: prompt }],
      modalities: ["image", "text"],
      image_config: {
        aspect_ratio: args.asset.aspect_ratio,
        image_size: args.asset.image_size,
      },
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as OpenRouterImageResponse;
  if (!response.ok) {
    throw new Error(
      payload.error?.message ??
        `OpenRouter image generation failed with status ${response.status}`
    );
  }

  const message = payload.choices?.[0]?.message;
  const imageUrl = message?.images?.[0] ? getImageUrl(message.images[0]) : null;
  if (!imageUrl) {
    throw new Error("OpenRouter did not return an image URL for the requested asset");
  }

  return {
    name: args.asset.name,
    type: args.asset.type,
    url_or_base64: imageUrl,
    prompt_used: prompt,
    revised_prompt: extractAssistantText(message?.content),
    aspect_ratio: args.asset.aspect_ratio,
    image_size: args.asset.image_size,
    polish_notes:
      args.asset.polish_goals.length > 0
        ? args.asset.polish_goals
        : ["Strong readability", "Clear hierarchy", "Cohesive game-ready finish"],
    source_model: args.model,
  };
}

async function generateSingleAssetWithRetry(
  args: Parameters<typeof generateSingleAsset>[0],
  maxRetries = 1,
): Promise<Awaited<ReturnType<typeof generateSingleAsset>>> {
  let lastError: Error | undefined;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await generateSingleAsset(args);
    } catch (err) {
      lastError = err as Error;
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
  }
  throw lastError;
}

export const generatePolishedVisualPackTool = createTool({
  id: "generate-polished-visual-pack",
  description:
    "Generate polished game UI packs, HUD elements, button states, sprites, textures, and overlays via OpenRouter image generation.",
  inputSchema: z.object({
    genre: z
      .string()
      .optional()
      .describe("Game genre for style alignment"),
    style_direction: z
      .string()
      .optional()
      .describe("Overall art direction for the asset pack"),
    pack_goal: z
      .string()
      .optional()
      .describe("What the pack should achieve inside gameplay"),
    model: z
      .string()
      .default(DEFAULT_PIXEL_IMAGE_MODEL)
      .describe("OpenRouter image model to use"),
    assets: z
      .array(pixelAssetRequestSchema)
      .min(1)
      .max(12)
      .describe("Assets to generate in a single coherent pack (up to 12)"),
  }),
  outputSchema: z.object({
    model: z.string(),
    assets: z.array(
      z.object({
        name: z.string(),
        type: z.string(),
        /**
         * A short reference key (e.g. "pxl_ref_1_health_bar"). The actual image
         * URL / base64 is stored in the module-level pixelAssetRegistry and is
         * never sent back through the conversation history to avoid context overflow.
         * Copy this key verbatim into your output's assets_created[].url_or_base64.
         * The orchestrator will resolve it to the real URL before persisting.
         */
        asset_key: z.string(),
        aspect_ratio: z.string(),
        image_size: z.string(),
        polish_notes: z.array(z.string()),
        source_model: z.string(),
      })
    ),
    failures: z.array(
      z.object({
        asset: z.string(),
        error: z.string(),
      })
    ).default([]),
    notes: z.array(z.string()),
  }),
  execute: async ({ genre, style_direction, pack_goal, model, assets }) => {
    const results = await Promise.allSettled(
      assets.map((asset) =>
        generateSingleAssetWithRetry({
          model,
          genre,
          styleDirection: style_direction,
          packGoal: pack_goal,
          asset,
        })
      )
    );

    const generated: Array<{
      name: string;
      type: string;
      asset_key: string;
      aspect_ratio: string;
      image_size: string;
      polish_notes: string[];
      source_model: string;
    }> = [];
    const failures: Array<{ asset: string; error: string }> = [];

    for (const [i, result] of results.entries()) {
      if (result.status === "fulfilled") {
        const full = result.value;
        // Store the actual image data in the run-scoped registry — never put it
        // in the tool result that flows back through the conversation history.
        const key = makeAssetKey(full.name);
        registryForRun(currentRunId()).set(key, full.url_or_base64);
        generated.push({
          name: full.name,
          type: full.type,
          asset_key: key,
          aspect_ratio: full.aspect_ratio,
          image_size: full.image_size,
          polish_notes: full.polish_notes,
          source_model: full.source_model,
        });
      } else {
        failures.push({
          asset: assets[i].name,
          error: result.reason?.message ?? "Unknown error",
        });
      }
    }

    return {
      model,
      assets: generated,
      failures,
      notes: [
        `${generated.length}/${assets.length} assets generated successfully.`,
        ...(failures.length > 0
          ? [`Failed: ${failures.map((f) => f.asset).join(", ")}`]
          : []),
        "Copy each asset_key verbatim into your output's assets_created[].url_or_base64 field.",
        "Use transparent-background outputs for overlay composition unless a full-scene asset was requested.",
      ],
    };
  },
});

export const pixelTools = {
  "get-code-structure": getCodeStructureTool,
  "read-atoms": readAtomsTool,
  "generate-polished-visual-pack": generatePolishedVisualPackTool,
};
