import sql from './db';

/**
 * Admin Service (Neon Postgres Implementation)
 */

let skuColumnChecked = false;
async function ensureSkuColumn() {
    if (skuColumnChecked) return;
    try {
        await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS sku TEXT`;
        skuColumnChecked = true;
    } catch (e) {
        // Table column verified or alter not needed
    }
}

export async function adminGetProducts() {
    try {
        await ensureSkuColumn();
        const rows = await sql`SELECT * FROM products ORDER BY created_at DESC`;
        return rows.map(r => {
            const detailsObj = typeof r.details === 'string' ? JSON.parse(r.details) : (r.details || {});
            return {
                ...r,
                sku: r.sku || detailsObj.sku || `SMN-${(r.category || 'GEN').substring(0, 3).toUpperCase()}-${String(r.id).padStart(4, '0')}`,
                details: detailsObj
            };
        });
    } catch (err) {
        console.error('Error fetching admin products:', err);
        return [];
    }
}

export async function adminCreateProduct(p) {
    try {
        await ensureSkuColumn();
        const skuVal = (p.sku && p.sku.trim()) || `SMN-${(p.category || 'GEN').substring(0, 3).toUpperCase()}-${Date.now().toString().slice(-4)}`;
        const detailsWithSku = {
            ...(p.details || {}),
            sku: skuVal
        };

        const [prod] = await sql`
            INSERT INTO products (
                name, sku, price, original_price, category, brand, 
                description, image_url, badge, in_stock, 
                rating, review_count, colors, details
            ) VALUES (
                ${p.name}, ${skuVal}, ${p.price}, ${p.original_price || 0}, ${p.category}, ${p.brand || ''},
                ${p.description || ''}, ${p.image_url}, ${p.badge || ''}, ${p.in_stock},
                ${p.rating || 0}, ${p.review_count || 0}, ${JSON.stringify(p.colors)}, ${JSON.stringify(detailsWithSku)}
            ) RETURNING *
        `;
        return { success: true, data: prod };
    } catch (err) {
        console.error('Error creating admin product:', err);
        throw err;
    }
}

export async function adminUpdateProduct(id, p) {
    try {
        await ensureSkuColumn();
        const skuVal = (p.sku && p.sku.trim()) || `SMN-${(p.category || 'GEN').substring(0, 3).toUpperCase()}-${String(id).padStart(4, '0')}`;
        const detailsWithSku = {
            ...(p.details || {}),
            sku: skuVal
        };

        const [prod] = await sql`
            UPDATE products SET
                name = ${p.name}, sku = ${skuVal}, price = ${p.price}, original_price = ${p.original_price || 0},
                category = ${p.category}, brand = ${p.brand || ''}, description = ${p.description || ''},
                image_url = ${p.image_url}, badge = ${p.badge || ''}, in_stock = ${p.in_stock},
                rating = ${p.rating || 0}, review_count = ${p.review_count || 0},
                colors = ${JSON.stringify(p.colors)}, details = ${JSON.stringify(detailsWithSku)}
            WHERE id = ${id}
            RETURNING *
        `;
        return { success: true, data: prod };
    } catch (err) {
        console.error('Error updating admin product:', err);
        throw err;
    }
}

export async function adminDeleteProduct(id) {
    try {
        await sql`DELETE FROM products WHERE id = ${id}`;
        return { success: true };
    } catch (err) {
        console.error('Error deleting admin product:', err);
        throw err;
    }
}

export async function adminGetOrders() {
    try {
        // Simple fetch for list
        return await sql`SELECT * FROM orders ORDER BY created_at DESC`;
    } catch (err) {
        console.error('Error fetching admin orders:', err);
        return [];
    }
}

export async function adminGetOrderDetails(id) {
    try {
        const [order] = await sql`SELECT * FROM orders WHERE id = ${id}`;
        if (!order) return null;

        const items = await sql`SELECT * FROM order_items WHERE order_id = ${id}`;
        const tracking = await sql`
            SELECT * FROM order_tracking 
            WHERE order_id = ${id} 
            ORDER BY timestamp ASC, id ASC
        `;

        return { 
            ...order, 
            order_items: items.map(i => ({ ...i, image_url: i.image_url || i.image })),
            order_tracking: tracking
        };
    } catch (err) {
        console.error('Error fetching admin order details:', err);
        return null;
    }
}

export async function adminUpdateOrderStatus(orderId, status) {
    try {
        await sql`UPDATE orders SET status = ${status} WHERE id = ${orderId}`;
        return { success: true };
    } catch (err) {
        console.error('Error updating status:', err);
        throw err;
    }
}

export async function adminAddTrackingStep(data) {
    try {
        if (data.is_current) {
            await sql`UPDATE order_tracking SET is_current = false WHERE order_id = ${data.order_id}`;
            await adminUpdateOrderStatus(data.order_id, data.status);
        }
        await sql`
            INSERT INTO order_tracking (order_id, label, description, status, is_current, timestamp)
            VALUES (${data.order_id}, ${data.label}, ${data.description || ''}, ${data.status || 'processing'}, ${Boolean(data.is_current)}, CURRENT_TIMESTAMP)
        `;
        return { success: true };
    } catch (err) {
        console.error('Error adding tracking step:', err);
        throw err;
    }
}

export async function fetchStats() {
    try {
        const [stats] = await sql`
            SELECT 
                COUNT(*)::int as "orderCount",
                SUM(total)::numeric as "totalSales"
            FROM orders
        `;
        return {
            totalSales: stats.totalSales || 0,
            orderCount: stats.orderCount || 0,
            customerCount: 0, // Requires a users table
            recentOrders: []
        };
    } catch (err) {
        return { totalSales: 0, orderCount: 0, customerCount: 0, recentOrders: [] };
    }
}
