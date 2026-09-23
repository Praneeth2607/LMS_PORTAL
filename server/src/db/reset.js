// Recreates the database from database/schema.sql and loads database/seed.sql.
// Creates the database first if it does not exist. DESTROYS ALL DATA.
//   npm run db:reset              schema + seed
//   npm run db:reset -- --no-seed schema only
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import env from '../config/env.js';

const databaseDir = fileURLToPath(new URL('../../../database/', import.meta.url));
const withSeed = !process.argv.includes('--no-seed');

// Connection failures arrive as an AggregateError with an empty message.
const describe = (err) =>
  err.message || err.errors?.map((e) => e.message).join('; ') || err.code || String(err);

const connection = (database) => ({
  ...(env.db.connectionString
    ? { connectionString: env.db.connectionString }
    : { host: env.db.host, port: env.db.port, user: env.db.user, password: env.db.password, database }),
  ssl: env.db.ssl ? { rejectUnauthorized: false } : false,
});

async function ensureDatabase() {
  const admin = new pg.Client(connection('postgres'));
  await admin.connect();
  try {
    const { rowCount } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [env.db.database]);
    if (rowCount === 0) {
      await admin.query(`CREATE DATABASE "${env.db.database.replace(/"/g, '""')}"`);
      console.log(`Created database "${env.db.database}"`);
    }
  } finally {
    await admin.end();
  }
}

async function run() {
  try {
    // A DATABASE_URL points at an existing hosted database; nothing to create.
    if (!env.db.connectionString) await ensureDatabase();
  } catch (err) {
    // Hosted databases often forbid connecting to "postgres"; assume it exists.
    console.warn(`Could not check/create database (${describe(err)}); continuing.`);
  }

  const client = new pg.Client(connection(env.db.database));
  await client.connect();
  try {
    await client.query(await readFile(`${databaseDir}schema.sql`, 'utf8'));
    console.log('Applied schema.sql');
    if (withSeed) {
      await client.query(await readFile(`${databaseDir}seed.sql`, 'utf8'));
      console.log('Applied seed.sql');
    }
  } finally {
    await client.end();
  }
}

run().catch((err) => {
  console.error(`Database reset failed: ${describe(err)}`);
  process.exit(1);
});
