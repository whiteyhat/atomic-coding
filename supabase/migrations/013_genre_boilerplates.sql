-- =============================================================================
-- Migration 013: Genre Boilerplates
-- =============================================================================
-- Adds genre_boilerplates table for game creation templates.
-- Each boilerplate defines atoms, externals, and suggested prompts for a genre.
-- Also adds genre and thumbnail_url columns to games.
-- =============================================================================

CREATE TABLE genre_boilerplates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  atoms_json JSONB NOT NULL DEFAULT '[]',          -- Array of atom definitions to seed
  externals TEXT[] DEFAULT '{}',                    -- Registry names to auto-install
  template_prompts TEXT[] DEFAULT '{}',             -- Suggested AI prompts for this genre
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add genre to games (nullable for existing games)
ALTER TABLE games ADD COLUMN genre TEXT;

-- Add thumbnail URL to games
ALTER TABLE games ADD COLUMN thumbnail_url TEXT;
