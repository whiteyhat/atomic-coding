-- =============================================================================
-- Migration 032: Pixel generated assets and war-room visual references
-- =============================================================================

ALTER TABLE war_rooms
  ADD COLUMN IF NOT EXISTS visual_references JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS war_room_generated_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  war_room_id UUID NOT NULL REFERENCES war_rooms(id) ON DELETE CASCADE,
  task_number INT NOT NULL CHECK (task_number IN (7, 8)),
  stable_asset_id TEXT NOT NULL,
  asset_kind TEXT NOT NULL CHECK (
    asset_kind IN (
      'ui_asset',
      'character_seed',
      'animation_pack',
      'sprite_sheet',
      'background_layer',
      'background_plate',
      'texture_asset',
      'effect_asset',
      'pixel_manifest'
    )
  ),
  variant TEXT NOT NULL DEFAULT '',
  storage_path TEXT,
  public_url TEXT,
  width INT,
  height INT,
  source_service TEXT NOT NULL DEFAULT 'unknown',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (war_room_id, task_number, stable_asset_id, asset_kind, variant)
);

CREATE INDEX IF NOT EXISTS idx_war_room_generated_assets_room
  ON war_room_generated_assets(war_room_id, task_number, created_at);

CREATE INDEX IF NOT EXISTS idx_war_room_generated_assets_stable
  ON war_room_generated_assets(war_room_id, stable_asset_id);

DROP TRIGGER IF EXISTS update_war_room_generated_assets_updated_at
  ON war_room_generated_assets;
CREATE TRIGGER update_war_room_generated_assets_updated_at
  BEFORE UPDATE ON war_room_generated_assets
  FOR EACH ROW
  EXECUTE FUNCTION set_row_updated_at();
