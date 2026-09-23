import env from '../config/env.js';
import { query } from '../db/pool.js';
import { camelize, camelizeRows } from '../utils/case.js';
import { buildSetClause } from '../utils/sql.js';

const COLUMNS = {
  title: 'title',
  sessionDate: 'session_date',
  startTime: 'start_time',
  endTime: 'end_time',
  meetingLink: 'meeting_link',
};

// Session date + time are local wall-clock values in env.appTimezone; `tz` is the
// placeholder (e.g. '$2') holding that timezone. All time checks use the DB clock.
//   attendance_open: QR/code check-in started and not yet expired
//   status: SCHEDULED → READY (start time reached) → ONGOING (organizer pressed Start)
//           → COMPLETED (end time passed)
const sessionColumns = (tz) => {
  const startsAt = `((s.session_date + s.start_time) AT TIME ZONE ${tz})`;
  const endsAt = `((s.session_date + s.end_time) AT TIME ZONE ${tz})`;
  return `
  s.id, s.workshop_id, s.title, s.session_date,
  to_char(s.start_time, 'HH24:MI') AS start_time,
  to_char(s.end_time, 'HH24:MI') AS end_time,
  ${startsAt} AS starts_at, ${endsAt} AS ends_at, s.started_at,
  CASE
    WHEN NOW() >= ${endsAt} THEN 'COMPLETED'
    WHEN s.started_at IS NOT NULL THEN 'ONGOING'
    WHEN NOW() >= ${startsAt} THEN 'READY'
    ELSE 'SCHEDULED'
  END AS status,
  s.meeting_link, s.video_room_name, s.video_room_url,
  s.attendance_token, s.attendance_code, s.attendance_expires_at,
  (s.attendance_active AND s.attendance_expires_at > NOW()) AS attendance_open,
  s.created_at, s.updated_at`;
};

export async function findById(id) {
  const { rows } = await query(
    `SELECT ${sessionColumns('$2')}, w.title AS workshop_title
     FROM sessions s
     JOIN workshops w ON w.id = s.workshop_id
     WHERE s.id = $1`,
    [id, env.appTimezone],
  );
  return camelize(rows[0]);
}

// participantId (optional) adds my_attendance_status for that participant.
export async function listByWorkshop(workshopId, participantId = null) {
  const { rows } = await query(
    `SELECT ${sessionColumns('$3')}, a.status AS my_attendance_status
     FROM sessions s
     LEFT JOIN attendance a ON a.session_id = s.id AND a.participant_id = $2
     WHERE s.workshop_id = $1
     ORDER BY s.session_date, s.start_time, s.id`,
    [workshopId, participantId, env.appTimezone],
  );
  return camelizeRows(rows);
}

export async function create(workshopId, data) {
  const { rows } = await query(
    `INSERT INTO sessions (workshop_id, title, session_date, start_time, end_time, meeting_link)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [workshopId, data.title, data.sessionDate, data.startTime, data.endTime, data.meetingLink ?? null],
  );
  return rows[0].id;
}

export async function update(id, data) {
  const { sets, values } = buildSetClause(data, COLUMNS, 2);
  if (!sets) return;
  // Rescheduling a session clears its "started" state.
  const rescheduled = ['sessionDate', 'startTime', 'endTime'].some((f) => data[f] !== undefined);
  await query(
    `UPDATE sessions SET ${sets}${rescheduled ? ', started_at = NULL' : ''} WHERE id = $1`,
    [id, ...values],
  );
}

// Saves the Daily room for a session unless one was saved concurrently;
// returns the saved room, or null if another request won.
export async function setVideoRoom(id, { name, url }) {
  const { rows } = await query(
    `UPDATE sessions SET video_room_name = $2, video_room_url = $3
     WHERE id = $1 AND video_room_name IS NULL
     RETURNING video_room_name AS name, video_room_url AS url`,
    [id, name, url],
  );
  if (rows[0]) return rows[0];
  const { rows: existing } = await query('SELECT video_room_name AS name, video_room_url AS url FROM sessions WHERE id = $1', [id]);
  return existing[0] || null;
}

// Marks the session as started (idempotent: keeps the first start time).
export async function markStarted(id) {
  await query('UPDATE sessions SET started_at = COALESCE(started_at, NOW()) WHERE id = $1', [id]);
}

export async function remove(id) {
  await query('DELETE FROM sessions WHERE id = $1', [id]);
}

export async function startAttendance(id, { token, code, minutes }) {
  const { rows } = await query(
    `UPDATE sessions
     SET attendance_token = $2, attendance_code = $3, attendance_active = TRUE,
         attendance_expires_at = NOW() + make_interval(mins => $4)
     WHERE id = $1
     RETURNING attendance_expires_at`,
    [id, token, code, minutes],
  );
  return rows[0].attendance_expires_at;
}

export async function stopAttendance(id) {
  await query(
    `UPDATE sessions
     SET attendance_active = FALSE, attendance_token = NULL, attendance_code = NULL,
         attendance_expires_at = NULL
     WHERE id = $1`,
    [id],
  );
}
