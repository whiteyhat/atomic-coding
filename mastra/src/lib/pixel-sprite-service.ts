import { inflateSync } from "node:zlib";

const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

export type SpriteAnimationName = "walk" | "jump" | "attack" | "idle";

export interface SpriteServiceFrameLayoutEntry {
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
}

export interface SpriteServiceAnimationSheet {
  animation: SpriteAnimationName;
  raw_sheet_url: string;
  processed_sheet_url: string;
  width: number;
  height: number;
  cols: number;
  rows: number;
  vertical_dividers: number[];
  horizontal_dividers: number[];
  frames: SpriteServiceFrameLayoutEntry[];
}

export interface SpriteServiceBackgroundLayer {
  variant: "layer_1" | "layer_2" | "layer_3";
  url: string;
  width: number;
  height: number;
}

export interface SpriteServicePack {
  stable_asset_id: string;
  character_prompt: string;
  reference_mode: "prompt_only" | "image_to_image";
  reference_image_url: string | null;
  character_seed: {
    url: string;
    width: number;
    height: number;
  };
  animations: SpriteServiceAnimationSheet[];
  background_layers: SpriteServiceBackgroundLayer[];
  source_service: "sprite-sheet-creator";
  notes: string[];
}

interface GenerateCharacterResponse {
  imageUrl: string;
  width: number;
  height: number;
}

interface GenerateSpriteSheetResponse {
  imageUrl: string;
  width: number;
  height: number;
  type: SpriteAnimationName;
}

interface RemoveBackgroundResponse {
  imageUrl: string;
  width: number;
  height: number;
}

interface GenerateBackgroundResponse {
  layer1Url: string;
  layer2Url: string;
  layer3Url: string;
  width: number;
  height: number;
}

function getSpriteServiceBaseUrl(): string {
  const baseUrl = process.env.PIXEL_SPRITE_SERVICE_URL?.trim();
  if (!baseUrl) {
    throw new Error("PIXEL_SPRITE_SERVICE_URL is not configured");
  }
  return baseUrl.replace(/\/+$/, "");
}

function getSpriteServiceTimeoutMs(): number {
  const raw = Number(process.env.PIXEL_SPRITE_SERVICE_TIMEOUT_MS ?? "120000");
  return Number.isFinite(raw) && raw > 0 ? raw : 120_000;
}

function getSpriteServiceHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const apiKey = process.env.PIXEL_SPRITE_SERVICE_KEY?.trim();
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
    headers["x-api-key"] = apiKey;
  }
  return headers;
}

async function fetchJson<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getSpriteServiceTimeoutMs());

  try {
    const response = await fetch(`${getSpriteServiceBaseUrl()}${path}`, {
      method: "POST",
      headers: getSpriteServiceHeaders(),
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      const errorMessage =
        payload && typeof payload === "object" && "error" in payload
          ? String((payload as Record<string, unknown>).error)
          : `Sprite service request failed with status ${response.status}`;
      throw new Error(errorMessage);
    }

    if (!payload || typeof payload !== "object") {
      throw new Error("Sprite service returned a malformed JSON payload");
    }

    return payload as T;
  } catch (error) {
    if ((error as Error).name === "AbortError") {
      throw new Error("Sprite service request timed out");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function generateCharacter(input: {
  prompt: string;
  referenceImageUrl?: string | null;
}): Promise<GenerateCharacterResponse> {
  const payload = await fetchJson<GenerateCharacterResponse>("/api/generate-character", {
    prompt: input.prompt,
    ...(input.referenceImageUrl ? { imageUrl: input.referenceImageUrl } : {}),
  });

  if (!payload.imageUrl || typeof payload.width !== "number" || typeof payload.height !== "number") {
    throw new Error("Sprite service returned an invalid character payload");
  }

  return payload;
}

export async function generateSpriteSheet(input: {
  characterImageUrl: string;
  type: SpriteAnimationName;
  customPrompt?: string;
}): Promise<GenerateSpriteSheetResponse> {
  const payload = await fetchJson<GenerateSpriteSheetResponse>("/api/generate-sprite-sheet", {
    characterImageUrl: input.characterImageUrl,
    type: input.type,
    ...(input.customPrompt ? { customPrompt: input.customPrompt } : {}),
  });

  if (!payload.imageUrl || typeof payload.width !== "number" || typeof payload.height !== "number") {
    throw new Error(`Sprite service returned an invalid ${input.type} sheet payload`);
  }

  return payload;
}

export async function removeSpriteSheetBackground(
  imageUrl: string,
): Promise<RemoveBackgroundResponse> {
  const payload = await fetchJson<RemoveBackgroundResponse>("/api/remove-background", {
    imageUrl,
  });

  if (!payload.imageUrl || typeof payload.width !== "number" || typeof payload.height !== "number") {
    throw new Error("Sprite service returned an invalid background removal payload");
  }

  return payload;
}

export async function generateParallaxBackground(input: {
  characterImageUrl: string;
  characterPrompt: string;
}): Promise<GenerateBackgroundResponse> {
  const payload = await fetchJson<GenerateBackgroundResponse>("/api/generate-background", {
    characterImageUrl: input.characterImageUrl,
    characterPrompt: input.characterPrompt,
  });

  if (!payload.layer1Url || !payload.layer2Url || !payload.layer3Url) {
    throw new Error("Sprite service returned an invalid background payload");
  }

  return payload;
}

function buildCharacterPrompt(input: {
  brief: string;
  styleDirection?: string | null;
  referenceNotes?: string[];
}): string {
  const parts = [
    input.brief.trim(),
    input.styleDirection?.trim() || "",
    ...(input.referenceNotes ?? []).map((note) => note.trim()),
  ].filter(Boolean);

  return parts.join(". ");
}

function buildAnimationPrompt(input: {
  brief: string;
  styleDirection?: string | null;
  referenceNotes?: string[];
  animation: SpriteAnimationName;
}): string {
  const motionHint = {
    idle: "Keep the motion subtle and loop-friendly.",
    walk: "Emphasize readable stepping and silhouette clarity.",
    jump: "Make the anticipation, rise, apex, and landing distinct.",
    attack: "Choose an attack motion that fits the character and reads clearly in sequence.",
  }[input.animation];

  return [
    input.brief.trim(),
    input.styleDirection?.trim() || "",
    ...(input.referenceNotes ?? []).map((note) => note.trim()),
    motionHint,
  ]
    .filter(Boolean)
    .join(". ");
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

function decodePngRgba(bytes: Uint8Array): { width: number; height: number; rgba: Uint8Array } {
  for (let i = 0; i < PNG_SIGNATURE.length; i++) {
    if (bytes[i] !== PNG_SIGNATURE[i]) {
      throw new Error("Expected PNG bytes");
    }
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 8;
  let width = 0;
  let height = 0;
  let colorType = 0;
  let bitDepth = 0;
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
      bitDepth = bytes[dataStart + 8];
      colorType = bytes[dataStart + 9];
    } else if (chunkType === "IDAT") {
      idatChunks.push(bytes.slice(dataStart, dataEnd));
    } else if (chunkType === "IEND") {
      break;
    }

    offset = dataEnd + 4;
  }

  if (!width || !height || !idatChunks.length) {
    throw new Error("PNG metadata is incomplete");
  }
  if (bitDepth !== 8) {
    throw new Error(`Unsupported PNG bit depth: ${bitDepth}`);
  }

  const bytesPerPixel = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 4 ? 2 : 0;
  if (!bytesPerPixel) {
    throw new Error(`Unsupported PNG color type: ${colorType}`);
  }

  const stride = width * bytesPerPixel;
  const compressed = new Uint8Array(idatChunks.reduce((sum, chunk) => sum + chunk.length, 0));
  let writeOffset = 0;
  for (const chunk of idatChunks) {
    compressed.set(chunk, writeOffset);
    writeOffset += chunk.length;
  }

  const inflated = inflateSync(compressed);
  const rgba = new Uint8Array(width * height * 4);
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

    for (let x = 0; x < width; x++) {
      const pixelOffset = rowIndex * width * 4 + x * 4;
      const sourceOffset = x * bytesPerPixel;

      if (colorType === 6) {
        rgba[pixelOffset] = reconstructed[sourceOffset];
        rgba[pixelOffset + 1] = reconstructed[sourceOffset + 1];
        rgba[pixelOffset + 2] = reconstructed[sourceOffset + 2];
        rgba[pixelOffset + 3] = reconstructed[sourceOffset + 3];
      } else if (colorType === 2) {
        rgba[pixelOffset] = reconstructed[sourceOffset];
        rgba[pixelOffset + 1] = reconstructed[sourceOffset + 1];
        rgba[pixelOffset + 2] = reconstructed[sourceOffset + 2];
        rgba[pixelOffset + 3] = 255;
      } else {
        const gray = reconstructed[sourceOffset];
        rgba[pixelOffset] = gray;
        rgba[pixelOffset + 1] = gray;
        rgba[pixelOffset + 2] = gray;
        rgba[pixelOffset + 3] = reconstructed[sourceOffset + 1];
      }
    }

    previousRow = reconstructed;
  }

  return { width, height, rgba };
}

async function fetchPngLayoutData(imageUrl: string): Promise<{
  width: number;
  height: number;
  rgba: Uint8Array;
}> {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch sprite sheet PNG: ${response.status}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("png")) {
    throw new Error(`Expected PNG sprite sheet, received ${contentType || "unknown content type"}`);
  }

  return decodePngRgba(new Uint8Array(await response.arrayBuffer()));
}

function deriveFrameBounds(args: {
  rgba: Uint8Array;
  imageWidth: number;
  frameX: number;
  frameY: number;
  frameWidth: number;
  frameHeight: number;
}): { x: number; y: number; width: number; height: number } | null {
  let minX = args.frameWidth;
  let minY = args.frameHeight;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < args.frameHeight; y++) {
    for (let x = 0; x < args.frameWidth; x++) {
      const globalX = args.frameX + x;
      const globalY = args.frameY + y;
      const alphaOffset = (globalY * args.imageWidth + globalX) * 4 + 3;
      if ((args.rgba[alphaOffset] ?? 0) > 0) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < 0 || maxY < 0) {
    return null;
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

export async function deriveDefaultSpriteLayout(input: {
  imageUrl: string;
  width: number;
  height: number;
  cols?: number;
  rows?: number;
}): Promise<{
  cols: number;
  rows: number;
  vertical_dividers: number[];
  horizontal_dividers: number[];
  frames: SpriteServiceFrameLayoutEntry[];
}> {
  const cols = input.cols ?? 2;
  const rows = input.rows ?? 2;
  const vertical_dividers = Array.from({ length: cols - 1 }, (_, index) =>
    Number((((index + 1) / cols) * 100).toFixed(4)),
  );
  const horizontal_dividers = Array.from({ length: rows - 1 }, (_, index) =>
    Number((((index + 1) / rows) * 100).toFixed(4)),
  );

  try {
    const { rgba, width, height } = await fetchPngLayoutData(input.imageUrl);
    const xStops = [0, ...vertical_dividers.map((value) => Math.round((value / 100) * width)), width];
    const yStops = [0, ...horizontal_dividers.map((value) => Math.round((value / 100) * height)), height];
    const frames: SpriteServiceFrameLayoutEntry[] = [];

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const frameX = xStops[col];
        const frameY = yStops[row];
        const frameWidth = Math.max(1, xStops[col + 1] - frameX);
        const frameHeight = Math.max(1, yStops[row + 1] - frameY);
        frames.push({
          index: row * cols + col,
          x: frameX,
          y: frameY,
          width: frameWidth,
          height: frameHeight,
          bounds: deriveFrameBounds({
            rgba,
            imageWidth: width,
            frameX,
            frameY,
            frameWidth,
            frameHeight,
          }),
        });
      }
    }

    return {
      cols,
      rows,
      vertical_dividers,
      horizontal_dividers,
      frames,
    };
  } catch {
    const frameWidth = Math.max(1, Math.round(input.width / cols));
    const frameHeight = Math.max(1, Math.round(input.height / rows));
    const frames: SpriteServiceFrameLayoutEntry[] = [];

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        frames.push({
          index: row * cols + col,
          x: col * frameWidth,
          y: row * frameHeight,
          width: frameWidth,
          height: frameHeight,
          bounds: null,
        });
      }
    }

    return {
      cols,
      rows,
      vertical_dividers,
      horizontal_dividers,
      frames,
    };
  }
}

export async function generateSpriteServicePack(input: {
  stableAssetId: string;
  brief: string;
  styleDirection?: string | null;
  referenceImageUrl?: string | null;
  referenceNotes?: string[];
  requiredAnimations?: SpriteAnimationName[];
  generateBackgroundLayers?: boolean;
}): Promise<SpriteServicePack> {
  const characterPrompt = buildCharacterPrompt({
    brief: input.brief,
    styleDirection: input.styleDirection,
    referenceNotes: input.referenceNotes,
  });
  const requiredAnimations = Array.from(
    new Set((input.requiredAnimations ?? ["idle", "walk", "jump", "attack"]).filter(Boolean)),
  ) as SpriteAnimationName[];

  const characterSeed = await generateCharacter({
    prompt: characterPrompt,
    referenceImageUrl: input.referenceImageUrl,
  });

  const animationSheets = await Promise.all(
    requiredAnimations.map(async (animation) => {
      const rawSheet = await generateSpriteSheet({
        characterImageUrl: characterSeed.imageUrl,
        type: animation,
        customPrompt: buildAnimationPrompt({
          brief: input.brief,
          styleDirection: input.styleDirection,
          referenceNotes: input.referenceNotes,
          animation,
        }),
      });
      const processedSheet = await removeSpriteSheetBackground(rawSheet.imageUrl);
      const layout = await deriveDefaultSpriteLayout({
        imageUrl: processedSheet.imageUrl,
        width: processedSheet.width,
        height: processedSheet.height,
      });

      return {
        animation,
        raw_sheet_url: rawSheet.imageUrl,
        processed_sheet_url: processedSheet.imageUrl,
        width: processedSheet.width,
        height: processedSheet.height,
        cols: layout.cols,
        rows: layout.rows,
        vertical_dividers: layout.vertical_dividers,
        horizontal_dividers: layout.horizontal_dividers,
        frames: layout.frames,
      } satisfies SpriteServiceAnimationSheet;
    }),
  );

  let backgroundLayers: SpriteServiceBackgroundLayer[] = [];
  if (input.generateBackgroundLayers) {
    const background = await generateParallaxBackground({
      characterImageUrl: characterSeed.imageUrl,
      characterPrompt,
    });
    backgroundLayers = [
      { variant: "layer_1", url: background.layer1Url, width: background.width, height: background.height },
      { variant: "layer_2", url: background.layer2Url, width: background.width, height: background.height },
      { variant: "layer_3", url: background.layer3Url, width: background.width, height: background.height },
    ];
  }

  return {
    stable_asset_id: input.stableAssetId,
    character_prompt: characterPrompt,
    reference_mode: input.referenceImageUrl ? "image_to_image" : "prompt_only",
    reference_image_url: input.referenceImageUrl ?? null,
    character_seed: {
      url: characterSeed.imageUrl,
      width: characterSeed.width,
      height: characterSeed.height,
    },
    animations: animationSheets,
    background_layers: backgroundLayers,
    source_service: "sprite-sheet-creator",
    notes: [
      `Generated ${animationSheets.length} animation sheet${animationSheets.length === 1 ? "" : "s"} for ${input.stableAssetId}.`,
      ...(backgroundLayers.length > 0 ? ["Generated 3 parallax background layers."] : []),
    ],
  };
}
