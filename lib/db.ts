import { Pool } from "pg";

// Use direct (non-pooled) URL for migrations; pooled URL for app queries.
// Set DATABASE_URL to the Neon pooled URL and DATABASE_URL_DIRECT to the
// non-pooled URL in .env. At runtime this module uses the pooled URL.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 5000,
});

export default pool;
