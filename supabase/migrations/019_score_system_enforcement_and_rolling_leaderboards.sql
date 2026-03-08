-- =============================================================================
-- Migration 019: Score System Enforcement + Rolling Leaderboards
-- =============================================================================

ALTER TABLE builds
  ADD COLUMN IF NOT EXISTS score_system_ready BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS score_system_report JSONB,
  ADD COLUMN IF NOT EXISTS score_system_checked_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_scores_game_created_at
  ON scores(game_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_scores_game_user_rank
  ON scores(game_id, user_id, score DESC, created_at ASC)
  WHERE user_id IS NOT NULL;

CREATE OR REPLACE FUNCTION get_game_leaderboard(
  p_game_id UUID,
  p_period TEXT DEFAULT 'lifetime',
  p_limit INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  game_id UUID,
  user_id TEXT,
  player_name TEXT,
  avatar_url TEXT,
  score BIGINT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_period NOT IN ('day', 'week', 'lifetime') THEN
    RAISE EXCEPTION 'Invalid leaderboard period: %', p_period;
  END IF;

  RETURN QUERY
  WITH filtered AS (
    SELECT
      s.id,
      s.game_id,
      s.user_id,
      COALESCE(up.display_name, s.player_name, 'Anonymous') AS player_name,
      up.avatar_url,
      s.score,
      s.created_at
    FROM scores s
    LEFT JOIN user_profiles up ON up.id = s.user_id
    WHERE s.game_id = p_game_id
      AND s.user_id IS NOT NULL
      AND (
        p_period = 'lifetime'
        OR (p_period = 'day' AND s.created_at >= now() - INTERVAL '24 hours')
        OR (p_period = 'week' AND s.created_at >= now() - INTERVAL '7 days')
      )
  ),
  ranked AS (
    SELECT
      filtered.*,
      ROW_NUMBER() OVER (
        PARTITION BY filtered.user_id
        ORDER BY filtered.score DESC, filtered.created_at ASC, filtered.id ASC
      ) AS rank_in_user
    FROM filtered
  )
  SELECT
    ranked.id,
    ranked.game_id,
    ranked.user_id,
    ranked.player_name,
    ranked.avatar_url,
    ranked.score,
    ranked.created_at
  FROM ranked
  WHERE ranked.rank_in_user = 1
  ORDER BY ranked.score DESC, ranked.created_at ASC, ranked.id ASC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 10), 1), 10);
END;
$$;
