import { query } from '../db/pool.js';
import { camelize, camelizeRows } from '../utils/case.js';

export async function findOne(workshopId, participantId, db) {
  const { rows } = await query(
    'SELECT * FROM registrations WHERE workshop_id = $1 AND participant_id = $2',
    [workshopId, participantId],
    db,
  );
  return camelize(rows[0]);
}

export async function isRegistered(workshopId, participantId) {
  const registration = await findOne(workshopId, participantId);
  return registration?.status === 'REGISTERED';
}

export async function countActive(workshopId, db) {
  const { rows } = await query(
    `SELECT COUNT(*) AS count FROM registrations WHERE workshop_id = $1 AND status = 'REGISTERED'`,
    [workshopId],
    db,
  );
  return rows[0].count;
}

export async function create(workshopId, participantId, formData, db) {
  const { rows } = await query(
    `INSERT INTO registrations (workshop_id, participant_id, form_data)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [workshopId, participantId, JSON.stringify(formData)],
    db,
  );
  return camelize(rows[0]);
}

// Re-registering after cancelling reuses the same row (UNIQUE workshop/participant).
export async function reactivate(id, formData, db) {
  const { rows } = await query(
    `UPDATE registrations
     SET status = 'REGISTERED', form_data = $2, registered_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [id, JSON.stringify(formData)],
    db,
  );
  return camelize(rows[0]);
}

export async function cancel(id) {
  const { rows } = await query(
    `UPDATE registrations SET status = 'CANCELLED' WHERE id = $1 RETURNING *`,
    [id],
  );
  return camelize(rows[0]);
}

export async function listByWorkshop(workshopId, status) {
  const params = [workshopId];
  let filter = '';
  if (status) {
    params.push(status);
    filter = 'AND r.status = $2';
  }
  const { rows } = await query(
    `SELECT r.id, r.participant_id, u.name AS participant_name, u.email AS participant_email,
            r.form_data, r.status, r.registered_at
     FROM registrations r
     JOIN users u ON u.id = r.participant_id
     WHERE r.workshop_id = $1 ${filter}
     ORDER BY r.registered_at`,
    params,
  );
  return camelizeRows(rows);
}

// A participant's registrations with raw attendance counts and certificate info.
export async function listForParticipant(participantId) {
  const { rows } = await query(
    `SELECT r.id AS registration_id, r.status AS registration_status, r.registered_at, r.form_data,
            w.id AS workshop_id, w.title, w.description, w.start_date, w.end_date, w.mode,
            w.venue, w.meeting_link, w.status AS workshop_status, u.name AS organizer_name,
            (SELECT COUNT(*) FROM sessions s WHERE s.workshop_id = w.id) AS total_sessions,
            (SELECT COUNT(*) FROM attendance a
               JOIN sessions s ON s.id = a.session_id
              WHERE s.workshop_id = w.id AND a.participant_id = r.participant_id
                AND a.status = 'PRESENT') AS attended_sessions,
            c.certificate_id, c.issued_at AS certificate_issued_at
     FROM registrations r
     JOIN workshops w ON w.id = r.workshop_id
     JOIN users u ON u.id = w.created_by
     LEFT JOIN certificates c ON c.workshop_id = w.id AND c.participant_id = r.participant_id
     WHERE r.participant_id = $1
     ORDER BY w.start_date DESC`,
    [participantId],
  );
  return camelizeRows(rows);
}
