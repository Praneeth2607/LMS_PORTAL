// Extra queries for the Excel exports (admin people lists).
import env from '../config/env.js';
import { query } from '../db/pool.js';
import { sessionEnded } from '../utils/sql.js';
import { camelizeRows } from '../utils/case.js';

// Every participant account with registration, attendance and certificate totals.
export async function participantsOverview() {
  const { rows } = await query(
    `SELECT u.id, u.name, u.email, u.created_at, u.suspended_at,
            (SELECT COUNT(*)::int FROM registrations r WHERE r.participant_id = u.id AND r.status = 'REGISTERED') AS registered_workshops,
            (SELECT COUNT(*)::int FROM registrations r WHERE r.participant_id = u.id AND r.status = 'CANCELLED') AS cancelled_registrations,
            (SELECT COUNT(DISTINCT s.workshop_id)::int FROM attendance a JOIN sessions s ON s.id = a.session_id
              WHERE a.participant_id = u.id AND a.status = 'PRESENT') AS workshops_attended,
            (SELECT COUNT(*)::int FROM attendance a WHERE a.participant_id = u.id AND a.status = 'PRESENT') AS sessions_attended,
            (SELECT COUNT(*)::int FROM certificates c WHERE c.participant_id = u.id) AS certificates,
            (SELECT COUNT(*)::int FROM session_feedback f WHERE f.participant_id = u.id) AS feedback_given
     FROM users u
     WHERE u.role = 'PARTICIPANT'
     ORDER BY u.name`,
  );
  return camelizeRows(rows);
}

// Every organizer (and anyone else who created a workshop) with workshop totals.
export async function organizersOverview() {
  const { rows } = await query(
    `SELECT u.id, u.name, u.email, u.role, u.created_at, u.suspended_at,
            (SELECT COUNT(*)::int FROM workshops w WHERE w.created_by = u.id AND w.status = 'PUBLISHED') AS published,
            (SELECT COUNT(*)::int FROM workshops w WHERE w.created_by = u.id AND w.status = 'CLOSED') AS closed,
            (SELECT COUNT(*)::int FROM workshops w WHERE w.created_by = u.id AND w.status = 'DRAFT') AS drafts,
            (SELECT COUNT(*)::int FROM sessions s JOIN workshops w ON w.id = s.workshop_id
              WHERE w.created_by = u.id AND w.status <> 'DRAFT' AND ${sessionEnded('s', '$1')}) AS sessions_held,
            (SELECT COUNT(*)::int FROM registrations r JOIN workshops w ON w.id = r.workshop_id
              WHERE w.created_by = u.id AND r.status = 'REGISTERED') AS registrations,
            (SELECT COUNT(*)::int FROM certificates c JOIN workshops w ON w.id = c.workshop_id
              WHERE w.created_by = u.id) AS certificates,
            (SELECT ROUND(AVG(fa.rating)::numeric, 2)::float FROM feedback_answers fa
               JOIN session_feedback sf ON sf.id = fa.feedback_id
               JOIN sessions s ON s.id = sf.session_id
               JOIN workshops w ON w.id = s.workshop_id
              WHERE w.created_by = u.id) AS feedback_average
     FROM users u
     WHERE u.role = 'ORGANIZER' OR EXISTS (SELECT 1 FROM workshops w WHERE w.created_by = u.id)
     ORDER BY u.name`,
    [env.appTimezone],
  );
  return camelizeRows(rows);
}
