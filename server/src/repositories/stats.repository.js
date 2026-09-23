import env from '../config/env.js';
import { query } from '../db/pool.js';
import { sessionEnded } from '../utils/sql.js';
import { camelizeRows } from '../utils/case.js';

export async function portalTotals() {
  const { rows } = await query(`
    SELECT
      (SELECT COUNT(*) FROM users)                                    AS users,
      (SELECT COUNT(*) FROM users WHERE role = 'ADMIN')               AS admins,
      (SELECT COUNT(*) FROM users WHERE role = 'ORGANIZER')           AS organizers,
      (SELECT COUNT(*) FROM users WHERE role = 'PARTICIPANT')         AS participants,
      (SELECT COUNT(*) FROM workshops)                                AS workshops,
      (SELECT COUNT(*) FROM workshops WHERE status = 'DRAFT')         AS draft_workshops,
      (SELECT COUNT(*) FROM workshops WHERE status = 'PUBLISHED')     AS published_workshops,
      (SELECT COUNT(*) FROM workshops WHERE status = 'CLOSED')        AS closed_workshops,
      (SELECT COUNT(*) FROM registrations WHERE status = 'REGISTERED') AS registrations,
      (SELECT COUNT(*) FROM sessions)                                 AS sessions,
      (SELECT COUNT(*) FROM attendance WHERE status = 'PRESENT')      AS attendance_marked,
      (SELECT COUNT(*) FROM certificates)                             AS certificates,
      (SELECT COUNT(*) FROM organizer_requests WHERE status = 'PENDING') AS pending_organizer_requests
  `);
  return rows[0];
}

// Per-workshop numbers; attendance percentages are derived in the service.
// present_count only counts completed sessions (like attendance percentages).
export async function workshopBreakdown() {
  const { rows } = await query(
    `
    SELECT w.id, w.title, w.status, w.start_date, w.end_date, u.name AS organizer_name,
           (SELECT COUNT(*) FROM registrations r
             WHERE r.workshop_id = w.id AND r.status = 'REGISTERED') AS registered_count,
           (SELECT COUNT(*) FROM sessions s WHERE s.workshop_id = w.id) AS session_count,
           (SELECT COUNT(*) FROM sessions s
             WHERE s.workshop_id = w.id AND ${sessionEnded('s', '$1')}) AS completed_session_count,
           (SELECT COUNT(*) FROM attendance a
              JOIN sessions s ON s.id = a.session_id
              JOIN registrations r ON r.workshop_id = s.workshop_id AND r.participant_id = a.participant_id
             WHERE s.workshop_id = w.id AND a.status = 'PRESENT' AND r.status = 'REGISTERED'
               AND ${sessionEnded('s', '$1')}) AS present_count,
           (SELECT COUNT(*) FROM certificates c WHERE c.workshop_id = w.id) AS certificate_count
    FROM workshops w
    JOIN users u ON u.id = w.created_by
    ORDER BY w.start_date DESC`,
    [env.appTimezone],
  );
  return camelizeRows(rows);
}
