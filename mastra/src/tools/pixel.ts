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
      .max(6)
      .describe("Assets to generate in a single coherent pack"),
  }),
  outputSchema: z.object({
    model: z.string(),
    assets: z.array(
      z.object({
        name: z.string(),
        type: z.string(),
        url_or_base64: z.string(),
        prompt_used: z.string(),
        revised_prompt: z.string().nullable(),
        aspect_ratio: z.string(),
        image_size: z.string(),
        polish_notes: z.array(z.string()),
        source_model: z.string(),
      })
    ),
    notes: z.array(z.string()),
  }),
  execute: async ({ genre, style_direction, pack_goal, model, assets }) => {
    const generated: Array<Awaited<ReturnType<typeof generateSingleAsset>>> = [];

    for (const asset of assets) {
      generated.push(
        await generateSingleAsset({
          model,
          genre,
          styleDirection: style_direction,
          packGoal: pack_goal,
          asset,
        })
      );
    }

    return {
      model,
      assets: generated,
      notes: [
        "Assets were generated through OpenRouter image generation.",
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
