"use client";

import type {
  PixelAnimationLayout,
  PixelFrameLayoutEntry,
  WarRoomGeneratedAsset,
} from "./types";

export interface PixelStudioFrame extends PixelFrameLayoutEntry {
  url?: string | null;
}

export interface PixelStudioAnimation {
  animation: string;
  rawSheetUrl: string | null;
  processedSheetUrl: string | null;
  frameManifestUrl: string | null;
  phaserDescriptorUrl: string | null;
  width: number;
  height: number;
  cols: number;
  rows: number;
  verticalDividers: number[];
  horizontalDividers: number[];
  frames: PixelStudioFrame[];
}

export interface PixelStudioAnimationPack {
  assetId: string;
  stableAssetId: string;
  characterPrompt: string;
  referenceMode: string | null;
  referenceImageUrl: string | null;
  characterSeedUrl: string | null;
  animations: PixelStudioAnimation[];
}

export interface PixelStudioBackgroundSet {
  stableAssetId: string;
  layers: Array<{
    variant: string;
    url: string | null;
    width: number | null;
    height: number | null;
  }>;
}

export interface PixelStudioModel {
  animationPacks: PixelStudioAnimationPack[];
  backgroundSets: PixelStudioBackgroundSet[];
  uiAssets: WarRoomGeneratedAsset[];
  auxiliaryAssets: WarRoomGeneratedAsset[];
  manifestAsset: WarRoomGeneratedAsset | null;
}

function sortNumeric(values: number[]): number[] {
  return [...values]
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);
}

function clampPercentage(value: number): number {
  return Math.max(5, Math.min(95, Number(value.toFixed(4))));
}

function inferFrameExtent(
  frames: Array<PixelFrameLayoutEntry | PixelStudioFrame>,
) {
  return frames.reduce(
    (acc, frame) => ({
      width: Math.max(acc.width, frame.x + frame.width),
      height: Math.max(acc.height, frame.y + frame.height),
    }),
    { width: 0, height: 0 },
  );
}

export function deriveFramesFromDividers(args: {
  width: number;
  height: number;
  cols: number;
  rows: number;
  verticalDividers: number[];
  horizontalDividers: number[];
  previousFrames?: Array<PixelFrameLayoutEntry | PixelStudioFrame>;
}): PixelStudioFrame[] {
  const verticalDividers = sortNumeric(args.verticalDividers).map(clampPercentage);
  const horizontalDividers = sortNumeric(args.horizontalDividers).map(clampPercentage);
  const xStops = [0, ...verticalDividers.map((value) => Math.round((value / 100) * args.width)), args.width];
  const yStops = [0, ...horizontalDividers.map((value) => Math.round((value / 100) * args.height)), args.height];
  const previousByIndex = new Map(
    (args.previousFrames ?? []).map((frame) => [frame.index, frame]),
  );
  const frames: PixelStudioFrame[] = [];

  for (let row = 0; row < args.rows; row++) {
    for (let col = 0; col < args.cols; col++) {
      const index = row * args.cols + col;
      const previous = previousByIndex.get(index);
      const x = xStops[col];
      const y = yStops[row];
      frames.push({
        index,
        x,
        y,
        width: Math.max(1, xStops[col + 1] - x),
        height: Math.max(1, yStops[row + 1] - y),
        bounds: previous?.bounds ?? null,
        url: "url" in (previous ?? {}) ? ((previous as PixelStudioFrame).url ?? null) : null,
      });
    }
  }

  return frames;
}

export function normalizeAnimationLayout(animation: PixelStudioAnimation): PixelAnimationLayout {
  return {
    cols: animation.cols,
    rows: animation.rows,
    vertical_dividers: animation.verticalDividers,
    horizontal_dividers: animation.horizontalDividers,
    frames: animation.frames.map(({ url: _url, ...frame }) => frame),
  };
}

function applyLayoutOverride(
  animation: PixelStudioAnimation,
  override: Record<string, unknown> | null | undefined,
): PixelStudioAnimation {
  if (!override) return animation;

  const cols = Number(override.cols ?? animation.cols) || animation.cols;
  const rows = Number(override.rows ?? animation.rows) || animation.rows;
  const verticalDividers = Array.isArray(override.vertical_dividers)
    ? (override.vertical_dividers as number[])
    : animation.verticalDividers;
  const horizontalDividers = Array.isArray(override.horizontal_dividers)
    ? (override.horizontal_dividers as number[])
    : animation.horizontalDividers;
  const frames = Array.isArray(override.frames)
    ? (override.frames as PixelFrameLayoutEntry[])
    : animation.frames;

  return {
    ...animation,
    cols,
    rows,
    verticalDividers,
    horizontalDividers,
    frames: frames.map((frame, index) => ({
      ...frame,
      url: animation.frames[index]?.url ?? null,
    })),
  };
}

export function buildPixelAssetStudioModel(
  assets: WarRoomGeneratedAsset[],
): PixelStudioModel {
  const processedSheets = new Map(
    assets
      .filter((asset) => asset.asset_kind === "sprite_sheet" && !asset.variant.endsWith("_raw"))
      .map((asset) => [`${asset.stable_asset_id}:${asset.variant}`, asset]),
  );
  const rawSheets = new Map(
    assets
      .filter((asset) => asset.asset_kind === "sprite_sheet" && asset.variant.endsWith("_raw"))
      .map((asset) => [`${asset.stable_asset_id}:${asset.variant.replace(/_raw$/, "")}`, asset]),
  );

  const animationPacks = assets
    .filter((asset) => asset.asset_kind === "animation_pack")
    .map((asset) => {
      const metadata = asset.metadata as Record<string, unknown>;
      const overrides = (metadata.animation_layouts as Record<string, Record<string, unknown>> | undefined) ?? {};
      const animations = ((metadata.animations as Array<Record<string, unknown>> | undefined) ?? []).map((entry) => {
        const animationName = String(entry.animation ?? "idle");
        const processedSheet = processedSheets.get(`${asset.stable_asset_id}:${animationName}`);
        const rawSheet = rawSheets.get(`${asset.stable_asset_id}:${animationName}`);
        const baseFrames = ((entry.frames as Array<Record<string, unknown>> | undefined) ?? []).map((frame) => ({
          index: Number(frame.index ?? 0),
          x: Number(frame.x ?? 0),
          y: Number(frame.y ?? 0),
          width: Number(frame.width ?? 1),
          height: Number(frame.height ?? 1),
          bounds: frame.bounds as PixelFrameLayoutEntry["bounds"],
          url: typeof frame.url === "string" ? frame.url : null,
        }));
        const inferredSize = inferFrameExtent(baseFrames);

        const animation: PixelStudioAnimation = {
          animation: animationName,
          rawSheetUrl:
            rawSheet?.public_url ??
            (typeof entry.raw_sheet_url === "string" ? entry.raw_sheet_url : null),
          processedSheetUrl:
            processedSheet?.public_url ??
            (typeof entry.processed_sheet_url === "string" ? entry.processed_sheet_url : null),
          frameManifestUrl:
            typeof entry.frame_manifest_url === "string" ? entry.frame_manifest_url : null,
          phaserDescriptorUrl:
            typeof entry.phaser_descriptor_url === "string" ? entry.phaser_descriptor_url : null,
          width:
            processedSheet?.width ??
            (typeof entry.width === "number" ? entry.width : inferredSize.width),
          height:
            processedSheet?.height ??
            (typeof entry.height === "number" ? entry.height : inferredSize.height),
          cols: Number(entry.cols ?? 2),
          rows: Number(entry.rows ?? 2),
          verticalDividers: Array.isArray(entry.vertical_dividers)
            ? (entry.vertical_dividers as number[])
            : [50],
          horizontalDividers: Array.isArray(entry.horizontal_dividers)
            ? (entry.horizontal_dividers as number[])
            : [50],
          frames: baseFrames,
        };

        return applyLayoutOverride(animation, overrides[animationName]);
      });

      return {
        assetId: asset.id,
        stableAssetId: asset.stable_asset_id,
        characterPrompt: String(metadata.character_prompt ?? asset.stable_asset_id),
        referenceMode: typeof metadata.reference_mode === "string" ? metadata.reference_mode : null,
        referenceImageUrl:
          typeof metadata.reference_image_url === "string" ? metadata.reference_image_url : null,
        characterSeedUrl:
          typeof metadata.character_seed_url === "string"
            ? metadata.character_seed_url
            : asset.public_url,
        animations: animations.sort((a, b) => a.animation.localeCompare(b.animation)),
      } satisfies PixelStudioAnimationPack;
    })
    .sort((a, b) => a.stableAssetId.localeCompare(b.stableAssetId));

  const backgroundSets = Array.from(
    assets
      .filter((asset) => asset.asset_kind === "background_layer")
      .reduce((map, asset) => {
        const existing = map.get(asset.stable_asset_id) ?? [];
        existing.push({
          variant: asset.variant,
          url: asset.public_url,
          width: asset.width,
          height: asset.height,
        });
        map.set(asset.stable_asset_id, existing);
        return map;
      }, new Map<string, PixelStudioBackgroundSet["layers"]>()),
  )
    .map(([stableAssetId, layers]) => ({
      stableAssetId,
      layers: layers.sort((a, b) => a.variant.localeCompare(b.variant)),
    }))
    .sort((a, b) => a.stableAssetId.localeCompare(b.stableAssetId));

  const uiAssets = assets
    .filter((asset) => asset.task_number === 7 && asset.asset_kind === "ui_asset")
    .sort((a, b) => a.stable_asset_id.localeCompare(b.stable_asset_id));

  const auxiliaryAssets = assets
    .filter((asset) =>
      asset.task_number === 8 &&
      ["texture_asset", "effect_asset", "ui_asset", "background_plate"].includes(asset.asset_kind),
    )
    .sort((a, b) => a.stable_asset_id.localeCompare(b.stable_asset_id));

  return {
    animationPacks,
    backgroundSets,
    uiAssets,
    auxiliaryAssets,
    manifestAsset: assets.find((asset) => asset.asset_kind === "pixel_manifest") ?? null,
  };
}

export function applyLayoutPatchLocally(args: {
  asset: WarRoomGeneratedAsset;
  animation: string;
  layout: PixelAnimationLayout;
}): WarRoomGeneratedAsset {
  const metadata = { ...(args.asset.metadata ?? {}) } as Record<string, unknown>;
  const existingLayouts = (metadata.animation_layouts as Record<string, unknown> | undefined) ?? {};
  metadata.animation_layouts = {
    ...existingLayouts,
    [args.animation]: args.layout,
  };

  if (Array.isArray(metadata.animations)) {
    metadata.animations = (metadata.animations as Array<Record<string, unknown>>).map((entry) =>
      entry.animation === args.animation
        ? {
            ...entry,
            cols: args.layout.cols,
            rows: args.layout.rows,
            vertical_dividers: args.layout.vertical_dividers,
            horizontal_dividers: args.layout.horizontal_dividers,
            frames: args.layout.frames,
          }
        : entry,
    );
  }

  return {
    ...args.asset,
    metadata,
    updated_at: new Date().toISOString(),
  };
}
