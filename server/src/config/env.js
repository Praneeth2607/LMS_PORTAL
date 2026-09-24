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

  // Live sessions inside the portal: "jitsi" (JaaS, 8x8.vc) or "daily".
  // Without the provider's keys the live room is unavailable (the rest of the
  // app works normally).
  videoProvider: (process.env.VIDEO_PROVIDER || (process.env.DAILY_API_KEY && !process.env.JAAS_APP_ID ? 'daily' : 'jitsi')).toLowerCase(),
  jaas: {
    appId: (process.env.JAAS_APP_ID || '').trim(),
    keyId: (process.env.JAAS_KEY_ID || '').trim(),
    // Relative paths are resolved from the server folder.
    privateKeyPath: process.env.JAAS_PRIVATE_KEY_PATH || '',
    domain: process.env.JAAS_DOMAIN || '8x8.vc',
  },
  daily: {
    apiKey: process.env.DAILY_API_KEY || '',
    apiBase: (process.env.DAILY_API_BASE || 'https://api.daily.co/v1').replace(/\/+$/, ''),
  },

  // Proof-of-active-presence for online/hybrid sessions. Demo mode (for
  // judging only) makes heartbeats every 5s count as 15 minutes each.
  presence: (() => {
    const demoMode = process.env.PRESENCE_DEMO_MODE === 'true';
    return {
      demoMode,
      thresholdPercent: toInt(process.env.PRESENCE_THRESHOLD_PERCENT, 75),
      heartbeatSeconds: demoMode ? 5 : toInt(process.env.HEARTBEAT_INTERVAL_SECONDS, 60),
      idleTimeoutSeconds: demoMode ? 15 : toInt(process.env.IDLE_TIMEOUT_SECONDS, 120),
      creditMultiplier: demoMode ? 180 : 1,
    };
  })(),

  // Tamil translation: Google Cloud Translation API (v2). Without a key, texts
  // already in server/i18n/ta.json are still shown; new texts stay in English.
  translate: {
    apiKey: process.env.GOOGLE_TRANSLATE_API_KEY || '',
    apiBase: process.env.GOOGLE_TRANSLATE_API_BASE || 'https://translation.googleapis.com/language/translate/v2',
    // Folder holding <lang>.json dictionaries (default: server/i18n).
    dictionaryDir: process.env.I18N_DIR || '',
  },

  attendanceWindowMinutes: toInt(process.env.ATTENDANCE_WINDOW_MINUTES, 15),
  // Attendance can be started from a session's start time until this many
  // minutes after it ends.
  attendanceCloseAfterEndMinutes: toInt(process.env.ATTENDANCE_CLOSE_AFTER_END_MINUTES, 120),
  certificateThreshold: toInt(process.env.CERTIFICATE_ATTENDANCE_THRESHOLD, 90),
};

env.isProduction = env.nodeEnv === 'production';

try {
  new Intl.DateTimeFormat('en', { timeZone: env.appTimezone });
} catch {
  throw new Error(`APP_TIMEZONE "${env.appTimezone}" is not a valid IANA timezone (e.g. Asia/Kolkata)`);
}

if (!['jitsi', 'daily'].includes(env.videoProvider)) {
  throw new Error(`VIDEO_PROVIDER "${env.videoProvider}" must be "jitsi" or "daily"`);
}

if (env.presence.demoMode) {
  console.warn('PRESENCE_DEMO_MODE is ON: each 5s heartbeat counts as 15 minutes. Never use this for real sessions.');
}

if (env.isProduction && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET must be set in production');
}

export default env;
