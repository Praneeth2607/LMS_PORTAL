import { query } from '../db/pool.js';
import { camelize, camelizeRows } from '../utils/case.js';

const SELECT_ANNOUNCEMENT = `
  SELECT a.id, a.workshop_id, a.title, a.message, a.created_at,
         a.created_by, u.name AS created_by_name
  FROM announcements a
  JOIN users u ON u.id = a.created_by`;

export async function listByWorkshop(workshopId) {
  const { rows } = await query(`${SELECT_ANNOUNCEMENT} WHERE a.workshop_id = $1 ORDER BY a.created_at DESC`, [
    workshopId,
  ]);
  return camelizeRows(rows);
}

export async function create(workshopId, createdBy, { title, message }) {
  const { rows } = await query(
    `INSERT INTO announcements (workshop_id, created_by, title, message)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [workshopId, createdBy, title, message],
  );
  const { rows: created } = await query(`${SELECT_ANNOUNCEMENT} WHERE a.id = $1`, [rows[0].id]);
  return camelize(created[0]);
}
