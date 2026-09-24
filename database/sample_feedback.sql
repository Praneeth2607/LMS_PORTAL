-- OPTIONAL demo data for an existing database (e.g. Supabase) after running
-- migrations/005_session_feedback.sql. Adds sample feedback for the seeded
-- Full-Stack workshop. Safe to run more than once. Not needed with db:reset
-- (seed.sql already contains it).

-- ---------------------------------------------------------------------
-- Feedback: default questions for every workshop, plus sample responses for
-- the finished Full-Stack workshop (from participants marked PRESENT).
-- ---------------------------------------------------------------------
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

WITH s AS (
  SELECT se.id, se.session_date, se.end_time,
         ROW_NUMBER() OVER (ORDER BY se.session_date, se.start_time) AS n
  FROM sessions se
  JOIN workshops w ON w.id = se.workshop_id
  WHERE w.title = 'Full-Stack Web Development with React & Node.js'
),
p AS (
  SELECT u.id, v.k, v.comments
  FROM (VALUES
    ('priya@aurex26.dev',   1, ARRAY['Loved the live coding. More practice exercises would help.', NULL, 'Clear explanations, easy to follow.']),
    ('rahul@aurex26.dev',   2, ARRAY[NULL, 'A bit fast for me, a recap at the start would help.', NULL]),
    ('ananya@aurex26.dev',  3, ARRAY['Great examples. Please share the slides after the session.', NULL, NULL]),
    ('karthik@aurex26.dev', 4, ARRAY[NULL, NULL, 'The hands-on part was the most useful.'])
  ) AS v(email, k, comments)
  JOIN users u ON u.email = v.email
)
INSERT INTO session_feedback (session_id, participant_id, comment, submitted_at)
SELECT s.id, p.id, p.comments[1 + ((s.n + p.k) % 3)],
       (s.session_date + s.end_time + INTERVAL '20 minutes')::timestamptz
FROM s
CROSS JOIN p
JOIN attendance a ON a.session_id = s.id AND a.participant_id = p.id AND a.status = 'PRESENT'
WHERE (s.n + p.k) % 5 <> 0 -- not everyone leaves feedback
ON CONFLICT (session_id, participant_id) DO NOTHING;

INSERT INTO feedback_answers (feedback_id, question_id, rating)
SELECT sf.id, q.id,
       (ARRAY[5, 4, 4, 5, 3, 4, 2, 5, 4, 3])[1 + ((sf.session_id * 7 + sf.participant_id * 3 + q.position * 5) % 10)]
FROM session_feedback sf
JOIN sessions se ON se.id = sf.session_id
JOIN feedback_questions q ON q.workshop_id = se.workshop_id AND q.is_active
ON CONFLICT (feedback_id, question_id) DO NOTHING;
