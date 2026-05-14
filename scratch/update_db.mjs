import { neon } from '@neondatabase/serverless';
const sql = neon('postgresql://neondb_owner:npg_5oCSnwNp8TDR@ep-wild-water-aoshjb2o-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require');

async function update() {
    try {
        await sql`ALTER TABLE cart_items ADD COLUMN IF NOT EXISTS variant_id TEXT`;
        console.log('✅ variant_id column added to cart_items');
    } catch (err) {
        console.error('❌ Error updating table:', err);
    }
}
update();
