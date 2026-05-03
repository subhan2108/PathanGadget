import { neon } from '@neondatabase/serverless';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envConfig = dotenv.parse(fs.readFileSync(envPath));
  for (const k in envConfig) {
    process.env[k] = envConfig[k];
  }
}

const databaseUrl = process.env.VITE_DATABASE_URL;

if (!databaseUrl) {
  console.error('❌ VITE_DATABASE_URL not found in .env.local');
  process.exit(1);
}

const sql = neon(databaseUrl);

async function init() {
  console.log('🚀 Initializing Neon Database...');
  
  try {
    // 1. Cart Items Table
    console.log('Creating cart_items table...');
    await sql`
      CREATE TABLE IF NOT EXISTS cart_items (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        name TEXT NOT NULL,
        price NUMERIC NOT NULL,
        image_url TEXT,
        quantity INTEGER DEFAULT 1,
        color TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, product_id)
      )
    `;

    // 2. Reviews Table
    console.log('Creating reviews table...');
    await sql`
      CREATE TABLE IF NOT EXISTS reviews (
        id SERIAL PRIMARY KEY,
        product_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        rating INTEGER CHECK (rating >= 1 AND rating <= 5),
        title TEXT,
        body TEXT,
        verified BOOLEAN DEFAULT FALSE,
        helpful INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // 3. Orders Table
    console.log('Creating orders table...');
    await sql`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        order_number TEXT UNIQUE NOT NULL,
        user_id TEXT,
        total NUMERIC NOT NULL,
        subtotal NUMERIC NOT NULL,
        delivery_fee NUMERIC DEFAULT 0,
        status TEXT DEFAULT 'pending',
        payment_method TEXT,
        payment_id TEXT,
        shipping_address JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // 4. Order Items Table
    console.log('Creating order_items table...');
    await sql`
      CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER REFERENCES orders(id),
        product_id TEXT NOT NULL,
        name TEXT NOT NULL,
        price NUMERIC NOT NULL,
        quantity INTEGER NOT NULL,
        image_url TEXT,
        color TEXT
      )
    `;

    // Indexes
    console.log('Creating indexes...');
    await sql`CREATE INDEX IF NOT EXISTS idx_cart_user ON cart_items(user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id)`;

    console.log('✅ All tables created successfully!');
  } catch (err) {
    console.error('❌ Error creating tables:', err);
    process.exit(1);
  }
}

init();
