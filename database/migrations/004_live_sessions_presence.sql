-- Live sessions inside the portal (Daily.co) + proof-of-active-presence tracking.
-- Safe to run more than once.

-- The Daily.co room used for an online/hybrid session (created on demand).
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS video_room_name VARCHAR(64);
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS video_room_url  TEXT;

-- Verified watch time per participant per session. active_seconds only grows
-- through server-checked heartbeats (see presence.service.js).
CREATE TABLE IF NOT EXISTS session_watch_logs (
  id                 INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id         INTEGER     NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  participant_id     INTEGER     NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  active_seconds     INTEGER     NOT NULL DEFAULT 0 CHECK (active_seconds >= 0),
  last_heartbeat_at  TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (session_id, participant_id)
);

-- Attendance recorded automatically from verified presence uses method PRESENCE.
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_method_check;
ALTER TABLE attendance ADD CONSTRAINT attendance_method_check
  CHECK (method IN ('QR', 'CODE', 'MANUAL', 'PRESENCE'));
