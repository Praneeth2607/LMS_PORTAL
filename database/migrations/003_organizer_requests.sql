-- Organizer access requests. People ask for an organizer account from the
-- sign-in page; an admin approves (creates the ORGANIZER user) or rejects.
-- Safe to run more than once.

CREATE TABLE IF NOT EXISTS organizer_requests (
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
CREATE UNIQUE INDEX IF NOT EXISTS uq_organizer_requests_pending_email
  ON organizer_requests (email) WHERE status = 'PENDING';
