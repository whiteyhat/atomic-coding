-- =============================================================================
-- Migration 028: Seed 2D Phaser Genre Boilerplates
-- =============================================================================
-- Adds 5 new 2D (Phaser) game genres alongside the existing side-scroller.
-- Each includes score_tracker + genre-specific starter atoms.
-- =============================================================================

-- ─── Top-Down Shooter ──────────────────────────────────────────────────────────

INSERT INTO genre_boilerplates (slug, display_name, description, atoms_json, externals, template_prompts, game_format)
VALUES (
  'top-down-shooter',
  'Top-Down Shooter',
  '2D Phaser arena shooter with 8-directional movement, mouse aiming, and enemy waves.',
  $$[
    {
      "name": "create_scene",
      "type": "core",
      "description": "Boot a Phaser 2D top-down shooter scene on the shared game canvas",
      "code": "function create_scene() {\n  if (window.__PHASER_GAME__ && !window.__PHASER_GAME__.isDestroyed) return 'ready';\n  const canvas = window.GAME.canvas;\n  const width = canvas.clientWidth || canvas.width || 960;\n  const height = canvas.clientHeight || canvas.height || 540;\n  const config = {\n    type: Phaser.AUTO,\n    canvas,\n    width,\n    height,\n    backgroundColor: '#0f172a',\n    scene: {\n      create: function() {\n        const scene = this;\n        scene.cameras.main.setRoundPixels(true);\n        const player = scene.add.rectangle(width / 2, height / 2, 28, 28, 0x22d3ee);\n        const aimLine = scene.add.line(0, 0, 0, 0, 40, 0, 0x22d3ee, 0.4).setOrigin(0);\n        scene.add.text(16, 16, 'Top-Down Shooter', { font: '14px monospace', color: '#94a3b8' });\n        window._top_down_shooter = { scene, player, aimLine, width, height };\n      },\n      update: function() {\n        if (!window._top_down_shooter) return;\n        const s = window._top_down_shooter;\n        const dt = Math.max(window.GAME.time.delta || 0.016, 0.016);\n        const speed = 200;\n        const keys = window.GAME.inputs.keys;\n        if (keys.ArrowUp || keys.KeyW) s.player.y -= speed * dt;\n        if (keys.ArrowDown || keys.KeyS) s.player.y += speed * dt;\n        if (keys.ArrowLeft || keys.KeyA) s.player.x -= speed * dt;\n        if (keys.ArrowRight || keys.KeyD) s.player.x += speed * dt;\n        s.player.x = Math.max(14, Math.min(s.width - 14, s.player.x));\n        s.player.y = Math.max(14, Math.min(s.height - 14, s.player.y));\n        const mx = window.GAME.mouse.x;\n        const my = window.GAME.mouse.y;\n        const ang = Math.atan2(my - s.player.y, mx - s.player.x);\n        s.aimLine.setTo(s.player.x, s.player.y, s.player.x + Math.cos(ang) * 40, s.player.y + Math.sin(ang) * 40);\n        if (window.GAME.mouse.justDown) bullet_manager('fire', s.player.x, s.player.y, ang);\n        bullet_manager('update', 0, 0, 0);\n        wave_spawner('update', s.player.x, s.player.y);\n      }\n    }\n  };\n  window.__PHASER_GAME__ = new Phaser.Game(config);\n  return 'ready';\n}",
      "inputs": [],
      "outputs": [{ "name": "status", "type": "string" }],
      "dependencies": ["bullet_manager", "wave_spawner", "score_tracker"]
    },
    {
      "name": "bullet_manager",
      "type": "feature",
      "description": "Manage a pool of bullets — fire toward angle, update positions, remove expired",
      "code": "function bullet_manager(action, x, y, angle) {\n  if (!window._bullets) window._bullets = [];\n  const b = window._bullets;\n  if (action === 'fire') {\n    const s = window._top_down_shooter;\n    if (!s) return JSON.stringify(0);\n    const speed = 500;\n    const rect = s.scene.add.rectangle(x, y, 6, 6, 0xfbbf24);\n    b.push({ rect, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 1.5 });\n  }\n  if (action === 'update') {\n    const dt = Math.max(window.GAME.time.delta || 0.016, 0.016);\n    for (let i = b.length - 1; i >= 0; i--) {\n      b[i].rect.x += b[i].vx * dt;\n      b[i].rect.y += b[i].vy * dt;\n      b[i].life -= dt;\n      if (b[i].life <= 0) { b[i].rect.destroy(); b.splice(i, 1); }\n    }\n  }\n  return JSON.stringify(b.length);\n}",
      "inputs": [
        { "name": "action", "type": "string" },
        { "name": "x", "type": "number" },
        { "name": "y", "type": "number" },
        { "name": "angle", "type": "number" }
      ],
      "outputs": [{ "name": "count", "type": "string" }],
      "dependencies": []
    },
    {
      "name": "wave_spawner",
      "type": "feature",
      "description": "Spawn enemies at screen edges and move them toward the player",
      "code": "function wave_spawner(action, player_x, player_y) {\n  if (!window._enemies) window._enemies = { list: [], timer: 0 };\n  const e = window._enemies;\n  const dt = Math.max(window.GAME.time.delta || 0.016, 0.016);\n  if (action === 'update') {\n    e.timer -= dt;\n    if (e.timer <= 0 && window._top_down_shooter) {\n      const s = window._top_down_shooter;\n      const side = Math.floor(Math.random() * 4);\n      let ex, ey;\n      if (side === 0) { ex = Math.random() * s.width; ey = -20; }\n      else if (side === 1) { ex = s.width + 20; ey = Math.random() * s.height; }\n      else if (side === 2) { ex = Math.random() * s.width; ey = s.height + 20; }\n      else { ex = -20; ey = Math.random() * s.height; }\n      const rect = s.scene.add.rectangle(ex, ey, 22, 22, 0xef4444);\n      e.list.push({ rect, hp: 1 });\n      e.timer = 1.5;\n    }\n    const bullets = window._bullets || [];\n    for (let i = e.list.length - 1; i >= 0; i--) {\n      const en = e.list[i];\n      const dx = player_x - en.rect.x;\n      const dy = player_y - en.rect.y;\n      const dist = Math.sqrt(dx * dx + dy * dy) || 1;\n      en.rect.x += (dx / dist) * 80 * dt;\n      en.rect.y += (dy / dist) * 80 * dt;\n      for (let j = bullets.length - 1; j >= 0; j--) {\n        const bx = bullets[j].rect.x - en.rect.x;\n        const by = bullets[j].rect.y - en.rect.y;\n        if (Math.abs(bx) < 16 && Math.abs(by) < 16) {\n          en.hp--; bullets[j].rect.destroy(); bullets.splice(j, 1);\n          if (en.hp <= 0) { en.rect.destroy(); e.list.splice(i, 1); score_tracker(10, 'add'); break; }\n        }\n      }\n    }\n  }\n  return JSON.stringify(e.list.length);\n}",
      "inputs": [
        { "name": "action", "type": "string" },
        { "name": "player_x", "type": "number" },
        { "name": "player_y", "type": "number" }
      ],
      "outputs": [{ "name": "count", "type": "string" }],
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
      "description": "Start the Phaser runtime for the top-down shooter",
      "code": "function game_loop() {\n  create_scene();\n  return true;\n}",
      "inputs": [],
      "outputs": [{ "name": "started", "type": "boolean" }],
      "dependencies": ["create_scene"]
    }
  ]$$::jsonb,
  ARRAY['phaser_js'],
  ARRAY[
    'Add enemy types with different speeds and health',
    'Create weapon upgrades that drop from defeated enemies',
    'Add a dash ability with cooldown on Shift key'
  ],
  '2d'
)
ON CONFLICT (slug, game_format) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  atoms_json = EXCLUDED.atoms_json,
  externals = EXCLUDED.externals,
  template_prompts = EXCLUDED.template_prompts;

-- ─── Puzzle Match ──────────────────────────────────────────────────────────────

INSERT INTO genre_boilerplates (slug, display_name, description, atoms_json, externals, template_prompts, game_format)
VALUES (
  'puzzle-match',
  'Puzzle Match',
  '2D Phaser grid-based tile matching with swap, match-3 detection, and cascades.',
  $$[
    {
      "name": "create_scene",
      "type": "core",
      "description": "Boot a Phaser 2D puzzle-match scene with a 6x6 colored grid",
      "code": "function create_scene() {\n  if (window.__PHASER_GAME__ && !window.__PHASER_GAME__.isDestroyed) return 'ready';\n  const canvas = window.GAME.canvas;\n  const width = canvas.clientWidth || canvas.width || 960;\n  const height = canvas.clientHeight || canvas.height || 540;\n  const cols = 6, rows = 6, tileSize = 56, pad = 4;\n  const colors = [0xef4444, 0x3b82f6, 0x22c55e, 0xeab308, 0xa855f7];\n  const config = {\n    type: Phaser.AUTO,\n    canvas,\n    width,\n    height,\n    backgroundColor: '#1e1b4b',\n    scene: {\n      create: function() {\n        const scene = this;\n        scene.cameras.main.setRoundPixels(true);\n        const ox = (width - cols * tileSize) / 2;\n        const oy = (height - rows * tileSize) / 2;\n        const grid = [];\n        for (let r = 0; r < rows; r++) {\n          grid[r] = [];\n          for (let c = 0; c < cols; c++) {\n            const ci = Math.floor(Math.random() * colors.length);\n            const x = ox + c * tileSize + tileSize / 2;\n            const y = oy + r * tileSize + tileSize / 2;\n            const rect = scene.add.rectangle(x, y, tileSize - pad, tileSize - pad, colors[ci]).setInteractive();\n            rect.setData('ci', ci); rect.setData('r', r); rect.setData('c', c);\n            grid[r][c] = { rect, ci };\n          }\n        }\n        scene.add.text(16, 16, 'Puzzle Match', { font: '14px monospace', color: '#c4b5fd' });\n        window._puzzle_match = { scene, grid, cols, rows, tileSize, ox, oy, colors, selected: null, animating: false };\n        scene.input.on('gameobjectdown', function(ptr, obj) {\n          if (window._puzzle_match.animating) return;\n          const s = window._puzzle_match;\n          const r = obj.getData('r'), c = obj.getData('c');\n          if (!s.selected) { s.selected = { r, c }; obj.setStrokeStyle(2, 0xffffff); return; }\n          const pr = s.selected.r, pc = s.selected.c;\n          s.grid[pr][pc].rect.setStrokeStyle();\n          const dr = Math.abs(r - pr), dc = Math.abs(c - pc);\n          if ((dr + dc) === 1) {\n            const tmp = s.grid[pr][pc]; s.grid[pr][pc] = s.grid[r][c]; s.grid[r][c] = tmp;\n            s.animating = true;\n            const ax = s.ox + c * s.tileSize + s.tileSize / 2;\n            const ay = s.oy + r * s.tileSize + s.tileSize / 2;\n            const bx = s.ox + pc * s.tileSize + s.tileSize / 2;\n            const by = s.oy + pr * s.tileSize + s.tileSize / 2;\n            scene.tweens.add({ targets: s.grid[r][c].rect, x: ax, y: ay, duration: 150 });\n            scene.tweens.add({ targets: s.grid[pr][pc].rect, x: bx, y: by, duration: 150, onComplete: function() {\n              s.grid[r][c].rect.setData('r', r); s.grid[r][c].rect.setData('c', c);\n              s.grid[pr][pc].rect.setData('r', pr); s.grid[pr][pc].rect.setData('c', pc);\n              var matched = match_checker('check', 0);\n              if (JSON.parse(matched).length === 0) {\n                var t2 = s.grid[pr][pc]; s.grid[pr][pc] = s.grid[r][c]; s.grid[r][c] = t2;\n                scene.tweens.add({ targets: s.grid[r][c].rect, x: ax, y: ay, duration: 150 });\n                scene.tweens.add({ targets: s.grid[pr][pc].rect, x: bx, y: by, duration: 150, onComplete: function() {\n                  s.grid[r][c].rect.setData('r', r); s.grid[pr][pc].rect.setData('r', pr);\n                  s.grid[r][c].rect.setData('c', c); s.grid[pr][pc].rect.setData('c', pc);\n                  s.animating = false;\n                }});\n              } else { s.animating = false; }\n            }});\n          }\n          s.selected = null;\n        });\n      }\n    }\n  };\n  window.__PHASER_GAME__ = new Phaser.Game(config);\n  return 'ready';\n}",
      "inputs": [],
      "outputs": [{ "name": "status", "type": "string" }],
      "dependencies": ["match_checker", "score_tracker"]
    },
    {
      "name": "match_checker",
      "type": "feature",
      "description": "Scan the grid for 3+ horizontal or vertical matches, clear them, and award score",
      "code": "function match_checker(action, unused) {\n  if (!window._puzzle_match) return JSON.stringify([]);\n  const s = window._puzzle_match;\n  const matched = new Set();\n  for (let r = 0; r < s.rows; r++) {\n    for (let c = 0; c < s.cols - 2; c++) {\n      if (s.grid[r][c].ci === s.grid[r][c+1].ci && s.grid[r][c].ci === s.grid[r][c+2].ci) {\n        matched.add(r+','+c); matched.add(r+','+(c+1)); matched.add(r+','+(c+2));\n      }\n    }\n  }\n  for (let c = 0; c < s.cols; c++) {\n    for (let r = 0; r < s.rows - 2; r++) {\n      if (s.grid[r][c].ci === s.grid[r+1][c].ci && s.grid[r][c].ci === s.grid[r+2][c].ci) {\n        matched.add(r+','+c); matched.add((r+1)+','+c); matched.add((r+2)+','+c);\n      }\n    }\n  }\n  const arr = Array.from(matched);\n  if (action === 'check') return JSON.stringify(arr);\n  arr.forEach(function(key) {\n    var parts = key.split(','); var r = +parts[0]; var c = +parts[1];\n    s.grid[r][c].rect.setVisible(false);\n    var ni = Math.floor(Math.random() * s.colors.length);\n    s.grid[r][c].ci = ni; s.grid[r][c].rect.setFillStyle(s.colors[ni]);\n    s.grid[r][c].rect.setVisible(true);\n  });\n  if (arr.length > 0) score_tracker(arr.length * 10, 'add');\n  return JSON.stringify(arr);\n}",
      "inputs": [
        { "name": "action", "type": "string" },
        { "name": "unused", "type": "number" }
      ],
      "outputs": [{ "name": "matches", "type": "string" }],
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
      "description": "Start the Phaser runtime for puzzle match",
      "code": "function game_loop() {\n  create_scene();\n  return true;\n}",
      "inputs": [],
      "outputs": [{ "name": "started", "type": "boolean" }],
      "dependencies": ["create_scene"]
    }
  ]$$::jsonb,
  ARRAY['phaser_js'],
  ARRAY[
    'Add cascade combos that chain after tiles fall',
    'Create special tiles that clear entire rows or columns',
    'Add a move counter and game-over screen'
  ],
  '2d'
)
ON CONFLICT (slug, game_format) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  atoms_json = EXCLUDED.atoms_json,
  externals = EXCLUDED.externals,
  template_prompts = EXCLUDED.template_prompts;

-- ─── Tower Defense ─────────────────────────────────────────────────────────────

INSERT INTO genre_boilerplates (slug, display_name, description, atoms_json, externals, template_prompts, game_format)
VALUES (
  'tower-defense-2d',
  'Tower Defense',
  '2D Phaser tower defense with path-following enemies, tower placement, and wave management.',
  $$[
    {
      "name": "create_scene",
      "type": "core",
      "description": "Boot a Phaser 2D tower defense scene with a path and tower slots",
      "code": "function create_scene() {\n  if (window.__PHASER_GAME__ && !window.__PHASER_GAME__.isDestroyed) return 'ready';\n  const canvas = window.GAME.canvas;\n  const width = canvas.clientWidth || canvas.width || 960;\n  const height = canvas.clientHeight || canvas.height || 540;\n  const path = [{x:0,y:270},{x:200,y:270},{x:200,y:100},{x:500,y:100},{x:500,y:400},{x:800,y:400},{x:800,y:270},{x:960,y:270}];\n  const config = {\n    type: Phaser.AUTO,\n    canvas,\n    width,\n    height,\n    backgroundColor: '#1a3a1a',\n    scene: {\n      create: function() {\n        const scene = this;\n        scene.cameras.main.setRoundPixels(true);\n        var gfx = scene.add.graphics();\n        gfx.lineStyle(24, 0x8b7355, 1);\n        gfx.beginPath(); gfx.moveTo(path[0].x, path[0].y);\n        for (var i = 1; i < path.length; i++) gfx.lineTo(path[i].x, path[i].y);\n        gfx.strokePath();\n        scene.add.text(16, 16, 'Tower Defense', { font: '14px monospace', color: '#86efac' });\n        window._tower_defense = { scene, path, width, height, lives: 10, spawnTimer: 0 };\n      },\n      update: function() {\n        if (!window._tower_defense) return;\n        var s = window._tower_defense;\n        var dt = Math.max(window.GAME.time.delta || 0.016, 0.016);\n        s.spawnTimer -= dt;\n        if (s.spawnTimer <= 0) { enemy_marcher('spawn', 0, 0); s.spawnTimer = 2.5; }\n        enemy_marcher('update', 0, 0);\n        if (window.GAME.mouse.justDown) {\n          tower_placer(Math.round(window.GAME.mouse.x / 60) * 60, Math.round(window.GAME.mouse.y / 60) * 60, 'basic');\n        }\n        var towers = window._towers || [];\n        var enemies = (window._td_enemies || {}).list || [];\n        towers.forEach(function(t) {\n          t.cooldown -= dt;\n          if (t.cooldown > 0) return;\n          for (var i = 0; i < enemies.length; i++) {\n            var dx = enemies[i].rect.x - t.rect.x;\n            var dy = enemies[i].rect.y - t.rect.y;\n            if (Math.sqrt(dx*dx+dy*dy) < t.range) {\n              enemies[i].hp -= t.damage;\n              t.cooldown = 1;\n              if (enemies[i].hp <= 0) { enemies[i].rect.destroy(); enemies.splice(i,1); score_tracker(15,'add'); }\n              break;\n            }\n          }\n        });\n      }\n    }\n  };\n  window.__PHASER_GAME__ = new Phaser.Game(config);\n  return 'ready';\n}",
      "inputs": [],
      "outputs": [{ "name": "status", "type": "string" }],
      "dependencies": ["tower_placer", "enemy_marcher", "score_tracker"]
    },
    {
      "name": "tower_placer",
      "type": "feature",
      "description": "Place a tower at a grid position with range and damage stats",
      "code": "function tower_placer(grid_x, grid_y, tower_type) {\n  if (!window._towers) window._towers = [];\n  var t = window._towers;\n  for (var i = 0; i < t.length; i++) {\n    if (t[i].rect.x === grid_x && t[i].rect.y === grid_y) return JSON.stringify({ error: 'occupied' });\n  }\n  var s = window._tower_defense;\n  if (!s) return JSON.stringify({ error: 'no_scene' });\n  var rect = s.scene.add.rectangle(grid_x, grid_y, 30, 30, 0x60a5fa);\n  var rangeCircle = s.scene.add.circle(grid_x, grid_y, 100, 0x60a5fa, 0.08);\n  t.push({ rect, rangeCircle, range: 100, damage: 1, cooldown: 0, type: tower_type });\n  return JSON.stringify({ placed: tower_type, x: grid_x, y: grid_y });\n}",
      "inputs": [
        { "name": "grid_x", "type": "number" },
        { "name": "grid_y", "type": "number" },
        { "name": "tower_type", "type": "string" }
      ],
      "outputs": [{ "name": "result", "type": "string" }],
      "dependencies": []
    },
    {
      "name": "enemy_marcher",
      "type": "feature",
      "description": "Move enemies along the path waypoints, remove at end or on death",
      "code": "function enemy_marcher(action, unused1, unused2) {\n  if (!window._td_enemies) window._td_enemies = { list: [] };\n  var e = window._td_enemies;\n  var s = window._tower_defense;\n  if (!s) return JSON.stringify(0);\n  if (action === 'spawn') {\n    var rect = s.scene.add.rectangle(s.path[0].x, s.path[0].y, 18, 18, 0xef4444);\n    e.list.push({ rect, hp: 3, waypointIdx: 0 });\n  }\n  if (action === 'update') {\n    var dt = Math.max(window.GAME.time.delta || 0.016, 0.016);\n    var speed = 60;\n    for (var i = e.list.length - 1; i >= 0; i--) {\n      var en = e.list[i];\n      var wp = s.path[en.waypointIdx + 1];\n      if (!wp) { en.rect.destroy(); e.list.splice(i, 1); s.lives--; continue; }\n      var dx = wp.x - en.rect.x;\n      var dy = wp.y - en.rect.y;\n      var dist = Math.sqrt(dx*dx + dy*dy) || 1;\n      if (dist < 4) { en.waypointIdx++; continue; }\n      en.rect.x += (dx / dist) * speed * dt;\n      en.rect.y += (dy / dist) * speed * dt;\n    }\n  }\n  return JSON.stringify(e.list.length);\n}",
      "inputs": [
        { "name": "action", "type": "string" },
        { "name": "unused1", "type": "number" },
        { "name": "unused2", "type": "number" }
      ],
      "outputs": [{ "name": "count", "type": "string" }],
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
      "description": "Start the Phaser runtime for tower defense",
      "code": "function game_loop() {\n  create_scene();\n  return true;\n}",
      "inputs": [],
      "outputs": [{ "name": "started", "type": "boolean" }],
      "dependencies": ["create_scene"]
    }
  ]$$::jsonb,
  ARRAY['phaser_js'],
  ARRAY[
    'Add different tower types with unique attack patterns',
    'Create a wave system with increasing difficulty',
    'Add a currency system to buy and upgrade towers'
  ],
  '2d'
)
ON CONFLICT (slug, game_format) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  atoms_json = EXCLUDED.atoms_json,
  externals = EXCLUDED.externals,
  template_prompts = EXCLUDED.template_prompts;

-- ─── Endless Runner ────────────────────────────────────────────────────────────

INSERT INTO genre_boilerplates (slug, display_name, description, atoms_json, externals, template_prompts, game_format)
VALUES (
  'endless-runner',
  'Endless Runner',
  '2D Phaser auto-scrolling runner with jump, obstacles, and increasing speed.',
  $$[
    {
      "name": "create_scene",
      "type": "core",
      "description": "Boot a Phaser 2D endless runner scene with scrolling ground and player",
      "code": "function create_scene() {\n  if (window.__PHASER_GAME__ && !window.__PHASER_GAME__.isDestroyed) return 'ready';\n  const canvas = window.GAME.canvas;\n  const width = canvas.clientWidth || canvas.width || 960;\n  const height = canvas.clientHeight || canvas.height || 540;\n  const groundY = height - 60;\n  const config = {\n    type: Phaser.AUTO,\n    canvas,\n    width,\n    height,\n    backgroundColor: '#0c0a1d',\n    scene: {\n      create: function() {\n        const scene = this;\n        scene.cameras.main.setRoundPixels(true);\n        var ground = scene.add.rectangle(width / 2, groundY + 30, width, 60, 0x374151);\n        var player = scene.add.rectangle(120, groundY - 20, 28, 40, 0x34d399);\n        scene.add.text(16, 16, 'Endless Runner', { font: '14px monospace', color: '#6ee7b7' });\n        window._endless_runner = {\n          scene, player, ground, width, height, groundY,\n          velY: 0, speed: 200, alive: true, distance: 0,\n          jumpQueued: false\n        };\n        scene.input.keyboard.on('keydown-SPACE', function() {\n          if (window._endless_runner) window._endless_runner.jumpQueued = true;\n        });\n        scene.input.on('pointerdown', function() {\n          if (window._endless_runner) window._endless_runner.jumpQueued = true;\n        });\n      },\n      update: function() {\n        if (!window._endless_runner || !window._endless_runner.alive) return;\n        var s = window._endless_runner;\n        var dt = Math.max(window.GAME.time.delta || 0.016, 0.016);\n        var gravity = 1200;\n        s.velY += gravity * dt;\n        s.player.y += s.velY * dt;\n        var onGround = false;\n        if (s.player.y >= s.groundY - 20) {\n          s.player.y = s.groundY - 20; s.velY = 0; onGround = true;\n        }\n        if (s.jumpQueued && onGround) s.velY = -480;\n        s.jumpQueued = false;\n        s.speed += 8 * dt;\n        s.distance += s.speed * dt;\n        obstacle_spawner('update', s.speed, s.player.x, s.player.y);\n        score_tracker(Math.floor(s.distance / 50), 'reset');\n        score_tracker(Math.floor(s.distance / 50), 'add');\n      }\n    }\n  };\n  window.__PHASER_GAME__ = new Phaser.Game(config);\n  return 'ready';\n}",
      "inputs": [],
      "outputs": [{ "name": "status", "type": "string" }],
      "dependencies": ["obstacle_spawner", "score_tracker"]
    },
    {
      "name": "obstacle_spawner",
      "type": "feature",
      "description": "Spawn obstacles from the right, scroll left, detect collision with player",
      "code": "function obstacle_spawner(action, speed, player_x, player_y) {\n  if (!window._obstacles) window._obstacles = { list: [], timer: 0 };\n  var o = window._obstacles;\n  var s = window._endless_runner;\n  if (!s) return JSON.stringify({ count: 0, hit: false });\n  var dt = Math.max(window.GAME.time.delta || 0.016, 0.016);\n  if (action === 'update') {\n    o.timer -= dt;\n    if (o.timer <= 0) {\n      var h = 30 + Math.random() * 30;\n      var rect = s.scene.add.rectangle(s.width + 20, s.groundY - h / 2, 24, h, 0xf87171);\n      o.list.push({ rect, w: 24, h: h });\n      o.timer = 1.2 + Math.random() * 0.8;\n    }\n    for (var i = o.list.length - 1; i >= 0; i--) {\n      o.list[i].rect.x -= speed * dt;\n      if (o.list[i].rect.x < -30) { o.list[i].rect.destroy(); o.list.splice(i, 1); continue; }\n      var ob = o.list[i];\n      var dx = Math.abs(player_x - ob.rect.x);\n      var dy = Math.abs(player_y - ob.rect.y);\n      if (dx < 22 && dy < (ob.h / 2 + 16)) {\n        s.alive = false;\n        s.player.setFillStyle(0x6b7280);\n        s.scene.add.text(s.width / 2 - 60, s.height / 2, 'GAME OVER', { font: '24px monospace', color: '#f87171' });\n        return JSON.stringify({ count: o.list.length, hit: true });\n      }\n    }\n  }\n  return JSON.stringify({ count: o.list.length, hit: false });\n}",
      "inputs": [
        { "name": "action", "type": "string" },
        { "name": "speed", "type": "number" },
        { "name": "player_x", "type": "number" },
        { "name": "player_y", "type": "number" }
      ],
      "outputs": [{ "name": "result", "type": "string" }],
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
      "description": "Start the Phaser runtime for the endless runner",
      "code": "function game_loop() {\n  create_scene();\n  return true;\n}",
      "inputs": [],
      "outputs": [{ "name": "started", "type": "boolean" }],
      "dependencies": ["create_scene"]
    }
  ]$$::jsonb,
  ARRAY['phaser_js'],
  ARRAY[
    'Add coins that float above obstacles for bonus points',
    'Create a double-jump power-up that appears randomly',
    'Add parallax background layers for depth effect'
  ],
  '2d'
)
ON CONFLICT (slug, game_format) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  atoms_json = EXCLUDED.atoms_json,
  externals = EXCLUDED.externals,
  template_prompts = EXCLUDED.template_prompts;

-- ─── Top-Down RPG ──────────────────────────────────────────────────────────────

INSERT INTO genre_boilerplates (slug, display_name, description, atoms_json, externals, template_prompts, game_format)
VALUES (
  'top-down-rpg',
  'Top-Down RPG',
  '2D Phaser tile-based exploration with grid movement, NPC dialogs, and collectibles.',
  $$[
    {
      "name": "create_scene",
      "type": "core",
      "description": "Boot a Phaser 2D top-down RPG scene with tiled floor, player, and NPCs",
      "code": "function create_scene() {\n  if (window.__PHASER_GAME__ && !window.__PHASER_GAME__.isDestroyed) return 'ready';\n  const canvas = window.GAME.canvas;\n  const width = canvas.clientWidth || canvas.width || 960;\n  const height = canvas.clientHeight || canvas.height || 540;\n  const ts = 40;\n  const config = {\n    type: Phaser.AUTO,\n    canvas,\n    width,\n    height,\n    backgroundColor: '#1a2e1a',\n    scene: {\n      create: function() {\n        const scene = this;\n        scene.cameras.main.setRoundPixels(true);\n        var cols = Math.ceil(width / ts) + 4;\n        var rows = Math.ceil(height / ts) + 4;\n        for (var r = 0; r < rows; r++) {\n          for (var c = 0; c < cols; c++) {\n            var color = ((r + c) % 2 === 0) ? 0x2d5a2d : 0x265a26;\n            scene.add.rectangle(c * ts + ts / 2, r * ts + ts / 2, ts - 1, ts - 1, color);\n          }\n        }\n        var player = scene.add.rectangle(5 * ts + ts / 2, 5 * ts + ts / 2, ts - 6, ts - 6, 0x60a5fa);\n        var npc = scene.add.rectangle(8 * ts + ts / 2, 4 * ts + ts / 2, ts - 6, ts - 6, 0xfbbf24);\n        var chest = scene.add.rectangle(12 * ts + ts / 2, 7 * ts + ts / 2, ts - 8, ts - 8, 0xf97316);\n        scene.add.text(16, 16, 'Top-Down RPG', { font: '14px monospace', color: '#86efac' });\n        window._top_down_rpg = {\n          scene, player, npc, chest, ts, width, height,\n          gridX: 5, gridY: 5, moving: false, chestOpened: false,\n          npcPos: { x: 8, y: 4 }, chestPos: { x: 12, y: 7 }\n        };\n      },\n      update: function() {\n        if (!window._top_down_rpg || window._top_down_rpg.moving) return;\n        var s = window._top_down_rpg;\n        var dir = null;\n        if (window.GAME.isKeyJustPressed('KeyW') || window.GAME.isKeyJustPressed('ArrowUp')) dir = 'up';\n        if (window.GAME.isKeyJustPressed('KeyS') || window.GAME.isKeyJustPressed('ArrowDown')) dir = 'down';\n        if (window.GAME.isKeyJustPressed('KeyA') || window.GAME.isKeyJustPressed('ArrowLeft')) dir = 'left';\n        if (window.GAME.isKeyJustPressed('KeyD') || window.GAME.isKeyJustPressed('ArrowRight')) dir = 'right';\n        if (dir) {\n          var result = JSON.parse(tile_movement(s.gridX, s.gridY, dir));\n          if (result.moved) {\n            s.gridX = result.x; s.gridY = result.y; s.moving = true;\n            s.scene.tweens.add({ targets: s.player, x: s.gridX * s.ts + s.ts / 2, y: s.gridY * s.ts + s.ts / 2, duration: 140, onComplete: function() { s.moving = false; } });\n          }\n        }\n        if (window.GAME.isKeyJustPressed('Space')) {\n          if (s.gridX === s.npcPos.x && s.gridY === s.npcPos.y - 1) dialog_system('show', 'Hello traveler! Welcome to this land.');\n          if (Math.abs(s.gridX - s.chestPos.x) <= 1 && Math.abs(s.gridY - s.chestPos.y) <= 1 && !s.chestOpened) {\n            s.chestOpened = true; s.chest.setFillStyle(0x6b7280);\n            score_tracker(50, 'add'); dialog_system('show', 'You found 50 gold!');\n          }\n        }\n      }\n    }\n  };\n  window.__PHASER_GAME__ = new Phaser.Game(config);\n  return 'ready';\n}",
      "inputs": [],
      "outputs": [{ "name": "status", "type": "string" }],
      "dependencies": ["tile_movement", "dialog_system", "score_tracker"]
    },
    {
      "name": "tile_movement",
      "type": "feature",
      "description": "Grid-snapped movement with simple collision checking",
      "code": "function tile_movement(grid_x, grid_y, direction) {\n  var nx = grid_x, ny = grid_y;\n  if (direction === 'up') ny--;\n  if (direction === 'down') ny++;\n  if (direction === 'left') nx--;\n  if (direction === 'right') nx++;\n  var s = window._top_down_rpg;\n  if (!s) return JSON.stringify({ moved: false, x: grid_x, y: grid_y });\n  var maxC = Math.floor(s.width / s.ts) - 1;\n  var maxR = Math.floor(s.height / s.ts) - 1;\n  if (nx < 0 || ny < 0 || nx > maxC || ny > maxR) return JSON.stringify({ moved: false, x: grid_x, y: grid_y });\n  if (nx === s.npcPos.x && ny === s.npcPos.y) return JSON.stringify({ moved: false, x: grid_x, y: grid_y });\n  return JSON.stringify({ moved: true, x: nx, y: ny });\n}",
      "inputs": [
        { "name": "grid_x", "type": "number" },
        { "name": "grid_y", "type": "number" },
        { "name": "direction", "type": "string" }
      ],
      "outputs": [{ "name": "result", "type": "string" }],
      "dependencies": []
    },
    {
      "name": "dialog_system",
      "type": "feature",
      "description": "Show or hide a dialog text box at the bottom of the screen",
      "code": "function dialog_system(action, text) {\n  if (!window._top_down_rpg) return JSON.stringify({ visible: false });\n  var s = window._top_down_rpg;\n  if (action === 'show') {\n    if (window._dialog_box) { window._dialog_box.bg.destroy(); window._dialog_box.txt.destroy(); }\n    var bg = s.scene.add.rectangle(s.width / 2, s.height - 50, s.width - 40, 70, 0x1e293b, 0.92);\n    bg.setStrokeStyle(1, 0x475569);\n    var txt = s.scene.add.text(40, s.height - 75, text, { font: '14px monospace', color: '#e2e8f0', wordWrap: { width: s.width - 80 } });\n    window._dialog_box = { bg, txt, visible: true };\n    s.scene.time.delayedCall(2500, function() { dialog_system('hide', ''); });\n  }\n  if (action === 'hide' && window._dialog_box) {\n    window._dialog_box.bg.destroy(); window._dialog_box.txt.destroy();\n    window._dialog_box = null;\n  }\n  return JSON.stringify({ visible: !!(window._dialog_box) });\n}",
      "inputs": [
        { "name": "action", "type": "string" },
        { "name": "text", "type": "string" }
      ],
      "outputs": [{ "name": "state", "type": "string" }],
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
      "description": "Start the Phaser runtime for the top-down RPG",
      "code": "function game_loop() {\n  create_scene();\n  return true;\n}",
      "inputs": [],
      "outputs": [{ "name": "started", "type": "boolean" }],
      "dependencies": ["create_scene"]
    }
  ]$$::jsonb,
  ARRAY['phaser_js'],
  ARRAY[
    'Add a simple turn-based battle system triggered by enemy contact',
    'Create an inventory with collectible items and equipment',
    'Add a second map area with a door transition'
  ],
  '2d'
)
ON CONFLICT (slug, game_format) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  atoms_json = EXCLUDED.atoms_json,
  externals = EXCLUDED.externals,
  template_prompts = EXCLUDED.template_prompts;
