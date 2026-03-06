-- =============================================================================
-- Migration 018: War Rooms – Multi-Agent Orchestration
-- =============================================================================
-- A War Room represents one orchestrated game-development session.
-- Jarvis receives a user prompt, spawns 12 pipeline tasks, dispatches them to
-- Forge / Pixel / Checker agents, and streams progress via SSE events.
-- =============================================================================

-- ── War Rooms ────────────────────────────────────────────────────────────────

CREATE TABLE war_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES user_profiles(id) ON DELETE SET NULL,
  prompt TEXT NOT NULL,
  genre TEXT,
  status TEXT NOT NULL DEFAULT 'planning'
    CHECK (status IN ('planning','running','completed','failed','cancelled')),
  scope JSONB,
  suggested_prompts TEXT[],
  final_build_id UUID REFERENCES builds(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_war_rooms_game ON war_rooms(game_id);
CREATE INDEX idx_war_rooms_user ON war_rooms(user_id) WHERE user_id IS NOT NULL;

-- ── War Room Tasks (the 12-step pipeline) ────────────────────────────────────

CREATE TABLE war_room_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  war_room_id UUID NOT NULL REFERENCES war_rooms(id) ON DELETE CASCADE,
  task_number INT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  assigned_agent TEXT CHECK (assigned_agent IN ('jarvis','forge','pixel','checker')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','assigned','running','completed','failed','blocked')),
  depends_on INT[] DEFAULT '{}',
  output JSONB,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  UNIQUE(war_room_id, task_number)
);

CREATE INDEX idx_war_room_tasks_room ON war_room_tasks(war_room_id);

-- ── War Room Events (SSE log) ────────────────────────────────────────────────

CREATE TABLE war_room_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  war_room_id UUID NOT NULL REFERENCES war_rooms(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  agent TEXT,
  task_number INT,
  payload JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_war_room_events_room ON war_room_events(war_room_id);
CREATE INDEX idx_war_room_events_time ON war_room_events(war_room_id, created_at);

-- ── Agent Heartbeats ─────────────────────────────────────────────────────────

CREATE TABLE agent_heartbeats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  war_room_id UUID NOT NULL REFERENCES war_rooms(id) ON DELETE CASCADE,
  agent TEXT NOT NULL CHECK (agent IN ('jarvis','forge','pixel','checker')),
  status TEXT NOT NULL DEFAULT 'idle'
    CHECK (status IN ('idle','working','error','timeout')),
  last_ping TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}',
  UNIQUE(war_room_id, agent)
);

CREATE INDEX idx_agent_heartbeats_room ON agent_heartbeats(war_room_id);

-- ── Enable Supabase Realtime ─────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE war_room_events;
ALTER PUBLICATION supabase_realtime ADD TABLE agent_heartbeats;
