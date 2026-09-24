-- =====================================================================
-- Demo data: a realistic ~15 months of portal activity for the demo.
--   3 more organizers, 72 students, 12 workshops (10 finished, 2 upcoming),
--   ~60 sessions, registrations, attendance, feedback and certificates.
--
-- Everything is relative to CURRENT_DATE, so it always looks recent, and it
-- is deterministic (hashtext), so every run produces the same numbers.
-- Safe to run more than once: it does nothing if the demo data is already
-- there. Needs the tables from schema.sql + migrations 001–005.
--   Local:    loaded automatically by `npm run db:reset`
--   Supabase: paste into the SQL editor and run
-- All demo accounts use the password Password@123.
-- =====================================================================

DO $demo$
BEGIN
IF EXISTS (SELECT 1 FROM workshops WHERE title = 'Python Programming Foundations') THEN
  RAISE NOTICE 'Demo data already loaded - nothing to do.';
  RETURN;
END IF;

-- ---------------------------------------------------------------------
-- People
-- ---------------------------------------------------------------------
INSERT INTO users (name, email, password_hash, role, created_at)
SELECT v.name, v.email, '$2b$10$N4PnxXshRSw.ob2xu7ieaut1XkAGy5M469b8e7J2PDyyIu.3.TQIW', v.role, CURRENT_DATE - v.days_ago
FROM (VALUES
  ('Dr. Kavitha Raman', 'kavitha@aurex26.dev', 'ORGANIZER', 480),
  ('Prof. Suresh Babu',  'suresh@aurex26.dev',  'ORGANIZER', 470),
  ('Nisha Menon',        'nisha@aurex26.dev',   'ORGANIZER', 460)
) AS v(name, email, role, days_ago)
ON CONFLICT (email) DO NOTHING;

INSERT INTO users (name, email, password_hash, role, created_at)
SELECT v.name, lower(replace(v.name, ' ', '.')) || '@student.aurex26.dev',
       '$2b$10$N4PnxXshRSw.ob2xu7ieaut1XkAGy5M469b8e7J2PDyyIu.3.TQIW', 'PARTICIPANT',
       -- most students joined early; some joined later through the year
       CURRENT_DATE - (CASE WHEN abs(hashtext(v.name)::bigint) % 10 < 7
                            THEN 450 + abs(hashtext(v.name)::bigint) % 30
                            ELSE 60 + abs(hashtext(v.name)::bigint) % 380 END)::int
FROM (VALUES
  ('Aarav Kumar'), ('Aditi Rao'), ('Akash Reddy'), ('Anjali Nair'), ('Arjun Pillai'), ('Bhavya Shetty'),
  ('Deepak Menon'), ('Divya Krishnan'), ('Gautham Raj'), ('Harini Subramanian'), ('Ishaan Gupta'), ('Janani Venkatesh'),
  ('Karan Mehta'), ('Keerthana Suresh'), ('Lakshmi Priya'), ('Manoj Kumar'), ('Meghna Iyer'), ('Mohammed Irfan'),
  ('Nandini Rao'), ('Naveen Chandra'), ('Nikhil Joshi'), ('Pooja Hegde'), ('Pranav Srinivasan'), ('Rahul Dev'),
  ('Ramya Balaji'), ('Rohit Sharma'), ('Sahana Murthy'), ('Sanjay Ramesh'), ('Shalini Das'), ('Shreya Kulkarni'),
  ('Siddharth Varma'), ('Sneha Reddy'), ('Sowmya Anand'), ('Sriram Natarajan'), ('Swathi Mohan'), ('Tanvi Desai'),
  ('Tarun Prakash'), ('Varsha Gopal'), ('Vignesh Kannan'), ('Vishal Singh'), ('Yamini Sekar'), ('Zoya Khan'),
  ('Abhinav Rao'), ('Aishwarya Menon'), ('Ajay Krishna'), ('Amrita Sen'), ('Ashwin Kumar'), ('Chandana Gowda'),
  ('Dhanush Raj'), ('Farhan Ali'), ('Gayathri Devi'), ('Hari Prasad'), ('Indhu Mathi'), ('Jayanth Reddy'),
  ('Kavya Srinivas'), ('Kishore Babu'), ('Madhavi Latha'), ('Nithya Shree'), ('Pavithra Ramesh'), ('Praveen Kumar'),
  ('Rakesh Nair'), ('Revathi Sundar'), ('Santhosh Kumar'), ('Sindhu Priya'), ('Subash Chandran'), ('Surya Narayanan'),
  ('Thejaswini Rao'), ('Uday Kiran'), ('Vaishnavi Iyer'), ('Vinay Kumar'), ('Yashwanth Gowda'), ('Zainab Fathima')
) AS v(name)
ON CONFLICT (email) DO NOTHING;

-- ---------------------------------------------------------------------
-- Workshops. Tuning per workshop (kept in a temp table for the steps below):
--   reach    : % of all students who registered
--   base     : attendance % at session 1;  decay: points lost per session
--   quality  : average feedback rating (1–5)
-- ---------------------------------------------------------------------
CREATE TEMP TABLE demo_ws ON COMMIT DROP AS
SELECT * FROM (VALUES
  ('Python Programming Foundations', 'kavitha@aurex26.dev', 440, 6, 'OFFLINE', 'CICT Lab 1', 'CLOSED', 60, 70, 94, 2, 4.4, '09:30', '12:00',
   'Variables to functions to files: a hands-on start in Python for first-year students, with a mini project on the last day.'),
  ('Git & GitHub for Collaborative Development', 'nisha@aurex26.dev', 405, 3, 'ONLINE', NULL, 'CLOSED', 80, 55, 90, 3, 4.2, '18:00', '19:30',
   'Branches, pull requests, code review and resolving merge conflicts, practised on a shared class repository.'),
  ('Data Structures & Algorithms Bootcamp', 'suresh@aurex26.dev', 360, 8, 'OFFLINE', 'CICT Seminar Hall', 'CLOSED', 60, 75, 92, 6, 3.6, '10:00', '13:00',
   'Arrays, linked lists, trees, graphs and dynamic programming, with timed problem-solving every day.'),
  ('UI/UX Design Fundamentals with Figma', 'nisha@aurex26.dev', 310, 4, 'HYBRID', 'CICT Design Studio', 'CLOSED', 40, 45, 93, 3, 4.5, '14:00', '16:30',
   'User research, wireframes and interactive prototypes in Figma, ending with a usability test of your own design.'),
  ('Introduction to Cloud Computing with AWS', 'arjun@aurex26.dev', 255, 5, 'HYBRID', 'CICT Lab 2', 'CLOSED', 50, 60, 88, 4, 3.9, '10:00', '12:30',
   'EC2, S3, IAM and serverless basics, deploying a small web app to AWS by the end of the week.'),
  ('Android App Development with Kotlin', 'kavitha@aurex26.dev', 205, 6, 'OFFLINE', 'CICT Lab 1', 'CLOSED', 45, 58, 91, 3, 4.1, '09:30', '12:30',
   'Kotlin, Jetpack Compose and local storage: build and publish a working to-do app on your own phone.'),
  ('Competitive Programming Camp', 'suresh@aurex26.dev', 150, 6, 'ONLINE', NULL, 'CLOSED', 100, 65, 90, 7, 3.4, '19:00', '21:00',
   'Contest strategy, greedy, binary search and graph problems, with a live contest every evening.'),
  ('Internet of Things with Arduino', 'arjun@aurex26.dev', 110, 4, 'OFFLINE', 'CICT Electronics Lab', 'CLOSED', 35, 50, 95, 2, 4.6, '14:00', '17:00',
   'Sensors, actuators and Wi-Fi modules on Arduino, finishing with a connected smart-room prototype.'),
  ('Generative AI & Prompt Engineering', 'meera@aurex26.dev', 70, 4, 'ONLINE', NULL, 'CLOSED', 120, 80, 96, 2, 4.7, '18:00', '20:00',
   'How large language models work, prompt patterns, retrieval-augmented generation and building a small AI assistant.'),
  ('Linux & Shell Scripting Essentials', 'nisha@aurex26.dev', 40, 3, 'HYBRID', 'CICT Lab 2', 'CLOSED', 60, 50, 89, 4, 4.0, '15:00', '17:00',
   'The Linux command line, permissions, processes and automating everyday tasks with Bash scripts.'),
  ('Blockchain Basics & Smart Contracts', 'suresh@aurex26.dev', -18, 3, 'ONLINE', NULL, 'PUBLISHED', 80, 40, 0, 0, 0, '18:00', '20:00',
   'Blocks, consensus and wallets, then writing and testing a simple smart contract in Solidity.'),
  ('Data Visualization with Power BI', 'kavitha@aurex26.dev', -30, 4, 'OFFLINE', 'CICT Lab 1', 'PUBLISHED', 40, 35, 0, 0, 0, '10:00', '12:30',
   'Cleaning data, building interactive dashboards and telling a clear story with charts in Power BI.')
) AS t(title, organizer, starts_ago, sessions, mode, venue, status, capacity, reach, base, decay, quality, start_t, end_t, description);

INSERT INTO workshops (title, description, start_date, end_date, mode, venue, meeting_link, capacity, status, created_by, created_at)
SELECT d.title, d.description, CURRENT_DATE - d.starts_ago, CURRENT_DATE - d.starts_ago + (d.sessions - 1),
       d.mode, d.venue,
       CASE WHEN d.mode <> 'OFFLINE' THEN 'https://meet.google.com/cict-' || lower(substr(md5(d.title), 1, 3)) || '-demo' END,
       d.capacity, d.status, u.id, CURRENT_DATE - d.starts_ago - 30
FROM demo_ws d JOIN users u ON u.email = d.organizer;

-- Registration form for every demo workshop.
INSERT INTO registration_fields (workshop_id, field_name, field_type, required, field_order, options)
SELECT w.id, f.field_name, f.field_type, f.required, f.field_order, f.options::jsonb
FROM demo_ws d
JOIN workshops w ON w.title = d.title
CROSS JOIN (VALUES
  ('Roll Number', 'TEXT', TRUE, 1, NULL),
  ('Department', 'SELECT', TRUE, 2, '["CSE","IT","ECE","EEE","MECH"]'),
  ('Year of Study', 'SELECT', TRUE, 3, '["1","2","3","4"]')
) AS f(field_name, field_type, required, field_order, options)
ON CONFLICT (workshop_id, field_name) DO NOTHING;

-- Default feedback statements.
INSERT INTO feedback_questions (workshop_id, question_text, position)
SELECT w.id, q.text, q.pos
FROM demo_ws d
JOIN workshops w ON w.title = d.title
CROSS JOIN (VALUES
  ('The session content was clear and easy to understand.', 1),
  ('I understood the key concepts covered in this session.', 2),
  ('I can apply what I learned in this session.', 3),
  ('The pace of the session was right for me.', 4)
) AS q(text, pos)
WHERE NOT EXISTS (SELECT 1 FROM feedback_questions f WHERE f.workshop_id = w.id);

-- Sessions: one per day, Day 1…n.
INSERT INTO sessions (workshop_id, title, session_date, start_time, end_time)
SELECT w.id,
       'Day ' || n || ' · ' || (ARRAY['Getting started', 'Core concepts', 'Hands-on lab', 'Going deeper', 'Mini project',
                                     'Real-world case study', 'Practice & review', 'Final project & demo'])[
         CASE WHEN n = d.sessions THEN 8 ELSE LEAST(n, 7) END],
       w.start_date + (n - 1), d.start_t::time, d.end_t::time
FROM demo_ws d
JOIN workshops w ON w.title = d.title
CROSS JOIN LATERAL generate_series(1, d.sessions) AS n;

-- ---------------------------------------------------------------------
-- Registrations: each student registers for ~reach% of workshops, a few
-- days before the start; about 1 in 20 cancels. Existing seed participants
-- join some too.
-- ---------------------------------------------------------------------
INSERT INTO registrations (workshop_id, participant_id, form_data, status, registered_at)
SELECT w.id, u.id,
       jsonb_build_object(
         'Roll Number', '23' || (ARRAY['CS', 'IT', 'EC', 'EE', 'ME'])[1 + abs(hashtext(u.email)::bigint) % 5] || lpad((u.id * 7 % 900 + 100)::text, 3, '0'),
         'Department', (ARRAY['CSE', 'IT', 'ECE', 'EEE', 'MECH'])[1 + abs(hashtext(u.email)::bigint) % 5],
         'Year of Study', (1 + abs(hashtext(u.email || 'year')::bigint) % 4)::text),
       CASE WHEN abs(hashtext(u.email || w.title || 'cancel')::bigint) % 20 = 0 AND d.status = 'CLOSED' THEN 'CANCELLED' ELSE 'REGISTERED' END,
       LEAST(NOW() - INTERVAL '1 hour',
         (w.start_date - (2 + abs(hashtext(u.email || w.title || 'reg')::bigint) % 24)::int + TIME '10:00'
           + make_interval(mins => (abs(hashtext(u.email || w.title)::bigint) % 600)::int)) AT TIME ZONE 'Asia/Kolkata')
FROM demo_ws d
JOIN workshops w ON w.title = d.title
JOIN users u ON u.role = 'PARTICIPANT'
WHERE abs(hashtext(u.email || w.title)::bigint) % 100 < d.reach
  AND u.created_at < w.start_date
ON CONFLICT (workshop_id, participant_id) DO NOTHING;

-- ---------------------------------------------------------------------
-- Attendance (finished sessions only): starts high and tails off by `decay`
-- points per session; each student has their own commitment level.
-- Online sessions are recorded by the live-room presence tracking.
-- ---------------------------------------------------------------------
INSERT INTO attendance (session_id, participant_id, status, method, marked_at)
SELECT s.id, r.participant_id, 'PRESENT',
       CASE WHEN d.mode = 'ONLINE' THEN 'PRESENCE'
            WHEN abs(hashtext(s.id || '-' || r.participant_id)::bigint) % 10 = 0 THEN 'CODE'
            WHEN abs(hashtext(s.id || '/' || r.participant_id)::bigint) % 25 = 0 THEN 'MANUAL'
            ELSE 'QR' END,
       (s.session_date + s.start_time + make_interval(mins => (3 + abs(hashtext(s.id || '*' || r.participant_id)::bigint) % 20)::int))
         AT TIME ZONE 'Asia/Kolkata'
FROM demo_ws d
JOIN workshops w ON w.title = d.title
JOIN sessions s ON s.workshop_id = w.id
JOIN registrations r ON r.workshop_id = w.id AND r.status = 'REGISTERED'
JOIN users u ON u.id = r.participant_id
CROSS JOIN LATERAL (
  SELECT COUNT(*) AS n FROM sessions s2
  WHERE s2.workshop_id = w.id AND (s2.session_date, s2.start_time, s2.id) <= (s.session_date, s.start_time, s.id)
) k
WHERE d.status = 'CLOSED'
  AND abs(hashtext(u.email || '#' || s.id)::bigint) % 100
      < d.base - d.decay * (k.n - 1) + ((abs(hashtext(u.email || 'commitment')::bigint) % 25) - 14)
ON CONFLICT (session_id, participant_id) DO NOTHING;

-- ---------------------------------------------------------------------
-- Feedback: about 55% of attendees respond; ratings follow the workshop's
-- quality with personal variation; faster courses score lower on pace.
-- About a third leave a written comment.
-- ---------------------------------------------------------------------
INSERT INTO session_feedback (session_id, participant_id, comment, submitted_at)
SELECT a.session_id, a.participant_id,
       CASE WHEN abs(hashtext(a.session_id || 'c' || a.participant_id)::bigint) % 3 = 0 THEN
         CASE WHEN d.quality >= 4.2 THEN (ARRAY[
             'Really well explained, the examples made everything click.',
             'Loved the hands-on part. Please keep the lab exercises!',
             'Great session, the instructor answered every question patiently.',
             'Best session so far, I finally understand how this works.',
             'Clear and practical. Sharing the slides afterwards helped a lot.',
             'Very engaging, the time flew by.',
             'The mini project was the highlight for me.'])[1 + abs(hashtext(a.session_id || 'p' || a.participant_id)::bigint) % 7]
           WHEN d.quality >= 3.8 THEN (ARRAY[
             'Good content, but a short recap at the start would help.',
             'Useful session. The lab setup took a while, though.',
             'Nice examples. Would like more practice problems.',
             'Mostly clear. The second half felt a little rushed.',
             'Good overall, please share the code after the session.',
             'Helpful, but the audio was unclear in places.'])[1 + abs(hashtext(a.session_id || 'p' || a.participant_id)::bigint) % 6]
           ELSE (ARRAY[
             'Too fast for me, I could not keep up with the problems.',
             'Hard to follow without more basics first.',
             'Interesting problems but not enough time to solve them.',
             'Please slow down and explain the approach before coding.',
             'Good problems, but the pace was intense.',
             'Needed more worked examples before the contest.'])[1 + abs(hashtext(a.session_id || 'p' || a.participant_id)::bigint) % 6]
         END
       END,
       (s.session_date + s.end_time + make_interval(mins => (5 + abs(hashtext(a.session_id || 't' || a.participant_id)::bigint) % 90)::int))
         AT TIME ZONE 'Asia/Kolkata'
FROM attendance a
JOIN sessions s ON s.id = a.session_id
JOIN workshops w ON w.id = s.workshop_id
JOIN demo_ws d ON d.title = w.title
WHERE a.status = 'PRESENT'
  AND abs(hashtext(a.session_id || 'f' || a.participant_id)::bigint) % 100 < 55
ON CONFLICT (session_id, participant_id) DO NOTHING;

INSERT INTO feedback_answers (feedback_id, question_id, rating)
SELECT sf.id, q.id,
       GREATEST(1, LEAST(5, round(
         d.quality
         + ((abs(hashtext(sf.id || 'r' || q.id)::bigint) % 100) / 100.0 * 2.2 - 1.1)
         - CASE WHEN q.position = 4 THEN d.decay * 0.12 ELSE 0 END
       )))::smallint
FROM session_feedback sf
JOIN sessions s ON s.id = sf.session_id
JOIN workshops w ON w.id = s.workshop_id
JOIN demo_ws d ON d.title = w.title
JOIN feedback_questions q ON q.workshop_id = w.id AND q.is_active
ON CONFLICT (feedback_id, question_id) DO NOTHING;

-- ---------------------------------------------------------------------
-- Certificates for everyone with at least 90% attendance in a finished
-- workshop (the PDF is generated on first download).
-- ---------------------------------------------------------------------
INSERT INTO certificates (certificate_id, participant_id, workshop_id, attendance_percentage, verification_token, issued_at)
SELECT 'CICT26-' || translate(upper(substr(md5(w.id || ':' || r.participant_id), 1, 8)), '01', 'XY'),
       r.participant_id, w.id,
       round(100.0 * x.attended / x.total, 2),
       replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
       (w.end_date + 2 + TIME '11:00') AT TIME ZONE 'Asia/Kolkata'
FROM demo_ws d
JOIN workshops w ON w.title = d.title
JOIN registrations r ON r.workshop_id = w.id AND r.status = 'REGISTERED'
CROSS JOIN LATERAL (
  SELECT (SELECT COUNT(*) FROM sessions s WHERE s.workshop_id = w.id) AS total,
         (SELECT COUNT(*) FROM attendance a JOIN sessions s ON s.id = a.session_id
           WHERE s.workshop_id = w.id AND a.participant_id = r.participant_id AND a.status = 'PRESENT') AS attended
) x
WHERE d.status = 'CLOSED' AND x.total > 0 AND x.attended * 100 >= 90 * x.total
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------
-- A few announcements.
-- ---------------------------------------------------------------------
INSERT INTO announcements (workshop_id, created_by, title, message, created_at)
SELECT w.id, w.created_by, a.title, a.message, (w.start_date - a.days_before + TIME '17:00') AT TIME ZONE 'Asia/Kolkata'
FROM (VALUES
  ('Generative AI & Prompt Engineering', 'Joining link and setup', 'Sessions run live in the portal. Please join 5 minutes early and keep this tab open during the session.', 2),
  ('Data Structures & Algorithms Bootcamp', 'Practice set released', 'Warm-up problems are on the shared drive. Try at least five before Day 1.', 4),
  ('Blockchain Basics & Smart Contracts', 'Install MetaMask', 'Please install the MetaMask browser extension before the first session.', 3),
  ('Data Visualization with Power BI', 'Bring your laptop', 'Power BI Desktop is Windows-only. A few lab machines are available if you use a Mac.', 5)
) AS a(workshop_title, title, message, days_before)
JOIN workshops w ON w.title = a.workshop_title;

RAISE NOTICE 'Demo data loaded.';
END
$demo$;
