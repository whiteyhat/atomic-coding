-- =============================================================================
-- Migration 012: Auth & User Profiles (Privy)
-- =============================================================================
-- Adds user_profiles table linked to Privy DIDs (decentralized identifiers).
-- Associates games and chat sessions with users.
-- =============================================================================

-- User profiles table (Privy DID as primary key)
CREATE TABLE user_profiles (
  id TEXT PRIMARY KEY,                    -- Privy user DID (e.g. "did:privy:...")
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  wallet_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-update updated_at on user_profiles
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Add user_id to games (nullable for existing/legacy games)
ALTER TABLE games ADD COLUMN user_id TEXT REFERENCES user_profiles(id) ON DELETE SET NULL;

-- Add user_id to chat_sessions (nullable for existing sessions)
ALTER TABLE chat_sessions ADD COLUMN user_id TEXT REFERENCES user_profiles(id) ON DELETE SET NULL;

-- Index for querying games by user
CREATE INDEX idx_games_user_id ON games(user_id) WHERE user_id IS NOT NULL;
