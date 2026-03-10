-- =============================================================================
-- Migration 022: Persist 2D/3D game format
-- =============================================================================

ALTER TABLE games
  ADD COLUMN game_format TEXT CHECK (game_format IN ('2d', '3d'));

CREATE INDEX idx_games_game_format ON games(game_format) WHERE game_format IS NOT NULL;
