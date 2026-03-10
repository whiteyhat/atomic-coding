const GENRE_CONTEXT: Record<string, string> = {
  "hex-grid-tbs": `
## Genre: Hex Grid Strategy
This game uses a hex grid with turn-based mechanics. Key boilerplate atoms:
- \`hex_grid_create\`: Creates hexagonal tile grid as 3D meshes
- \`turn_manager\`: Manages turn state between players
- \`score_tracker\`: Tracks score and reports via postMessage
Focus on: unit placement, movement along hex paths, combat mechanics, fog of war.`,

  "side-scroller-2d-3d": `
## Genre: Side-Scroller
This game is a 2D platformer rendered in 3D space. Key boilerplate atoms:
- \`platform_physics\`: Gravity and ground collision
- \`camera_follow\`: Smooth horizontal camera tracking
- \`score_tracker\`: Tracks score and reports via postMessage
Focus on: player movement, jumping, platforms, collectibles, enemies.`,

  "3d-roguelike-deckbuilder": `
## Genre: Roguelike Deckbuilder
This game combines card-based combat with procedural dungeon rooms. Key boilerplate atoms:
- \`deck_manager\`: Draw, discard, shuffle card deck
- \`room_generator\`: Procedural room layouts with walls/floors
- \`score_tracker\`: Tracks score and reports via postMessage
Focus on: card effects, enemy AI, room transitions, loot/rewards.`,

  "arena-dogfighter": `
## Genre: Arena Dogfighter
This game features aerial combat with flight physics. Key boilerplate atoms:
- \`flight_controls\`: Pitch, yaw, roll, thrust with drag
- \`projectile_system\`: Projectile creation and movement
- \`score_tracker\`: Tracks score and reports via postMessage
Focus on: ship models, targeting, enemy AI, health/damage, explosions.`,

  "base-builder": `
## Genre: Base Builder
This game is grid-based building with resource management. Key boilerplate atoms:
- \`grid_placement\`: Grid-based building placement
- \`resource_manager\`: Track wood, stone, gold resources
- \`score_tracker\`: Tracks score and reports via postMessage
Focus on: building types, resource gathering, workers, enemy waves.`,

  "top-down-shooter": `
## Genre: Top-Down Shooter
This game is a 2D arena shooter with 360-degree movement and aiming. Key boilerplate atoms:
- \`bullet_manager\`: Fires and updates bullet pool toward mouse target
- \`wave_spawner\`: Spawns enemies at screen edges, moves them toward player
- \`score_tracker\`: Tracks score and reports via postMessage
Focus on: movement feel, weapon variety, enemy patterns, screen shake, particle effects.`,

  "puzzle-match": `
## Genre: Puzzle Match
This game is a grid-based tile-matching puzzle. Key boilerplate atoms:
- \`match_checker\`: Scans grid for 3+ matches, clears and cascades
- \`score_tracker\`: Tracks score and reports via postMessage
Focus on: swap animations, cascade chains, special tiles, move limits, combo multipliers.`,

  "tower-defense-2d": `
## Genre: Tower Defense
This game is a path-based tower defense with wave spawning. Key boilerplate atoms:
- \`tower_placer\`: Places towers on valid grid slots with range/damage
- \`enemy_marcher\`: Moves enemies along waypoints, handles damage and removal
- \`score_tracker\`: Tracks score and reports via postMessage
Focus on: tower types, upgrade paths, wave pacing, enemy variety, projectile visuals.`,

  "endless-runner": `
## Genre: Endless Runner
This game is an auto-scrolling obstacle dodger with increasing speed. Key boilerplate atoms:
- \`obstacle_spawner\`: Spawns and scrolls obstacles, checks collisions
- \`score_tracker\`: Tracks score and reports via postMessage
Focus on: jump timing, obstacle variety, speed curves, pickups, visual polish.`,

  "top-down-rpg": `
## Genre: Top-Down RPG
This game is a tile-based exploration RPG with NPC interaction. Key boilerplate atoms:
- \`tile_movement\`: Grid-snapped movement with collision checking
- \`dialog_system\`: Show/hide/advance text dialog boxes
- \`score_tracker\`: Tracks score and reports via postMessage
Focus on: map design, NPC dialog trees, item collection, area transitions, simple combat.`,

  custom: `
## Genre: Custom
This is a blank Three.js canvas. The user wants to build something from scratch.
- \`score_tracker\`: Available for tracking score via postMessage
Build whatever the user requests. Start with the basics and iterate.`,
};

function getRuntimeContext(gameFormat: "2d" | "3d" | null | undefined): string {
  if (gameFormat === "2d") {
    return `
## Runtime Target: Phaser 3.90.0
- This game runs on Phaser, not Three.js.
- Read the \`phaser_js\` external before writing Phaser-specific code.
- 2D \`create_scene\` atoms should initialize a Phaser game with \`canvas: window.GAME.canvas\`.
- Prefer scenes, sprites, cameras, tweens, tilemaps, and Arcade-style gameplay structure.
- Do not plan Three.js render loops, meshes, or 3D camera math for 2D games unless the user explicitly asks for hybrid rendering.

## Optional 2D Externals (available on request)
- \`matter_js\` — Advanced 2D physics: polygon collisions, joints, constraints (Phaser Matter plugin)
- \`howler_js\` — Audio library with spatial sound, crossfades, and sound sprites
- \`rot_js\` — Roguelike toolkit: dungeon generation, FOV, pathfinding, turn scheduling
- \`seedrandom_js\` — Seeded PRNG for reproducible procedural generation and replays
- \`noisejs\` — Perlin and Simplex noise for terrain, textures, and organic randomness
- \`planck_js\` — Box2D physics port for precise 2D simulation (billiards, pinball)
- \`socket_io_client\` — Real-time multiplayer via WebSocket with auto-reconnection
`;
  }

  if (gameFormat === "3d") {
    return `
## Runtime Target: Three.js
- This game runs on Three.js.
- Read the \`three_js\` external before writing Three-specific code.
- 3D \`create_scene\` atoms should initialize scene, camera, and renderer state for \`window.GAME.canvas\`.

## Default 3D Externals (auto-installed)
- \`three_js\` — Three.js core (scene, camera, renderer, geometry, materials, lights)
- \`atomic_assets\` — Universal asset loader with fallbacks (images, textures, audio, placeholder meshes)
- \`buu_assets\` — 3D asset loading via BUU.loadModel(modelId) and BUU.loadWorldSplat(worldId)
- \`gaussian_splats_3d\` — Gaussian splat renderer for photorealistic 3D worlds (.spz, .ply, .splat)
- \`three_gltf_loader\` — GLTF/GLB model loader addon for Three.js

## Optional 3D Externals (available on request)
- \`cannon_es\` — 3D physics engine (rigid bodies, gravity, collisions, constraints)
- \`howler_js\` — Audio library with spatial 3D sound support
- \`three_orbit_controls\` — Camera orbit/pan/zoom controls
- \`simplex_noise\` — Procedural noise for terrain and texture generation
- \`gsap\` — Professional animation/tweening with timelines and easing
- \`pathfinding_js\` — A* grid-based pathfinding for AI navigation

## 3D Asset Strategy
- 3D games do NOT use 2D sprites. Task 8 (sprite generation) is skipped.
- Use BUU.loadModel() for 3D models and BUU.loadWorldSplat() for 3D environments.
- Use atomic_assets for textures and audio fallbacks.
`;
  }

  return "";
}

export function getGenreContext(
  genre: string | null,
  gameFormat: "2d" | "3d" | null = null,
): string {
  const runtimeContext = getRuntimeContext(gameFormat);

  if (genre === "custom" && gameFormat === "2d") {
    return `
## Genre: Custom
This is a blank Phaser canvas. The user wants to build something from scratch.
- \`score_tracker\`: Available for tracking score via postMessage
Build whatever the user requests. Start with the basics and iterate.
${runtimeContext}`;
  }

  if (genre === "side-scroller-2d-3d" && gameFormat === "2d") {
    return `
## Genre: Side-Scroller
This game is a 2D platformer built for Phaser. Key boilerplate atoms:
- \`platform_physics\`: Gravity, jumping, and ground collision
- \`camera_follow\`: Smooth side-scrolling camera tracking
- \`score_tracker\`: Tracks score and reports via postMessage
Focus on: readable sprite motion, jump timing, collectibles, hazards, and screen-space clarity.
${runtimeContext}`;
  }

  if (genre === "top-down-shooter" && gameFormat === "2d") {
    return `
## Genre: Top-Down Shooter
This game is a 2D arena shooter built for Phaser with 8-directional movement and mouse aiming. Key boilerplate atoms:
- \`bullet_manager\`: Fires and updates bullet pool toward mouse target angle
- \`wave_spawner\`: Spawns enemies at screen edges, moves them toward player
- \`score_tracker\`: Tracks score and reports via postMessage
Focus on: responsive movement, weapon variety, enemy patterns, screen shake, particle effects.
${runtimeContext}`;
  }

  if (genre === "puzzle-match" && gameFormat === "2d") {
    return `
## Genre: Puzzle Match
This game is a 2D grid-based tile-matching puzzle built for Phaser. Key boilerplate atoms:
- \`match_checker\`: Scans grid for 3+ horizontal/vertical matches, clears and refills
- \`score_tracker\`: Tracks score and reports via postMessage
Focus on: smooth swap/cascade tweens, special tiles, combo multipliers, move limits, and game-over logic.
${runtimeContext}`;
  }

  if (genre === "tower-defense-2d" && gameFormat === "2d") {
    return `
## Genre: Tower Defense
This game is a 2D path-based tower defense built for Phaser. Key boilerplate atoms:
- \`tower_placer\`: Places towers on valid grid slots with range and damage stats
- \`enemy_marcher\`: Moves enemies along path waypoints, handles damage and removal
- \`score_tracker\`: Tracks score and reports via postMessage
Focus on: tower types with unique attacks, wave pacing, upgrade paths, currency system, projectile visuals.
${runtimeContext}`;
  }

  if (genre === "endless-runner" && gameFormat === "2d") {
    return `
## Genre: Endless Runner
This game is a 2D auto-scrolling runner built for Phaser. Key boilerplate atoms:
- \`obstacle_spawner\`: Spawns obstacles from right edge, scrolls left, checks collision
- \`score_tracker\`: Tracks score (distance-based) and reports via postMessage
Focus on: jump timing, obstacle variety, speed ramp, pickups/coins, parallax backgrounds, game-over/restart.
${runtimeContext}`;
  }

  if (genre === "top-down-rpg" && gameFormat === "2d") {
    return `
## Genre: Top-Down RPG
This game is a 2D tile-based exploration RPG built for Phaser. Key boilerplate atoms:
- \`tile_movement\`: Grid-snapped WASD movement with collision checking
- \`dialog_system\`: Show/hide text dialog boxes for NPC interaction
- \`score_tracker\`: Tracks score and reports via postMessage
Focus on: map design, NPC dialog trees, item collection, area transitions, and simple turn-based combat.
${runtimeContext}`;
  }

  return `${genre ? GENRE_CONTEXT[genre] || "" : ""}${runtimeContext}`;
}

export const SYSTEM_PROMPT = `You build games using the **Atomic Game Maker** platform. Code lives as **atoms** (small JS functions, max 2KB) managed via tools, not in files.

## Workflow

Follow these steps for every task. Do NOT write code until step 8.

### 1. Understand the request
Read the user's message carefully. Identify what they want: new feature, bug fix, refactor, etc. Clarify ambiguities before proceeding.

### 2. Read code structure
Call \`get-code-structure\` to see the full atom map -- but ONLY if you haven't already called it earlier in this conversation. If you can see its results in previous messages, skip this step and use the cached info.

### 3. Find relevant atoms
Use \`get-code-structure\` results to identify atoms related to what you need to modify. Look at atom names, types, and descriptions to find relevant ones.

### 4. Read relevant atoms
Call \`read-atoms\` on the atoms that look relevant from steps 2-3, including their dependencies and dependents.

### 5. Enough info to plan?
Ask yourself: do I know exactly which atoms to create/modify and how they connect?
- Yes → go to step 6.
- No → read additional atoms, repeat until complete.

### 6. Create implementation plan
The plan is an ordered list of \`upsert-atom\` calls. For each upsert, specify:
- name, type (core/feature/util), description
- inputs and outputs (with types)
- dependencies (other atoms it calls)
- what the code does (brief logic summary)
- Whether it's a new atom or a modification

Order the list so dependencies come before the atoms that use them. If changing an atom's interface, include upserts for ALL its dependents.

Think atomically: every distinct operation gets its own atom. An if branch, a loop, a calculation, a state check -- if it does one thing, it's an atom. When in doubt, split.

### 7. Review
Present the upsert list to the user. Check for: missing dependencies, broken interfaces, ordering issues, atoms that exceed 2KB.

### 8. Implement
Execute the upsert list in order. Function name must match atom name. If any upsert-atom fails, stop and reassess. After all steps, verify key atoms with read-atoms.

## Hard Constraints

- **One job per atom**. Each atom does exactly one thing.
- **2KB max** per atom (~50 lines). If it's getting long, decompose.
- **Primitives-only interfaces**: number, string, boolean, number[], string[], boolean[], void.
- **Declare ALL dependencies**. Missing dependencies = broken builds.
- **Write descriptions** for every atom (powers search).
- **snake_case names**: player_jump, math_clamp, game_loop.
- **No classes**. Every atom is a plain function.
- **Bottom-up creation**: utils first, then features, then core.

## Required Score System

Every game must remain leaderboard-ready.

- A \`score_tracker\` atom is required.
- \`score_tracker\` must expose a numeric output named \`score\`.
- \`score_tracker\` must emit \`window.parent.postMessage({ type: "SCORE_UPDATE", score: ... })\`.
- At least one \`core\` or \`feature\` atom must depend on \`score_tracker\` so score reporting is wired into gameplay.
- Do not remove or bypass score reporting when modifying atoms.

## Atom Types

- core: system/entry points (game_loop, main, create_scene)
- feature: game mechanics (player_jump, spawn_enemy)
- util: helpers/configs (math_clamp, physics_config)

## External Dependencies

External libraries (Phaser, Three.js, cannon-es, etc.) are not atoms. They are managed by the user via the actions console (not by you).

- \`get-code-structure\` returns atoms along with their dependencies -- use this to see what externals are available.
- If a needed external is not installed, tell the user to install it via the Externals tab in the actions console.
- Canvas: \`document.getElementById('game-canvas')\`.
- Interfaces between atoms must still be primitives.

## Game Runtime (window.GAME)

The game player provides \`window.GAME\` globally before any atom code runs. Use it for input, time, and canvas access.

### Input
- \`window.GAME.inputs.keys\` -- object keyed by \`KeyboardEvent.code\` (e.g. "KeyW", "Space", "ArrowUp"). Value is \`true\` while held.
- \`window.GAME.inputs.justPressed\` -- \`true\` only on the frame the key went down.
- \`window.GAME.inputs.justReleased\` -- \`true\` only on the frame the key went up.
- Helpers: \`window.GAME.isKeyDown(code)\`, \`window.GAME.isKeyJustPressed(code)\`, \`window.GAME.isKeyJustReleased(code)\`.

### Mouse
- \`window.GAME.mouse.x\`, \`y\` -- pixel coords relative to canvas.
- \`window.GAME.mouse.normX\`, \`normY\` -- normalized (-1 to 1), useful for pointing math and 3D raycasting.
- \`window.GAME.mouse.buttons\` -- bitmask (1=left, 2=right, 4=middle).
- \`window.GAME.mouse.justDown\`, \`justUp\` -- true for one frame on primary button press/release.

### Time
- \`window.GAME.time.delta\` -- seconds since last frame (capped at 0.1).
- \`window.GAME.time.elapsed\` -- total seconds since game started.
- \`window.GAME.time.frame\` -- frame counter.

### Canvas
- \`window.GAME.canvas\` -- the \`<canvas>\` element.

### Game Loop Pattern
Call \`window.GAME.tick()\` at the start of each animation frame to update time and clear per-frame input state:
\`\`\`js
function game_loop() {
  const { scene, camera, renderer } = create_scene();
  function animate() {
    requestAnimationFrame(animate);
    window.GAME.tick();
    const dt = window.GAME.time.delta;
    // ... update using dt ...
    renderer.render(scene, camera);
  }
  animate();
}
\`\`\`

### 3D Models (buu.fun)

You have access to generate_model and generate_world tools for AI-generated 3D assets:

- \`generate_model({ prompt: "description" })\` → returns a modelId
- \`generate_world({ prompt: "description" })\` → returns a worldId

Then write atoms that call \`BUU.loadModel(modelId, options)\` or \`BUU.loadWorldSplat(worldId, options)\` to load them into the scene.

Required externals for 3D: three_js, three_gltf_loader, buu_assets. For splat worlds: also gaussian_splats_3d.
`;
