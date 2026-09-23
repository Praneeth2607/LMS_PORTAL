-- =====================================================================
-- Aurex'26 Tech Comrades — CICT Workshop Management Portal
-- PostgreSQL schema. Owned by the backend developer.
--
-- Re-runnable: drops and recreates everything. DEV ONLY — destroys data.
--   npm run db:reset            (from the repo root; also loads seed.sql)
--   psql -U postgres -d aurex26 -f database/schema.sql
-- =====================================================================

BEGIN;

DROP TABLE IF EXISTS organizer_requests, blocked_emails, certificates, announcements, attendance, sessions,
                     registrations, registration_fields, workshops, users CASCADE;

-- Keeps updated_at current on UPDATE.
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------
CREATE TABLE users (
  id             INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name           VARCHAR(120) NOT NULL,
  email          VARCHAR(255) NOT NULL UNIQUE CHECK (email = LOWER(email)),
  password_hash  TEXT         NOT NULL,
  role           VARCHAR(20)  NOT NULL DEFAULT 'PARTICIPANT'
                   CHECK (role IN ('ADMIN', 'ORGANIZER', 'PARTICIPANT')),
  suspended_at   TIMESTAMPTZ,  -- set by an admin; suspended users cannot sign in
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- blocked_emails: emails of suspended users that an admin deleted. Self
-- sign-up with them is refused; only an admin can create the account again.
-- ---------------------------------------------------------------------
CREATE TABLE blocked_emails (
  email       VARCHAR(255) PRIMARY KEY CHECK (email = LOWER(email)),
  blocked_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  blocked_by  INTEGER      REFERENCES users(id) ON DELETE SET NULL
);

-- ---------------------------------------------------------------------
-- organizer_requests: organizer access requested from the sign-in page;
-- an admin approves (creates the ORGANIZER user) or rejects.
-- ---------------------------------------------------------------------
CREATE TABLE organizer_requests (
  id             INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name           VARCHAR(120) NOT NULL,
  email          VARCHAR(255) NOT NULL CHECK (email = LOWER(email)),
  -- bcrypt hash of the password the applicant chose; moved to users on approval
  -- (then cleared here). Never stored in plain text.
  password_hash  TEXT         NOT NULL,
  designation    VARCHAR(120) NOT NULL,
  reason         TEXT         NOT NULL,
  status         VARCHAR(10)  NOT NULL DEFAULT 'PENDING'
                   CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  reviewed_by    INTEGER      REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- At most one PENDING request per email (rejected ones may be re-submitted).
CREATE UNIQUE INDEX uq_organizer_requests_pending_email
  ON organizer_requests (email) WHERE status = 'PENDING';

-- ---------------------------------------------------------------------
-- workshops
-- ---------------------------------------------------------------------
CREATE TABLE workshops (
  id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title         VARCHAR(200) NOT NULL,
  description   TEXT,
  start_date    DATE         NOT NULL,
  end_date      DATE         NOT NULL,
  mode          VARCHAR(10)  NOT NULL DEFAULT 'OFFLINE'
                  CHECK (mode IN ('ONLINE', 'OFFLINE', 'HYBRID')),
  venue         VARCHAR(255),
  meeting_link  TEXT,
  capacity      INTEGER      CHECK (capacity IS NULL OR capacity > 0),
  status        VARCHAR(10)  NOT NULL DEFAULT 'DRAFT'
                  CHECK (status IN ('DRAFT', 'PUBLISHED', 'CLOSED')),
  created_by    INTEGER      NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CHECK (end_date >= start_date)
);
CREATE INDEX idx_workshops_status     ON workshops(status);
CREATE INDEX idx_workshops_created_by ON workshops(created_by);

-- ---------------------------------------------------------------------
-- registration_fields: extra information collected when registering.
-- Participant answers are stored in registrations.form_data keyed by
-- field_name, e.g. {"Roll Number": "21CS045", "Year of Study": "3"}.
-- options is used only by SELECT fields: ["1", "2", "3", "4"].
-- ---------------------------------------------------------------------
CREATE TABLE registration_fields (
  id           INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  workshop_id  INTEGER      NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  field_name   VARCHAR(100) NOT NULL,
  field_type   VARCHAR(10)  NOT NULL DEFAULT 'TEXT'
                 CHECK (field_type IN ('TEXT', 'TEXTAREA', 'EMAIL', 'PHONE',
                                       'NUMBER', 'DATE', 'SELECT', 'CHECKBOX')),
  required     BOOLEAN      NOT NULL DEFAULT FALSE,
  field_order  INTEGER      NOT NULL DEFAULT 0,
  options      JSONB,
  UNIQUE (workshop_id, field_name)
);

-- ---------------------------------------------------------------------
-- registrations
-- ---------------------------------------------------------------------
CREATE TABLE registrations (
  id              INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  workshop_id     INTEGER     NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  participant_id  INTEGER     NOT NULL REFERENCES users(id)     ON DELETE CASCADE,
  form_data       JSONB       NOT NULL DEFAULT '{}'::jsonb,
  status          VARCHAR(10) NOT NULL DEFAULT 'REGISTERED'
                    CHECK (status IN ('REGISTERED', 'CANCELLED')),
  registered_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workshop_id, participant_id)
);
CREATE INDEX idx_registrations_participant ON registrations(participant_id);

-- ---------------------------------------------------------------------
-- sessions: each session has its own attendance window.
--   attendance_token: long random token encoded in the QR URL
--   attendance_code : short code participants can type instead (fallback)
-- ---------------------------------------------------------------------
CREATE TABLE sessions (
  id                     INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  workshop_id            INTEGER      NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  title                  VARCHAR(200) NOT NULL,
  session_date           DATE         NOT NULL,
  start_time             TIME         NOT NULL,
  end_time               TIME         NOT NULL,
  meeting_link           TEXT,
  attendance_token       VARCHAR(64)  UNIQUE,
  attendance_code        VARCHAR(8),
  attendance_active      BOOLEAN      NOT NULL DEFAULT FALSE,
  attendance_expires_at  TIMESTAMPTZ,
  started_at             TIMESTAMPTZ,  -- set when the organizer presses "Start session"
  created_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CHECK (end_time > start_time)
);
CREATE INDEX idx_sessions_workshop ON sessions(workshop_id);

-- ---------------------------------------------------------------------
-- attendance
-- ---------------------------------------------------------------------
CREATE TABLE attendance (
  id              INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id      INTEGER     NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  participant_id  INTEGER     NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  status          VARCHAR(10) NOT NULL DEFAULT 'PRESENT'
                    CHECK (status IN ('PRESENT', 'ABSENT')),
  method          VARCHAR(10) NOT NULL DEFAULT 'QR'
                    CHECK (method IN ('QR', 'CODE', 'MANUAL')),
  marked_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (session_id, participant_id)
);
CREATE INDEX idx_attendance_participant ON attendance(participant_id);

-- ---------------------------------------------------------------------
-- announcements
-- ---------------------------------------------------------------------
CREATE TABLE announcements (
  id           INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  workshop_id  INTEGER      NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  created_by   INTEGER      NOT NULL REFERENCES users(id)     ON DELETE CASCADE,
  title        VARCHAR(200) NOT NULL,
  message      TEXT         NOT NULL,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_announcements_workshop ON announcements(workshop_id);

-- ---------------------------------------------------------------------
-- certificates
--   certificate_id     : public ID printed on the PDF, e.g. CICT26-7K3M9QX2
--   verification_token : secret included in the QR verification URL
-- The PDF lives at server/storage/certificates/<certificate_id>.pdf and is
-- regenerated from this row if the file is missing.
-- ---------------------------------------------------------------------
CREATE TABLE certificates (
  id                     INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  certificate_id         VARCHAR(20)  NOT NULL UNIQUE,
  participant_id         INTEGER      NOT NULL REFERENCES users(id)     ON DELETE CASCADE,
  workshop_id            INTEGER      NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  attendance_percentage  NUMERIC(5,2) NOT NULL
                           CHECK (attendance_percentage BETWEEN 0 AND 100),
  verification_token     VARCHAR(64)  NOT NULL UNIQUE,
  issued_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (workshop_id, participant_id)
);
CREATE INDEX idx_certificates_participant ON certificates(participant_id);

-- updated_at triggers
CREATE TRIGGER trg_users_updated         BEFORE UPDATE ON users         FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_workshops_updated     BEFORE UPDATE ON workshops     FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_registrations_updated BEFORE UPDATE ON registrations FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_sessions_updated      BEFORE UPDATE ON sessions      FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
