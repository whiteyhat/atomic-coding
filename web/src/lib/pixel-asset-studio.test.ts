import { describe, expect, it } from "vitest";
import {
  applyLayoutPatchLocally,
  buildPixelAssetStudioModel,
  deriveFramesFromDividers,
} from "./pixel-asset-studio";
import type { PixelAnimationLayout, WarRoomGeneratedAsset } from "./types";

function makeAsset(
  overrides: Partial<WarRoomGeneratedAsset> & {
    id: string;
    task_number: 7 | 8;
    stable_asset_id: string;
    asset_kind: WarRoomGeneratedAsset["asset_kind"];
  },
): WarRoomGeneratedAsset {
  return {
    id: overrides.id,
    war_room_id: "wr-1",
    task_number: overrides.task_number,
    stable_asset_id: overrides.stable_asset_id,
    asset_kind: overrides.asset_kind,
    variant: overrides.variant ?? "",
    storage_path: overrides.storage_path ?? null,
    public_url: overrides.public_url ?? null,
    width: overrides.width ?? null,
    height: overrides.height ?? null,
    layout_version: overrides.layout_version ?? 1,
    runtime_ready: overrides.runtime_ready ?? true,
    editor_only: overrides.editor_only ?? false,
    source_service: overrides.source_service ?? "test",
    metadata: overrides.metadata ?? {},
    created_at: overrides.created_at ?? "2026-03-17T00:00:00.000Z",
    updated_at: overrides.updated_at ?? "2026-03-17T00:00:00.000Z",
  };
}

describe("deriveFramesFromDividers", () => {
  it("builds a 2x2 frame grid from divider percentages", () => {
    const frames = deriveFramesFromDividers({
      width: 200,
      height: 100,
      cols: 2,
      rows: 2,
      verticalDividers: [50],
      horizontalDividers: [50],
    });

    expect(frames).toEqual([
      { index: 0, x: 0, y: 0, width: 100, height: 50, bounds: null, url: null },
      { index: 1, x: 100, y: 0, width: 100, height: 50, bounds: null, url: null },
      { index: 2, x: 0, y: 50, width: 100, height: 50, bounds: null, url: null },
      { index: 3, x: 100, y: 50, width: 100, height: 50, bounds: null, url: null },
    ]);
  });
});

describe("buildPixelAssetStudioModel", () => {
  it("groups animation packs and applies saved layout overrides", () => {
    const animationPack = makeAsset({
      id: "pack-1",
      task_number: 8,
      stable_asset_id: "player",
      asset_kind: "animation_pack",
      public_url: "https://cdn.example/player-seed.png",
      metadata: {
        character_prompt: "Agile platform hero",
        reference_mode: "image_to_image",
        reference_image_url: "https://cdn.example/ref.png",
        character_seed_url: "https://cdn.example/player-seed.png",
        animations: [
          {
            animation: "idle",
            raw_sheet_url: "https://cdn.example/idle-raw.png",
            processed_sheet_url: "https://cdn.example/idle.png",
            cols: 2,
            rows: 2,
            vertical_dividers: [50],
            horizontal_dividers: [50],
            frames: [
              { index: 0, x: 0, y: 0, width: 64, height: 64, bounds: null, url: "https://cdn.example/f0.png" },
              { index: 1, x: 64, y: 0, width: 64, height: 64, bounds: null, url: "https://cdn.example/f1.png" },
              { index: 2, x: 0, y: 64, width: 64, height: 64, bounds: null, url: "https://cdn.example/f2.png" },
              { index: 3, x: 64, y: 64, width: 64, height: 64, bounds: null, url: "https://cdn.example/f3.png" },
            ],
          },
        ],
        animation_layouts: {
          idle: {
            cols: 2,
            rows: 2,
            vertical_dividers: [40],
            horizontal_dividers: [55],
            frames: [
              { index: 0, x: 0, y: 0, width: 51, height: 70, bounds: null },
              { index: 1, x: 51, y: 0, width: 77, height: 70, bounds: null },
              { index: 2, x: 0, y: 70, width: 51, height: 58, bounds: null },
              { index: 3, x: 51, y: 70, width: 77, height: 58, bounds: null },
            ],
          },
        },
      },
    });

    const processedSheet = makeAsset({
      id: "sheet-1",
      task_number: 8,
      stable_asset_id: "player",
      asset_kind: "sprite_sheet",
      variant: "idle",
      public_url: "https://cdn.example/player-idle.png",
      width: 128,
      height: 128,
      metadata: { sheet_type: "processed" },
    });

    const backgroundLayer = makeAsset({
      id: "bg-1",
      task_number: 8,
      stable_asset_id: "forest_backdrop",
      asset_kind: "background_layer",
      variant: "layer_1",
      public_url: "https://cdn.example/bg-1.png",
      width: 1920,
      height: 1080,
    });

    const model = buildPixelAssetStudioModel([
      animationPack,
      processedSheet,
      backgroundLayer,
    ]);

    expect(model.animationPacks).toHaveLength(1);
    expect(model.animationPacks[0].animations[0].processedSheetUrl).toBe("https://cdn.example/player-idle.png");
    expect(model.animationPacks[0].animations[0].verticalDividers).toEqual([40]);
    expect(model.animationPacks[0].animations[0].frames[0].url).toBe("https://cdn.example/f0.png");
    expect(model.backgroundSets[0].stableAssetId).toBe("forest_backdrop");
  });
});

describe("applyLayoutPatchLocally", () => {
  it("updates animation metadata and animation_layouts together", () => {
    const asset = makeAsset({
      id: "pack-1",
      task_number: 8,
      stable_asset_id: "player",
      asset_kind: "animation_pack",
      metadata: {
        animations: [
          {
            animation: "idle",
            cols: 2,
            rows: 2,
            vertical_dividers: [50],
            horizontal_dividers: [50],
            frames: [{ index: 0, x: 0, y: 0, width: 64, height: 64, bounds: null }],
          },
        ],
      },
    });

    const layout: PixelAnimationLayout = {
      cols: 2,
      rows: 2,
      vertical_dividers: [42],
      horizontal_dividers: [58],
      frames: [
        { index: 0, x: 0, y: 0, width: 54, height: 74, bounds: null },
      ],
    };

    const updated = applyLayoutPatchLocally({
      asset,
      animation: "idle",
      layout,
    });

    expect((updated.metadata.animation_layouts as Record<string, unknown>).idle).toEqual(layout);
    expect((updated.metadata.animations as Array<Record<string, unknown>>)[0].vertical_dividers).toEqual([42]);
    expect((updated.metadata.animations as Array<Record<string, unknown>>)[0].frames).toEqual(layout.frames);
  });
});
