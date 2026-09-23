import pg from 'pg';
import env from '../config/env.js';

// Return DATE columns as 'YYYY-MM-DD' strings instead of JS Dates at local
// midnight (which shift by timezone when serialized), NUMERIC as numbers and
// COUNT(*) (int8) as numbers.
pg.types.setTypeParser(1082, (value) => value);
pg.types.setTypeParser(1700, (value) => (value === null ? null : Number.parseFloat(value)));
pg.types.setTypeParser(20, (value) => (value === null ? null : Number.parseInt(value, 10)));

export const pool = new pg.Pool({
  ...(env.db.connectionString
    ? { connectionString: env.db.connectionString }
    : {
        host: env.db.host,
        port: env.db.port,
        database: env.db.database,
        user: env.db.user,
        password: env.db.password,
      }),
  ssl: env.db.ssl ? { rejectUnauthorized: false } : false,
  max: 10,
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err.message);
});

// Repositories take an optional `db` argument so the same function works with
// the pool or with a transaction client.
export const query = (text, params, db = pool) => db.query(text, params);

export async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
