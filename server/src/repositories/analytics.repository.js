// Aggregates for the admin analytics charts. Everything is counted in SQL;
// no individual participant data leaves this file.
//
// scope = { workshopId, from, to }: an optional workshop and an optional date
// range ('YYYY-MM-DD', inclusive, institute time). Sessions are in range by
// their date, registrations by when they were made, check-ins by when they
// were marked and certificates by when they were issued.
import env from '../config/env.js';
import { query } from '../db/pool.js';
import { sessionEnded } from '../utils/sql.js';
import { camelizeRows } from '../utils/case.js';

// $1 = timezone, $2 = workshop id, $3 = from, $4 = to (placeholders shared below)
const scopeParams = ({ workshopId = null, from = null, to = null }) => [env.appTimezone, workshopId, from, to];
const sessionInScope = (alias) =>
  `($2::int IS NULL OR ${alias}.workshop_id = $2)
   AND ($3::date IS NULL OR ${alias}.session_date >= $3::date)
   AND ($4::date IS NULL OR ${alias}.session_date <= $4::date)`;

// Filter options: non-draft workshops and the years that have any activity.
export async function filterOptions() {
  const { rows: workshops } = await query(
    `SELECT id, title, start_date FROM workshops WHERE status <> 'DRAFT' ORDER BY start_date DESC, id DESC`,
  );
  const { rows: years } = await query(
    `SELECT DISTINCT y FROM (
       SELECT EXTRACT(YEAR FROM s.session_date)::int AS y FROM sessions s
       UNION SELECT EXTRACT(YEAR FROM r.registered_at AT TIME ZONE $1)::int FROM registrations r
     ) t ORDER BY y DESC`,
    [env.appTimezone],
  );
  return { workshops: camelizeRows(workshops), years: years.map((r) => r.y) };
}

// First day with any registration or check-in (for the "all time" range).
export async function firstActivityDate(workshopId = null) {
  const { rows } = await query(
    `SELECT to_char(LEAST(
       (SELECT MIN((r.registered_at AT TIME ZONE $1)::date) FROM registrations r WHERE $2::int IS NULL OR r.workshop_id = $2),
       (SELECT MIN((a.marked_at AT TIME ZONE $1)::date) FROM attendance a JOIN sessions s ON s.id = a.session_id
         WHERE $2::int IS NULL OR s.workshop_id = $2)
     ), 'YYYY-MM-DD') AS first`,
    [env.appTimezone, workshopId],
  );
  return rows[0].first;
}

// Present ÷ currently registered, per finished session. `number` is the
// session's position in its workshop's full schedule (1…n).
export async function sessionAttendance(scope) {
  const { rows } = await query(
    `WITH numbered AS (
       SELECT s.*, ROW_NUMBER() OVER (PARTITION BY s.workshop_id ORDER BY s.session_date, s.start_time, s.id) AS number
       FROM sessions s
     )
     SELECT w.id AS workshop_id, w.title AS workshop_title,
            s.id AS session_id, s.number::int AS number, s.title, s.session_date,
            to_char(s.start_time, 'HH24:MI') AS start_time,
            (SELECT COUNT(*)::int FROM registrations r
              WHERE r.workshop_id = w.id AND r.status = 'REGISTERED') AS registered,
            (SELECT COUNT(*)::int FROM attendance a
               JOIN registrations r ON r.workshop_id = w.id AND r.participant_id = a.participant_id AND r.status = 'REGISTERED'
              WHERE a.session_id = s.id AND a.status = 'PRESENT') AS present
     FROM numbered s
     JOIN workshops w ON w.id = s.workshop_id
     WHERE w.status <> 'DRAFT' AND ${sessionEnded('s', '$1')} AND ${sessionInScope('s')}
     ORDER BY w.start_date DESC, w.id, s.number`,
    scopeParams(scope),
  );
  return camelizeRows(rows);
}

// Registrations and check-ins per bucket ('day' | 'week' | 'month') from
// `start` to `end`, optionally for one workshop.
export async function activity({ workshopId = null, start, end, unit }) {
  const step = { day: '1 day', week: '1 week', month: '1 month' }[unit];
  const { rows } = await query(
    `WITH series AS (
       SELECT generate_series($2::date, $3::date, $4::interval)::date AS b
     )
     SELECT to_char(b, 'YYYY-MM-DD') AS bucket_start,
            (SELECT COUNT(*)::int FROM registrations r
              WHERE ($5::int IS NULL OR r.workshop_id = $5)
                AND (r.registered_at AT TIME ZONE $1)::date >= b
                AND (r.registered_at AT TIME ZONE $1)::date < (b + $4::interval)::date) AS registrations,
            (SELECT COUNT(*)::int FROM attendance a JOIN sessions s ON s.id = a.session_id
              WHERE a.status = 'PRESENT'
                AND ($5::int IS NULL OR s.workshop_id = $5)
                AND (a.marked_at AT TIME ZONE $1)::date >= b
                AND (a.marked_at AT TIME ZONE $1)::date < (b + $4::interval)::date) AS check_ins
     FROM series
     ORDER BY b`,
    [env.appTimezone, start, end, step, workshopId],
  );
  return camelizeRows(rows);
}

// Average rating (1–5) and share of Agree/Strongly agree answers per workshop,
// counting feedback on sessions in scope.
export async function feedbackByWorkshop(scope) {
  const { rows } = await query(
    `SELECT w.id, w.title,
            COUNT(DISTINCT sf.id)::int AS responses,
            ROUND(AVG(fa.rating)::numeric, 2)::float AS average,
            ROUND(100.0 * COUNT(*) FILTER (WHERE fa.rating >= 4) / COUNT(*), 1)::float AS agree_percent
     FROM feedback_answers fa
     JOIN session_feedback sf ON sf.id = fa.feedback_id
     JOIN sessions s ON s.id = sf.session_id
     JOIN workshops w ON w.id = s.workshop_id
     WHERE $1::text IS NOT NULL AND ${sessionInScope('s')}
     GROUP BY w.id, w.title
     ORDER BY average DESC, w.title`,
    scopeParams(scope),
  );
  return camelizeRows(rows);
}

// The statements participants agreed with least (at least `minAnswers` answers in scope).
export async function lowestStatements(scope, limit = 5, minAnswers = 3) {
  const { rows } = await query(
    `SELECT q.id, q.question_text, w.id AS workshop_id, w.title AS workshop_title,
            COUNT(*)::int AS answers,
            ROUND(AVG(fa.rating)::numeric, 2)::float AS average,
            ROUND(100.0 * COUNT(*) FILTER (WHERE fa.rating >= 4) / COUNT(*), 1)::float AS agree_percent
     FROM feedback_answers fa
     JOIN session_feedback sf ON sf.id = fa.feedback_id
     JOIN sessions s ON s.id = sf.session_id
     JOIN feedback_questions q ON q.id = fa.question_id
     JOIN workshops w ON w.id = q.workshop_id
     WHERE $1::text IS NOT NULL AND ${sessionInScope('s')}
     GROUP BY q.id, q.question_text, w.id, w.title
     HAVING COUNT(*) >= $6
     ORDER BY average ASC, answers DESC
     LIMIT $5`,
    [...scopeParams(scope), limit, minAnswers],
  );
  return camelizeRows(rows);
}

// Per organizer, within scope: workshops run (published/closed, with a session
// in range when a range is set), attendance across finished sessions
// (present ÷ registered), average feedback and certificates issued.
export async function organizerComparison(scope) {
  const scoped = scope.workshopId || scope.from || scope.to;
  const { rows } = await query(
    `SELECT u.id, u.name, u.role,
            (SELECT COUNT(*)::int FROM workshops w
              WHERE w.created_by = u.id AND w.status <> 'DRAFT'
                AND ($2::int IS NULL OR w.id = $2)
                AND (($3::date IS NULL AND $4::date IS NULL)
                     OR EXISTS (SELECT 1 FROM sessions s WHERE s.workshop_id = w.id AND ${sessionInScope('s')}))) AS workshops,
            COALESCE(att.present, 0) AS present,
            COALESCE(att.possible, 0) AS possible,
            COALESCE(att.sessions, 0) AS completed_sessions,
            fb.average AS feedback_average,
            COALESCE(fb.answers, 0) AS feedback_answers,
            (SELECT COUNT(*)::int FROM certificates c JOIN workshops w ON w.id = c.workshop_id
              WHERE w.created_by = u.id
                AND ($2::int IS NULL OR w.id = $2)
                AND ($3::date IS NULL OR (c.issued_at AT TIME ZONE $1)::date >= $3::date)
                AND ($4::date IS NULL OR (c.issued_at AT TIME ZONE $1)::date <= $4::date)) AS certificates
     FROM users u
     LEFT JOIN LATERAL (
       SELECT SUM(x.present)::int AS present, SUM(x.registered)::int AS possible, COUNT(*)::int AS sessions
       FROM (
         SELECT (SELECT COUNT(*) FROM attendance a
                   JOIN registrations r ON r.workshop_id = s.workshop_id AND r.participant_id = a.participant_id
                                       AND r.status = 'REGISTERED'
                  WHERE a.session_id = s.id AND a.status = 'PRESENT') AS present,
                (SELECT COUNT(*) FROM registrations r
                  WHERE r.workshop_id = s.workshop_id AND r.status = 'REGISTERED') AS registered
         FROM sessions s
         JOIN workshops w ON w.id = s.workshop_id
         WHERE w.created_by = u.id AND w.status <> 'DRAFT' AND ${sessionEnded('s', '$1')} AND ${sessionInScope('s')}
       ) x
     ) att ON TRUE
     LEFT JOIN LATERAL (
       SELECT ROUND(AVG(fa.rating)::numeric, 2)::float AS average, COUNT(*)::int AS answers
       FROM feedback_answers fa
       JOIN session_feedback sf ON sf.id = fa.feedback_id
       JOIN sessions s ON s.id = sf.session_id
       JOIN workshops w ON w.id = s.workshop_id
       WHERE w.created_by = u.id AND ${sessionInScope('s')}
     ) fb ON TRUE
     WHERE u.role = 'ORGANIZER' OR EXISTS (SELECT 1 FROM workshops w WHERE w.created_by = u.id)
     ORDER BY u.name`,
    scopeParams(scope),
  );
  const list = camelizeRows(rows);
  // With a filter, only organizers who have something in scope are listed.
  return scoped ? list.filter((o) => o.workshops > 0 || o.completedSessions > 0 || o.certificates > 0) : list;
}
