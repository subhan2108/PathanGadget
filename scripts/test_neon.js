const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });
const dbUrl = process.env.VITE_DATABASE_URL || process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('Error: VITE_DATABASE_URL is not set in .env.local');
  process.exit(1);
}
const sql = neon(dbUrl);

async function test() {
  try {
    const orderIds = [1, 2, 3];
    console.log('Testing IN clause with array:', orderIds);
    // This often fails if not handled correctly in some drivers
    const items = await sql`SELECT * FROM order_items WHERE order_id IN (${orderIds})`;
    console.log('Items found:', items.length);
  } catch (err) {
    console.error('Test failed:', err.message);
  }
}

test();
