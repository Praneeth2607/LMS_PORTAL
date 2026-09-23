import { query } from '../db/pool.js';
import { camelize, camelizeRows } from '../utils/case.js';

const PUBLIC_COLUMNS = 'id, name, email, role, created_at, updated_at';

export async function findById(id) {
  const { rows } = await query(`SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = $1`, [id]);
  return camelize(rows[0]);
}

// Includes password_hash: only for login.
export async function findByEmailWithPassword(email) {
  const { rows } = await query(`SELECT ${PUBLIC_COLUMNS}, password_hash FROM users WHERE email = $1`, [email]);
  return camelize(rows[0]);
}

export async function create({ name, email, passwordHash, role }) {
  const { rows } = await query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ($1, $2, $3, $4)
     RETURNING ${PUBLIC_COLUMNS}`,
    [name, email, passwordHash, role],
  );
  return camelize(rows[0]);
}

export async function list({ role, search }) {
  const params = [];
  const where = [];
  if (role) {
    params.push(role);
    where.push(`role = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    where.push(`(name ILIKE $${params.length} OR email ILIKE $${params.length})`);
  }
  const { rows } = await query(
    `SELECT ${PUBLIC_COLUMNS} FROM users
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY created_at DESC`,
    params,
  );
  return camelizeRows(rows);
}

export async function updateRole(id, role) {
  const { rows } = await query(
    `UPDATE users SET role = $2 WHERE id = $1 RETURNING ${PUBLIC_COLUMNS}`,
    [id, role],
  );
  return camelize(rows[0]);
}
