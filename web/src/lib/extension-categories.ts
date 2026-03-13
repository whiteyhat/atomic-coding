export interface ExtensionCategory {
  key: string;
  label: string;
  description: string;
}

export const EXTENSION_CATEGORIES: ExtensionCategory[] = [
  { key: "audio", label: "Audio", description: "Sound effects, music, and spatial audio" },
  { key: "physics", label: "Physics", description: "Collision, gravity, and rigid body simulation" },
  { key: "ai", label: "AI / Pathfinding", description: "Enemy navigation and procedural generation" },
  { key: "multiplayer", label: "Multiplayer", description: "Real-time online gameplay" },
  { key: "animation", label: "Animation", description: "Tweening, timelines, and visual effects" },
  { key: "procedural", label: "Procedural", description: "Noise, randomness, and terrain generation" },
  { key: "3d", label: "3D Extras", description: "Camera controls and additional 3D utilities" },
];

/**
 * Maps extension registry names to categories and format compatibility.
 * Core/mandatory extensions (three_js, phaser_js, atomic_assets, buu_assets,
 * gaussian_splats_3d, three_gltf_loader) are excluded — they are auto-installed
 * by genre boilerplates and should not be toggleable.
 */
export const EXTENSION_CATALOG: Record<
  string,
  { category: string; formats: ("2d" | "3d")[] }
> = {
  // Audio
  howler_js: { category: "audio", formats: ["2d", "3d"] },

  // Physics
  matter_js: { category: "physics", formats: ["2d"] },
  planck_js: { category: "physics", formats: ["2d"] },
  cannon_es: { category: "physics", formats: ["3d"] },

  // AI / Pathfinding
  pathfinding_js: { category: "ai", formats: ["2d", "3d"] },
  rot_js: { category: "ai", formats: ["2d"] },

  // Multiplayer
  socket_io_client: { category: "multiplayer", formats: ["2d", "3d"] },

  // Animation
  gsap: { category: "animation", formats: ["2d", "3d"] },

  // Procedural
  simplex_noise: { category: "procedural", formats: ["3d"] },
  seedrandom_js: { category: "procedural", formats: ["2d", "3d"] },
  noisejs: { category: "procedural", formats: ["2d"] },

  // 3D extras
  three_orbit_controls: { category: "3d", formats: ["3d"] },
};

/** Get extension names relevant for a given game format */
export function getExtensionsForFormat(format: "2d" | "3d"): string[] {
  return Object.entries(EXTENSION_CATALOG)
    .filter(([, meta]) => meta.formats.includes(format))
    .map(([name]) => name);
}
