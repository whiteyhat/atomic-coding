import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildPixelManifestDocument,
  mergeCheckerOutputWithPixelValidation,
  runPixelAssetValidation,
} from "../orchestrator.js";
import type {
  CheckerValidationOutput,
  WarRoomGeneratedAsset,
} from "../types.js";

function makeGeneratedAsset(
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

describe("buildPixelManifestDocument", () => {
  it("builds grouped UI, animation, and background sections", () => {
    const manifest = buildPixelManifestDocument({
      warRoomId: "wr-1",
      gameId: "game-1",
      gameFormat: "2d",
      runtime: "phaser",
      task7Output: {
        design_system: { palette: { primary: "#fff" } },
        art_direction: "Cozy arcade",
        generation_model: "vertex",
      },
      task8Output: {
        art_direction: "Cozy arcade sprites",
        generation_model: "sprite-sheet-creator",
        sprite_manifest: [{ name: "player", category: "character" }],
        notes: ["ok"],
      },
      generatedAssets: [
        makeGeneratedAsset({
          id: "ui-1",
          task_number: 7,
          stable_asset_id: "health_bar",
          asset_kind: "ui_asset",
          public_url: "https://cdn.example/ui.png",
        }),
        makeGeneratedAsset({
          id: "pack-1",
          task_number: 8,
          stable_asset_id: "player",
          asset_kind: "animation_pack",
          public_url: "https://cdn.example/player-seed.png",
          metadata: {
            character_prompt: "Agile hero",
            animations: [{ animation: "idle" }],
          },
        }),
        makeGeneratedAsset({
          id: "bg-1",
          task_number: 8,
          stable_asset_id: "forest_backdrop",
          asset_kind: "background_layer",
          variant: "layer_1",
          public_url: "https://cdn.example/bg-1.png",
        }),
      ],
    });

    const typedManifest = manifest as Record<string, any>;
    expect(typedManifest.asset_contract_version).toBe(2);
    expect(typedManifest.task_7.ui_assets).toHaveLength(1);
    expect(typedManifest.task_8.animation_sets).toHaveLength(1);
    expect(typedManifest.task_8.background_sets).toHaveLength(1);
    expect(typedManifest.task_8.runtime_index.animations).toHaveLength(1);
    expect(typedManifest.task_8.background_sets[0].stable_asset_id).toBe("forest_backdrop");
  });
});

describe("runPixelAssetValidation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("flags missing manifest, missing animations, and missing parallax layers", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      }),
    );

    const generatedAssets = [
      makeGeneratedAsset({
        id: "pack-1",
        task_number: 8,
        stable_asset_id: "player",
        asset_kind: "animation_pack",
        public_url: "https://cdn.example/player.png",
      }),
      makeGeneratedAsset({
        id: "bg-1",
        task_number: 8,
        stable_asset_id: "forest_backdrop",
        asset_kind: "background_layer",
        variant: "layer_1",
        public_url: "https://cdn.example/bg-1.png",
      }),
      makeGeneratedAsset({
        id: "bg-2",
        task_number: 8,
        stable_asset_id: "forest_backdrop",
        asset_kind: "background_layer",
        variant: "layer_2",
        public_url: "https://cdn.example/bg-2.png",
      }),
    ];

    const report = await runPixelAssetValidation({
      warRoomId: "wr-1",
      gameFormat: "2d",
      scope: {
        sprite_requirements: {
          characters: [
            {
              stable_id: "player",
              required_animations: ["idle", "walk"],
            },
          ],
          environment: [
            {
              stable_id: "forest_backdrop",
              generate_parallax_layers: true,
            },
          ],
        },
      },
      task8Output: {
        animation_sets: [
          {
            stable_asset_id: "player",
            animations: [
              {
                animation: "idle",
                phaser_descriptor_url: "https://cdn.example/player-idle-atlas.json",
                cols: 2,
                rows: 2,
                frames: [{ index: 0, x: 0, y: 0, width: 64, height: 64, bounds: null }],
              },
            ],
          },
        ],
        background_sets: [
          {
            stable_asset_id: "forest_backdrop",
            layers: [
              { variant: "layer_1", url: "https://cdn.example/bg-1.png", width: 1920, height: 1080 },
              { variant: "layer_2", url: "https://cdn.example/bg-2.png", width: 1920, height: 1080 },
            ],
          },
        ],
      },
      generatedAssets,
    });

    expect(report.passed).toBe(false);
    expect(report.failures.map((failure) => failure.rule)).toEqual(
      expect.arrayContaining([
        "pixel_manifest_exists",
        "pixel_required_animation_missing",
        "pixel_frame_count_mismatch",
        "pixel_parallax_layer_missing",
      ]),
    );
  });
});

describe("mergeCheckerOutputWithPixelValidation", () => {
  it("adds pixel failures and flips the checker output to failed", () => {
    const output: CheckerValidationOutput = {
      status: "completed",
      passed: true,
      failures: [],
      notes: "Base deterministic checks passed.",
    };

    const merged = mergeCheckerOutputWithPixelValidation(output, {
      passed: false,
      checkedUrls: 4,
      failures: [
        {
          atom: "pixel_manifest",
          rule: "pixel_manifest_exists",
          message: "Missing pixel-manifest.json",
          severity: "error",
        },
      ],
    });

    expect(merged.passed).toBe(false);
    expect(merged.status).toBe("failed");
    expect(merged.failures).toHaveLength(1);
    expect(merged.notes).toContain("checked 4 URL");
  });
});
