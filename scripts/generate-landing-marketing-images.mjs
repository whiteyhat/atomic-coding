#!/usr/bin/env node

import fs from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const OUTPUT_DIR = path.join(
  ROOT_DIR,
  "web",
  "public",
  "marketing",
  "landing",
);
const MANIFEST_PATH = path.join(OUTPUT_DIR, "manifest.json");
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL =
  process.env.OPENROUTER_IMAGE_MODEL ??
  "google/gemini-3.1-flash-image-preview";

const IMAGE_RECIPES = [
  {
    id: "stardew-inspired-farm-world",
    label: "Cozy Farming Lane",
    aspectRatio: "4:3",
    imageSize: "2K",
    alt: "Original cozy farming-adventure world with crops, cabins, and warm village light.",
    prompt: [
      "Create an original premium marketing image for a cozy farming-adventure game world.",
      "The mood should be inspired by the emotional warmth of beloved indie farming RPGs, but the world, characters, props, and composition must be completely original.",
      "Show a lush village with crops, paths, a wooden bridge, cabins, lanterns, and a hero character silhouette moving through the scene.",
      "Use handcrafted detail, rich color, warm sunset light, and a polished game-key-art finish.",
      "Make it feel playable and alive, not like concept art wallpaper.",
      "No logos, no UI chrome, no text, no watermark.",
    ].join(" "),
  },
];

function parseArgs(argv) {
  const args = {
    model: DEFAULT_MODEL,
  };

  for (const arg of argv) {
    if (arg.startsWith("--model=")) {
      args.model = arg.slice("--model=".length).trim() || DEFAULT_MODEL;
    }
  }

  return args;
}

function parseDotenv(text) {
  const entries = [];

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separator = line.indexOf("=");
    if (separator === -1) continue;

    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    value = value.replace(/\\n/g, "\n");
    entries.push([key, value]);
  }

  return entries;
}

function loadLocalEnv() {
  const envFiles = [
    path.join(ROOT_DIR, ".env.local"),
    path.join(ROOT_DIR, ".env.development.local"),
    path.join(ROOT_DIR, "mastra", ".env"),
    path.join(ROOT_DIR, "mastra", ".env.local"),
  ];

  for (const envPath of envFiles) {
    if (!fs.existsSync(envPath)) continue;
    const content = fs.readFileSync(envPath, "utf8");
    for (const [key, value] of parseDotenv(content)) {
      if (!(key in process.env)) {
        process.env[key] = value;
      }
    }
  }
}

function extractAssistantMessage(payload) {
  return payload?.choices?.[0]?.message ?? null;
}

function extractImageUrl(message) {
  const image = message?.images?.[0];
  if (!image) return null;

  return (
    image.image_url?.url ??
    image.imageUrl?.url ??
    image.url ??
    null
  );
}

function extractAssistantText(message) {
  if (!message?.content) return null;
  if (typeof message.content === "string") {
    return message.content.trim() || null;
  }

  const text = message.content
    .map((part) => (part?.type === "text" ? part.text?.trim() ?? "" : ""))
    .filter(Boolean)
    .join("\n")
    .trim();

  return text || null;
}

function parseDataUrl(dataUrl) {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) {
    throw new Error("Unsupported data URL returned by OpenRouter");
  }

  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], "base64"),
  };
}

function extensionForMimeType(mimeType) {
  if (mimeType === "image/png") return ".png";
  if (mimeType === "image/webp") return ".webp";
  if (mimeType === "image/jpeg") return ".jpg";
  return ".png";
}

async function downloadImageBuffer(imageSource) {
  if (imageSource.startsWith("data:")) {
    return parseDataUrl(imageSource);
  }

  const response = await fetch(imageSource);
  if (!response.ok) {
    throw new Error(`Unable to download generated image: ${response.status}`);
  }

  const mimeType = response.headers.get("content-type")?.split(";")[0] ?? "image/png";
  const arrayBuffer = await response.arrayBuffer();

  return {
    mimeType,
    buffer: Buffer.from(arrayBuffer),
  };
}

async function generateImage(recipe, model) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENROUTER_API_KEY is required. Set it in your environment or local env files before running this script.",
    );
  }

  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer":
        process.env.OPENROUTER_SITE_URL ?? "https://atomic-coding.local",
      "X-Title": process.env.OPENROUTER_APP_NAME ?? "Buu Landing Image Generator",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: recipe.prompt }],
      modalities: ["image", "text"],
      image_config: {
        aspect_ratio: recipe.aspectRatio,
        image_size: recipe.imageSize,
      },
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      payload?.error?.message ??
        `OpenRouter image generation failed with status ${response.status}`,
    );
  }

  const message = extractAssistantMessage(payload);
  const imageUrl = extractImageUrl(message);
  if (!imageUrl) {
    throw new Error(`No image returned for ${recipe.id}`);
  }

  return {
    imageUrl,
    revisedPrompt: extractAssistantText(message),
  };
}

async function writeGeneratedImage(recipe, imageSource) {
  const { mimeType, buffer } = await downloadImageBuffer(imageSource);
  const extension = extensionForMimeType(mimeType);
  const filename = `${recipe.id}${extension}`;
  const absolutePath = path.join(OUTPUT_DIR, filename);

  await writeFile(absolutePath, buffer);

  return {
    filename,
    publicPath: `/marketing/landing/${filename}`,
    mimeType,
  };
}

async function main() {
  loadLocalEnv();
  const { model } = parseArgs(process.argv.slice(2));

  await mkdir(OUTPUT_DIR, { recursive: true });

  const manifest = {
    generatedAt: new Date().toISOString(),
    model,
    images: [],
  };

  for (const recipe of IMAGE_RECIPES) {
    console.log(`Generating ${recipe.id} with ${model}...`);

    const generated = await generateImage(recipe, model);
    const written = await writeGeneratedImage(recipe, generated.imageUrl);

    manifest.images.push({
      id: recipe.id,
      label: recipe.label,
      alt: recipe.alt,
      aspectRatio: recipe.aspectRatio,
      imageSize: recipe.imageSize,
      src: written.publicPath,
      mimeType: written.mimeType,
      prompt: recipe.prompt,
      revisedPrompt: generated.revisedPrompt,
      model,
    });

    console.log(`Saved ${written.publicPath}`);
  }

  await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n", "utf8");
  console.log(`Wrote manifest ${path.relative(ROOT_DIR, MANIFEST_PATH)}`);
}

main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Landing marketing image generation failed.",
  );
  process.exitCode = 1;
});
