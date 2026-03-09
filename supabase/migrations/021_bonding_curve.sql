-- =============================================================================
-- 021: Bonding Curve — Extends token_launches with DBC config + state tables
-- =============================================================================

-- ─── Extend token_launches with bonding curve configuration ──────────────────

ALTER TABLE token_launches
  ADD COLUMN curve_mode         INT DEFAULT 1,
  ADD COLUMN initial_mcap       NUMERIC,
  ADD COLUMN migration_mcap     NUMERIC,
  ADD COLUMN total_token_supply NUMERIC DEFAULT 1000000000,
  ADD COLUMN token_decimals     INT DEFAULT 6,
  ADD COLUMN supply_on_migration_pct INT DEFAULT 80,
  ADD COLUMN migration_option   INT DEFAULT 1,
  ADD COLUMN migration_fee_option INT DEFAULT 3,
  ADD COLUMN creator_fee_pct    INT DEFAULT 50,
  ADD COLUMN creator_lp_pct     INT DEFAULT 50,
  ADD COLUMN base_fee_mode      INT DEFAULT 0,
  ADD COLUMN starting_fee_bps   INT DEFAULT 100,
  ADD COLUMN ending_fee_bps     INT DEFAULT 100,
  ADD COLUMN dynamic_fee        BOOLEAN DEFAULT true,
  ADD COLUMN token_image_url    TEXT,
  ADD COLUMN token_description  TEXT,
  ADD COLUMN token_website      TEXT,
  ADD COLUMN token_twitter      TEXT,
  ADD COLUMN token_telegram     TEXT,
  ADD COLUMN dbc_config_key     TEXT,
  ADD COLUMN pool_address       TEXT,
  ADD COLUMN base_mint          TEXT,
  ADD COLUMN quote_mint         TEXT DEFAULT 'So11111111111111111111111111111111111111112',
  ADD COLUMN creator_wallet     TEXT,
  ADD COLUMN deployed_at        TIMESTAMPTZ,
  ADD COLUMN graduated_at       TIMESTAMPTZ,
  ADD COLUMN graduated_pool     TEXT;

-- Update status check to include new states
ALTER TABLE token_launches
  DROP CONSTRAINT IF EXISTS token_launches_status_check;
ALTER TABLE token_launches
  ADD CONSTRAINT token_launches_status_check
  CHECK (status IN ('draft', 'configuring', 'deploying', 'live', 'graduating', 'graduated', 'failed'));


-- ─── Bonding curve real-time state (cached from on-chain / Jupiter) ─────────

CREATE TABLE bonding_curve_state (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  launch_id       UUID UNIQUE NOT NULL REFERENCES token_launches(id) ON DELETE CASCADE,
  game_id         UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  bonding_pct     NUMERIC DEFAULT 0,
  current_mcap    NUMERIC DEFAULT 0,
  current_mcap_usd NUMERIC DEFAULT 0,
  current_price   NUMERIC DEFAULT 0,
  current_price_usd NUMERIC DEFAULT 0,
  total_supply_sold NUMERIC DEFAULT 0,
  base_reserve    NUMERIC DEFAULT 0,
  quote_reserve   NUMERIC DEFAULT 0,
  volume_24h      NUMERIC DEFAULT 0,
  volume_24h_usd  NUMERIC DEFAULT 0,
  trades_24h      INT DEFAULT 0,
  unique_traders  INT DEFAULT 0,
  holder_count    INT DEFAULT 0,
  fdv             NUMERIC DEFAULT 0,
  liquidity       NUMERIC DEFAULT 0,
  price_change_5m  NUMERIC DEFAULT 0,
  price_change_1h  NUMERIC DEFAULT 0,
  price_change_6h  NUMERIC DEFAULT 0,
  price_change_24h NUMERIC DEFAULT 0,
  is_graduated    BOOLEAN DEFAULT false,
  last_synced_at  TIMESTAMPTZ DEFAULT now(),
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_bcs_launch ON bonding_curve_state(launch_id);
CREATE INDEX idx_bcs_game ON bonding_curve_state(game_id);
CREATE INDEX idx_bcs_graduated ON bonding_curve_state(is_graduated);
CREATE INDEX idx_bcs_bonding_pct ON bonding_curve_state(bonding_pct DESC);


-- ─── Token transaction history ──────────────────────────────────────────────

CREATE TABLE token_transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  launch_id       UUID NOT NULL REFERENCES token_launches(id) ON DELETE CASCADE,
  game_id         UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  tx_signature    TEXT UNIQUE NOT NULL,
  tx_type         TEXT NOT NULL CHECK (tx_type IN ('buy', 'sell')),
  wallet_address  TEXT NOT NULL,
  amount_in       NUMERIC NOT NULL,
  amount_out      NUMERIC NOT NULL,
  price_per_token NUMERIC NOT NULL,
  fee_amount      NUMERIC DEFAULT 0,
  mcap_at_trade   NUMERIC,
  bonding_pct_at_trade NUMERIC,
  block_time      TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_tt_launch ON token_transactions(launch_id);
CREATE INDEX idx_tt_game ON token_transactions(game_id);
CREATE INDEX idx_tt_wallet ON token_transactions(wallet_address);
CREATE INDEX idx_tt_block_time ON token_transactions(block_time DESC);
CREATE INDEX idx_tt_type ON token_transactions(tx_type);


-- ─── Token holder snapshots (cached, refreshed periodically) ────────────────

CREATE TABLE token_holders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  launch_id       UUID NOT NULL REFERENCES token_launches(id) ON DELETE CASCADE,
  wallet_address  TEXT NOT NULL,
  balance         NUMERIC NOT NULL DEFAULT 0,
  percentage      NUMERIC NOT NULL DEFAULT 0,
  is_creator      BOOLEAN DEFAULT false,
  is_contract     BOOLEAN DEFAULT false,
  last_updated_at TIMESTAMPTZ DEFAULT now(),
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(launch_id, wallet_address)
);

CREATE INDEX idx_th_launch ON token_holders(launch_id);
CREATE INDEX idx_th_balance ON token_holders(launch_id, balance DESC);


-- ─── Enable Realtime on state table for live frontend updates ───────────────

ALTER PUBLICATION supabase_realtime ADD TABLE bonding_curve_state;
