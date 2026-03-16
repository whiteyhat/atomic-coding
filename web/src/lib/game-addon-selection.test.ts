import { describe, expect, it } from "vitest";
import {
  getBoilerplateExternals,
  getInstallableOptionalAddons,
  pruneOptionalAddons,
} from "./game-addon-selection";

describe("game addon selection", () => {
  it("drops format-incompatible optional addons when the game format changes", () => {
    const pruned = pruneOptionalAddons(
      new Set(["matter_js", "howler_js", "pathfinding_js"]),
      "3d",
    );

    expect(Array.from(pruned).sort()).toEqual([
      "howler_js",
      "pathfinding_js",
    ]);
  });

  it("keeps boilerplate externals separate from explicit addon installs", () => {
    const boilerplateExternals = getBoilerplateExternals(
      [
        {
          slug: "custom",
          game_format: "3d",
          externals: [
            "three_js",
            "atomic_assets",
            "buu_assets",
            "gaussian_splats_3d",
            "three_gltf_loader",
          ],
        },
      ],
      "custom",
      "3d",
    );

    expect(boilerplateExternals).toEqual([
      "three_js",
      "atomic_assets",
      "buu_assets",
      "gaussian_splats_3d",
      "three_gltf_loader",
    ]);
    expect(getInstallableOptionalAddons(new Set())).toEqual([]);
    expect(
      getInstallableOptionalAddons(new Set(["cannon_es", "howler_js"])),
    ).toEqual(["cannon_es", "howler_js"]);
  });
});
