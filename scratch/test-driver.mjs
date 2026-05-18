import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load .env
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const envConfig = dotenv.parse(fs.readFileSync(envPath));
  for (const k in envConfig) {
    process.env[k] = envConfig[k];
  }
}

const sql = neon(process.env.VITE_DATABASE_URL);

async function run() {
  try {
    const res = await sql.query('SELECT * FROM products WHERE category = $1 LIMIT 1', ['watches']);
    console.log('Success with sql.query!', res);
  } catch (err) {
    console.error('Failed with sql.query:', err);
  }
}

run();
