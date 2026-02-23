import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

// We need mockData and productDetails (since this is run by node, we might face ES module syntax issues. Let's use basic node `fetch` or just redefine the basic products here for seeding since they are static)

// Since we cannot dynamically import jsx/export without babel easily, we'll embed the mock products here to directly push to the DB.

const products = [
    {
        id: 1,
        name: 'ProWatch Series 8',
        category: 'watches',
        brand: 'TechBrand',
        price: 24999,
        original_price: 29999,
        rating: 4.8,
        review_count: 1245,
        image_url: 'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=600&h=600&fit=crop',
        badge: 'Best Seller',
        description: 'Advanced health tracking, fall detection, and seamless ecosystem integration.',
        colors: ['Midnight', 'Starlight', 'Silver'],
        in_stock: true,
        details: {
            long_description: 'The ProWatch Series 8 is the ultimate companion for a healthy life. Featuring advanced sensors for temperature tracking, sleep insights, and ECG. The Edge-to-Edge display pushes the boundaries of screen real estate.',
            highlights: ['Free delivery in 2 days', '1-Year Brand Warranty', '7-Day Easy Returns', '100% Genuine Product'],
            specifications: { display: '1.9" OLED Always-On', battery: 'Up to 18 hours', water_resistance: 'WR50 (50 meters)', connectivity: 'Cellular + GPS', materials: 'Aluminum, Stainless Steel' }
        }
    },
    {
        id: 2,
        name: 'AirBuds Pro Max',
        category: 'airpods',
        brand: 'AirBuds',
        price: 18999,
        original_price: 24999,
        rating: 4.9,
        review_count: 3450,
        image_url: 'https://images.unsplash.com/photo-1588423771073-b8903fbb85b5?w=400&h=400&fit=crop',
        badge: 'Top Rated',
        description: 'Active Noise Cancellation, Spatial Audio, and comfortable silicon tips.',
        colors: ['White', 'Black'],
        in_stock: true,
        details: {
            long_description: 'AirBuds Pro Max redefines the true wireless experience with Adaptive Active Noise Cancellation that automatically adjusts to your environment.',
            highlights: ['Free delivery in 2 days', '1-Year Brand Warranty', '7-Day Easy Returns', '100% Genuine Product'],
            specifications: { driver: 'Custom high-excursion', anc: 'Adaptive Active Noise Cancellation', battery: 'Up to 30 hours with case', chip: 'H2 custom processor', connectivity: 'Bluetooth 5.3' }
        }
    },
    {
        id: 3,
        name: 'SoundPeak Studio+',
        category: 'headphones',
        brand: 'SoundPeak',
        price: 34999,
        original_price: 39999,
        rating: 4.7,
        review_count: 890,
        image_url: 'https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?w=400&h=400&fit=crop',
        badge: 'New',
        description: 'High-fidelity audio with lossless support and premium vegan leather earcups.',
        colors: ['Black', 'Silver'],
        in_stock: true,
        details: {
            long_description: 'Experience studio-quality sound with SoundPeak Studio+. These over-ear headphones deliver incredible clarity and deep bass for the pure audiophile experience.',
            specifications: { driver: '40mm Titanium drivers', frequency_response: '5Hz - 40kHz', anc: 'Hybrid ANC with 4 mics', battery: '40 hours continuous playback' }
        }
    }
];

async function seed() {
    console.log("Seeding products...");
    for (const p of products) {
        // We ensure we don't duplicate on ID by doing an upsert or checking
        const { id, details, ...productData } = p;
        const { error } = await supabase.from('products').upsert({ id, ...productData, details });
        if (error) {
            console.error("Error inserting", p.name, error);
        } else {
            console.log("Inserted:", p.name);
        }
    }
    console.log("Done seeding.");
}

seed();
