const { neon } = require('@neondatabase/serverless');
const sql = neon('postgresql://neondb_owner:npg_5oCSnwNp8TDR@ep-wild-water-aoshjb2o-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require');

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
