import { neon } from '@neondatabase/serverless';

/**
 * Neon Database Connection
 * NOTE: Using this directly on the frontend exposes your DATABASE_URL.
 * For production, you should move this logic to a backend API (like Vercel Functions).
 */
const sql = neon(import.meta.env.VITE_DATABASE_URL);

export default sql;
