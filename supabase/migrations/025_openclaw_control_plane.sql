-- =============================================================================
-- Migration 025: OpenClaw Import & Control Plane
-- =============================================================================

CREATE OR REPLACE FUNCTION set_row_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE openclaw_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  avatar_emoji TEXT NOT NULL DEFAULT '🦞',
  description TEXT,
  agent_url TEXT NOT NULL,
  endpoint_url TEXT,
  webhook_secret TEXT NOT NULL,
  webhook_events JSONB NOT NULL DEFAULT '["*"]'::jsonb,
  connection_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (connection_status IN ('pending', 'connected', 'disconnected', 'error', 'replaced')),
  last_heartbeat TIMESTAMPTZ,
  last_error TEXT,
  capabilities JSONB NOT NULL DEFAULT '[]'::jsonb,
  api_key_prefix TEXT,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  replaced_by_agent_id UUID REFERENCES openclaw_agents(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_openclaw_webhook_events_array CHECK (jsonb_typeof(webhook_events) = 'array'),
  CONSTRAINT chk_openclaw_capabilities_array CHECK (jsonb_typeof(capabilities) = 'array')
);

CREATE INDEX idx_openclaw_agents_user_active
  ON openclaw_agents(user_id, is_active, claimed_at DESC);

CREATE TABLE openclaw_onboarding_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL
    CHECK (status IN ('pending_claim', 'claimed', 'expired', 'failed', 'cancelled')),
  mode TEXT NOT NULL CHECK (mode IN ('import', 'replace')),
  expires_at TIMESTAMPTZ NOT NULL,
  claimed_at TIMESTAMPTZ,
  agent_id UUID REFERENCES openclaw_agents(id) ON DELETE SET NULL,
  replaces_agent_id UUID REFERENCES openclaw_agents(id) ON DELETE SET NULL,
  identity_name TEXT,
  identity_description TEXT,
  identity_avatar TEXT,
  agent_url TEXT,
  endpoint_url TEXT,
  webhook_events JSONB NOT NULL DEFAULT '["*"]'::jsonb,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_openclaw_onboarding_webhook_events_array CHECK (jsonb_typeof(webhook_events) = 'array')
);

CREATE INDEX idx_openclaw_onboarding_user
  ON openclaw_onboarding_sessions(user_id, created_at DESC);

CREATE INDEX idx_openclaw_onboarding_status
  ON openclaw_onboarding_sessions(status, expires_at);

CREATE TABLE openclaw_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES openclaw_agents(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  scopes JSONB NOT NULL DEFAULT '[]'::jsonb,
  rate_limit_tier TEXT NOT NULL DEFAULT 'standard',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  CONSTRAINT chk_openclaw_scopes_array CHECK (jsonb_typeof(scopes) = 'array')
);

CREATE INDEX idx_openclaw_api_keys_agent
  ON openclaw_api_keys(agent_id, created_at DESC);

CREATE INDEX idx_openclaw_api_keys_user
  ON openclaw_api_keys(user_id, created_at DESC);

CREATE TABLE openclaw_request_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES openclaw_agents(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  tool_name TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INT NOT NULL,
  latency_ms INT NOT NULL,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_openclaw_request_log_agent_time
  ON openclaw_request_log(agent_id, created_at DESC);

CREATE INDEX idx_openclaw_request_log_user_time
  ON openclaw_request_log(user_id, created_at DESC);

CREATE TABLE openclaw_webhook_delivery_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES openclaw_agents(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  url TEXT NOT NULL,
  status_code INT,
  latency_ms INT NOT NULL DEFAULT 0,
  attempt INT NOT NULL DEFAULT 1,
  error TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_openclaw_webhook_log_agent_time
  ON openclaw_webhook_delivery_log(agent_id, created_at DESC);

CREATE TRIGGER update_openclaw_agents_updated_at
  BEFORE UPDATE ON openclaw_agents
  FOR EACH ROW
  EXECUTE FUNCTION set_row_updated_at();

CREATE TRIGGER update_openclaw_onboarding_sessions_updated_at
  BEFORE UPDATE ON openclaw_onboarding_sessions
  FOR EACH ROW
  EXECUTE FUNCTION set_row_updated_at();
