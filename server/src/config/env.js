// Central place for configuration. Environment variables are loaded by Node
// itself (`node --env-file-if-exists=.env`), so no dotenv dependency is needed.

const toInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: toInt(process.env.PORT, 5000),

  // Used for CORS and for the URLs encoded in attendance / certificate QR codes.
  frontendUrl: (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, ''),

  db: {
    // A full connection string (e.g. Supabase) takes precedence over the PG* values.
    connectionString: process.env.DATABASE_URL || null,
    host: process.env.PGHOST || 'localhost',
    port: toInt(process.env.PGPORT, 5432),
    database: process.env.PGDATABASE || 'aurex26',
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || '',
    ssl: process.env.PGSSL === 'true',
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'dev-only-insecure-secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
  },

  // Timezone that session dates/times are written in. Sessions store local
  // wall-clock times; this decides when "2:00 PM" actually happens (the DB
  // itself may run in UTC, as Supabase does).
  appTimezone: process.env.APP_TIMEZONE || 'Asia/Kolkata',

  bcryptSaltRounds: toInt(process.env.BCRYPT_SALT_ROUNDS, 10),
  // Self sign-ups with an email at this domain become ORGANIZERs.
  organizerEmailDomain: (process.env.ORGANIZER_EMAIL_DOMAIN || 'cict.in').trim().toLowerCase().replace(/^@/, ''),
  attendanceWindowMinutes: toInt(process.env.ATTENDANCE_WINDOW_MINUTES, 15),
  certificateThreshold: toInt(process.env.CERTIFICATE_ATTENDANCE_THRESHOLD, 90),
};

env.isProduction = env.nodeEnv === 'production';

try {
  new Intl.DateTimeFormat('en', { timeZone: env.appTimezone });
} catch {
  throw new Error(`APP_TIMEZONE "${env.appTimezone}" is not a valid IANA timezone (e.g. Asia/Kolkata)`);
}

if (env.isProduction && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET must be set in production');
}

export default env;
