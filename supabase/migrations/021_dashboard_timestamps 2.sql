-- =============================================================================
-- 021: Dashboard timestamps and auth-attributed metadata support
-- =============================================================================

CREATE OR REPLACE FUNCTION set_updated_at_only()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at_only();

DROP TRIGGER IF EXISTS update_games_updated_at ON games;
CREATE TRIGGER update_games_updated_at
  BEFORE UPDATE ON games
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at_only();

ALTER TABLE token_launches
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

UPDATE token_launches
SET updated_at = COALESCE(updated_at, created_at);

DROP TRIGGER IF EXISTS update_token_launches_updated_at ON token_launches;
CREATE TRIGGER update_token_launches_updated_at
  BEFORE UPDATE ON token_launches
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at_only();
