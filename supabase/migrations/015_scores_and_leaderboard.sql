-- =============================================================================
-- Migration 015: Scores & Leaderboard
-- =============================================================================
-- Adds scores table for game score tracking and a leaderboard view.
-- Scores flow from game iframes via postMessage → API → this table.
-- =============================================================================

CREATE TABLE scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES user_profiles(id) ON DELETE SET NULL,
  player_name TEXT,
  score BIGINT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_scores_game_rank ON scores(game_id, score DESC);
CREATE INDEX idx_scores_user ON scores(user_id) WHERE user_id IS NOT NULL;

-- Top score per user per game (leaderboard view)
CREATE VIEW leaderboard AS
  SELECT DISTINCT ON (s.game_id, COALESCE(s.user_id, s.id::text))
    s.id,
    s.game_id,
    s.user_id,
    COALESCE(up.display_name, s.player_name, 'Anonymous') AS player_name,
    up.avatar_url,
    s.score,
    s.created_at
  FROM scores s
  LEFT JOIN user_profiles up ON s.user_id = up.id
  ORDER BY s.game_id, COALESCE(s.user_id, s.id::text), s.score DESC;
