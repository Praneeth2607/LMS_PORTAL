import { query } from '../db/pool.js';
import { camelize, camelizeRows } from '../utils/case.js';

const PUBLIC_COLUMNS = 'id, name, email, role, suspended_at, created_at, updated_at';

export async function findById(id, db) {
  const { rows } = await query(`SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = $1`, [id], db);
  return camelize(rows[0]);
}

// Includes password_hash: only for login.
export async function findByEmailWithPassword(email) {
  const { rows } = await query(`SELECT ${PUBLIC_COLUMNS}, password_hash FROM users WHERE email = $1`, [email]);
  return camelize(rows[0]);
}

export async function create({ name, email, passwordHash, role }, db) {
  const { rows } = await query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ($1, $2, $3, $4)
     RETURNING ${PUBLIC_COLUMNS}`,
    [name, email, passwordHash, role],
    db,
  );
  return camelize(rows[0]);
}

// Admin listing. workshops_attended = workshops where the user was marked
// PRESENT in at least one session; certificates_count = certificates issued.
export async function list({ role, search }) {
  const params = [];
  const where = [];
  if (role) {
    params.push(role);
    where.push(`u.role = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    where.push(`(u.name ILIKE $${params.length} OR u.email ILIKE $${params.length})`);
  }
  const { rows } = await query(
    `SELECT u.id, u.name, u.email, u.role, u.suspended_at, u.created_at, u.updated_at,
            (SELECT COUNT(DISTINCT s.workshop_id) FROM attendance a
               JOIN sessions s ON s.id = a.session_id
              WHERE a.participant_id = u.id AND a.status = 'PRESENT') AS workshops_attended,
            (SELECT COUNT(*) FROM certificates c WHERE c.participant_id = u.id) AS certificates_count
     FROM users u
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY u.created_at DESC`,
    params,
  );
  return camelizeRows(rows);
}

export async function setSuspended(id, suspended) {
  const { rows } = await query(
    `UPDATE users SET suspended_at = ${suspended ? 'COALESCE(suspended_at, NOW())' : 'NULL'}
     WHERE id = $1
     RETURNING ${PUBLIC_COLUMNS}`,
    [id],
  );
  return camelize(rows[0]);
}

export async function countOrganizedWorkshops(id) {
  const { rows } = await query('SELECT COUNT(*) AS count FROM workshops WHERE created_by = $1', [id]);
  return rows[0].count;
}

// Deletes the account; registrations, attendance and certificates cascade.
export async function remove(id, db) {
  await query('DELETE FROM users WHERE id = $1', [id], db);
}

// ---- blocked_emails ----

export async function isEmailBlocked(email) {
  const { rowCount } = await query('SELECT 1 FROM blocked_emails WHERE email = $1', [email]);
  return rowCount > 0;
}

export async function blockEmail(email, blockedBy, db) {
  await query(
    `INSERT INTO blocked_emails (email, blocked_by) VALUES ($1, $2)
     ON CONFLICT (email) DO NOTHING`,
    [email, blockedBy],
    db,
  );
}

export async function unblockEmail(email, db) {
  await query('DELETE FROM blocked_emails WHERE email = $1', [email], db);
}
