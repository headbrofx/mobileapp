require('dotenv').config();

// Free managed Postgres providers (Supabase, Neon, Render) require SSL.
// Local dev / docker-compose postgres does not. Toggle with DB_SSL=true.
const useSSL = process.env.DB_SSL === 'true';

const base = {
  use_env_variable: 'DATABASE_URL',
  dialect: 'postgres',
  logging: false,
  dialectOptions: useSSL
    ? { ssl: { require: true, rejectUnauthorized: false } }
    : {},

  // Tuned for a free-tier host in front of a free-tier Postgres.
  // min: 0 matters — Neon suspends an idle database and drops its
  // connections, so holding idle ones open only guarantees dead sockets.
  pool: {
    max: 5,
    min: 0,
    idle: 10000,
    acquire: 60000,
  },

  // Waking a suspended Neon database takes a moment, and the first
  // attempt can fail outright. Retry the connection-level errors only;
  // a genuine query error must still surface immediately.
  retry: {
    max: 3,
    match: [
      /SequelizeConnectionError/,
      /SequelizeConnectionRefusedError/,
      /SequelizeHostNotReachableError/,
      /SequelizeConnectionTimedOutError/,
      /ETIMEDOUT/,
      /ECONNRESET/,
      /Connection terminated unexpectedly/,
    ],
  },
};

module.exports = {
  development: base,
  test: base,
  production: base,
};
