-- =============================================================================
-- Migration 029: Default 2D externals for all Phaser boilerplates
-- =============================================================================
-- Mirrors the 3D pattern: all 2D genre boilerplates get a standard set of
-- auto-installed externals so the AI can use audio, assets, physics, and
-- pathfinding without the user having to request them explicitly.
-- =============================================================================

UPDATE genre_boilerplates
SET externals = ARRAY['phaser_js', 'atomic_assets', 'howler_js', 'matter_js', 'pathfinding_js']
WHERE game_format = '2d';
