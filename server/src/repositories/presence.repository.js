import { query } from '../db/pool.js';
import { camelize, camelizeRows } from '../utils/case.js';

export async function findLog(sessionId, participantId) {
  const { rows } = await query(
    'SELECT * FROM session_watch_logs WHERE session_id = $1 AND participant_id = $2',
    [sessionId, participantId],
  );
  return camelize(rows[0]);
}

// Ensures a log row exists and returns it locked, with seconds since the last
// heartbeat measured by the DB clock (null for the first heartbeat).
export async function lockLog(sessionId, participantId, db) {
  await query(
    `INSERT INTO session_watch_logs (session_id, participant_id) VALUES ($1, $2)
     ON CONFLICT (session_id, participant_id) DO NOTHING`,
    [sessionId, participantId],
    db,
  );
  const { rows } = await query(
    `SELECT *, EXTRACT(EPOCH FROM (NOW() - last_heartbeat_at))::float AS seconds_since_last
     FROM session_watch_logs WHERE session_id = $1 AND participant_id = $2
     FOR UPDATE`,
    [sessionId, participantId],
    db,
  );
  return camelize(rows[0]);
}

// Adds credited seconds (capped) and moves the heartbeat anchor to now.
export async function applyHeartbeat(logId, creditSeconds, capSeconds, db) {
  const { rows } = await query(
    `UPDATE session_watch_logs
     SET active_seconds = LEAST(active_seconds + $2, $3), last_heartbeat_at = NOW(), updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [logId, creditSeconds, capSeconds],
    db,
  );
  return camelize(rows[0]);
}

// Organizer view: every registered participant with their verified watch time.
export async function listForSession(sessionId, workshopId) {
  const { rows } = await query(
    `SELECT u.id AS participant_id, u.name AS participant_name, u.email AS participant_email,
            COALESCE(l.active_seconds, 0) AS active_seconds, l.last_heartbeat_at,
            a.status AS attendance_status, a.method AS attendance_method
     FROM registrations r
     JOIN users u ON u.id = r.participant_id
     LEFT JOIN session_watch_logs l ON l.session_id = $1 AND l.participant_id = r.participant_id
     LEFT JOIN attendance a ON a.session_id = $1 AND a.participant_id = r.participant_id
     WHERE r.workshop_id = $2 AND r.status = 'REGISTERED'
     ORDER BY u.name`,
    [sessionId, workshopId],
  );
  return camelizeRows(rows);
}
