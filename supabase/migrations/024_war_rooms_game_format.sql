-- =============================================================================
-- Migration 024: Persist game format on war rooms
-- =============================================================================

ALTER TABLE war_rooms
  ADD COLUMN IF NOT EXISTS game_format TEXT CHECK (game_format IN ('2d', '3d'));

UPDATE war_rooms wr
SET game_format = g.game_format
FROM games g
WHERE g.id = wr.game_id
  AND wr.game_format IS NULL;

CREATE INDEX IF NOT EXISTS idx_war_rooms_game_format
  ON war_rooms (game_format)
  WHERE game_format IS NOT NULL;
