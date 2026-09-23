// Applies database/migrations/*.sql in filename order to the database in .env.
// Every migration is idempotent (ADD COLUMN IF NOT EXISTS …), so this is safe
// to re-run and never deletes data. Use it for databases that already hold
// real data (e.g. Supabase) instead of db:reset.
//   npm run db:migrate
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { pool } from './pool.js';

const dir = fileURLToPath(new URL('../../../database/migrations/', import.meta.url));

try {
  const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    await pool.query(await readFile(`${dir}${file}`, 'utf8'));
    console.log(`Applied ${file}`);
  }
} catch (err) {
  console.error(`Migration failed: ${err.message || err.code}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
