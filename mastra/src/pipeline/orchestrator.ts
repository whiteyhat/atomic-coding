import { inflateSync } from "node:zlib";
import { APICallError } from "ai";
import { mastra } from "../mastra.js";
import { getSupabaseClient } from "../lib/supabase.js";
import {
  mergeValidationReports,
  validateScoreSystemRules,
  validateStructuralRules,
  validateGameSpecificRules,
  validateInterfaceCompatibility,
  validateReachability,
  validateCodeQuality,
  type ValidationReport,
  type ValidationSpecs as AtomValidationSpecs,
} from "../shared/atom-validation.js";
import * as warrooms from "./warrooms.js";
import { buildTaskPrompt, getAgentSystemPrompt } from "./prompts.js";
import { Task1OutputSchema, Task2OutputSchema, Task3OutputSchema, Task4OutputSchema, Task5OutputSchema, Task6OutputSchema, Task7OutputSchema, Task8OutputSchema, CheckerValidationOutputSchema, Task10OutputSchema, type Task1Scope, type Task8Asset, type ValidationSpecs } from "./types.js";
import type { WarRoomTask, DispatchResult, TaskStatus } from "./types.js";
import { ensureBoilerplateSeeded } from "./boilerplate-seeder.js";
import { resolvePixelAssetKeys, clearPixelRegistryForRun, runWithPixelContext } from "../tools/pixel.js";

const MAX_RETRY_CYCLES = 3;
const MAX_TASK_RETRIES = 2;
const PIPELINE_TIMEOUT_MS = 20 * 60 * 1000; // 20 minutes
const TASK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes per task
const PROVIDER_RETRY_DELAY_MS = [2_000, 5_000, 10_000]; // stepped backoff per attempt

/**
 * Safe wrapper for non-critical DB operations (event recording, heartbeat updates).
 * These are informational — a transient DB error must never crash the pipeline.
 */
async function safeRecord<T>(
  label: string,
  fn: () => Promise<T>,
): Promise<T | undefined> {
  try {
    return await fn();
  } catch (err) {
    console.warn(`[orchestrator] ${label} failed (non-fatal):`, (err as Error).message);
    return undefined;
  }
}
const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

type Task8DeliveryKind = "isolated_sprite" | "tile_texture" | "background_plate";

interface PngAlphaAnalysis {
  hasTransparentPixels: boolean;
  nonTransparentPixels: number;
  touchesEdgeCount: number;
  coverageRatio: number;
}

function getRuntimeName(gameFormat: "2d" | "3d" | null | undefined): "phaser" | "three" {
  return gameFormat === "2d" ? "phaser" : "three";
}

function dedupeStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

/**
 * Rough token estimate: 1 token ≈ 3 characters (conservative for JSON-heavy content).
 * Used for pre-dispatch budget checks — not exact, but good enough to catch overflows.
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 2); // ~1 token per 2 chars (conservative for JSON-heavy content)
}

/**
 * Token budget for a single agent dispatch (initial prompt + system prompt).
 * Gemini 3.1 Pro has a 1M token context window. We leave 40% headroom for
 * the accumulated tool calls and assistant messages during the agentic loop.
 */
const PROMPT_TOKEN_BUDGET = 400_000;

/**
 * If the combined prompt exceeds the token budget, trim the middle section
 * (dependency outputs) while preserving the task header/instructions and the end.
 * This is a last-resort safety net — ideally sanitizeDependencyOutput prevents overflow.
 */
function trimPromptToTokenBudget(prompt: string, budget: number): string {
  const maxChars = budget * 2; // Match estimateTokens ratio (2 chars/token)
  if (prompt.length <= maxChars) return prompt;

  const keepHead = Math.floor(maxChars * 0.75);
  const keepTail = Math.floor(maxChars * 0.10);
  const warning =
    "\n\n[CONTEXT TRIMMED: dependency outputs exceeded token budget and were truncated to prevent overflow.]\n\n";
  return prompt.slice(0, keepHead) + warning + prompt.slice(-keepTail);
}

function sanitizeAssetSegment(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return normalized || "asset";
}

function inferTask8DeliveryKind(asset: Task8Asset): Task8DeliveryKind {
  if (asset.delivery_kind) {
    return asset.delivery_kind;
  }

  if (asset.type === "background") {
    return "background_plate";
  }

  if (asset.type === "texture") {
    return "tile_texture";
  }

  return "isolated_sprite";
}

function getExtensionForContentType(contentType: string | null): string {
  if (!contentType) return ".png";
  if (contentType.includes("png")) return ".png";
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return ".jpg";
  if (contentType.includes("webp")) return ".webp";
  return ".png";
}

function paethPredictor(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);

  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function analyzePngAlpha(bytes: Uint8Array): PngAlphaAnalysis {
  for (let i = 0; i < PNG_SIGNATURE.length; i++) {
    if (bytes[i] !== PNG_SIGNATURE[i]) {
      throw new Error("Expected a PNG asset after background removal");
    }
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 8;
  let width = 0;
  let height = 0;
  let colorType = 0;
  const idatChunks: Uint8Array[] = [];

  while (offset + 8 <= bytes.length) {
    const length = view.getUint32(offset);
    const chunkType = String.fromCharCode(
      bytes[offset + 4],
      bytes[offset + 5],
      bytes[offset + 6],
      bytes[offset + 7],
    );
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;

    if (chunkType === "IHDR") {
      width = view.getUint32(dataStart);
      height = view.getUint32(dataStart + 4);
      colorType = bytes[dataStart + 9];
    } else if (chunkType === "IDAT") {
      idatChunks.push(bytes.slice(dataStart, dataEnd));
    } else if (chunkType === "IEND") {
      break;
    }

    offset = dataEnd + 4;
  }

  if (!width || !height || idatChunks.length === 0) {
    throw new Error("PNG metadata is incomplete");
  }

  if (colorType !== 6 && colorType !== 4) {
    return {
      hasTransparentPixels: false,
      nonTransparentPixels: width * height,
      touchesEdgeCount: 4,
      coverageRatio: 1,
    };
  }

  const bytesPerPixel = colorType === 6 ? 4 : 2;
  const stride = width * bytesPerPixel;
  const compressed = new Uint8Array(idatChunks.reduce((sum, chunk) => sum + chunk.length, 0));
  let writeOffset = 0;
  for (const chunk of idatChunks) {
    compressed.set(chunk, writeOffset);
    writeOffset += chunk.length;
  }

  const inflated = inflateSync(compressed);
  const rows: Uint8Array[] = [];
  let readOffset = 0;
  let previousRow = new Uint8Array(stride);

  for (let rowIndex = 0; rowIndex < height; rowIndex++) {
    const filterType = inflated[readOffset];
    readOffset += 1;
    const row = inflated.slice(readOffset, readOffset + stride);
    readOffset += stride;
    const reconstructed = new Uint8Array(stride);

    for (let i = 0; i < stride; i++) {
      const left = i >= bytesPerPixel ? reconstructed[i - bytesPerPixel] : 0;
      const up = previousRow[i] ?? 0;
      const upLeft = i >= bytesPerPixel ? previousRow[i - bytesPerPixel] ?? 0 : 0;

      switch (filterType) {
        case 0:
          reconstructed[i] = row[i];
          break;
        case 1:
          reconstructed[i] = (row[i] + left) & 0xff;
          break;
        case 2:
          reconstructed[i] = (row[i] + up) & 0xff;
          break;
        case 3:
          reconstructed[i] = (row[i] + Math.floor((left + up) / 2)) & 0xff;
          break;
        case 4:
          reconstructed[i] = (row[i] + paethPredictor(left, up, upLeft)) & 0xff;
          break;
        default:
          throw new Error(`Unsupported PNG filter type: ${filterType}`);
      }
    }

    rows.push(reconstructed);
    previousRow = reconstructed;
  }

  let hasTransparentPixels = false;
  let nonTransparentPixels = 0;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    const row = rows[y];
    for (let x = 0; x < width; x++) {
      const alpha = row[x * bytesPerPixel + (bytesPerPixel - 1)];
      if (alpha < 255) {
        hasTransparentPixels = true;
      }
      if (alpha > 0) {
        nonTransparentPixels++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (nonTransparentPixels === 0) {
    return {
      hasTransparentPixels,
      nonTransparentPixels,
      touchesEdgeCount: 0,
      coverageRatio: 0,
    };
  }

  const touchesEdgeCount = Number(minX === 0) +
    Number(maxX === width - 1) +
    Number(minY === 0) +
    Number(maxY === height - 1);

  return {
    hasTransparentPixels,
    nonTransparentPixels,
    touchesEdgeCount,
    coverageRatio: nonTransparentPixels / (width * height),
  };
}

async function fetchAssetBytes(urlOrBase64: string): Promise<{
  bytes: Uint8Array;
  contentType: string | null;
}> {
  const response = await fetch(urlOrBase64);
  if (!response.ok) {
    throw new Error(`Failed to fetch generated asset: ${response.status}`);
  }

  return {
    bytes: new Uint8Array(await response.arrayBuffer()),
    contentType: response.headers.get("content-type"),
  };
}

async function removeBackground(
  bytes: Uint8Array,
  _fileName: string,
  contentType: string | null,
): Promise<Uint8Array> {
  const apiKey = process.env.FAL_API_KEY;
  if (!apiKey) {
    throw new Error("FAL_API_KEY is not configured");
  }

  const mime = contentType ?? "image/png";
  const base64 = Buffer.from(bytes).toString("base64");
  const dataUrl = `data:${mime};base64,${base64}`;

  const response = await fetch("https://fal.run/pixelcut/background-removal", {
    method: "POST",
    headers: {
      Authorization: `Key ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      image_url: dataUrl,
      output_format: "rgba",
      sync_mode: true,
    }),
  });

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(`FAL background-removal failed: ${response.status} ${message}`.trim());
  }

  const result = (await response.json()) as { image?: { url?: string } };
  const imageUrl = result.image?.url;
  if (!imageUrl) {
    throw new Error("FAL background-removal returned no image URL");
  }

  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) {
    throw new Error(`Failed to download FAL result image: ${imageResponse.status}`);
  }

  return new Uint8Array(await imageResponse.arrayBuffer());
}

async function uploadCanonicalTask8Asset(args: {
  bytes: Uint8Array;
  contentType: string;
  gameName: string;
  warRoomId: string;
  assetName: string;
  index: number;
}): Promise<string> {
  const path = `${args.gameName}/assets/${args.warRoomId}/${String(args.index + 1).padStart(2, "0")}_${sanitizeAssetSegment(args.assetName)}${getExtensionForContentType(args.contentType)}`;
  const supabase = getSupabaseClient();

  const { error } = await supabase.storage
    .from("bundles")
    .upload(path, new Blob([args.bytes], { type: args.contentType }), {
      cacheControl: "3600",
      upsert: true,
      contentType: args.contentType,
    });

  if (error) {
    throw new Error(`Failed to upload processed asset: ${error.message}`);
  }

  const { data } = supabase.storage
    .from("bundles")
    .getPublicUrl(path);

  if (!data?.publicUrl) {
    throw new Error("Failed to resolve public URL for processed asset");
  }

  return data.publicUrl;
}

/**
 * Upload a Task 7 UI asset to Supabase bundle storage and return the public URL.
 * Mirrors uploadCanonicalTask8Asset but uses a "ui" subfolder.
 */
async function uploadCanonicalTask7Asset(args: {
  bytes: Uint8Array;
  contentType: string;
  gameName: string;
  warRoomId: string;
  assetName: string;
  index: number;
}): Promise<string> {
  const path = `${args.gameName}/ui/${args.warRoomId}/${String(args.index + 1).padStart(2, "0")}_${sanitizeAssetSegment(args.assetName)}${getExtensionForContentType(args.contentType)}`;
  const supabase = getSupabaseClient();

  const { error } = await supabase.storage
    .from("bundles")
    .upload(path, new Blob([args.bytes], { type: args.contentType }), {
      cacheControl: "3600",
      upsert: true,
      contentType: args.contentType,
    });

  if (error) {
    throw new Error(`Failed to upload Task 7 UI asset: ${error.message}`);
  }

  const { data } = supabase.storage
    .from("bundles")
    .getPublicUrl(path);

  if (!data?.publicUrl) {
    throw new Error("Failed to resolve public URL for Task 7 UI asset");
  }

  return data.publicUrl;
}

/**
 * Post-process Task 7 (UI asset generation) output.
 *
 * OpenRouter/Gemini may return base64 data URIs instead of hosted HTTPS URLs.
 * If those data URIs end up in Task 7's output, they flow into Task 8's
 * dependency_outputs and massively inflate the prompt (100K–1.3M tokens per image).
 *
 * This function detects data URIs, uploads them to Supabase bundle storage, and
 * replaces url_or_base64 with a short public HTTPS URL — eliminating the root cause
 * of the context overflow. Mirroring what processTask8Output does for sprites.
 */
async function processTask7Output(args: {
  gameId: string;
  output: Record<string, unknown>;
  warRoomId: string;
}): Promise<Record<string, unknown>> {
  const supabase = getSupabaseClient();
  const assets = ((args.output.assets_created as Array<Record<string, unknown>> | undefined) ?? []).slice();
  if (assets.length === 0) {
    return args.output;
  }

  const { data: game, error: gameError } = await supabase
    .from("games")
    .select("name")
    .eq("id", args.gameId)
    .single();

  if (gameError || !game) {
    throw new Error(`Failed to resolve game name for Task 7 uploads: ${gameError?.message ?? "missing game"}`);
  }

  const processedAssets = await Promise.all(
    assets.map(async (asset, index) => {
      const urlOrBase64 = String(asset.url_or_base64 ?? "");

      // Only upload if this is a data URI — already-hosted URLs are fine as-is.
      if (!urlOrBase64.startsWith("data:")) {
        return asset;
      }

      try {
        const source = await fetchAssetBytes(urlOrBase64);
        const canonicalUrl = await uploadCanonicalTask7Asset({
          bytes: source.bytes,
          contentType: source.contentType ?? "image/png",
          gameName: game.name,
          warRoomId: args.warRoomId,
          assetName: String(asset.name ?? `ui_asset_${index + 1}`),
          index,
        });
        return { ...asset, url_or_base64: canonicalUrl };
      } catch (uploadErr) {
        // Non-fatal: log and preserve original to avoid breaking the pipeline.
        console.warn("[orchestrator] Task 7 asset upload failed — keeping original", {
          assetName: asset.name,
          warRoomId: args.warRoomId,
          error: (uploadErr as Error).message,
        });
        return asset;
      }
    }),
  );

  const uploadedCount = processedAssets.filter(
    (a, i) => a.url_or_base64 !== assets[i]?.url_or_base64,
  ).length;
  const notes = ((args.output.notes as string[] | undefined) ?? []).slice();
  if (uploadedCount > 0) {
    notes.push(
      `${uploadedCount} Task 7 UI asset${uploadedCount === 1 ? "" : "s"} uploaded to canonical bundle storage.`,
    );
  }

  return {
    ...args.output,
    assets_created: processedAssets,
    notes: dedupeStrings(notes),
  };
}

async function processTask8Output(args: {
  gameFormat: "2d" | "3d" | null;
  gameId: string;
  output: Record<string, unknown>;
  warRoomId: string;
}): Promise<Record<string, unknown>> {
  const supabase = getSupabaseClient();
  const assets = ((args.output.assets_created as Task8Asset[] | undefined) ?? []).slice();
  if (assets.length === 0) {
    return args.output;
  }

  const { data: game, error: gameError } = await supabase
    .from("games")
    .select("name")
    .eq("id", args.gameId)
    .single();

  if (gameError || !game) {
    throw new Error(`Failed to resolve game name for Task 8 uploads: ${gameError?.message ?? "missing game"}`);
  }

  const processedAssets = await Promise.all(
    assets.map(async (asset, index) => {
      const deliveryKind = inferTask8DeliveryKind(asset);
      const processingSteps = dedupeStrings([...(asset.processing_steps ?? ["generated"])]);
      const source = await fetchAssetBytes(asset.url_or_base64);
      let canonicalBytes = source.bytes;
      let canonicalContentType = source.contentType ?? "image/png";
      let backgroundRemoved = false;

      if (deliveryKind === "isolated_sprite") {
        let success = false;
        let lastError: Error | null = null;

        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            const cutout = await removeBackground(
              source.bytes,
              `${sanitizeAssetSegment(asset.name)}.png`,
              source.contentType,
            );
            const analysis = analyzePngAlpha(cutout);

            if (analysis.nonTransparentPixels === 0) {
              throw new Error("Background removal produced an empty sprite");
            }
            if (!analysis.hasTransparentPixels) {
              throw new Error("Background removal produced a fully opaque sprite");
            }
            if (analysis.touchesEdgeCount >= 3 || analysis.coverageRatio > 0.97) {
              throw new Error("Background removal appears tightly cropped against the frame");
            }

            canonicalBytes = cutout;
            canonicalContentType = "image/png";
            backgroundRemoved = true;
            processingSteps.push("background_removed", "validated_alpha");
            success = true;
            break;
          } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
          }
        }

        if (!success) {
          throw lastError ?? new Error(`Background removal failed for ${asset.name}`);
        }
      }

      processingSteps.push("uploaded_canonical");
      const canonicalUrl = await uploadCanonicalTask8Asset({
        bytes: canonicalBytes,
        contentType: canonicalContentType,
        gameName: game.name,
        warRoomId: args.warRoomId,
        assetName: asset.name,
        index,
      });

      return {
        ...asset,
        url_or_base64: canonicalUrl,
        processed_url: canonicalUrl,
        background_removed: backgroundRemoved,
        delivery_kind: deliveryKind,
        processing_steps: dedupeStrings(processingSteps),
      } satisfies Task8Asset;
    }),
  );

  const phases = new Set<string>((args.output.iteration_phases_completed as string[] | undefined) ?? []);
  if (processedAssets.some((asset) => asset.delivery_kind === "isolated_sprite")) {
    phases.add("background_removal");
  }
  if (processedAssets.some((asset) => asset.delivery_kind !== "isolated_sprite")) {
    phases.add("environment");
  }
  if (processedAssets.some((asset) => asset.type === "effect")) {
    phases.add("effects");
  }

  const notes = ((args.output.notes as string[] | undefined) ?? []).slice();
  notes.push(
    `${processedAssets.length} Task 8 asset${processedAssets.length === 1 ? "" : "s"} uploaded to canonical bundle storage for ${getRuntimeName(args.gameFormat)} runtime delivery.`,
  );

  return {
    ...args.output,
    assets_created: processedAssets,
    iteration_phases_completed: [...phases],
    notes: dedupeStrings(notes),
  };
}

/**
 * Extract a JSON object from an LLM response that may include markdown code
 * fences, preamble prose, or trailing explanation text.
 *
 * Strategy (in order):
 *  1. Bare JSON parse — fastest path when the model behaved perfectly.
 *  2. Strip a single ```json … ``` or ``` … ``` code fence, then parse.
 *  3. Scan for the outermost { … } block in the text and parse that.
 */
function extractJsonFromText(text: string): Record<string, unknown> {
  const trimmed = text.trim();

  // 1. Direct parse
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    // continue
  }

  // 2. Strip markdown code fence
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch?.[1]) {
    try {
      return JSON.parse(fenceMatch[1].trim()) as Record<string, unknown>;
    } catch {
      // continue
    }
  }

  // 3. Find outermost { … } in the text
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start !== -1 && end > start) {
    try {
      return JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>;
    } catch {
      // continue
    }
  }

  // All strategies failed — return a sentinel so validation produces a clear error
  return { raw_response: text };
}

/** Schema map for output validation — tasks not listed here accept any JSON. */
const OUTPUT_SCHEMAS: Record<number, import("zod").ZodSchema> = {
  1: Task1OutputSchema,
  2: Task2OutputSchema,
  3: Task3OutputSchema,
  4: Task4OutputSchema,
  5: Task5OutputSchema,
  6: Task6OutputSchema,
  7: Task7OutputSchema,
  8: Task8OutputSchema,
  9: CheckerValidationOutputSchema,
  10: Task10OutputSchema,
  11: CheckerValidationOutputSchema,
};

/** Find tasks whose dependencies are all completed. */
export function getNextRunnableTasks(tasks: WarRoomTask[]): WarRoomTask[] {
  const tasksByNumber = new Map(tasks.map((task) => [task.task_number, task]));

  return tasks.filter((t) => {
    if (t.status !== "pending" && t.status !== "assigned") return false;
    return t.depends_on.every((dep) =>
      isDependencySatisfied(t.task_number, dep, tasksByNumber)
    );
  });
}

export interface TaskDependencySnapshot {
  waitingOn: number[];
  resolvedDependencies: number[];
  isReady: boolean;
}

export interface TaskGraphTransition {
  taskNumber: number;
  status: Extract<TaskStatus, "assigned" | "blocked">;
  dependsOn: number[];
  waitingOn: number[];
  resolvedDependencies: number[];
}

function getTaskDependencySnapshot(
  task: WarRoomTask,
  tasksByNumber: Map<number, WarRoomTask>
): TaskDependencySnapshot {
  const waitingOn: number[] = [];
  const resolvedDependencies: number[] = [];

  for (const dependencyNumber of task.depends_on) {
    if (isDependencySatisfied(task.task_number, dependencyNumber, tasksByNumber)) {
      resolvedDependencies.push(dependencyNumber);
    } else {
      waitingOn.push(dependencyNumber);
    }
  }

  return {
    waitingOn,
    resolvedDependencies,
    isReady: waitingOn.length === 0,
  };
}

export function getTaskGraphTransitions(tasks: WarRoomTask[]): TaskGraphTransition[] {
  const tasksByNumber = new Map(tasks.map((task) => [task.task_number, task]));

  return tasks.flatMap((task) => {
    if (task.status === "running" || task.status === "completed" || task.status === "failed") {
      return [];
    }

    const snapshot = getTaskDependencySnapshot(task, tasksByNumber);
    const status: Extract<TaskStatus, "assigned" | "blocked"> = snapshot.isReady
      ? "assigned"
      : "blocked";

    if (task.status === status) {
      return [];
    }

    return [{
      taskNumber: task.task_number,
      status,
      dependsOn: task.depends_on,
      waitingOn: snapshot.waitingOn,
      resolvedDependencies: snapshot.resolvedDependencies,
    }];
  });
}

async function syncTaskGraphStates(
  warRoomId: string,
  tasks: WarRoomTask[]
): Promise<WarRoomTask[]> {
  const transitions = getTaskGraphTransitions(tasks);
  if (transitions.length === 0) return tasks;

  const updatedTasks = new Map(tasks.map((task) => [task.task_number, task]));

  for (const transition of transitions) {
    const updatedTask = await warrooms.updateTaskStatus(
      warRoomId,
      transition.taskNumber,
      transition.status,
      undefined,
      {
        depends_on: transition.dependsOn,
        waiting_on: transition.waitingOn,
        resolved_dependencies: transition.resolvedDependencies,
        ...(transition.status === "assigned"
          ? { ready_at: new Date().toISOString() }
          : {}),
      }
    );
    updatedTasks.set(transition.taskNumber, updatedTask);
  }

  return tasks.map((task) => updatedTasks.get(task.task_number) ?? task);
}

/** Check if all tasks are in a terminal state. */
export function isPipelineComplete(tasks: WarRoomTask[]): boolean {
  return tasks.every(
    (t) => t.status === "completed" || t.status === "failed"
  );
}

/**
 * When a task fails permanently, any downstream task that is still "blocked"
 * and can never become runnable (all its deps are now completed or failed)
 * must be auto-skipped. Without this the pipeline deadlocks: isPipelineComplete
 * stays false while getNextRunnableTasks returns [] indefinitely.
 */
async function autoSkipPermanentlyBlockedTasks(
  warRoomId: string,
  failedTaskNumber: number
): Promise<void> {
  // Re-fetch tasks so we have the latest statuses (the failed task was just updated)
  const latestTasks = await warrooms.getTasks(warRoomId);
  const byNumber = new Map(latestTasks.map((t) => [t.task_number, t]));

  const toSkip = latestTasks.filter((t) => {
    if (t.status !== "blocked") return false;
    // All dependencies must be terminal (completed or failed)
    return t.depends_on.every((dep) => {
      const depTask = byNumber.get(dep);
      return depTask?.status === "completed" || depTask?.status === "failed";
    });
  });

  for (const blockedTask of toSkip) {
    const skipOutput = {
      status: "completed",
      skipped: true,
      reason: `Auto-skipped: dependency task #${failedTaskNumber} failed permanently`,
    };
    await warrooms.updateTaskStatus(warRoomId, blockedTask.task_number, "completed", skipOutput);
    void safeRecord("task_auto_skipped event", () =>
      warrooms.recordEvent(warRoomId, "task_skipped", blockedTask.assigned_agent ?? "jarvis", blockedTask.task_number, {
        reason: `Dependency task #${failedTaskNumber} failed permanently`,
        blocked_by: failedTaskNumber,
      })
    );
    console.log("[orchestrator] auto-skipped permanently blocked task", {
      warRoomId,
      taskNumber: blockedTask.task_number,
      blockedBy: failedTaskNumber,
    });
  }
}

/** Collect outputs from completed dependency tasks. */
function gatherDependencyOutputs(
  task: WarRoomTask,
  tasks: WarRoomTask[]
): Record<string, unknown> {
  const outputs: Record<string, unknown> = {};
  for (const depNum of task.depends_on) {
    const dep = tasks.find((t) => t.task_number === depNum);
    if (dep?.output) {
      outputs[`task_${depNum}`] = dep.output;
    }
  }
  return outputs;
}

function isDependencySatisfied(
  taskNumber: number,
  dependencyNumber: number,
  tasksByNumber: Map<number, WarRoomTask>
): boolean {
  const dependency = tasksByNumber.get(dependencyNumber);
  if (!dependency) return false;
  if (dependency.status === "completed") return true;

  return (
    taskNumber === 10 &&
    dependencyNumber === 9 &&
    dependency.status === "failed"
  );
}

function getLatestValidationOutputs(
  tasks: WarRoomTask[]
): Record<string, unknown> {
  const outputs: Record<string, unknown> = {};

  for (const taskNumber of [11, 9]) {
    const task = tasks.find((candidate) => candidate.task_number === taskNumber);
    if (task?.output) {
      outputs[`task_${taskNumber}_latest_validation`] = task.output;
    }
  }

  return outputs;
}

/** Simple in-memory cache for deterministic validation (10s TTL). */
const validationCache = new Map<string, { report: ValidationReport; timestamp: number }>();
const VALIDATION_CACHE_TTL_MS = 10_000;

async function runDeterministicValidation(
  gameId: string,
  gameSpecs?: AtomValidationSpecs | null,
  bustCache = false,
): Promise<ValidationReport> {
  const cacheKey = `${gameId}:${gameSpecs ? "with-specs" : "no-specs"}`;
  const cached = validationCache.get(cacheKey);
  if (!bustCache && cached && Date.now() - cached.timestamp < VALIDATION_CACHE_TTL_MS) {
    return cached.report;
  }

  const supabase = getSupabaseClient();

  const { data: atoms, error: atomsError } = await supabase
    .from("atoms")
    .select("name, type, code, description, inputs, outputs")
    .eq("game_id", gameId);
  if (atomsError) {
    throw new Error(`Failed to fetch atoms for validation: ${atomsError.message}`);
  }

  const { data: deps, error: depsError } = await supabase
    .from("atom_dependencies")
    .select("atom_name, depends_on")
    .eq("game_id", gameId);
  if (depsError) {
    throw new Error(`Failed to fetch dependencies for validation: ${depsError.message}`);
  }

  const a = atoms || [];
  const d = deps || [];

  const reports = [
    validateStructuralRules(a, d),
    validateScoreSystemRules(a, d),
    validateInterfaceCompatibility(a, d),
    validateReachability(a, d),
    validateCodeQuality(a),
  ];

  if (gameSpecs) {
    reports.push(validateGameSpecificRules(a, d, gameSpecs));
  }

  const report = mergeValidationReports(...reports);
  validationCache.set(cacheKey, { report, timestamp: Date.now() });
  return report;
}

/**
 * Dispatch a task to a Mastra agent.
 * Replaces the old OpenClaw gateway dispatch with local agent.generate() calls.
 */
async function dispatchToAgent(
  task: WarRoomTask,
  context: Record<string, unknown>,
  warRoomId: string
): Promise<DispatchResult> {
  const agentName = task.assigned_agent;
  if (!agentName) {
    return { success: false, error: "No agent assigned to task" };
  }

  const genre = context.genre as string | null | undefined;
  const gameFormat = (context.game_format as "2d" | "3d" | null | undefined) ?? null;
  const systemPrompt = getAgentSystemPrompt(agentName, genre, gameFormat, task.task_number);
  const maxSteps = task.task_number === 2 ? 10
    : task.task_number === 10 ? 40
    : agentName === "forge" ? 25
    : agentName === "pixel" ? 5   // get-code-structure + 1-3 generate-polished-visual-pack calls + output
    : agentName === "jarvis" ? 15
    : 10;

  // Pre-dispatch token budget guard: progressively compact the prompt until it fits.
  // sanitizeDependencyOutput() in prompts.ts is the primary defence; compaction levels
  // provide a secondary safety net by stripping scope/dep sections progressively.
  let compactLevel = 0;
  let taskPrompt = buildTaskPrompt(task, context, compactLevel);
  let promptTokenEstimate = estimateTokens(taskPrompt + systemPrompt);

  while (promptTokenEstimate > PROMPT_TOKEN_BUDGET && compactLevel < 4) {
    compactLevel++;
    console.warn("[orchestrator] prompt exceeds token budget — compacting", {
      taskNumber: task.task_number,
      agent: agentName,
      compactLevel,
      promptTokenEstimate,
      budget: PROMPT_TOKEN_BUDGET,
    });
    taskPrompt = buildTaskPrompt(task, context, compactLevel);
    promptTokenEstimate = estimateTokens(taskPrompt + systemPrompt);
  }

  // Last-resort blind trim if compaction levels weren't enough
  if (promptTokenEstimate > PROMPT_TOKEN_BUDGET) {
    console.warn("[orchestrator] prompt still over budget after compaction — trimming", {
      taskNumber: task.task_number,
      agent: agentName,
      compactLevel,
      promptTokenEstimate,
      budget: PROMPT_TOKEN_BUDGET,
    });
    taskPrompt = trimPromptToTokenBudget(taskPrompt, PROMPT_TOKEN_BUDGET - estimateTokens(systemPrompt));
    promptTokenEstimate = estimateTokens(taskPrompt + systemPrompt);
  }

  console.log("[orchestrator] dispatching to agent", {
    taskNumber: task.task_number,
    title: task.title,
    agent: agentName,
    promptLength: taskPrompt.length,
    promptTokenEstimate,
    maxSteps,
    depKeys: Object.keys(context.dependency_outputs as Record<string, unknown> ?? {}),
  });

  const dispatchStart = Date.now();

  // Record an initial thinking event so the UI shows activity immediately
  void safeRecord("agent_thinking event", () =>
    warrooms.recordEvent(warRoomId, "agent_thinking", agentName, task.task_number, {
      title: task.title,
      phase: "starting",
      elapsed_seconds: 0,
    })
  );

  // Periodic heartbeat — only upsert heartbeat (no event write) to reduce DB noise.
  // Events are reserved for meaningful state transitions, not periodic pings.
  const heartbeatInterval = setInterval(async () => {
    const elapsed = Math.round((Date.now() - dispatchStart) / 1000);
    try {
      await warrooms.upsertHeartbeat(warRoomId, agentName, "working", {
        task_number: task.task_number,
        title: task.title,
        phase: "processing",
        elapsed_seconds: elapsed,
      });
    } catch (hbErr) {
      console.warn("[orchestrator] heartbeat update failed:", (hbErr as Error).message);
    }
  }, 10_000);

  try {
    const agent = mastra.getAgent(agentName);
    const result = await Promise.race([
      agent.generate(
        [{ role: "user" as const, content: taskPrompt }],
        {
          instructions: systemPrompt,
          maxSteps,
        }
      ),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Task timed out after ${TASK_TIMEOUT_MS / 1000}s`)),
          TASK_TIMEOUT_MS
        )
      ),
    ]);

    clearInterval(heartbeatInterval);

    // result.text is the LAST step's text only. When the model's final action is a tool
    // call (e.g. get-code-structure), result.text is "" — walk steps in reverse to find
    // the last non-empty text the model produced before parsing.
    const rawText =
      result.text?.trim() ||
      [...(result.steps ?? [])].reverse().find((s) => s.text?.trim())?.text?.trim() ||
      "";

    if (!rawText) {
      console.warn("[orchestrator] agent produced no text output", {
        taskNumber: task.task_number,
        agent: agentName,
        stepCount: result.steps?.length ?? 0,
      });
    }

    let output: Record<string, unknown> = extractJsonFromText(rawText);

    // Validate output against schema if one exists for this task
    const schema = OUTPUT_SCHEMAS[task.task_number];
    if (schema) {
      const parseResult = schema.safeParse(output);
      if (!parseResult.success) {
        const issues = (parseResult as any).error.issues
          .map((i: any) => `${i.path.join(".")}: ${i.message}`)
          .join("; ");
        console.error(`[orchestrator] task ${task.task_number} output validation failed`, {
          errors: (parseResult as any).error.issues,
          outputKeys: Object.keys(output),
          rawTextLength: rawText.length,
          rawTextPreview: rawText.slice(0, 200),
        });
        return {
          success: false,
          error: `Task ${task.task_number} output validation failed: ${issues}`,
        };
      }
      output = parseResult.data as unknown as Record<string, unknown>;
    }

    console.log("[orchestrator] agent completed", {
      taskNumber: task.task_number,
      agent: agentName,
      durationMs: Date.now() - dispatchStart,
      responseLength: rawText.length,
      outputKeys: Object.keys(output),
    });

    return { success: true, output };
  } catch (err) {
    clearInterval(heartbeatInterval);

    const errMsg = (err as Error).message ?? "";

    // Extract rich error info from AI SDK's APICallError
    let statusCode: number | undefined;
    let responseBody: string | undefined;
    let isRetryable: boolean | undefined;
    let retryAfter: string | undefined;

    if (APICallError.isInstance(err)) {
      statusCode = err.statusCode;
      responseBody = err.responseBody;
      isRetryable = err.isRetryable;
      retryAfter = err.responseHeaders?.["retry-after"];
    }

    const isContextOverflow =
      errMsg.includes("maximum context length") ||
      errMsg.includes("context_length_exceeded") ||
      errMsg.includes("context window") ||
      errMsg.includes("prompt is too long") ||
      (responseBody?.includes("prompt is too long") ?? false) ||
      (responseBody?.includes("context_length_exceeded") ?? false);

    // Context overflow is retryable — the orchestrator can compact the prompt and retry.
    // The SDK marks 400 errors as non-retryable, but overflow is a special case.
    if (isContextOverflow) {
      isRetryable = true;
    }

    console.error("[orchestrator] agent dispatch failed", {
      taskNumber: task.task_number,
      agent: agentName,
      durationMs: Date.now() - dispatchStart,
      isContextOverflow,
      promptTokenEstimate,
      error: errMsg,
      statusCode,
      isRetryable,
      retryAfter,
      responseBody: responseBody?.slice(0, 500),
    });

    if (isContextOverflow) {
      void safeRecord("context_overflow event", () =>
        warrooms.recordEvent(warRoomId, "context_overflow", agentName, task.task_number, {
          prompt_length_chars: taskPrompt.length,
          prompt_token_estimate: promptTokenEstimate,
          dep_keys: Object.keys(context.dependency_outputs as Record<string, unknown> ?? {}),
          error: errMsg,
        })
      );
    }

    const errorDetail = statusCode
      ? `Agent dispatch failed (HTTP ${statusCode}): ${errMsg}`
      : `Agent dispatch failed: ${errMsg}`;

    return {
      success: false,
      error: errorDetail,
      isRetryable,
      providerStatusCode: statusCode,
    };
  }
}

/**
 * Run the full war room pipeline.
 *
 * This is the main orchestration loop. It dispatches runnable tasks
 * in dependency order, waits for results, and repeats until done.
 */
export async function runPipeline(warRoomId: string): Promise<void> {
  const pipelineStart = Date.now();
  const room = await warrooms.getWarRoom(warRoomId);
  if (!room) throw new Error(`War room ${warRoomId} not found`);

  // Idempotency: skip if already running or completed/cancelled
  if (room.status === "running") {
    console.log("[orchestrator] pipeline already running, skipping", { warRoomId });
    return;
  }
  if (["completed", "cancelled"].includes(room.status)) {
    console.log("[orchestrator] pipeline already terminal, skipping", { warRoomId, status: room.status });
    return;
  }

  // Allow re-running a failed pipeline (e.g. remote trigger failed, local retry)
  if (room.status === "failed") {
    console.log("[orchestrator] resetting failed pipeline for re-run", { warRoomId });
    // Reset all task statuses back to pending
    const existingTasks = await warrooms.getTasks(warRoomId);
    for (const task of existingTasks) {
      if (task.status !== "completed") {
        await warrooms.updateTaskStatus(warRoomId, task.task_number, "pending");
      }
    }
    await warrooms.updateWarRoomStatus(warRoomId, "planning");
  }

  const initialTasks = await warrooms.getTasks(warRoomId);
  console.log("[orchestrator] pipeline starting", {
    warRoomId,
    gameId: room.game_id,
    genre: room.genre,
    promptPreview: room.prompt?.slice(0, 100),
    totalTasks: initialTasks.length,
  });

  // Mark war room as running
  await warrooms.updateWarRoomStatus(warRoomId, "running");
  void safeRecord("pipeline_started event", () =>
    warrooms.recordEvent(warRoomId, "pipeline_started", "jarvis", null, {
      totalTasks: initialTasks.length,
    })
  );
  void safeRecord("jarvis heartbeat", () =>
    warrooms.upsertHeartbeat(warRoomId, "jarvis", "working", {
      phase: "orchestrating",
    })
  );

  const retryMap = new Map<number, number>();
  // Cache completed task outputs so getWarRoom() doesn't need to re-serialize
  // large JSONB columns on every loop iteration for already-finished tasks.
  const taskOutputCache = new Map<number, Record<string, unknown> | null>();
  let iteration = 0;

  try {
    while (true) {
      iteration++;
      // Refresh war room + task state in a single query
      const currentRoom = await warrooms.getWarRoom(warRoomId);
      if (!currentRoom) throw new Error(`War room ${warRoomId} disappeared`);

      // Check for cancellation
      if (currentRoom.status === "cancelled") {
        console.log("[orchestrator] pipeline cancelled by user", { warRoomId });
        void safeRecord("jarvis idle heartbeat", () =>
          warrooms.upsertHeartbeat(warRoomId, "jarvis", "idle")
        );
        return;
      }

      // Check for pipeline timeout
      if (Date.now() - pipelineStart >= PIPELINE_TIMEOUT_MS) {
        console.error("[orchestrator] pipeline timed out", {
          warRoomId,
          durationMs: Date.now() - pipelineStart,
        });
        await warrooms.updateWarRoomStatus(warRoomId, "failed");
        void safeRecord("pipeline_timeout event", () =>
          warrooms.recordEvent(warRoomId, "pipeline_timeout", "jarvis", null, {
            timeout_ms: PIPELINE_TIMEOUT_MS,
            elapsed_ms: Date.now() - pipelineStart,
          })
        );
        void safeRecord("jarvis error heartbeat", () =>
          warrooms.upsertHeartbeat(warRoomId, "jarvis", "error", {
            error: "Pipeline timed out after 20 minutes",
          })
        );
        return;
      }

      const tasks = await syncTaskGraphStates(warRoomId, currentRoom.tasks);
      // Restore completed task outputs from cache — avoids re-reading large JSONB
      // from DB on every iteration for tasks whose output never changes.
      for (const t of tasks) {
        if (t.status === "completed" && taskOutputCache.has(t.task_number)) {
          t.output = taskOutputCache.get(t.task_number) ?? null;
        }
      }
      const statusCounts = tasks.reduce(
        (acc, t) => { acc[t.status] = (acc[t.status] || 0) + 1; return acc; },
        {} as Record<string, number>
      );
      console.log(`[orchestrator] iteration ${iteration}`, { warRoomId, statusCounts });

      // Keep Jarvis heartbeat alive while orchestrating
      void safeRecord("jarvis orchestrating heartbeat", () =>
        warrooms.upsertHeartbeat(warRoomId, "jarvis", "working", {
          phase: "orchestrating",
          iteration,
          elapsed_seconds: Math.round((Date.now() - pipelineStart) / 1000),
        })
      );

      if (isPipelineComplete(tasks)) {
        console.log("[orchestrator] pipeline complete", { warRoomId });
        break;
      }

      const runnable = getNextRunnableTasks(tasks);

      if (runnable.length === 0) {
        const hasRunning = tasks.some((t) => t.status === "running");
        if (!hasRunning) {
          console.error(
            "[orchestrator] pipeline stuck: no runnable or running tasks",
            { warRoomId, statusCounts }
          );
          await warrooms.updateWarRoomStatus(warRoomId, "failed");
          void safeRecord("pipeline_stuck event", () =>
            warrooms.recordEvent(
              warRoomId,
              "pipeline_stuck",
              "jarvis",
              null,
              { reason: "No runnable or running tasks — dependency deadlock", statusCounts }
            )
          );
          return;
        }
        // Tasks are still running — adaptive polling (fast early, slower later)
        const pollDelay = iteration <= 5 ? 100 : iteration <= 20 ? 300 : 500;
        await sleep(pollDelay);
        continue;
      }

      // Dispatch all runnable tasks (some can run in parallel, e.g. tasks 7+8)
      console.log("[orchestrator] dispatching runnable tasks", {
        warRoomId,
        tasks: runnable.map((t) => `#${t.task_number} ${t.title} → ${t.assigned_agent}`),
      });

      const dispatches = runnable.map(async (task) => {
        // Skip Task 8 (sprite generation) for 3D games — no 2D sprites needed
        if (task.task_number === 8 && currentRoom.game_format === "3d") {
          const skipOutput = {
            status: "completed",
            skipped: true,
            reason: "3D games do not use 2D sprites — Task 8 auto-completed.",
            art_direction: "N/A — 3D game, sprites skipped",
            assets_created: [],
            generation_model: "none",
            sprite_manifest: [],
            iteration_phases_completed: [],
            notes: ["Task 8 skipped: 3D games use 3D models and assets instead of 2D sprites."],
          };
          await warrooms.updateTaskStatus(warRoomId, 8, "completed", skipOutput);
          void safeRecord("task_skipped event", () =>
            warrooms.recordEvent(warRoomId, "task_skipped", "pixel", 8, {
              reason: "3D games do not use 2D sprites",
            })
          );
          console.log("[orchestrator] Task 8 skipped for 3D game", { warRoomId });
          return;
        }

        const agent = task.assigned_agent;
        if (!agent) {
          console.error("[orchestrator] task has no assigned agent", {
            warRoomId,
            taskNumber: task.task_number,
          });
          return;
        }

        // Mark running + heartbeat
        await warrooms.updateTaskStatus(
          warRoomId,
          task.task_number,
          "running",
          undefined,
          {
            depends_on: task.depends_on,
            waiting_on: [],
            resolved_dependencies: task.depends_on,
          }
        );
        void safeRecord(`${agent} dispatching heartbeat`, () =>
          warrooms.upsertHeartbeat(warRoomId, agent, "working", {
            task_number: task.task_number,
            title: task.title,
            phase: "dispatching",
          })
        );

        // Build context from dependency outputs
        const depOutputs = gatherDependencyOutputs(task, tasks);
        const context: Record<string, unknown> = {
          game_id: currentRoom.game_id,
          genre: currentRoom.genre,
          game_format: currentRoom.game_format,
          runtime: getRuntimeName(currentRoom.game_format),
          prompt: currentRoom.prompt,
          scope: currentRoom.scope,
          dependency_outputs: depOutputs,
        };

        // Fetch active externals for this game and inject into context.
        // Fetched per-task so post-Task-2 seeding is reflected for downstream tasks.
        // Pixel tasks (7, 8) skip this — they generate images, not code.
        if (task.task_number !== 7 && task.task_number !== 8) {
          const { data: extRows } = await getSupabaseClient()
            .from("game_externals")
            .select(
              "external_registry(name, display_name, global_name, version, cdn_url, load_type, api_surface)"
            )
            .eq("game_id", currentRoom.game_id);
          context.installed_externals = (extRows || [])
            .map((row: any) => row.external_registry)
            .filter(Boolean);
        }
        const latestValidationOutputs =
          task.task_number === 10 ? getLatestValidationOutputs(tasks) : {};
        if (Object.keys(latestValidationOutputs).length > 0) {
          context.latest_validation_outputs = latestValidationOutputs;
        }

        // Expanded context for Task 10: implementation outputs + diagnostic events
        if (task.task_number === 10) {
          // Gather outputs from Tasks 3/4/5/6 (summary only to control prompt size)
          for (const supplementaryTask of [3, 4, 5, 6]) {
            const t = tasks.find((c) => c.task_number === supplementaryTask);
            if (t?.output && !depOutputs[`task_${supplementaryTask}`]) {
              const output = t.output as Record<string, unknown>;
              // Include only summary fields to avoid bloating the context
              depOutputs[`task_${supplementaryTask}`] = {
                status: output.status,
                atoms_created: output.atoms_created,
                atoms_modified: output.atoms_modified,
                notes: output.notes,
                ...(supplementaryTask === 3 ? { validation_specs: output.validation_specs } : {}),
              };
            }
          }

          // Fetch diagnostic events from earlier tasks
          const diagnosticEvents = await warrooms.getWarRoomEvents(warRoomId, {
            eventTypes: [
              "post_task_validation",
              "scope_complexity_warning",
              "deterministic_validation",
              "task_retry",
              "retry_cycle",
              "smart_retry_cycle",
              "post_fix_validation",
            ],
            limit: 30,
          });
          context.pipeline_diagnostic_events = diagnosticEvents.map((e) => ({
            event_type: e.event_type,
            task_number: e.task_number,
            payload: e.payload,
            created_at: e.created_at,
          }));
        }

        // Pre-dispatch: deterministic validation for Tasks 9/11
        if (task.task_number === 9 || task.task_number === 11) {
          const task3 = tasks.find((t) => t.task_number === 3);
          const gameSpecs = task3?.output?.validation_specs as AtomValidationSpecs | undefined;

          const deterministicReport = await runDeterministicValidation(
            currentRoom.game_id,
            gameSpecs ?? null,
          );
          context.deterministic_validation = deterministicReport;

          console.log("[orchestrator] deterministic pre-check for task", {
            warRoomId,
            taskNumber: task.task_number,
            passed: deterministicReport.passed,
            failureCount: deterministicReport.failures.length,
            summary: deterministicReport.summary,
          });

          // Persist deterministic report as event for debugging
          void safeRecord("deterministic_validation_report event", () =>
            warrooms.recordEvent(warRoomId, "deterministic_validation_report", agent, task.task_number, {
              passed: deterministicReport.passed,
              failure_count: deterministicReport.failures.length,
              summary: deterministicReport.summary,
              failures: deterministicReport.failures.slice(0, 15),
            })
          );

          // Short-circuit Task 11 (final pass) when all deterministic checks pass
          if (task.task_number === 11 && deterministicReport.passed) {
            const warningIssues = deterministicReport.failures.filter((f) => f.severity === "warning");
            await warrooms.updateTaskStatus(warRoomId, task.task_number, "completed", {
              status: "completed",
              passed: true,
              failures: [],
              deterministic_report: deterministicReport,
              warning_issues: warningIssues,
              notes: warningIssues.length > 0
                ? `Passed with ${warningIssues.length} warning(s) — skipped LLM validation`
                : "All deterministic checks passed — skipped LLM validation",
            });
            void safeRecord(`${agent} idle heartbeat`, () =>
              warrooms.upsertHeartbeat(warRoomId, agent, "idle")
            );
            void safeRecord("validation_shortcircuit event", () =>
              warrooms.recordEvent(warRoomId, "validation_shortcircuit", agent, task.task_number, {
                reason: "deterministic_passed",
              })
            );
            return;
          }
        }

        // Pre-dispatch: deterministic validation snapshot for Task 10
        if (task.task_number === 10) {
          const task3 = tasks.find((t) => t.task_number === 3);
          const gameSpecs = task3?.output?.validation_specs as AtomValidationSpecs | undefined;

          const preFixReport = await runDeterministicValidation(
            currentRoom.game_id,
            gameSpecs ?? null,
          );
          context.deterministic_validation = preFixReport;
          context.pre_fix_failure_count = preFixReport.failures.length;

          const criticalFailures = preFixReport.failures.filter((f) =>
            ["no_cycles", "required_atom", "required_score_tracker", "dependency_exists", "duplicate_atom_name"].includes(f.rule)
          );

          console.log("[orchestrator] pre-fix deterministic snapshot for task 10", {
            warRoomId,
            passed: preFixReport.passed,
            failureCount: preFixReport.failures.length,
            criticalCount: criticalFailures.length,
          });

          // Short-circuit: if deterministic checks already pass, skip Task 10
          if (preFixReport.passed) {
            await warrooms.updateTaskStatus(warRoomId, task.task_number, "completed", {
              status: "completed",
              atoms_fixed: [],
              atoms_created: [],
              fixes_detail: [],
              failures_addressed: 0,
              failures_remaining: [],
              pre_fix_snapshot: { total_failures: 0, critical_failures: 0, warning_failures: 0 },
              notes: "All deterministic checks already pass — no fixes needed",
            });
            void safeRecord(`${agent} idle heartbeat`, () =>
              warrooms.upsertHeartbeat(warRoomId, agent, "idle")
            );
            void safeRecord("fix_shortcircuit event", () =>
              warrooms.recordEvent(warRoomId, "fix_shortcircuit", agent, task.task_number, {
                reason: "deterministic_passed",
              })
            );
            return;
          }
        }

        // Pre-dispatch: deterministic boilerplate seeding for Task 2
        if (task.task_number === 2) {
          const task1 = tasks.find((t) => t.task_number === 1);
          const scopeGenre = (task1?.output?.scope as Record<string, unknown>)?.genre as string | undefined;
          const genre = scopeGenre || currentRoom.genre || "custom";

          const seedReport = await ensureBoilerplateSeeded(
            currentRoom.game_id,
            genre,
            currentRoom.game_format,
          );
          void safeRecord("boilerplate_seeded event", () =>
            warrooms.recordEvent(warRoomId, "boilerplate_seeded", "forge", 2, {
              seeded: seedReport.seeded,
              already_existed: seedReport.already_existed,
              externals: seedReport.externals_installed,
            })
          );
          context.seeded_atoms = seedReport.seeded.concat(seedReport.already_existed);
          context.boilerplate_atoms = seedReport.boilerplate_atoms;

          console.log("[orchestrator] boilerplate seeded for task 2", {
            warRoomId,
            genre,
            seeded: seedReport.seeded.length,
            alreadyExisted: seedReport.already_existed.length,
          });
        }

        // Dispatch to Mastra agent.
        // Pixel tasks (7 & 8) run inside a scoped AsyncLocalStorage context so
        // generate-polished-visual-pack writes asset data to a per-run registry
        // bucket instead of embedding it in the conversation history.
        const taskStart = Date.now();
        const isPixelTask = task.task_number === 7 || task.task_number === 8;
        const result = isPixelTask
          ? await runWithPixelContext(warRoomId, () => dispatchToAgent(task, context, warRoomId))
          : await dispatchToAgent(task, context, warRoomId);

        const taskDurationMs = Date.now() - taskStart;

        // Resolve pixel asset registry keys → real URLs before persisting output.
        // Must run for BOTH task 7 (UI assets) and task 8 (sprites), and for
        // task 8 it must happen BEFORE processTask8Output which fetches the URLs.
        if (result.success && isPixelTask && result.output) {
          result.output = resolvePixelAssetKeys(result.output, warRoomId);
        }

        // Free the run's registry memory immediately after each pixel task's keys
        // are resolved. Task 7 and task 8 run sequentially (8 depends on 7) and each
        // generates fresh pxl_ref_* keys, so clearing after resolution is safe.
        // Clearing per-task (rather than only after task 8) prevents a memory leak
        // when task 8 is auto-skipped because a dependency failed permanently.
        if (isPixelTask) {
          clearPixelRegistryForRun(warRoomId);
        }

        // Task 7 post-processing: upload any base64 data URIs to Supabase so that
        // Task 8's dependency_outputs never contains raw image blobs (context overflow root cause).
        if (result.success && task.task_number === 7 && result.output) {
          try {
            result.output = await processTask7Output({
              gameId: currentRoom.game_id,
              output: result.output,
              warRoomId,
            });
            const uiAssets = (result.output.assets_created as Array<Record<string, unknown>> | undefined) ?? [];
            void safeRecord("task7_assets_processed event", () =>
              warrooms.recordEvent(warRoomId, "task7_assets_processed", "pixel", 7, {
                asset_count: uiAssets.length,
              })
            );
          } catch (error) {
            // Non-fatal: log the failure but don't abort the pipeline.
            // The sanitizeDependencyOutput guard in prompts.ts is the primary protection;
            // this upload is a secondary hardening step.
            console.warn("[orchestrator] Task 7 asset post-processing failed (non-fatal)", {
              warRoomId,
              error: (error as Error).message,
            });
          }
        }

        if (result.success && task.task_number === 8 && result.output) {
          try {
            result.output = await processTask8Output({
              gameFormat: currentRoom.game_format,
              gameId: currentRoom.game_id,
              output: result.output,
              warRoomId,
            });

            const processedAssets = (result.output.assets_created as Task8Asset[] | undefined) ?? [];
            void safeRecord("task8_assets_processed event", () =>
              warrooms.recordEvent(warRoomId, "task8_assets_processed", "pixel", 8, {
                asset_count: processedAssets.length,
                background_removed_count: processedAssets.filter((asset) => asset.background_removed).length,
              })
            );
          } catch (error) {
            result.success = false;
            result.error = `Task 8 asset post-processing failed: ${(error as Error).message}`;
          }
        }

        // Post-Task 6 gate: deterministic validation before accepting core atoms
        if (result.success && task.task_number === 6) {
          const task3 = tasks.find((t) => t.task_number === 3);
          const gameSpecs = task3?.output?.validation_specs as AtomValidationSpecs | undefined;
          const detReport = await runDeterministicValidation(currentRoom.game_id, gameSpecs ?? null);

          void safeRecord("deterministic_validation event", () =>
            warrooms.recordEvent(warRoomId, "deterministic_validation", "forge", 6, {
              passed: detReport.passed,
              failure_count: detReport.failures.length,
              failures: detReport.failures.slice(0, 10),
            })
          );

          if (!detReport.passed) {
            const failureSummary = detReport.failures
              .map((f) => `${f.atom}: [${f.rule}] ${f.message}`)
              .join("\n");
            console.warn("[orchestrator] post-task-6 deterministic validation failed", {
              warRoomId,
              failureCount: detReport.failures.length,
            });
            result.success = false;
            result.error = `Deterministic validation failed after core atoms:\n${failureSummary}`;
            result.output = {
              ...result.output,
              deterministic_validation_failures: detReport.failures,
            };
          }
        }

        if (result.success) {
          // Cache output before writing to DB — downstream iterations read from cache.
          taskOutputCache.set(task.task_number, result.output ?? null);
          await warrooms.updateTaskStatus(
            warRoomId,
            task.task_number,
            "completed",
            { ...result.output, _duration_ms: taskDurationMs }
          );
          void safeRecord(`${agent} idle heartbeat`, () =>
            warrooms.upsertHeartbeat(warRoomId, agent, "idle")
          );

          // Record task metrics
          void safeRecord("task_metrics event", () =>
            warrooms.recordEvent(warRoomId, "task_metrics", agent, task.task_number, {
              duration_ms: taskDurationMs,
              response_length: result.output ? JSON.stringify(result.output).length : 0,
              atoms_created: (result.output?.atoms_created as string[])?.length ?? 0,
              attempt: (retryMap.get(task.task_number) ?? 0) + 1,
              success: true,
            })
          );

          // Propagate task 1 scope to war_rooms row for downstream context
          if (task.task_number === 1 && result.output?.scope) {
            const supabase = getSupabaseClient();
            await supabase
              .from("war_rooms")
              .update({ scope: result.output.scope })
              .eq("id", warRoomId);

            // Log complexity warning if scope is over-ambitious
            const scope = result.output.scope as Task1Scope;
            if (scope.complexity?.total_atoms > 20) {
              console.warn("[orchestrator] task 1 scope may be over-ambitious", {
                totalAtoms: scope.complexity.total_atoms,
                difficulty: scope.complexity.estimated_difficulty,
              });
              void safeRecord("scope_complexity_warning event", () =>
                warrooms.recordEvent(warRoomId, "scope_complexity_warning", "jarvis", 1, {
                  total_atoms: scope.complexity.total_atoms,
                  estimated_difficulty: scope.complexity.estimated_difficulty,
                })
              );
            }

            console.log("[orchestrator] scope propagated to war_room", {
              warRoomId,
              totalAtoms: scope.complexity?.total_atoms,
              genre: scope.genre,
            });
          }

          // Propagate task 3 validation specs to war_rooms scope for downstream access
          if (task.task_number === 3 && result.output?.validation_specs) {
            const supabase = getSupabaseClient();
            const currentRoom = await warrooms.getWarRoom(warRoomId);
            await supabase
              .from("war_rooms")
              .update({
                scope: {
                  ...(currentRoom?.scope || {}),
                  validation_specs: result.output.validation_specs,
                },
              })
              .eq("id", warRoomId);

            console.log("[orchestrator] validation specs propagated to war_room", {
              warRoomId,
              requiredAtoms: (result.output.validation_specs as ValidationSpecs).required_atoms?.length,
            });
          }

          // Post-task deterministic validation for Forge implementation tasks (4/5/6)
          // Catches critical issues (cycles, missing required atoms) early before downstream tasks build on broken foundations
          if ([4, 5, 6].includes(task.task_number)) {
            try {
              const task3 = tasks.find((t) => t.task_number === 3);
              const gameSpecs = task3?.output?.validation_specs as AtomValidationSpecs | undefined;
              const postReport = await runDeterministicValidation(currentRoom.game_id, gameSpecs ?? null);
              if (!postReport.passed) {
                const critical = postReport.failures.filter((f) =>
                  ["no_cycles", "required_atom", "duplicate_atom_name"].includes(f.rule)
                );
                void safeRecord("post_task_validation event", () =>
                  warrooms.recordEvent(warRoomId, "post_task_validation", agent, task.task_number, {
                    passed: false,
                    failure_count: postReport.failures.length,
                    critical_count: critical.length,
                    failures: postReport.failures,
                  })
                );
                if (critical.length > 0) {
                  console.warn("[orchestrator] post-task validation found critical issues", {
                    warRoomId, taskNumber: task.task_number,
                    critical: critical.map((f) => f.message),
                  });
                  await warrooms.updateTaskStatus(warRoomId, task.task_number, "failed", {
                    error: `Post-task validation: ${critical.map((f) => f.message).join("; ")}`,
                  });
                  void safeRecord(`${agent} error heartbeat`, () =>
                    warrooms.upsertHeartbeat(warRoomId, agent, "error", {
                      error: "Post-task validation failed",
                    })
                  );
                  return;
                }
              } else {
                console.log("[orchestrator] post-task validation passed", {
                  warRoomId, taskNumber: task.task_number, atomCount: postReport.atom_count,
                });
              }
            } catch (valErr) {
              console.warn("[orchestrator] post-task validation error (non-fatal)", {
                warRoomId, taskNumber: task.task_number, error: (valErr as Error).message,
              });
            }
          }

          // Post-fix deterministic validation gate for Task 10
          if (result.success && task.task_number === 10) {
            try {
              const task3 = tasks.find((t) => t.task_number === 3);
              const gameSpecs = task3?.output?.validation_specs as AtomValidationSpecs | undefined;
              const postFixReport = await runDeterministicValidation(currentRoom.game_id, gameSpecs ?? null);

              void safeRecord("post_fix_validation event", () =>
                warrooms.recordEvent(warRoomId, "post_fix_validation", "forge", 10, {
                  passed: postFixReport.passed,
                  failure_count: postFixReport.failures.length,
                  failures: postFixReport.failures.slice(0, 15),
                  pre_fix_count: context.pre_fix_failure_count ?? null,
                })
              );

              if (postFixReport.passed) {
                result.output = {
                  ...result.output,
                  post_fix_snapshot: { total_failures: 0, critical_failures: 0, warning_failures: 0 },
                };
                await warrooms.updateTaskStatus(warRoomId, task.task_number, "completed", {
                  ...result.output,
                  _duration_ms: taskDurationMs,
                });
                console.log("[orchestrator] post-fix validation passed", { warRoomId });
              } else {
                const critical = postFixReport.failures.filter((f) =>
                  ["no_cycles", "required_atom", "required_score_tracker", "dependency_exists", "duplicate_atom_name"].includes(f.rule)
                );

                if (critical.length > 0) {
                  console.warn("[orchestrator] post-fix validation found critical issues", {
                    warRoomId,
                    criticalCount: critical.length,
                    totalRemaining: postFixReport.failures.length,
                  });
                  result.success = false;
                  result.error = `Post-fix validation: ${critical.map((f) => f.message).join("; ")}`;
                  result.output = {
                    ...result.output,
                    post_fix_validation_failures: postFixReport.failures,
                  };
                  await warrooms.updateTaskStatus(warRoomId, task.task_number, "failed", {
                    error: result.error,
                    post_fix_validation_failures: postFixReport.failures,
                    _duration_ms: taskDurationMs,
                  });
                  void safeRecord(`${agent} error heartbeat`, () =>
                    warrooms.upsertHeartbeat(warRoomId, agent, "error", {
                      error: "Post-fix validation failed — critical issues remain",
                    })
                  );
                } else {
                  result.output = {
                    ...result.output,
                    post_fix_snapshot: {
                      total_failures: postFixReport.failures.length,
                      critical_failures: 0,
                      warning_failures: postFixReport.failures.length,
                    },
                  };
                  await warrooms.updateTaskStatus(warRoomId, task.task_number, "completed", {
                    ...result.output,
                    _duration_ms: taskDurationMs,
                  });
                  console.log("[orchestrator] post-fix validation: non-critical issues remain", {
                    warRoomId,
                    remainingCount: postFixReport.failures.length,
                  });
                }
              }
            } catch (valErr) {
              console.warn("[orchestrator] post-fix validation error (non-fatal)", {
                warRoomId, error: (valErr as Error).message,
              });
            }
          }
        }

        // Retry logic for failed tasks
        if (!result.success) {
          const taskRetries = retryMap.get(task.task_number) ?? 0;

          // Non-retryable provider error (auth failure, invalid model, bad request):
          // skip all retries and fail immediately. Strict === false check so that
          // non-provider errors (isRetryable === undefined) still go through normal retry.
          if (result.isRetryable === false) {
            console.error("[orchestrator] non-retryable provider error — skipping retries", {
              warRoomId,
              taskNumber: task.task_number,
              statusCode: result.providerStatusCode,
              error: result.error,
            });
            await warrooms.updateTaskStatus(
              warRoomId,
              task.task_number,
              "failed",
              { error: result.error, _duration_ms: taskDurationMs, non_retryable: true }
            );
            void safeRecord(`${agent} error heartbeat`, () =>
              warrooms.upsertHeartbeat(warRoomId, agent, "error", {
                error: result.error,
              })
            );
            await autoSkipPermanentlyBlockedTasks(warRoomId, task.task_number);
            return;
          }

          // Backoff delay for retryable provider errors (rate limit, server error).
          // Non-provider failures (isRetryable === undefined) retry immediately as before.
          if (result.isRetryable === true && taskRetries < MAX_TASK_RETRIES) {
            const delayMs = PROVIDER_RETRY_DELAY_MS[Math.min(taskRetries, PROVIDER_RETRY_DELAY_MS.length - 1)];
            console.log("[orchestrator] backing off before retry", {
              warRoomId,
              taskNumber: task.task_number,
              delayMs,
              attempt: taskRetries + 1,
              statusCode: result.providerStatusCode,
            });
            await sleep(delayMs);
          }

          if (task.task_number === 10 && taskRetries < MAX_RETRY_CYCLES) {
            retryMap.set(10, taskRetries + 1);

            // Check if we have post-fix deterministic failures for smart retry
            const postFixFailures = (result.output as Record<string, unknown>)?.post_fix_validation_failures;

            if (postFixFailures && taskRetries < 2) {
              // Smart retry: skip Task 9, retry Task 10 directly with deterministic data
              const task10Output = result.output || {};
              const previousRetryContext = (task.output as Record<string, unknown>)?._retry_context as Record<string, unknown> | undefined;
              const accumulatedHistory = [
                ...((previousRetryContext?.accumulated_fix_history as unknown[]) ?? []),
                { cycle: taskRetries + 1, fixes_attempted: (task10Output as Record<string, unknown>).atoms_fixed ?? [], error: result.error },
              ].slice(-MAX_RETRY_CYCLES);

              console.log("[orchestrator] smart retry: skipping Task 9, direct Task 10 retry", {
                warRoomId,
                cycle: taskRetries + 1,
                remainingFailures: (postFixFailures as unknown[]).length,
              });
              await warrooms.updateTaskStatus(warRoomId, 10, "assigned", {
                _retry_context: {
                  attempt: taskRetries + 1,
                  previous_error: result.error,
                  deterministic_failures: postFixFailures,
                  smart_retry: true,
                  accumulated_fix_history: accumulatedHistory,
                },
              }, {
                depends_on: [9],
                waiting_on: [],
                resolved_dependencies: [9],
                ready_at: new Date().toISOString(),
              });
              void safeRecord("smart_retry_cycle event", () =>
                warrooms.recordEvent(warRoomId, "smart_retry_cycle", "jarvis", 10, {
                  cycle: taskRetries + 1,
                  max: MAX_RETRY_CYCLES,
                  skipped_task_9: true,
                  remaining_failures: (postFixFailures as unknown[]).length,
                })
              );
            } else {
              // Full retry: reset Task 9 → Task 10 cycle
              console.log("[orchestrator] full retry cycle: re-running Task 9 → 10", {
                warRoomId,
                cycle: taskRetries + 1,
                error: result.error,
              });
              const task9 = tasks.find((candidate) => candidate.task_number === 9);
              if (task9) {
                await warrooms.updateTaskStatus(warRoomId, 9, "assigned", undefined, {
                  depends_on: task9.depends_on,
                  waiting_on: [],
                  resolved_dependencies: task9.depends_on,
                  ready_at: new Date().toISOString(),
                });
              }
              await warrooms.updateTaskStatus(warRoomId, 10, "blocked", undefined, {
                depends_on: [9],
                waiting_on: [9],
                resolved_dependencies: [],
              });
              void safeRecord("retry_cycle event", () =>
                warrooms.recordEvent(warRoomId, "retry_cycle", "jarvis", 10, {
                  cycle: taskRetries + 1,
                  max: MAX_RETRY_CYCLES,
                })
              );
            }
          } else if (task.task_number !== 10 && taskRetries < MAX_TASK_RETRIES) {
            // Generic retry for any other task — preserve partial output for context
            retryMap.set(task.task_number, taskRetries + 1);
            console.log("[orchestrator] retrying task", {
              warRoomId,
              taskNumber: task.task_number,
              attempt: taskRetries + 1,
              durationMs: taskDurationMs,
              error: result.error,
            });
            await warrooms.updateTaskStatus(
              warRoomId,
              task.task_number,
              "assigned",
              {
                _partial_output: result.output || {},
                _retry_reason: result.error,
                _duration_ms: taskDurationMs,
                _retry_context: {
                  attempt: taskRetries + 1,
                  previous_error: result.error,
                  deterministic_failures: (result.output as Record<string, unknown>)?.deterministic_validation_failures ?? null,
                },
              },
              {
                depends_on: task.depends_on,
                waiting_on: [],
                resolved_dependencies: task.depends_on,
                ready_at: new Date().toISOString(),
              }
            );
            void safeRecord("task_retry event", () =>
              warrooms.recordEvent(
                warRoomId,
                "task_retry",
                agent,
                task.task_number,
                { attempt: taskRetries + 1, max: MAX_TASK_RETRIES }
              )
            );
          } else {
            // Max retries exceeded — mark as failed
            console.error("[orchestrator] task failed permanently", {
              warRoomId,
              taskNumber: task.task_number,
              agent,
              retries: taskRetries,
              durationMs: taskDurationMs,
              error: result.error,
            });
            await warrooms.updateTaskStatus(
              warRoomId,
              task.task_number,
              "failed",
              { error: result.error, _duration_ms: taskDurationMs }
            );
            void safeRecord(`${agent} error heartbeat`, () =>
              warrooms.upsertHeartbeat(warRoomId, agent, "error", {
                error: result.error,
              })
            );

            // Auto-skip any tasks that are now permanently blocked because this
            // task failed. Without this, the pipeline deadlocks: isPipelineComplete
            // returns false (blocked ≠ terminal), getNextRunnableTasks returns [],
            // and the stuck-detection fires. Skip tasks whose every dependency is
            // now completed or failed so the pipeline can advance past them.
            await autoSkipPermanentlyBlockedTasks(warRoomId, task.task_number);
          }
        }
      });

      // Wait for all dispatched tasks to complete and log any unexpected rejections
      const settledResults = await Promise.allSettled(dispatches);
      for (const settled of settledResults) {
        if (settled.status === "rejected") {
          console.error("[orchestrator] unhandled dispatch rejection", {
            warRoomId,
            error: settled.reason instanceof Error ? settled.reason.message : String(settled.reason),
            stack: settled.reason instanceof Error ? settled.reason.stack : undefined,
          });
        }
      }
    }

    // Pipeline complete — determine final status
    const finalTasks = await warrooms.getTasks(warRoomId);
    const allPassed = finalTasks.every((t) => t.status === "completed");

    if (allPassed) {
      // Trigger a final rebuild to ensure the game bundle is up-to-date
      const rebuildStart = Date.now();
      await triggerFinalRebuild(room.game_id);
      console.log("[orchestrator] final rebuild done", { durationMs: Date.now() - rebuildStart });

      const task12 = finalTasks.find((t) => t.task_number === 12);
      const suggestions =
        (task12?.output?.suggested_prompts as string[]) || [];
      const buildId = (task12?.output?.build_id as string) || undefined;

      await warrooms.updateWarRoomStatus(
        warRoomId,
        "completed",
        suggestions,
        buildId
      );
      console.log("[orchestrator] pipeline completed successfully", {
        warRoomId,
        suggestionsCount: suggestions.length,
        buildId,
        totalDurationMs: Date.now() - pipelineStart,
      });
    } else {
      await warrooms.updateWarRoomStatus(warRoomId, "failed");
      const finalCounts = finalTasks.reduce(
        (acc, t) => { acc[t.status] = (acc[t.status] || 0) + 1; return acc; },
        {} as Record<string, number>
      );
      console.error("[orchestrator] pipeline completed with failures", {
        warRoomId,
        finalCounts,
        totalDurationMs: Date.now() - pipelineStart,
      });
    }

    void safeRecord("jarvis final idle heartbeat", () =>
      warrooms.upsertHeartbeat(warRoomId, "jarvis", "idle")
    );
  } catch (err) {
    const errorMessage = (err as Error).message;
    const errorStack = (err as Error).stack;
    console.error("[orchestrator] pipeline error", {
      warRoomId,
      error: errorMessage,
      stack: errorStack,
      totalDurationMs: Date.now() - pipelineStart,
    });
    // Status update is critical — don't wrap in safeRecord
    try {
      await warrooms.updateWarRoomStatus(warRoomId, "failed");
    } catch (statusErr) {
      console.error("[orchestrator] failed to mark war room as failed", {
        warRoomId,
        error: (statusErr as Error).message,
      });
    }
    void safeRecord("pipeline_error event", () =>
      warrooms.recordEvent(warRoomId, "pipeline_error", "jarvis", null, {
        error: errorMessage,
        stack: errorStack?.split("\n").slice(0, 5).join("\n"),
        elapsed_ms: Date.now() - pipelineStart,
      })
    );
    void safeRecord("jarvis error heartbeat", () =>
      warrooms.upsertHeartbeat(warRoomId, "jarvis", "error", {
        error: errorMessage,
      })
    );
  }
}

/**
 * Trigger the rebuild-bundle Edge Function and wait for it to complete.
 * Awaited (not fire-and-forget) so the bundle exists before the pipeline
 * is marked as completed.
 */
async function triggerFinalRebuild(gameId: string): Promise<void> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.warn("[orchestrator] triggerFinalRebuild: missing env vars, skipping");
    return;
  }

  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/rebuild-bundle`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ game_id: gameId }),
    });
    const body = await res.json().catch(() => ({}));
    console.log("[orchestrator] final rebuild:", {
      gameId,
      status: res.status,
      buildId: (body as any).build_id,
    });
  } catch (err) {
    console.error("[orchestrator] triggerFinalRebuild failed:", err);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
