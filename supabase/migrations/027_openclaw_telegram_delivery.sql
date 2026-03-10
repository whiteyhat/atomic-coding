-- =============================================================================
-- Migration 027: OpenClaw Telegram Delivery Channel
-- =============================================================================

ALTER TABLE openclaw_agents
  ADD COLUMN delivery_channel TEXT NOT NULL DEFAULT 'custom'
    CHECK (delivery_channel IN ('custom', 'telegram')),
  ADD COLUMN telegram_bot_token TEXT,
  ADD COLUMN telegram_chat_id TEXT;
