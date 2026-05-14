const { neon } = require('@neondatabase/serverless');
const sql = neon('postgresql://neondb_owner:npg_5oCSnwNp8TDR@ep-wild-water-aoshjb2o-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require');

async function setup() {
  try {
    console.log('Creating tables...');
    
    await sql`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        order_number TEXT UNIQUE NOT NULL,
        user_id TEXT,
        total NUMERIC NOT NULL,
        subtotal NUMERIC NOT NULL,
        delivery_fee NUMERIC NOT NULL,
        payment_method TEXT NOT NULL,
        payment_id TEXT,
        shipping_address JSONB,
        status TEXT DEFAULT 'processing',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
        product_id TEXT,
        name TEXT NOT NULL,
        price NUMERIC NOT NULL,
        quantity INTEGER NOT NULL,
        image_url TEXT,
        color TEXT
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        price NUMERIC NOT NULL,
        original_price NUMERIC,
        category TEXT,
        brand TEXT,
        description TEXT,
        image_url TEXT,
        badge TEXT,
        in_stock BOOLEAN DEFAULT TRUE,
        rating NUMERIC DEFAULT 0,
        review_count INTEGER DEFAULT 0,
        colors JSONB,
        details JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `;

    console.log('Tables created successfully!');
  } catch (err) {
    console.error('Error creating tables:', err);
  }
}

setup();
