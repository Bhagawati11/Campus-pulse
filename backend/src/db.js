const { Pool } = require('pg');

// In docker-compose these come from environment variables set in the service.
// In AWS, DB_HOST will point at your RDS endpoint.
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'campus_pulse',

  ssl:
    process.env.DB_HOST &&
    !["localhost", "postgres"].includes(process.env.DB_HOST)
      ? { rejectUnauthorized: false }
      : false,

  max: 10,
  idleTimeoutMillis: 30000,
});

pool.on('error', (err) => {
  console.error('Unexpected Postgres pool error', err);
});

module.exports = pool;
