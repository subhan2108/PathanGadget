import { neon } from '@neondatabase/serverless';
import { neonConfig } from '@neondatabase/serverless';

/**
 * Neon Database Connection
 * NOTE: Using this directly on the frontend exposes your DATABASE_URL in the client bundle.
 * For production, consider moving database queries to Vercel Serverless Functions (/api).
 */
const dbUrl = import.meta.env.VITE_DATABASE_URL;

if (!dbUrl) {
  console.warn(
    '[Neon DB] Missing DATABASE_URL / VITE_DATABASE_URL! Verify your environment variables in .env.local or Vercel Settings.'
  );
}

// Fallback dummy function if dbUrl is missing during static build or misconfiguration
const sql = dbUrl ? neon(dbUrl) : () => Promise.resolve([]);

export default sql;

