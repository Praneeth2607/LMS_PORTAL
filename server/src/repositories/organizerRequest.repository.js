import { query } from '../db/pool.js';
import { camelize, camelizeRows } from '../utils/case.js';

// Everything except password_hash.
const PUBLIC_COLUMNS = `r.id, r.name, r.email, r.designation, r.reason, r.status,
  r.reviewed_by, r.reviewed_at, r.created_at`;

export async function create({ name, email, passwordHash, designation, reason }) {
  const { rows } = await query(
    `INSERT INTO organizer_requests (name, email, password_hash, designation, reason)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, name, email, designation, reason, status, created_at`,
    [name, email, passwordHash, designation, reason],
  );
  return camelize(rows[0]);
}

export async function findPendingByEmail(email) {
  const { rows } = await query(
    `SELECT ${PUBLIC_COLUMNS} FROM organizer_requests r WHERE r.email = $1 AND r.status = 'PENDING'`,
    [email],
  );
  return camelize(rows[0]);
}

// Latest pending/rejected request for an email, with its password hash (login only).
export async function findLatestUnapprovedWithPassword(email) {
  const { rows } = await query(
    `SELECT r.id, r.status, r.password_hash FROM organizer_requests r
     WHERE r.email = $1 AND r.status IN ('PENDING', 'REJECTED')
     ORDER BY r.created_at DESC LIMIT 1`,
    [email],
  );
  return camelize(rows[0]);
}

export async function list(status) {
  const params = [];
  let where = '';
  if (status) {
    params.push(status);
    where = 'WHERE r.status = $1';
  }
  const { rows } = await query(
    `SELECT ${PUBLIC_COLUMNS}, u.name AS reviewed_by_name
     FROM organizer_requests r
     LEFT JOIN users u ON u.id = r.reviewed_by
     ${where}
     ORDER BY (r.status = 'PENDING') DESC, r.created_at DESC`,
    params,
  );
  return camelizeRows(rows);
}

export async function countPending() {
  const { rows } = await query(`SELECT COUNT(*) AS count FROM organizer_requests WHERE status = 'PENDING'`);
  return rows[0].count;
}

// Row-locks the request inside a transaction; includes the password hash.
export async function lockById(id, db) {
  const { rows } = await query('SELECT * FROM organizer_requests WHERE id = $1 FOR UPDATE', [id], db);
  return camelize(rows[0]);
}

// Approval moves the hash to the new user row, so it is cleared here.
export async function markReviewed(id, status, reviewerId, db) {
  const { rows } = await query(
    `UPDATE organizer_requests r
     SET status = $2, reviewed_by = $3, reviewed_at = NOW(),
         password_hash = CASE WHEN $4 THEN '' ELSE password_hash END
     WHERE r.id = $1
     RETURNING ${PUBLIC_COLUMNS}`,
    [id, status, reviewerId, status === 'APPROVED'],
    db,
  );
  return camelize(rows[0]);
}
