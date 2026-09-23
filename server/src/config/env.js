// Central place for configuration. Environment variables are loaded by Node
// itself (`node --env-file-if-exists=.env`), so no dotenv dependency is needed.

const toInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: toInt(process.env.PORT, 5000),
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  publicVerifyUrl: process.env.PUBLIC_VERIFY_URL || 'http://localhost:5173/verify',

  db: {
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

  bcryptSaltRounds: toInt(process.env.BCRYPT_SALT_ROUNDS, 10),
  certificateThreshold: toInt(process.env.CERTIFICATE_ATTENDANCE_THRESHOLD, 90),
};

env.isProduction = env.nodeEnv === 'production';

if (env.isProduction && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET must be set in production');
}

export default env;
