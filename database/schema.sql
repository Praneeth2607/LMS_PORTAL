-- =====================================================================
-- Aurex'26 Tech Comrades — CICT Workshop Management Portal
-- PostgreSQL schema (v1). Owned by the backend developer.
--
-- Re-runnable: drops and recreates everything. DEV ONLY — destroys data.
--   psql -U postgres -d aurex26 -f database/schema.sql
-- =====================================================================

BEGIN;

DROP VIEW  IF EXISTS workshop_attendance_summary;
DROP TABLE IF EXISTS announcements, certificates, attendance, sessions,
                     registrations, workshops, users CASCADE;

-- Keeps updated_at current on UPDATE.
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------
-- Users (all three roles live in one table)
-- ---------------------------------------------------------------------
CREATE TABLE users (
  id             INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  full_name      VARCHAR(120) NOT NULL,
  email          VARCHAR(255) NOT NULL UNIQUE,
  password_hash  TEXT         NOT NULL,
  role           VARCHAR(20)  NOT NULL DEFAULT 'participant'
                   CHECK (role IN ('admin', 'organizer', 'participant')),
  phone          VARCHAR(20),
  institution    VARCHAR(200),
  department     VARCHAR(120),
  is_active      BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- Workshops
-- registration_fields: configurable extra form fields, e.g.
--   [{"key":"year","label":"Year of study","type":"select",
--     "required":true,"options":["1","2","3","4"]}]
-- ---------------------------------------------------------------------
CREATE TABLE workshops (
  id                     INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organizer_id           INTEGER      NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title                  VARCHAR(200) NOT NULL,
  description            TEXT,
  category               VARCHAR(80),
  banner_url             TEXT,
  mode                   VARCHAR(10)  NOT NULL DEFAULT 'offline'
                           CHECK (mode IN ('online', 'offline', 'hybrid')),
  venue                  VARCHAR(255),
  meeting_link           TEXT,
  start_date             DATE         NOT NULL,
  end_date               DATE         NOT NULL,
  registration_deadline  TIMESTAMPTZ,
  capacity               INTEGER      CHECK (capacity IS NULL OR capacity > 0),
  requires_approval      BOOLEAN      NOT NULL DEFAULT FALSE,
  registration_fields    JSONB        NOT NULL DEFAULT '[]'::jsonb,
  certificate_threshold  SMALLINT     NOT NULL DEFAULT 90
                           CHECK (certificate_threshold BETWEEN 0 AND 100),
  status                 VARCHAR(15)  NOT NULL DEFAULT 'draft'
                           CHECK (status IN ('draft', 'published', 'completed', 'cancelled')),
  published_at           TIMESTAMPTZ,
  created_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CHECK (end_date >= start_date)
);
CREATE INDEX idx_workshops_status    ON workshops(status);
CREATE INDEX idx_workshops_organizer ON workshops(organizer_id);

-- ---------------------------------------------------------------------
-- Registrations (participant <-> workshop)
-- Status starts as 'pending' when workshops.requires_approval, else 'approved'.
-- ---------------------------------------------------------------------
CREATE TABLE registrations (
  id              INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  workshop_id     INTEGER     NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  user_id         INTEGER     NOT NULL REFERENCES users(id)     ON DELETE CASCADE,
  status          VARCHAR(15) NOT NULL DEFAULT 'approved'
                    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  form_responses  JSONB       NOT NULL DEFAULT '{}'::jsonb,
  registered_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workshop_id, user_id)
);
CREATE INDEX idx_registrations_user ON registrations(user_id);

-- ---------------------------------------------------------------------
-- Sessions (a workshop has one or more sessions)
-- attendance_code: short code shown as a QR / typed manually while open.
-- ---------------------------------------------------------------------
CREATE TABLE sessions (
  id                   INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  workshop_id          INTEGER      NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  title                VARCHAR(200) NOT NULL,
  description          TEXT,
  starts_at            TIMESTAMPTZ  NOT NULL,
  ends_at              TIMESTAMPTZ  NOT NULL,
  venue                VARCHAR(255),
  meeting_link         TEXT,
  attendance_code      VARCHAR(12),
  attendance_open      BOOLEAN      NOT NULL DEFAULT FALSE,
  code_expires_at      TIMESTAMPTZ,
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CHECK (ends_at > starts_at)
);
CREATE INDEX idx_sessions_workshop ON sessions(workshop_id);

-- ---------------------------------------------------------------------
-- Attendance (one row per participant per attended session)
-- ---------------------------------------------------------------------
CREATE TABLE attendance (
  id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id  INTEGER     NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id     INTEGER     NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  method      VARCHAR(10) NOT NULL DEFAULT 'qr'
                CHECK (method IN ('qr', 'code', 'manual')),
  marked_by   INTEGER     REFERENCES users(id) ON DELETE SET NULL, -- organizer, for manual
  marked_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (session_id, user_id)
);
CREATE INDEX idx_attendance_user ON attendance(user_id);

-- ---------------------------------------------------------------------
-- Certificates
-- certificate_code: public, unguessable id embedded in the verification QR.
-- PDFs are generated on demand with pdf-lib; nothing is stored on disk.
-- ---------------------------------------------------------------------
CREATE TABLE certificates (
  id                     INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  workshop_id            INTEGER      NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  user_id                INTEGER      NOT NULL REFERENCES users(id)     ON DELETE CASCADE,
  certificate_code       VARCHAR(32)  NOT NULL UNIQUE,
  attendance_percentage  NUMERIC(5,2) NOT NULL,
  issued_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  revoked                BOOLEAN      NOT NULL DEFAULT FALSE,
  UNIQUE (workshop_id, user_id)
);

-- ---------------------------------------------------------------------
-- Announcements (workshop_id NULL = portal-wide, admin only)
-- ---------------------------------------------------------------------
CREATE TABLE announcements (
  id           INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  workshop_id  INTEGER      REFERENCES workshops(id) ON DELETE CASCADE,
  author_id    INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title        VARCHAR(200) NOT NULL,
  body         TEXT         NOT NULL,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_announcements_workshop ON announcements(workshop_id);

-- updated_at triggers
CREATE TRIGGER trg_users_updated         BEFORE UPDATE ON users         FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_workshops_updated     BEFORE UPDATE ON workshops     FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_registrations_updated BEFORE UPDATE ON registrations FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_sessions_updated      BEFORE UPDATE ON sessions      FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------
-- Attendance percentage per approved registration.
--   attendance_percentage = attended sessions / total sessions * 100
--   certificate_eligible  = attendance_percentage >= certificate_threshold (default 90)
-- ---------------------------------------------------------------------
CREATE VIEW workshop_attendance_summary AS
SELECT
  r.workshop_id,
  r.user_id,
  COALESCE(s.total_sessions, 0)    AS total_sessions,
  COALESCE(a.attended_sessions, 0) AS attended_sessions,
  CASE WHEN COALESCE(s.total_sessions, 0) = 0 THEN 0
       ELSE ROUND(COALESCE(a.attended_sessions, 0) * 100.0 / s.total_sessions, 2)
  END                              AS attendance_percentage,
  (COALESCE(s.total_sessions, 0) > 0 AND
   COALESCE(a.attended_sessions, 0) * 100.0 / s.total_sessions >= w.certificate_threshold)
                                   AS certificate_eligible
FROM registrations r
JOIN workshops w ON w.id = r.workshop_id
LEFT JOIN (
  SELECT workshop_id, COUNT(*) AS total_sessions
  FROM sessions
  GROUP BY workshop_id
) s ON s.workshop_id = r.workshop_id
LEFT JOIN (
  SELECT se.workshop_id, at.user_id, COUNT(*) AS attended_sessions
  FROM attendance at
  JOIN sessions se ON se.id = at.session_id
  GROUP BY se.workshop_id, at.user_id
) a ON a.workshop_id = r.workshop_id AND a.user_id = r.user_id
WHERE r.status = 'approved';

COMMIT;
