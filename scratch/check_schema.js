const { neon } = require('@neondatabase/serverless');
const sql = neon('postgresql://neondb_owner:npg_5oCSnwNp8TDR@ep-wild-water-aoshjb2o-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require');

async function main() {
  const cols = await sql.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'products'");
  console.log(cols);
}
main();
