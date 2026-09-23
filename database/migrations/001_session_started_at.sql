-- Records when the organizer pressed "Start session" (the session is then ONGOING
-- until its end time). Safe to run more than once; does not touch existing data.
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
