-- =============================================================================
-- Migration 016: Game Publishing
-- =============================================================================
-- Adds publishing fields to games so users can share playable URLs.
-- Published games are accessible without authentication at /play/[slug].
-- =============================================================================

ALTER TABLE games ADD COLUMN is_published BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE games ADD COLUMN published_at TIMESTAMPTZ;
ALTER TABLE games ADD COLUMN public_slug TEXT UNIQUE;
ALTER TABLE games ADD COLUMN published_bundle_url TEXT;

CREATE INDEX idx_games_public ON games(public_slug) WHERE is_published = true;
