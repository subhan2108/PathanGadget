import sql from './db';
import { products as mockProducts, orders as mockOrders, trackingData as mockTracking } from '../data/mockData';

const PRODUCT_GALLERIES = {
    1: [
        'https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?w=600&h=600&fit=crop',
        'https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=600&h=600&fit=crop',
        'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=600&h=600&fit=crop',
        'https://images.unsplash.com/photo-1510017803434-a899398421b3?w=600&h=600&fit=crop',
    ],
    2: [
        'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=600&h=600&fit=crop',
        'https://images.unsplash.com/photo-1572536147248-ac59a8abfa4b?w=600&h=600&fit=crop',
        'https://images.unsplash.com/photo-1588423771073-b8903fbb85b5?w=600&h=600&fit=crop',
        'https://images.unsplash.com/photo-1572645315416-6c5bc4fcabba?w=600&h=600&fit=crop',
    ],
    3: [
        'https://images.unsplash.com/photo-1484704849700-f032a568e944?w=600&h=600&fit=crop',
        'https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=600&h=600&fit=crop',
        'https://images.unsplash.com/photo-1583394838336-acd977736f90?w=600&h=600&fit=crop',
        'https://images.unsplash.com/photo-1524678606370-a47ad25cb82a?w=600&h=600&fit=crop',
    ],
    4: [
        'https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?w=600&h=600&fit=crop',
        'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&h=600&fit=crop',
        'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=600&h=600&fit=crop',
    ],
    5: [
        'https://images.unsplash.com/photo-1606220588913-b3aacb4d2f46?w=600&h=600&fit=crop',
        'https://images.unsplash.com/photo-1572536147248-ac59a8abfa4b?w=600&h=600&fit=crop',
        'https://images.unsplash.com/photo-1588423771073-b8903fbb85b5?w=600&h=600&fit=crop',
    ],
    6: [
        'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&h=600&fit=crop',
        'https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=600&h=600&fit=crop',
        'https://images.unsplash.com/photo-1583394838336-acd977736f90?w=600&h=600&fit=crop',
    ],
    7: [
        'https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=600&h=600&fit=crop',
        'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&h=600&fit=crop',
        'https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?w=600&h=600&fit=crop',
    ],
    8: [
        'https://images.unsplash.com/photo-1606220588913-b3aacb4d2f46?w=600&h=600&fit=crop',
        'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=600&h=600&fit=crop',
        'https://images.unsplash.com/photo-1572536147248-ac59a8abfa4b?w=600&h=600&fit=crop',
    ]
};

/**
 * Initializes and synchronizes all data from mockData.js into Neon PostgreSQL.
 * Ensures tables exist and are populated with all products, orders, items, and tracking milestones.
 */
export async function syncMockDataToNeon() {
    try {
        console.log('[Sync] Initializing Neon DB schema and syncing mock data...');

        // 1. Create tables if not exist
        await sql`
            CREATE TABLE IF NOT EXISTS products (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                sku TEXT,
                price NUMERIC NOT NULL,
                original_price NUMERIC,
                category TEXT NOT NULL,
                brand TEXT,
                description TEXT,
                image_url TEXT,
                badge TEXT,
                in_stock BOOLEAN DEFAULT true,
                rating NUMERIC DEFAULT 0,
                review_count INTEGER DEFAULT 0,
                colors JSONB,
                details JSONB,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `;
        await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS sku TEXT`;

        await sql`
            CREATE TABLE IF NOT EXISTS orders (
                id SERIAL PRIMARY KEY,
                order_number TEXT UNIQUE NOT NULL,
                user_id TEXT,
                total NUMERIC NOT NULL,
                subtotal NUMERIC NOT NULL,
                delivery_fee NUMERIC NOT NULL DEFAULT 0,
                payment_method TEXT NOT NULL,
                payment_id TEXT,
                shipping_address JSONB,
                status TEXT DEFAULT 'processing',
                carrier TEXT DEFAULT 'FastTrack India',
                tracking_number TEXT,
                estimated_delivery TEXT,
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
                quantity INTEGER NOT NULL DEFAULT 1,
                image_url TEXT,
                color TEXT
            )
        `;

        await sql`
            CREATE TABLE IF NOT EXISTS order_tracking (
                id SERIAL PRIMARY KEY,
                order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
                label TEXT NOT NULL,
                description TEXT,
                status TEXT DEFAULT 'processing',
                is_current BOOLEAN DEFAULT false,
                timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `;

        // 2. Sync Products from mockData.js
        for (const p of mockProducts) {
            const existing = await sql`SELECT id FROM products WHERE id = ${p.id} OR LOWER(name) = LOWER(${p.name})`;
            const specsObj = p.specs || {};
            const extraGalleryImages = PRODUCT_GALLERIES[p.id] || [
                'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&h=600&fit=crop',
                'https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=600&h=600&fit=crop',
                'https://images.unsplash.com/photo-1583394838336-acd977736f90?w=600&h=600&fit=crop'
            ];

            const productSku = p.sku || `SMN-${p.category ? p.category.substring(0, 3).toUpperCase() : 'GEN'}-${String(p.id).padStart(4, '0')}`;

            const detailsData = {
                sku: productSku,
                specifications: { SKU: productSku, ...specsObj },
                specs: { SKU: productSku, ...specsObj },
                connectivity: p.connectivity || '',
                highlights: [
                    p.description,
                    p.connectivity ? `Connectivity: ${p.connectivity}` : null,
                    p.specs?.battery ? `Battery: ${p.specs.battery}` : null
                ].filter(Boolean),
                whyChooseUs: [
                    '100% Genuine Direct Warranty',
                    'Express Delivery in 24–48 Hours',
                    '7-Day Easy Return Policy'
                ],
                extraImages: extraGalleryImages
            };

            if (existing.length === 0) {
                await sql`
                    INSERT INTO products (
                        id, name, sku, price, original_price, category, brand,
                        description, image_url, badge, in_stock, rating,
                        review_count, colors, details
                    ) VALUES (
                        ${p.id}, ${p.name}, ${productSku}, ${p.price}, ${p.originalPrice || 0}, ${p.category}, ${p.brand || ''},
                        ${p.description || ''}, ${p.image}, ${p.badge || ''}, ${p.inStock}, ${p.rating || 0},
                        ${p.reviews || 0}, ${JSON.stringify(p.colors || [])}, ${JSON.stringify(detailsData)}
                    )
                `;
            } else {
                // Update details and specs to keep synced
                await sql`
                    UPDATE products SET
                        sku = ${productSku},
                        price = ${p.price},
                        original_price = ${p.originalPrice || 0},
                        category = ${p.category},
                        brand = ${p.brand || ''},
                        description = ${p.description || ''},
                        image_url = ${p.image},
                        badge = ${p.badge || ''},
                        in_stock = ${p.inStock},
                        rating = ${p.rating || 0},
                        review_count = ${p.reviews || 0},
                        colors = ${JSON.stringify(p.colors || [])},
                        details = ${JSON.stringify(detailsData)}
                    WHERE id = ${existing[0].id}
                `;
            }
        }

        // 3. Sync Orders from mockData.js
        for (const o of mockOrders) {
            let orderId;
            const existingOrder = await sql`SELECT id FROM orders WHERE order_number = ${o.id}`;
            const shippingObj = {
                name: o.shipping?.name || 'Customer',
                phone: o.shipping?.phone || '+91 98765 43210',
                address: o.shipping?.address || 'Mumbai, MH',
                city: 'Mumbai',
                state: 'MH',
                pincode: '400050'
            };

            const orderDate = o.date ? new Date(o.date) : new Date();

            if (existingOrder.length === 0) {
                const [newOrder] = await sql`
                    INSERT INTO orders (
                        order_number, total, subtotal, delivery_fee, payment_method,
                        payment_id, shipping_address, status, carrier, tracking_number,
                        estimated_delivery, created_at
                    ) VALUES (
                        ${o.id}, ${o.total}, ${o.total}, 0, ${o.payment?.method || 'UPI'},
                        ${o.payment?.transactionId || 'TXN123456'}, ${JSON.stringify(shippingObj)},
                        ${o.status}, 'BlueDart Express', ${'BD' + o.id.replace(/\D/g, '') + '99'},
                        'Feb 22, 2024', ${orderDate}
                    ) RETURNING id
                `;
                orderId = newOrder.id;
            } else {
                orderId = existingOrder[0].id;
                await sql`
                    UPDATE orders SET
                        total = ${o.total},
                        subtotal = ${o.total},
                        status = ${o.status},
                        shipping_address = ${JSON.stringify(shippingObj)}
                    WHERE id = ${orderId}
                `;
            }

            // Sync items for this order
            const existingItems = await sql`SELECT id FROM order_items WHERE order_id = ${orderId}`;
            if (existingItems.length === 0 && o.items && o.items.length > 0) {
                for (const item of o.items) {
                    await sql`
                        INSERT INTO order_items (order_id, product_id, name, price, quantity, image_url, color)
                        VALUES (${orderId}, ${item.id}, ${item.name}, ${item.price}, ${item.quantity || 1}, ${item.image}, ${item.colors?.[0] || 'Black'})
                    `;
                }
            }

            // Sync tracking milestones for this order
            const existingTracking = await sql`SELECT id FROM order_tracking WHERE order_id = ${orderId}`;
            if (existingTracking.length === 0) {
                if (o.id === 'ORD-2024-002' && mockTracking?.steps) {
                    // Use detailed tracking steps from mockTracking
                    for (const step of mockTracking.steps) {
                        await sql`
                            INSERT INTO order_tracking (order_id, label, description, status, is_current, timestamp)
                            VALUES (
                                ${orderId},
                                ${step.label},
                                ${step.description},
                                ${step.label.toLowerCase().replace(/\s+/g, '_')},
                                ${Boolean(step.active)},
                                ${orderDate}
                            )
                        `;
                    }
                } else if (o.timeline && o.timeline.length > 0) {
                    // Use timeline from order
                    for (let idx = 0; idx < o.timeline.length; idx++) {
                        const t = o.timeline[idx];
                        if (t.done) {
                            const isCurrent = idx === o.timeline.filter(x => x.done).length - 1;
                            await sql`
                                INSERT INTO order_tracking (order_id, label, description, status, is_current, timestamp)
                                VALUES (
                                    ${orderId},
                                    ${t.step},
                                    ${`Order milestone reached: ${t.step}`},
                                    ${t.step.toLowerCase().replace(/\s+/g, '_')},
                                    ${isCurrent},
                                    ${t.date ? new Date(t.date) : orderDate}
                                )
                            `;
                        }
                    }
                }
            }
        }

        console.log('[Sync] Successfully synchronized all mock data to Neon DB!');
        return { success: true };
    } catch (err) {
        console.error('[Sync] Error synchronizing data to Neon DB:', err);
        return { success: false, error: err.message };
    }
}
