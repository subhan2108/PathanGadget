const { neon } = require('@neondatabase/serverless');
const sql = neon('postgresql://neondb_owner:npg_5oCSnwNp8TDR@ep-wild-water-aoshjb2o-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require');

async function fixProduct11() {
  const imageUrl = 'https://plain-apac-prod-public.komododecks.com/202610/17/SssZD7VcuGiu7WXq1bK6/image.webp';
  const res = await sql`
    UPDATE products 
    SET image_url = ${imageUrl} 
    WHERE id = 11
    RETURNING id, name, image_url
  `;
  console.log('Updated product 11:', res);
}

fixProduct11();
