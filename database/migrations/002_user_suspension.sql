-- User suspension + blocked sign-up emails. Safe to run more than once.

-- Set when an admin suspends the account (NULL = active). Suspended users cannot sign in.
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;

-- Emails of suspended users that an admin deleted. Self sign-up with these emails
-- is refused; an admin can still create an account with them (which unblocks it).
CREATE TABLE IF NOT EXISTS blocked_emails (
  email       VARCHAR(255) PRIMARY KEY CHECK (email = LOWER(email)),
  blocked_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  blocked_by  INTEGER      REFERENCES users(id) ON DELETE SET NULL
);
