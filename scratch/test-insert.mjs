import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load .env
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const envConfig = dotenv.parse(fs.readFileSync(envPath));
  for (const k in envConfig) {
    process.env[k] = envConfig[k];
  }
}

const sql = neon(process.env.VITE_DATABASE_URL);

async function run() {
  try {
    const p = {
      name: 'Test Smart Watch Z',
      price: 15999,
      original_price: 19999,
      category: 'watches',
      brand: 'TestBrand',
      description: 'A beautiful test product.',
      image_url: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=400&fit=crop',
      badge: 'New',
      in_stock: true,
      rating: 4.5,
      review_count: 10,
      colors: ['Black', 'Silver'],
      details: { specs: { screen: 'AMOLED' } }
    };

    console.log('Inserting test product...');
    const prod = await sql`
      INSERT INTO products (
        name, price, original_price, category, brand, 
        description, image_url, badge, in_stock, 
        rating, review_count, colors, details
      ) VALUES (
        ${p.name}, ${p.price}, ${p.original_price || 0}, ${p.category}, ${p.brand || ''},
        ${p.description || ''}, ${p.image_url}, ${p.badge || ''}, ${p.in_stock},
        ${p.rating || 0}, ${p.review_count || 0}, ${JSON.stringify(p.colors)}, ${JSON.stringify(p.details)}
      ) RETURNING *
    `;

    console.log('Successfully inserted!', prod);

    console.log('Deleting test product...');
    await sql`DELETE FROM products WHERE id = ${prod[0].id}`;
    console.log('Successfully deleted test product!');
  } catch (err) {
    console.error('Database Operation Failed:', err);
  }
}

run();
