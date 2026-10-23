const { neon } = require('@neondatabase/serverless');
const sql = neon('postgresql://neondb_owner:npg_5oCSnwNp8TDR@ep-wild-water-aoshjb2o-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require');

async function test() {
  const p = await sql`SELECT * FROM products WHERE id = 11`;
  console.log(JSON.stringify(p, null, 2));
}

test().catch(console.error);
