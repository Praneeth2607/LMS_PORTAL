import env from '../config/env.js';
import { query } from '../db/pool.js';
import { sessionEnded } from '../utils/sql.js';
import { camelize, camelizeRows } from '../utils/case.js';

// Marks PRESENT. Returns null when the participant is already PRESENT (an
// existing ABSENT row is upgraded).
export async function markPresent(sessionId, participantId, method) {
  const { rows } = await query(
    `INSERT INTO attendance (session_id, participant_id, status, method)
     VALUES ($1, $2, 'PRESENT', $3)
     ON CONFLICT (session_id, participant_id) DO UPDATE
       SET status = 'PRESENT', method = EXCLUDED.method, marked_at = NOW()
       WHERE attendance.status <> 'PRESENT'
     RETURNING *`,
    [sessionId, participantId, method],
  );
  return camelize(rows[0]) || null;
}

export async function findOne(sessionId, participantId) {
  const { rows } = await query(
    'SELECT * FROM attendance WHERE session_id = $1 AND participant_id = $2',
    [sessionId, participantId],
  );
  return camelize(rows[0]) || null;
}

export async function setManual(sessionId, participantId, status) {
  const { rows } = await query(
    `INSERT INTO attendance (session_id, participant_id, status, method)
     VALUES ($1, $2, $3, 'MANUAL')
     ON CONFLICT (session_id, participant_id) DO UPDATE
       SET status = EXCLUDED.status, method = 'MANUAL', marked_at = NOW()
     RETURNING *`,
    [sessionId, participantId, status],
  );
  return camelize(rows[0]);
}

export async function countPresent(sessionId) {
  const { rows } = await query(
    `SELECT COUNT(*) AS count FROM attendance WHERE session_id = $1 AND status = 'PRESENT'`,
    [sessionId],
  );
  return rows[0].count;
}

export async function listForWorkshop(workshopId) {
  const { rows } = await query(
    `SELECT a.session_id, a.participant_id, a.status, a.method, a.marked_at
     FROM attendance a
     JOIN sessions s ON s.id = a.session_id
     WHERE s.workshop_id = $1`,
    [workshopId],
  );
  return camelizeRows(rows);
}

// Session totals for a workshop: all scheduled, and those already finished.
export async function sessionCounts(workshopId) {
  const { rows } = await query(
    `SELECT COUNT(*) AS total_sessions,
            COUNT(*) FILTER (WHERE ${sessionEnded('s', '$2')}) AS completed_sessions
     FROM sessions s WHERE s.workshop_id = $1`,
    [workshopId, env.appTimezone],
  );
  return camelize(rows[0]);
}

// Raw counts per REGISTERED participant; percentages are calculated in the
// attendance service. Only finished sessions count towards attendance.
// Optional participantId narrows to one participant.
export async function countsForWorkshop(workshopId, participantId = null) {
  const { rows } = await query(
    `SELECT r.participant_id, u.name AS participant_name, u.email AS participant_email,
            (SELECT COUNT(*) FROM sessions s WHERE s.workshop_id = r.workshop_id) AS total_sessions,
            (SELECT COUNT(*) FROM sessions s
              WHERE s.workshop_id = r.workshop_id AND ${sessionEnded('s', '$3')}) AS completed_sessions,
            (SELECT COUNT(*) FROM attendance a
               JOIN sessions s ON s.id = a.session_id
              WHERE s.workshop_id = r.workshop_id
                AND a.participant_id = r.participant_id
                AND a.status = 'PRESENT'
                AND ${sessionEnded('s', '$3')}) AS attended_sessions
     FROM registrations r
     JOIN users u ON u.id = r.participant_id
     WHERE r.workshop_id = $1 AND r.status = 'REGISTERED'
       AND ($2::int IS NULL OR r.participant_id = $2)
     ORDER BY u.name`,
    [workshopId, participantId, env.appTimezone],
  );
  return camelizeRows(rows);
}
