import { neon, neonConfig } from '@neondatabase/serverless';

/**
 * Neon Database Connection
 */
const dbUrl = import.meta.env.VITE_DATABASE_URL;

if (!dbUrl) {
  console.warn(
    '[Neon DB] Missing DATABASE_URL / VITE_DATABASE_URL! Verify your environment variables in .env.local or Vercel Settings.'
  );
}

// Route queries through local dev proxy / api proxy to avoid ERR_NAME_NOT_RESOLVED
// caused by local ISP / Wi-Fi router DNS refusing direct connections to Neon subdomains.
if (typeof window !== 'undefined') {
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    neonConfig.fetchEndpoint = () => '/neon-sql';
  } else {
    neonConfig.fetchEndpoint = () => '/api/neon-sql';
  }
}

// Fallback dummy function if dbUrl is missing during static build or misconfiguration
const sql = dbUrl ? neon(dbUrl) : () => Promise.resolve([]);

export default sql;
