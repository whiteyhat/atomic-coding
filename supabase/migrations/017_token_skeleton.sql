-- =============================================================================
-- 017: Token Launch Skeleton
-- Stores token launch configs and distribution plans.
-- No blockchain calls — skeleton for future integration.
-- =============================================================================

CREATE TABLE token_launches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID UNIQUE NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  creator_id TEXT NOT NULL REFERENCES user_profiles(id),
  token_name TEXT NOT NULL,
  token_symbol TEXT NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','pending','launched','failed')),
  chain_id TEXT,
  contract_address TEXT,
  total_supply BIGINT,
  leaderboard_allocation_pct INT DEFAULT 2,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE token_distributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  launch_id UUID NOT NULL REFERENCES token_launches(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES user_profiles(id),
  rank INT,
  allocation_amount BIGINT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','distributed','claimed')),
  wallet_address TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_token_launches_game ON token_launches(game_id);
CREATE INDEX idx_token_distributions_launch ON token_distributions(launch_id);
