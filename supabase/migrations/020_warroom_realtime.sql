-- Add war_rooms table to realtime publication so clients can subscribe
-- to status changes (e.g. running → completed) without polling.
ALTER PUBLICATION supabase_realtime ADD TABLE war_rooms;
