---
name: pixel-sprite-service
description: Use when Atomic Pixel needs 2D character animation packs, frame-layout manifests, or parallax background layers through the external sprite-sheet-creator service instead of the default Vertex image path.
---

# Pixel Sprite Service

Use this skill when working on Atomic's 2D asset pipeline.

## When To Use It

Use `sprite-sheet-creator` for:
- 2D character seed art that will become animation-ready sprite sheets
- Character animation packs with `idle`, `walk`, `jump`, or `attack`
- Default 2x2 frame-layout extraction and editable divider manifests
- 3-layer parallax background sets tied to a 2D side-scroller or background plate brief

Keep using `generate-polished-visual-pack` / Vertex for:
- Task 7 UI, HUD, menus, buttons, panels, cursors, and overlays
- Task 8 non-character textures, tiles, one-off effects, and auxiliary icons
- Any asset shape the sprite service does not support cleanly

Do not use this skill for 3D games. Task 8 remains skipped for `game_format = 3d`.

## Required Env Vars

- `PIXEL_SPRITE_SERVICE_URL`
- `PIXEL_SPRITE_SERVICE_KEY`
  Use only if the deployed service is protected.
- `PIXEL_SPRITE_SERVICE_TIMEOUT_MS`
- `FAL_API_KEY`
  Still required for non-sprite-service isolated sprite cleanup in Task 8.

## Stable Asset Contract

For 2D games, Task 1 must plan structured sprite requirements with stable snake_case IDs:
- Characters: `player`, `enemy_grunt`, `boss_wisp`
- Environment: `platform_tile`, `forest_backdrop`
- Effects: `coin_sparkle`, `impact_flash`

Rules:
- Reuse Task 1 `stable_id` values exactly in Task 8 `animation_sets` and `background_sets`.
- Runtime code targets stable IDs, not generated URLs.
- `pixel-manifest.json` is the canonical resolution layer from stable IDs to storage URLs and layout metadata.

## Workflow

For each required 2D character:
1. Build the character prompt from the Task 1 brief, style direction, and structured visual references.
2. Call `POST /api/generate-character`.
3. Call `POST /api/generate-sprite-sheet` for each required animation in parallel.
4. Call `POST /api/remove-background` on returned sheets.
5. Derive the default 2x2 frame layout and content bounds.
6. Persist character seed, sheets, extracted frames, frame manifest JSON, and generated-asset rows.

For parallax backgrounds:
1. Only generate them when Task 1 environment requirements request `generate_parallax_layers = true`.
2. Call `POST /api/generate-background`.
3. Persist `layer_1`, `layer_2`, and `layer_3` plus background-set metadata.

## Visual References

Prefer structured war-room `visual_references` over flattened prompt summaries.

Reference mode rules:
- If a suitable reference image exists, use `image_to_image`.
- Otherwise use `prompt_only`.

Persist the chosen reference mode, reference image URL, and character prompt in the animation pack metadata.

## Persistence Rules

Task 7 and Task 8 outputs are first-class generated assets, not prompt-only blobs.

Persist:
- `ui_asset` rows for Task 7
- `character_seed`, `animation_pack`, and `sprite_sheet` rows for Task 8 character work
- `background_layer` rows for parallax sets
- `pixel_manifest` row for `pixel-manifest.json`

When frame dividers are edited:
- Update the animation-pack metadata
- Update the saved animation layout entry for that animation
- Refresh `pixel-manifest.json` so the edited layout becomes canonical

## Failure And Fallback

If the sprite service fails:
- Fail the Task 8 animation-pack branch with a clear service error
- Keep Vertex for remaining non-character assets
- Do not silently invent animation sheets or frame manifests

If only optional parallax generation fails:
- Keep the character pack if it is valid
- Record the missing background set as a validation failure

If `pixel-manifest.json` is missing, URLs are dead, required animations are absent, frame counts do not match `cols * rows`, or requested parallax layers are incomplete, final Checker validation must fail.
