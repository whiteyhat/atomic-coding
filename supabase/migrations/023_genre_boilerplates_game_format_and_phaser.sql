-- =============================================================================
-- Migration 023: Genre boilerplate runtime split + Phaser external registry
-- =============================================================================

ALTER TABLE genre_boilerplates
  ADD COLUMN IF NOT EXISTS game_format TEXT CHECK (game_format IN ('2d', '3d'));

UPDATE genre_boilerplates
SET game_format = CASE
  WHEN slug = 'side-scroller-2d-3d' THEN '2d'
  ELSE '3d'
END
WHERE game_format IS NULL;

ALTER TABLE genre_boilerplates
  ALTER COLUMN game_format SET NOT NULL;

ALTER TABLE genre_boilerplates
  DROP CONSTRAINT IF EXISTS genre_boilerplates_slug_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_genre_boilerplates_slug_format
  ON genre_boilerplates (slug, game_format);

INSERT INTO external_registry (
  name,
  display_name,
  package_name,
  version,
  cdn_url,
  global_name,
  description,
  load_type,
  api_surface
)
VALUES (
  'phaser_js',
  'Phaser',
  'phaser',
  '3.90.0',
  'https://cdn.jsdelivr.net/npm/phaser@3.90.0/dist/phaser.min.js',
  'Phaser',
  '2D game engine for scenes, arcade physics, sprites, cameras, animation, particles, tilemaps, and input.',
  'script',
  '// Phaser 3.90.0 - Available API
//
// === Game Boot ===
// new Phaser.Game(config)
// Phaser.AUTO, Phaser.CANVAS, Phaser.WEBGL
//
// === Core Config ===
// type, canvas, width, height, backgroundColor
// scene: { preload, create, update }
// physics: { default: "arcade", arcade: { gravity, debug } }
//
// === Scene Systems ===
// this.add, this.physics, this.input, this.time, this.tweens, this.sound
// this.cameras.main, this.anims, this.children
//
// === Game Objects ===
// this.add.sprite(x, y, texture)
// this.add.image(x, y, texture)
// this.add.rectangle(x, y, width, height, color)
// this.add.text(x, y, text, style)
// this.add.tileSprite(x, y, width, height, texture)
// this.add.container(x, y, children)
//
// === Arcade Physics ===
// this.physics.add.existing(gameObject)
// this.physics.add.sprite(x, y, texture)
// this.physics.add.image(x, y, texture)
// this.physics.add.staticGroup()
// body.setVelocity(x, y)
// body.setCollideWorldBounds(true)
// body.setAllowGravity(true)
// this.physics.add.collider(a, b)
// this.physics.add.overlap(a, b, callback)
//
// === Cameras ===
// this.cameras.main.startFollow(target)
// this.cameras.main.setBounds(x, y, width, height)
// this.cameras.main.setZoom(value)
// this.cameras.main.setRoundPixels(true)
//
// === Input ===
// this.input.keyboard.createCursorKeys()
// this.input.keyboard.addKey("SPACE")
// this.input.keyboard.on("keydown-SPACE", callback)
// this.input.on("pointerdown", callback)
//
// === Texture Loading ===
// this.load.image(key, url)
// this.load.spritesheet(key, url, { frameWidth, frameHeight })
// this.load.atlas(key, textureURL, atlasURL)
//
// === Notes ===
// - Use window.GAME.canvas as the canvas target when booting Phaser.
// - Destroy old runtimes with game.destroy(true) before re-booting.
// - Arcade physics is the default 2D runtime in this project.'
)
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  package_name = EXCLUDED.package_name,
  version = EXCLUDED.version,
  cdn_url = EXCLUDED.cdn_url,
  global_name = EXCLUDED.global_name,
  description = EXCLUDED.description,
  load_type = EXCLUDED.load_type,
  api_surface = EXCLUDED.api_surface;

UPDATE genre_boilerplates
SET
  description = '2D Phaser platformer with jumping, running, collectibles, and camera follow.',
  externals = ARRAY['phaser_js'],
  atoms_json = $$[
    {
      "name": "create_scene",
      "type": "core",
      "description": "Boot a Phaser 2D platformer scene on the shared game canvas",
      "code": "function create_scene() {\n  if (window.__PHASER_GAME__ && !window.__PHASER_GAME__.isDestroyed) return 'ready';\n  const canvas = window.GAME.canvas;\n  const width = canvas.clientWidth || canvas.width || 960;\n  const height = canvas.clientHeight || canvas.height || 540;\n  const config = {\n    type: Phaser.AUTO,\n    canvas,\n    width,\n    height,\n    backgroundColor: '#87ceeb',\n    physics: {\n      default: 'arcade',\n      arcade: { gravity: { y: 0 }, debug: false }\n    },\n    scene: {\n      create: function() {\n        const scene = this;\n        scene.cameras.main.setRoundPixels(true);\n        scene.add.rectangle(width / 2, height - 24, width, 48, 0x2f855a).setOrigin(0.5);\n        const player = scene.add.rectangle(120, height - 72, 36, 44, 0xf6ad55);\n        window._side_scroller = {\n          scene,\n          player,\n          velocityY: 0,\n          groundY: height - 72,\n          scoreGiven: false,\n          jumpQueued: false\n        };\n        scene.input.keyboard.on('keydown-SPACE', function() {\n          if (window._side_scroller) window._side_scroller.jumpQueued = true;\n        });\n        scene.add.text(16, 16, 'Phaser Side-Scroller', {\n          font: '16px monospace',\n          color: '#0f172a'\n        });\n      },\n      update: function() {\n        if (!window._side_scroller) return;\n        const state = window._side_scroller;\n        const dt = Math.max(window.GAME.time.delta || 0.016, 0.016);\n        const keys = window.GAME.inputs.keys;\n        if ((keys.ArrowRight || keys.KeyD)) state.player.x += 220 * dt;\n        if ((keys.ArrowLeft || keys.KeyA)) state.player.x -= 220 * dt;\n        state.player.x = Math.max(24, Math.min(width - 24, state.player.x));\n        const physicsResult = JSON.parse(platform_physics(state.player.y, state.velocityY, state.groundY, dt));\n        state.player.y = physicsResult.y;\n        state.velocityY = physicsResult.vy;\n        if (state.jumpQueued && physicsResult.grounded) {\n          state.velocityY = -420;\n        }\n        state.jumpQueued = false;\n        const nextCameraX = camera_follow(this.cameras.main.scrollX, state.player.x - width * 0.35, dt);\n        this.cameras.main.scrollX = Math.max(0, nextCameraX);\n        if (!state.scoreGiven && state.player.x > width * 0.72) {\n          score_tracker(100, 'add');\n          state.scoreGiven = true;\n        }\n      }\n    }\n  };\n  window.__PHASER_GAME__ = new Phaser.Game(config);\n  return 'ready';\n}",
      "inputs": [],
      "outputs": [{ "name": "status", "type": "string" }],
      "dependencies": ["platform_physics", "camera_follow", "score_tracker"]
    },
    {
      "name": "platform_physics",
      "type": "feature",
      "description": "Apply gravity and ground collision for the starter side-scroller hero",
      "code": "function platform_physics(pos_y, vel_y, ground_y, dt) {\n  const gravity = 1200;\n  let nextVelY = vel_y + gravity * dt;\n  let nextPosY = pos_y + nextVelY * dt;\n  let grounded = false;\n  if (nextPosY >= ground_y) {\n    nextPosY = ground_y;\n    nextVelY = 0;\n    grounded = true;\n  }\n  return JSON.stringify({ y: nextPosY, vy: nextVelY, grounded: grounded });\n}",
      "inputs": [
        { "name": "pos_y", "type": "number" },
        { "name": "vel_y", "type": "number" },
        { "name": "ground_y", "type": "number" },
        { "name": "dt", "type": "number" }
      ],
      "outputs": [{ "name": "result", "type": "string" }],
      "dependencies": []
    },
    {
      "name": "camera_follow",
      "type": "feature",
      "description": "Smoothly ease the 2D camera toward the player target position",
      "code": "function camera_follow(camera_x, target_x, dt) {\n  const speed = 6;\n  return camera_x + (target_x - camera_x) * Math.min(speed * dt, 1);\n}",
      "inputs": [
        { "name": "camera_x", "type": "number" },
        { "name": "target_x", "type": "number" },
        { "name": "dt", "type": "number" }
      ],
      "outputs": [{ "name": "next_x", "type": "number" }],
      "dependencies": []
    },
    {
      "name": "score_tracker",
      "type": "feature",
      "description": "Track and report game score via SCORE_UPDATE postMessage",
      "code": "function score_tracker(points, action) {\n  if (!window._score) window._score = 0;\n  if (action === 'add') window._score += points;\n  if (action === 'reset') window._score = 0;\n  window.parent.postMessage({ type: 'SCORE_UPDATE', score: window._score }, '*');\n  return window._score;\n}",
      "inputs": [
        { "name": "points", "type": "number" },
        { "name": "action", "type": "string" }
      ],
      "outputs": [{ "name": "score", "type": "number" }],
      "dependencies": []
    },
    {
      "name": "game_loop",
      "type": "core",
      "description": "Start the Phaser runtime for the side-scroller starter",
      "code": "function game_loop() {\n  create_scene();\n  return true;\n}",
      "inputs": [],
      "outputs": [{ "name": "started", "type": "boolean" }],
      "dependencies": ["create_scene"]
    }
  ]$$::jsonb
WHERE slug = 'side-scroller-2d-3d'
  AND game_format = '2d';

UPDATE genre_boilerplates
SET
  description = 'Start from scratch with a blank Three.js canvas — build anything you can imagine.'
WHERE slug = 'custom'
  AND game_format = '3d';

INSERT INTO genre_boilerplates (
  slug,
  display_name,
  description,
  atoms_json,
  externals,
  template_prompts,
  game_format
)
VALUES (
  'custom',
  'Custom',
  'Start from scratch with a blank Phaser canvas — build any 2D game you can imagine.',
  $$[
    {
      "name": "create_scene",
      "type": "core",
      "description": "Boot a blank Phaser scene on the shared game canvas",
      "code": "function create_scene() {\n  if (window.__PHASER_GAME__ && !window.__PHASER_GAME__.isDestroyed) return 'ready';\n  const canvas = window.GAME.canvas;\n  const width = canvas.clientWidth || canvas.width || 960;\n  const height = canvas.clientHeight || canvas.height || 540;\n  const config = {\n    type: Phaser.AUTO,\n    canvas,\n    width,\n    height,\n    backgroundColor: '#111827',\n    scene: {\n      create: function() {\n        const scene = this;\n        scene.cameras.main.setRoundPixels(true);\n        const hero = scene.add.circle(width / 2, height / 2, 22, 0x22d3ee);\n        scene.add.text(16, 16, 'Blank Phaser Canvas', {\n          font: '16px monospace',\n          color: '#f8fafc'\n        });\n        window._phaser_custom = { hero: hero, scoreGiven: false, width: width, height: height };\n      },\n      update: function() {\n        if (!window._phaser_custom) return;\n        const state = window._phaser_custom;\n        const dt = Math.max(window.GAME.time.delta || 0.016, 0.016);\n        const speed = 180;\n        if (window.GAME.isKeyDown('ArrowRight') || window.GAME.isKeyDown('KeyD')) state.hero.x += speed * dt;\n        if (window.GAME.isKeyDown('ArrowLeft') || window.GAME.isKeyDown('KeyA')) state.hero.x -= speed * dt;\n        if (window.GAME.isKeyDown('ArrowUp') || window.GAME.isKeyDown('KeyW')) state.hero.y -= speed * dt;\n        if (window.GAME.isKeyDown('ArrowDown') || window.GAME.isKeyDown('KeyS')) state.hero.y += speed * dt;\n        state.hero.x = Math.max(24, Math.min(state.width - 24, state.hero.x));\n        state.hero.y = Math.max(24, Math.min(state.height - 24, state.hero.y));\n        if (!state.scoreGiven && state.hero.x > state.width * 0.75) {\n          score_tracker(50, 'add');\n          state.scoreGiven = true;\n        }\n      }\n    }\n  };\n  window.__PHASER_GAME__ = new Phaser.Game(config);\n  return 'ready';\n}",
      "inputs": [],
      "outputs": [{ "name": "status", "type": "string" }],
      "dependencies": ["score_tracker"]
    },
    {
      "name": "score_tracker",
      "type": "feature",
      "description": "Track and report game score via SCORE_UPDATE postMessage",
      "code": "function score_tracker(points, action) {\n  if (!window._score) window._score = 0;\n  if (action === 'add') window._score += points;\n  if (action === 'reset') window._score = 0;\n  window.parent.postMessage({ type: 'SCORE_UPDATE', score: window._score }, '*');\n  return window._score;\n}",
      "inputs": [
        { "name": "points", "type": "number" },
        { "name": "action", "type": "string" }
      ],
      "outputs": [{ "name": "score", "type": "number" }],
      "dependencies": []
    },
    {
      "name": "game_loop",
      "type": "core",
      "description": "Start the blank Phaser runtime",
      "code": "function game_loop() {\n  create_scene();\n  return true;\n}",
      "inputs": [],
      "outputs": [{ "name": "started", "type": "boolean" }],
      "dependencies": ["create_scene"]
    }
  ]$$::jsonb,
  ARRAY['phaser_js'],
  ARRAY[
    'Create a top-down arcade game with collectible pickups',
    'Build a 2D dodge-survival prototype with score streaks',
    'Add enemies, particles, and a pause menu to the Phaser starter'
  ],
  '2d'
)
ON CONFLICT (slug, game_format) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  atoms_json = EXCLUDED.atoms_json,
  externals = EXCLUDED.externals,
  template_prompts = EXCLUDED.template_prompts;
