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

const databaseUrl = process.env.VITE_DATABASE_URL;
if (!databaseUrl) {
  console.error('❌ VITE_DATABASE_URL not found in .env');
  process.exit(1);
}

const sql = neon(databaseUrl);

const products = [
    {
        id: 1,
        name: 'ProWatch Ultra X1',
        category: 'watches',
        brand: 'ProWatch',
        price: 24999,
        originalPrice: 34999,
        rating: 4.8,
        reviews: 1247,
        image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=400&fit=crop',
        badge: 'Best Seller',
        description: 'Premium smartwatch with AMOLED display, health monitoring, and 7-day battery life.',
        colors: ['Black', 'Silver', 'Blue', 'Rose Gold'],
        connectivity: 'Bluetooth 5.3, GPS, NFC',
        specs: {
            display: '1.9" AMOLED, 410x502px',
            battery: '7 days typical use',
            connectivity: 'Bluetooth 5.3, GPS, NFC',
            water_resistance: '5ATM',
            sensors: 'Heart rate, SpO2, Sleep, Stress',
        },
        inStock: true,
    },
    {
        id: 2,
        name: 'AirBuds Pro Max',
        category: 'airpods',
        brand: 'AirBuds',
        price: 8999,
        originalPrice: 14999,
        rating: 4.7,
        reviews: 3820,
        image: 'https://images.unsplash.com/photo-1606220588913-b3aacb4d2f46?w=400&h=400&fit=crop',
        badge: 'Top Rated',
        description: 'Active noise cancellation with 30-hour total playback and spatial audio support.',
        colors: ['White', 'Black', 'Blue'],
        connectivity: 'Bluetooth 5.3',
        specs: {
            driver: '11mm custom dynamic driver',
            anc: 'Adaptive Active Noise Cancellation',
            battery: '6h (30h with case)',
            connectivity: 'Bluetooth 5.3, AAC, LDAC',
            water_resistance: 'IPX5',
        },
        inStock: true,
    },
    {
        id: 3,
        name: 'SoundPeak Studio HD',
        category: 'headphones',
        brand: 'SoundPeak',
        price: 12999,
        originalPrice: 19999,
        rating: 4.9,
        reviews: 924,
        image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=400&fit=crop',
        badge: 'Premium',
        description: 'Over-ear studio headphones with Hi-Res audio, 40h battery, and premium leather cushions.',
        colors: ['Black', 'Silver'],
        connectivity: 'Bluetooth 5.2, 3.5mm, USB-C',
        specs: {
            driver: '40mm planar magnetic',
            frequency: '10Hz – 40kHz',
            battery: '40h with ANC, 70h without',
            connectivity: 'Bluetooth 5.2, 3.5mm, USB-C',
            weight: '250g',
        },
        inStock: true,
    },
    {
        id: 4,
        name: 'ProWatch Lite S2',
        category: 'watches',
        brand: 'ProWatch',
        price: 9999,
        originalPrice: 14999,
        rating: 4.5,
        reviews: 2103,
        image: 'https://images.unsplash.com/photo-1579586337278-3befd40fd17a?w=400&h=400&fit=crop',
        badge: 'New',
        description: 'Slim fitness watch with heart rate, sleep tracking, and 10-day battery.',
        colors: ['Pink', 'White', 'Green'],
        connectivity: 'Bluetooth 5.0, GPS',
        specs: {
            display: '1.4" TFT, 320x320px',
            battery: '10 days typical use',
            connectivity: 'Bluetooth 5.0, GPS',
            water_resistance: '3ATM',
            sensors: 'Heart rate, SpO2, Step counter',
        },
        inStock: true,
    },
    {
        id: 5,
        name: 'AirBuds Nano',
        category: 'airpods',
        brand: 'AirBuds',
        price: 3499,
        originalPrice: 5999,
        rating: 4.3,
        reviews: 5601,
        image: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=400&h=400&fit=crop',
        badge: 'Value Pick',
        description: 'Compact true wireless earbuds with punchy bass and 24h total battery.',
        colors: ['White', 'Black', 'Green'],
        connectivity: 'Bluetooth 5.2',
        specs: {
            driver: '8mm dynamic driver',
            anc: 'Environmental Noise Cancellation',
            battery: '4h (24h with case)',
            connectivity: 'Bluetooth 5.2',
            water_resistance: 'IPX4',
        },
        inStock: false,
    },
    {
        id: 6,
        name: 'BassMax 360 Pro',
        category: 'headphones',
        brand: 'BassMax',
        price: 6499,
        originalPrice: 9999,
        rating: 4.4,
        reviews: 1889,
        image: 'https://images.unsplash.com/photo-1484704849700-f032a568e944?w=400&h=400&fit=crop',
        badge: 'Sale',
        description: 'Wireless over-ear headphones with deep bass tuning and 35h playback.',
        colors: ['Red', 'Black', 'Blue'],
        connectivity: 'Bluetooth 5.0, 3.5mm',
        specs: {
            driver: '50mm dynamic driver',
            frequency: '20Hz – 20kHz',
            battery: '35h',
            connectivity: 'Bluetooth 5.0, 3.5mm aux',
            weight: '280g',
        },
        inStock: true,
    },
    {
        id: 7,
        name: 'QuantumWatch Black',
        category: 'watches',
        brand: 'Quantum',
        price: 39999,
        originalPrice: 54999,
        rating: 4.9,
        reviews: 432,
        image: 'https://images.unsplash.com/photo-1548171916-c8fd5d7d9e13?w=400&h=400&fit=crop',
        badge: 'Luxury',
        description: 'Flagship titanium case smartwatch with ECG, always-on display, and cellular LTE.',
        colors: ['Black', 'Silver'],
        connectivity: 'LTE, Bluetooth 5.3, WiFi, NFC',
        specs: {
            display: '1.9" LTPO AMOLED, 466x466px',
            battery: '5 days with AOD',
            connectivity: 'LTE, Bluetooth 5.3, WiFi, NFC',
            water_resistance: '10ATM',
            sensors: 'ECG, Heart rate, SpO2, Skin temp',
        },
        inStock: true,
    },
    {
        id: 8,
        name: 'AirBuds Sport X',
        category: 'airpods',
        brand: 'AirBuds',
        price: 5999,
        originalPrice: 8999,
        rating: 4.6,
        reviews: 2347,
        image: 'https://images.unsplash.com/photo-1572645315416-6c5bc4fcabba?w=400&h=400&fit=crop',
        badge: 'Sport',
        description: 'Sport earbuds with secure ear-hook, IPX7 sweat resistance, and 36h case battery.',
        colors: ['Blue', 'Black', 'Green'],
        connectivity: 'Bluetooth 5.3',
        specs: {
            driver: '10mm titanium driver',
            anc: 'Transparency Mode + ANC',
            battery: '7h (36h with case)',
            connectivity: 'Bluetooth 5.3',
            water_resistance: 'IPX7',
        },
        inStock: true,
    },
];

async function seed() {
  console.log('🚀 Seeding products to Neon Database...');
  try {
    // Delete existing products to avoid duplicates
    await sql`DELETE FROM products`;
    console.log('Cleared existing products.');

    for (const p of products) {
      const details = {
        connectivity: p.connectivity,
        specs: p.specs
      };

      await sql`
        INSERT INTO products (id, name, price, original_price, category, brand, description, image_url, badge, in_stock, rating, review_count, colors, details)
        VALUES (
          ${p.id},
          ${p.name},
          ${p.price},
          ${p.originalPrice},
          ${p.category},
          ${p.brand},
          ${p.description},
          ${p.image},
          ${p.badge},
          ${p.inStock},
          ${p.rating},
          ${p.reviews},
          ${JSON.stringify(p.colors)},
          ${JSON.stringify(details)}
        )
      `;
      console.log(`Inserted: ${p.name}`);
    }

    // Reset SERIAL sequence
    await sql`SELECT setval('products_id_seq', (SELECT MAX(id) FROM products))`;
    console.log('✅ Seeding complete!');
  } catch (err) {
    console.error('❌ Error seeding products:', err);
  }
}

seed();
