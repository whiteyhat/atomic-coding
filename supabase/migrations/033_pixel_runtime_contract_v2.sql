-- =============================================================================
-- Migration 033: Pixel runtime contract v2
-- =============================================================================

ALTER TABLE games
  ADD COLUMN IF NOT EXISTS pixel_assets_revision BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pixel_manifest_url TEXT;

ALTER TABLE war_room_generated_assets
  ADD COLUMN IF NOT EXISTS layout_version INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS runtime_ready BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS editor_only BOOLEAN NOT NULL DEFAULT false;
