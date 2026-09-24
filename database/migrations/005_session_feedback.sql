-- Session feedback: organizer-defined Likert questions (per workshop) and one
-- anonymous response per participant per session (ratings + optional comment).
-- Safe to run more than once.

-- Questions asked after every session of a workshop. Questions that already
-- have answers are archived (is_active = FALSE) instead of deleted, so past
-- statistics stay correct.
CREATE TABLE IF NOT EXISTS feedback_questions (
  id             INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  workshop_id    INTEGER      NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  question_text  VARCHAR(300) NOT NULL,
  position       INTEGER      NOT NULL DEFAULT 0,
  is_active      BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_feedback_questions_workshop ON feedback_questions(workshop_id);

-- One submission per participant per session.
CREATE TABLE IF NOT EXISTS session_feedback (
  id              INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id      INTEGER     NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  participant_id  INTEGER     NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  comment         TEXT,
  submitted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (session_id, participant_id)
);

-- Ratings: 5 Strongly agree, 4 Agree, 3 Neutral, 2 Disagree, 1 Strongly disagree.
CREATE TABLE IF NOT EXISTS feedback_answers (
  feedback_id  INTEGER  NOT NULL REFERENCES session_feedback(id)   ON DELETE CASCADE,
  question_id  INTEGER  NOT NULL REFERENCES feedback_questions(id) ON DELETE CASCADE,
  rating       SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  PRIMARY KEY (feedback_id, question_id)
);
CREATE INDEX IF NOT EXISTS idx_feedback_answers_question ON feedback_answers(question_id);

-- Default questions for existing workshops that have none yet.
INSERT INTO feedback_questions (workshop_id, question_text, position)
SELECT w.id, q.text, q.pos
FROM workshops w
CROSS JOIN (VALUES
  ('The session content was clear and easy to understand.', 1),
  ('I understood the key concepts covered in this session.', 2),
  ('I can apply what I learned in this session.', 3),
  ('The pace of the session was right for me.', 4)
) AS q(text, pos)
WHERE NOT EXISTS (SELECT 1 FROM feedback_questions f WHERE f.workshop_id = w.id);
