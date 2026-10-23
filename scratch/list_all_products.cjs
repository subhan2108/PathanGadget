const { neon } = require('@neondatabase/serverless');
const sql = neon('postgresql://neondb_owner:npg_5oCSnwNp8TDR@ep-wild-water-aoshjb2o-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require');

async function test() {
  const products = await sql`SELECT id, name, category, image_url FROM products ORDER BY id ASC`;
  console.log(JSON.stringify(products, null, 2));
}

test().catch(console.error);
