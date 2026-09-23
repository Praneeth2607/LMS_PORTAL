-- =====================================================================
-- Demo data. Run AFTER schema.sql (npm run db:reset does both).
-- Dates are relative to CURRENT_DATE so the demo always looks current.
--
-- All demo accounts use the password:  Password@123
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- Users
-- ---------------------------------------------------------------------
INSERT INTO users (name, email, password_hash, role) VALUES
  ('CICT Admin',         'admin@aurex26.dev',   '$2b$10$N4PnxXshRSw.ob2xu7ieaut1XkAGy5M469b8e7J2PDyyIu.3.TQIW', 'ADMIN'),
  ('Dr. Meera Krishnan', 'meera@aurex26.dev',   '$2b$10$N4PnxXshRSw.ob2xu7ieaut1XkAGy5M469b8e7J2PDyyIu.3.TQIW', 'ORGANIZER'),
  ('Arjun Rao',          'arjun@aurex26.dev',   '$2b$10$N4PnxXshRSw.ob2xu7ieaut1XkAGy5M469b8e7J2PDyyIu.3.TQIW', 'ORGANIZER'),
  ('Priya Sharma',       'priya@aurex26.dev',   '$2b$10$N4PnxXshRSw.ob2xu7ieaut1XkAGy5M469b8e7J2PDyyIu.3.TQIW', 'PARTICIPANT'),
  ('Rahul Verma',        'rahul@aurex26.dev',   '$2b$10$N4PnxXshRSw.ob2xu7ieaut1XkAGy5M469b8e7J2PDyyIu.3.TQIW', 'PARTICIPANT'),
  ('Ananya Iyer',        'ananya@aurex26.dev',  '$2b$10$N4PnxXshRSw.ob2xu7ieaut1XkAGy5M469b8e7J2PDyyIu.3.TQIW', 'PARTICIPANT'),
  ('Karthik Nair',       'karthik@aurex26.dev', '$2b$10$N4PnxXshRSw.ob2xu7ieaut1XkAGy5M469b8e7J2PDyyIu.3.TQIW', 'PARTICIPANT'),
  ('Sneha Patel',        'sneha@aurex26.dev',   '$2b$10$N4PnxXshRSw.ob2xu7ieaut1XkAGy5M469b8e7J2PDyyIu.3.TQIW', 'PARTICIPANT'),
  ('Vikram Singh',       'vikram@aurex26.dev',  '$2b$10$N4PnxXshRSw.ob2xu7ieaut1XkAGy5M469b8e7J2PDyyIu.3.TQIW', 'PARTICIPANT');

-- ---------------------------------------------------------------------
-- Workshops
--   1. Full-Stack    CLOSED, finished, 10 sessions with attendance (certificate demo)
--   2. ML            PUBLISHED, first session TODAY (live QR attendance demo)
--   3. Cybersecurity PUBLISHED, upcoming, online
--   4. Cloud/DevOps  DRAFT (only visible to its organizer and admins)
-- ---------------------------------------------------------------------
INSERT INTO workshops (title, description, start_date, end_date, mode, venue, meeting_link, capacity, status, created_by) VALUES
  ('Full-Stack Web Development with React & Node.js',
   'A 10-day hands-on bootcamp: React fundamentals, REST APIs with Express, PostgreSQL, authentication and deployment. Participants build and deploy a complete project.',
   CURRENT_DATE - 14, CURRENT_DATE - 5, 'HYBRID', 'CICT Lab 2, Main Block', 'https://meet.google.com/abc-defg-hij', 40, 'CLOSED',
   (SELECT id FROM users WHERE email = 'meera@aurex26.dev')),

  ('Machine Learning Fundamentals with Python',
   'Supervised and unsupervised learning with scikit-learn: regression, classification, clustering and model evaluation, using real datasets.',
   CURRENT_DATE, CURRENT_DATE + 3, 'OFFLINE', 'CICT Seminar Hall', NULL, 60, 'PUBLISHED',
   (SELECT id FROM users WHERE email = 'arjun@aurex26.dev')),

  ('Cybersecurity Essentials: Web Application Security',
   'OWASP Top 10 in practice: injection, broken authentication, XSS and secure coding habits, with live capture-the-flag exercises.',
   CURRENT_DATE + 10, CURRENT_DATE + 11, 'ONLINE', NULL, 'https://zoom.us/j/9876543210', 100, 'PUBLISHED',
   (SELECT id FROM users WHERE email = 'meera@aurex26.dev')),

  ('Cloud & DevOps Bootcamp',
   'Docker, CI/CD pipelines and deploying to the cloud. Agenda still being finalised.',
   CURRENT_DATE + 20, CURRENT_DATE + 22, 'OFFLINE', 'CICT Lab 1', NULL, 30, 'DRAFT',
   (SELECT id FROM users WHERE email = 'arjun@aurex26.dev'));

-- ---------------------------------------------------------------------
-- Registration fields
-- ---------------------------------------------------------------------
INSERT INTO registration_fields (workshop_id, field_name, field_type, required, field_order, options)
SELECT w.id, f.field_name, f.field_type, f.required, f.field_order, f.options::jsonb
FROM workshops w
JOIN (VALUES
  ('Full-Stack Web Development with React & Node.js', 'Roll Number',   'TEXT',   TRUE,  1, NULL),
  ('Full-Stack Web Development with React & Node.js', 'Department',    'SELECT', TRUE,  2, '["CSE","IT","ECE","EEE","MECH"]'),
  ('Full-Stack Web Development with React & Node.js', 'Year of Study', 'SELECT', TRUE,  3, '["1","2","3","4"]'),
  ('Full-Stack Web Development with React & Node.js', 'Phone',         'PHONE',  FALSE, 4, NULL),
  ('Machine Learning Fundamentals with Python',       'Roll Number',   'TEXT',   TRUE,  1, NULL),
  ('Machine Learning Fundamentals with Python',       'Python Experience', 'SELECT', TRUE, 2, '["None","Beginner","Intermediate","Advanced"]'),
  ('Machine Learning Fundamentals with Python',       'Bringing own laptop', 'CHECKBOX', FALSE, 3, NULL),
  ('Cybersecurity Essentials: Web Application Security', 'Roll Number', 'TEXT', TRUE, 1, NULL),
  ('Cybersecurity Essentials: Web Application Security', 'Why do you want to attend?', 'TEXTAREA', FALSE, 2, NULL),
  ('Cloud & DevOps Bootcamp',                         'Roll Number',   'TEXT',   TRUE,  1, NULL)
) AS f(workshop_title, field_name, field_type, required, field_order, options)
  ON f.workshop_title = w.title;

-- ---------------------------------------------------------------------
-- Registrations
-- ---------------------------------------------------------------------
INSERT INTO registrations (workshop_id, participant_id, form_data, registered_at)
SELECT w.id, u.id, r.form_data::jsonb, LEAST(w.start_date - 7, CURRENT_DATE - 1)
FROM (VALUES
  ('Full-Stack Web Development with React & Node.js', 'priya@aurex26.dev',   '{"Roll Number":"21CS045","Department":"CSE","Year of Study":"3","Phone":"9876543210"}'),
  ('Full-Stack Web Development with React & Node.js', 'rahul@aurex26.dev',   '{"Roll Number":"21IT012","Department":"IT","Year of Study":"3"}'),
  ('Full-Stack Web Development with React & Node.js', 'ananya@aurex26.dev',  '{"Roll Number":"22CS101","Department":"CSE","Year of Study":"2","Phone":"9123456780"}'),
  ('Full-Stack Web Development with React & Node.js', 'karthik@aurex26.dev', '{"Roll Number":"21EC033","Department":"ECE","Year of Study":"3"}'),
  ('Machine Learning Fundamentals with Python',       'priya@aurex26.dev',   '{"Roll Number":"21CS045","Python Experience":"Intermediate","Bringing own laptop":true}'),
  ('Machine Learning Fundamentals with Python',       'rahul@aurex26.dev',   '{"Roll Number":"21IT012","Python Experience":"Beginner","Bringing own laptop":true}'),
  ('Machine Learning Fundamentals with Python',       'ananya@aurex26.dev',  '{"Roll Number":"22CS101","Python Experience":"Beginner","Bringing own laptop":false}'),
  ('Machine Learning Fundamentals with Python',       'sneha@aurex26.dev',   '{"Roll Number":"22IT077","Python Experience":"Advanced","Bringing own laptop":true}'),
  ('Cybersecurity Essentials: Web Application Security', 'sneha@aurex26.dev', '{"Roll Number":"22IT077","Why do you want to attend?":"Preparing for a security internship."}'),
  ('Cybersecurity Essentials: Web Application Security', 'karthik@aurex26.dev', '{"Roll Number":"21EC033"}')
) AS r(workshop_title, email, form_data)
JOIN workshops w ON w.title = r.workshop_title
JOIN users u     ON u.email = r.email;

-- ---------------------------------------------------------------------
-- Sessions
-- ---------------------------------------------------------------------
-- Full-Stack: 10 daily sessions, all in the past.
INSERT INTO sessions (workshop_id, title, session_date, start_time, end_time, meeting_link)
SELECT w.id, t.title, w.start_date + (t.n - 1), TIME '10:00', TIME '12:30', w.meeting_link
FROM workshops w
CROSS JOIN (VALUES
  (1, 'Kickoff & Modern JavaScript'),
  (2, 'React Components and Props'),
  (3, 'State, Effects and Hooks'),
  (4, 'Routing and Forms in React'),
  (5, 'Node.js & Express Basics'),
  (6, 'REST API Design'),
  (7, 'PostgreSQL and SQL Essentials'),
  (8, 'Authentication with JWT'),
  (9, 'Connecting Frontend and Backend'),
  (10, 'Deployment & Project Demo Day')
) AS t(n, title)
WHERE w.title = 'Full-Stack Web Development with React & Node.js';

-- ML: first session today, then one per day.
INSERT INTO sessions (workshop_id, title, session_date, start_time, end_time)
SELECT w.id, t.title, w.start_date + (t.n - 1), TIME '14:00', TIME '16:00'
FROM workshops w
CROSS JOIN (VALUES
  (1, 'Python for Data Science Refresher'),
  (2, 'Regression Models'),
  (3, 'Classification and Evaluation'),
  (4, 'Clustering & Mini Project')
) AS t(n, title)
WHERE w.title = 'Machine Learning Fundamentals with Python';

-- Cybersecurity: two online sessions.
INSERT INTO sessions (workshop_id, title, session_date, start_time, end_time, meeting_link)
SELECT w.id, t.title, w.start_date + (t.n - 1), TIME '18:00', TIME '20:00', w.meeting_link
FROM workshops w
CROSS JOIN (VALUES
  (1, 'OWASP Top 10 Walkthrough'),
  (2, 'Capture the Flag Lab')
) AS t(n, title)
WHERE w.title = 'Cybersecurity Essentials: Web Application Security';

-- ---------------------------------------------------------------------
-- Attendance for the finished Full-Stack workshop (10 sessions)
--   Priya   10/10 = 100%  eligible
--   Rahul    9/10 =  90%  eligible (exactly at the threshold)
--   Ananya   7/10 =  70%  NOT eligible
--   Karthik  5/10 =  50%  NOT eligible
-- Missed sessions are stored as ABSENT rows (marked manually by the organizer).
-- ---------------------------------------------------------------------
WITH s AS (
  SELECT se.id, se.session_date, se.start_time,
         ROW_NUMBER() OVER (ORDER BY se.session_date, se.start_time) AS n
  FROM sessions se
  JOIN workshops w ON w.id = se.workshop_id
  WHERE w.title = 'Full-Stack Web Development with React & Node.js'
),
p AS (
  SELECT u.id, v.absent
  FROM (VALUES
    ('priya@aurex26.dev',   ARRAY[]::INT[]),
    ('rahul@aurex26.dev',   ARRAY[4]),
    ('ananya@aurex26.dev',  ARRAY[2, 5, 8]),
    ('karthik@aurex26.dev', ARRAY[1, 3, 6, 7, 9])
  ) AS v(email, absent)
  JOIN users u ON u.email = v.email
)
INSERT INTO attendance (session_id, participant_id, status, method, marked_at)
SELECT s.id, p.id,
       CASE WHEN s.n = ANY(p.absent) THEN 'ABSENT' ELSE 'PRESENT' END,
       CASE WHEN s.n = ANY(p.absent) THEN 'MANUAL' WHEN s.n % 3 = 0 THEN 'CODE' ELSE 'QR' END,
       (s.session_date + s.start_time + INTERVAL '8 minutes')::timestamptz
FROM s CROSS JOIN p;

-- ---------------------------------------------------------------------
-- Announcements
-- ---------------------------------------------------------------------
INSERT INTO announcements (workshop_id, created_by, title, message, created_at)
SELECT w.id, w.created_by, a.title, a.message, a.created_at
FROM (VALUES
  ('Full-Stack Web Development with React & Node.js', 'Welcome to the bootcamp!',
   'Please install Node.js 20+, VS Code and PostgreSQL before Day 1. Lab 2 opens at 9:45 AM.',
   NOW() - INTERVAL '15 days'),
  ('Full-Stack Web Development with React & Node.js', 'Certificates',
   'Certificates will be issued to participants with at least 90% attendance.',
   NOW() - INTERVAL '4 days'),
  ('Machine Learning Fundamentals with Python', 'Venue confirmed',
   'All sessions are in the CICT Seminar Hall. Attendance is taken by QR at the start of each session.',
   NOW() - INTERVAL '2 days'),
  ('Machine Learning Fundamentals with Python', 'Bring your laptop',
   'Install Anaconda (Python 3.11+) beforehand. A few lab machines are available if needed.',
   NOW() - INTERVAL '1 day')
) AS a(workshop_title, title, message, created_at)
JOIN workshops w ON w.title = a.workshop_title;

COMMIT;
