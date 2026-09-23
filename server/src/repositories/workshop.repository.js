import { query } from '../db/pool.js';
import { camelize, camelizeRows } from '../utils/case.js';
import { buildSetClause } from '../utils/sql.js';

const COLUMNS = {
  title: 'title',
  description: 'description',
  startDate: 'start_date',
  endDate: 'end_date',
  mode: 'mode',
  venue: 'venue',
  meetingLink: 'meeting_link',
  capacity: 'capacity',
};

// $1 is always the viewer id (or NULL) so is_registered can be computed.
const SELECT_WORKSHOP = `
  SELECT w.*,
         u.name AS organizer_name,
         (SELECT COUNT(*) FROM registrations r
           WHERE r.workshop_id = w.id AND r.status = 'REGISTERED') AS registered_count,
         (SELECT COUNT(*) FROM sessions s WHERE s.workshop_id = w.id) AS session_count,
         EXISTS (SELECT 1 FROM registrations r
                  WHERE r.workshop_id = w.id AND r.participant_id = $1
                    AND r.status = 'REGISTERED') AS is_registered
  FROM workshops w
  JOIN users u ON u.id = w.created_by`;

export async function list({ viewer, search, status, mode, mine }) {
  const params = [viewer?.id ?? null];
  const where = [];

  // Visibility: admins see everything, organizers also see their own drafts,
  // everyone else sees published and closed workshops.
  if (!viewer || viewer.role === 'PARTICIPANT') {
    where.push(`w.status <> 'DRAFT'`);
  } else if (viewer.role === 'ORGANIZER') {
    where.push(`(w.status <> 'DRAFT' OR w.created_by = $1)`);
  }
  if (mine && viewer) where.push('w.created_by = $1');
  if (status) {
    params.push(status);
    where.push(`w.status = $${params.length}`);
  }
  if (mode) {
    params.push(mode);
    where.push(`w.mode = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    where.push(`(w.title ILIKE $${params.length} OR w.description ILIKE $${params.length})`);
  }

  const { rows } = await query(
    `${SELECT_WORKSHOP}
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY (w.status = 'CLOSED'), w.start_date, w.id`,
    params,
  );
  return camelizeRows(rows);
}

export async function findById(id, viewerId = null) {
  const { rows } = await query(`${SELECT_WORKSHOP} WHERE w.id = $2`, [viewerId, id]);
  return camelize(rows[0]);
}

// Row-locks the workshop inside a transaction (serialises registrations for capacity).
export async function lockById(id, db) {
  const { rows } = await query('SELECT * FROM workshops WHERE id = $1 FOR UPDATE', [id], db);
  return camelize(rows[0]);
}

export async function create(data, createdBy, db) {
  const { rows } = await query(
    `INSERT INTO workshops (title, description, start_date, end_date, mode, venue, meeting_link, capacity, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id`,
    [
      data.title,
      data.description ?? null,
      data.startDate,
      data.endDate,
      data.mode,
      data.venue ?? null,
      data.meetingLink ?? null,
      data.capacity ?? null,
      createdBy,
    ],
    db,
  );
  return rows[0].id;
}

export async function update(id, data, db) {
  const { sets, values } = buildSetClause(data, COLUMNS, 2);
  if (!sets) return;
  await query(`UPDATE workshops SET ${sets} WHERE id = $1`, [id, ...values], db);
}

export async function setStatus(id, status) {
  await query('UPDATE workshops SET status = $2 WHERE id = $1', [id, status]);
}

export async function remove(id) {
  await query('DELETE FROM workshops WHERE id = $1', [id]);
}

export async function countCertificates(id) {
  const { rows } = await query('SELECT COUNT(*) AS count FROM certificates WHERE workshop_id = $1', [id]);
  return rows[0].count;
}

// ---- registration_fields ----

export async function findFields(workshopId, db) {
  const { rows } = await query(
    `SELECT id, field_name, field_type, required, field_order, options
     FROM registration_fields
     WHERE workshop_id = $1
     ORDER BY field_order, id`,
    [workshopId],
    db,
  );
  return camelizeRows(rows);
}

export async function replaceFields(workshopId, fields, db) {
  await query('DELETE FROM registration_fields WHERE workshop_id = $1', [workshopId], db);
  for (const field of fields) {
    await query(
      `INSERT INTO registration_fields (workshop_id, field_name, field_type, required, field_order, options)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        workshopId,
        field.fieldName,
        field.fieldType,
        field.required,
        field.fieldOrder,
        field.options ? JSON.stringify(field.options) : null,
      ],
      db,
    );
  }
}
