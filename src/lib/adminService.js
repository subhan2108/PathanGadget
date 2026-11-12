import sql from './db';
import { formatImageUrl } from './productsService';

/**
 * Admin Service (Neon Postgres Implementation)
 */

let schemaChecked = false;
async function ensureSchema() {
    if (schemaChecked) return;
    try {
        await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS sku TEXT`;
        await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS subcategory TEXT`;
        schemaChecked = true;
    } catch (e) {
        // Table columns verified
    }
}

export async function adminGetProducts() {
    try {
        await ensureSchema();
        const rows = await sql`SELECT * FROM products ORDER BY created_at DESC`;
        return rows.map(r => {
            const detailsObj = typeof r.details === 'string' ? JSON.parse(r.details) : (r.details || {});
            return {
                ...r,
                image_url: formatImageUrl(r.image_url),
                sku: r.sku || detailsObj.sku || `SMN-${(r.category || 'GEN').substring(0, 3).toUpperCase()}-${String(r.id).padStart(4, '0')}`,
                subcategory: r.subcategory || detailsObj.subcategory || '',
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
        await ensureSchema();
        const skuVal = (p.sku && p.sku.trim()) || `SMN-${(p.category || 'GEN').substring(0, 3).toUpperCase()}-${Date.now().toString().slice(-4)}`;
        const subcatVal = (p.subcategory && p.subcategory.trim()) || '';
        const detailsWithSku = {
            ...(p.details || {}),
            sku: skuVal,
            subcategory: subcatVal
        };

        const [prod] = await sql`
            INSERT INTO products (
                name, sku, price, original_price, category, subcategory, brand, 
                description, image_url, badge, in_stock, 
                rating, review_count, colors, details
            ) VALUES (
                ${p.name}, ${skuVal}, ${p.price}, ${p.original_price || 0}, ${p.category}, ${subcatVal}, ${p.brand || ''},
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
        await ensureSchema();
        const skuVal = (p.sku && p.sku.trim()) || `SMN-${(p.category || 'GEN').substring(0, 3).toUpperCase()}-${String(id).padStart(4, '0')}`;
        const subcatVal = (p.subcategory && p.subcategory.trim()) || '';
        const detailsWithSku = {
            ...(p.details || {}),
            sku: skuVal,
            subcategory: subcatVal
        };

        const [prod] = await sql`
            UPDATE products SET
                name = ${p.name}, sku = ${skuVal}, price = ${p.price}, original_price = ${p.original_price || 0},
                category = ${p.category}, subcategory = ${subcatVal}, brand = ${p.brand || ''}, description = ${p.description || ''},
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

export async function adminRenameCategory(oldName, newName) {
    try {
        await ensureSchema();
        const trimmedOld = (oldName || '').trim();
        const trimmedNew = (newName || '').trim();
        if (!trimmedOld || !trimmedNew) {
            throw new Error('Both old and new category names are required.');
        }
        if (trimmedOld.toLowerCase() === trimmedNew.toLowerCase() && trimmedOld === trimmedNew) {
            return { success: true, count: 0 };
        }

        const result = await sql`
            UPDATE products
            SET category = ${trimmedNew}
            WHERE category = ${trimmedOld}
            RETURNING id
        `;
        return { success: true, count: result.length };
    } catch (err) {
        console.error('Error renaming category:', err);
        throw err;
    }
}

export async function adminRenameSubcategory(category, oldName, newName) {
    try {
        await ensureSchema();
        const trimmedCat = (category || '').trim();
        const trimmedOld = (oldName || '').trim();
        const trimmedNew = (newName || '').trim();
        if (!trimmedOld || !trimmedNew) {
            throw new Error('Both old and new subcategory names are required.');
        }

        let result;
        if (trimmedCat && trimmedCat !== 'all') {
            result = await sql`
                UPDATE products
                SET subcategory = ${trimmedNew}
                WHERE category = ${trimmedCat} AND subcategory = ${trimmedOld}
                RETURNING id
            `;
        } else {
            result = await sql`
                UPDATE products
                SET subcategory = ${trimmedNew}
                WHERE subcategory = ${trimmedOld}
                RETURNING id
            `;
        }
        return { success: true, count: result.length };
    } catch (err) {
        console.error('Error renaming subcategory:', err);
        throw err;
    }
}

export async function adminBulkUpdateSubcategory(productIds, newSubcategory) {
    try {
        await ensureSchema();
        if (!Array.isArray(productIds) || productIds.length === 0) {
            throw new Error('No products selected.');
        }
        const trimmedSubcat = (newSubcategory || '').trim();
        const numIds = productIds.map(Number).filter(n => !isNaN(n));

        const result = await sql`
            UPDATE products
            SET subcategory = ${trimmedSubcat}
            WHERE id = ANY(${numIds})
            RETURNING id
        `;
        return { success: true, count: result.length };
    } catch (err) {
        console.error('Error bulk updating subcategory:', err);
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
