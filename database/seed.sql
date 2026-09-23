-- =====================================================================
-- Demo data. Run AFTER schema.sql:
--   psql -U postgres -d aurex26 -f database/seed.sql
--
-- All demo accounts use the password:  Password@123
-- =====================================================================

BEGIN;

INSERT INTO users (full_name, email, password_hash, role, department) VALUES
  ('Portal Admin',     'admin@aurex26.dev',       '$2b$10$N4PnxXshRSw.ob2xu7ieaut1XkAGy5M469b8e7J2PDyyIu.3.TQIW', 'admin',       'CICT'),
  ('Olivia Organizer', 'organizer@aurex26.dev',   '$2b$10$N4PnxXshRSw.ob2xu7ieaut1XkAGy5M469b8e7J2PDyyIu.3.TQIW', 'organizer',   'CICT'),
  ('Pat Participant',  'participant@aurex26.dev', '$2b$10$N4PnxXshRSw.ob2xu7ieaut1XkAGy5M469b8e7J2PDyyIu.3.TQIW', 'participant', 'Computer Science'),
  ('Sam Student',      'sam@aurex26.dev',         '$2b$10$N4PnxXshRSw.ob2xu7ieaut1XkAGy5M469b8e7J2PDyyIu.3.TQIW', 'participant', 'Information Technology');

INSERT INTO workshops (organizer_id, title, description, category, mode, venue, meeting_link,
                       start_date, end_date, registration_deadline, capacity,
                       registration_fields, status, published_at)
VALUES
  ((SELECT id FROM users WHERE email = 'organizer@aurex26.dev'),
   'Full-Stack Web Development Bootcamp',
   'Hands-on workshop covering React, Express and PostgreSQL.',
   'Web Development', 'hybrid', 'CICT Lab 2', 'https://meet.example.com/fullstack',
   CURRENT_DATE + 7, CURRENT_DATE + 8, NOW() + INTERVAL '5 days', 60,
   '[{"key":"year","label":"Year of study","type":"select","required":true,"options":["1","2","3","4"]},
     {"key":"laptop","label":"Will you bring a laptop?","type":"checkbox","required":false}]'::jsonb,
   'published', NOW()),
  ((SELECT id FROM users WHERE email = 'organizer@aurex26.dev'),
   'Intro to Machine Learning',
   'Draft workshop, not yet visible to participants.',
   'AI / ML', 'offline', 'CICT Seminar Hall', NULL,
   CURRENT_DATE + 21, CURRENT_DATE + 21, NULL, 40,
   '[]'::jsonb, 'draft', NULL);

INSERT INTO sessions (workshop_id, title, starts_at, ends_at, venue)
SELECT w.id, s.title, s.starts_at, s.ends_at, 'CICT Lab 2'
FROM workshops w
CROSS JOIN (VALUES
  ('Day 1: Frontend with React', (CURRENT_DATE + 7) + TIME '09:00', (CURRENT_DATE + 7) + TIME '12:00'),
  ('Day 1: APIs with Express',   (CURRENT_DATE + 7) + TIME '13:00', (CURRENT_DATE + 7) + TIME '16:00'),
  ('Day 2: PostgreSQL',          (CURRENT_DATE + 8) + TIME '09:00', (CURRENT_DATE + 8) + TIME '12:00'),
  ('Day 2: Deploy & Demo',       (CURRENT_DATE + 8) + TIME '13:00', (CURRENT_DATE + 8) + TIME '16:00')
) AS s(title, starts_at, ends_at)
WHERE w.title = 'Full-Stack Web Development Bootcamp';

INSERT INTO registrations (workshop_id, user_id, status, form_responses)
SELECT w.id, u.id, 'approved', '{"year":"3","laptop":true}'::jsonb
FROM workshops w, users u
WHERE w.title = 'Full-Stack Web Development Bootcamp'
  AND u.role = 'participant';

INSERT INTO announcements (workshop_id, author_id, title, body) VALUES
  (NULL,
   (SELECT id FROM users WHERE email = 'admin@aurex26.dev'),
   'Welcome to the CICT Workshop Portal',
   'Browse upcoming workshops and register to secure your seat.'),
  ((SELECT id FROM workshops WHERE title = 'Full-Stack Web Development Bootcamp'),
   (SELECT id FROM users WHERE email = 'organizer@aurex26.dev'),
   'Bring your laptop',
   'Please install Node.js 20+ and PostgreSQL before Day 1.');

COMMIT;
