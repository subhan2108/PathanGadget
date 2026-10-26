const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });
const dbUrl = process.env.VITE_DATABASE_URL || process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('Error: VITE_DATABASE_URL is not set in .env.local');
  process.exit(1);
}
const sql = neon(dbUrl);

async function check() {
  try {
    const orders = await sql`SELECT * FROM orders`;
    console.log('Orders in DB:', JSON.stringify(orders, null, 2));
    
    const items = await sql`SELECT * FROM order_items`;
    console.log('Items in DB:', JSON.stringify(items, null, 2));
  } catch (err) {
    console.error('Error:', err);
  }
}

check();
