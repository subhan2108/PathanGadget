const { neon } = require('@neondatabase/serverless');
const sql = neon('postgresql://neondb_owner:npg_5oCSnwNp8TDR@ep-wild-water-aoshjb2o-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require');

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
