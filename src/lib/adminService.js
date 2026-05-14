import sql from './db';

/**
 * Admin Service (Neon Postgres Implementation)
 */

export async function adminGetProducts() {
    try {
        return await sql`SELECT * FROM products ORDER BY created_at DESC`;
    } catch (err) {
        console.error('Error fetching admin products:', err);
        return [];
    }
}

export async function adminCreateProduct(p) {
    try {
        const [prod] = await sql`
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
        return { success: true, data: prod };
    } catch (err) {
        console.error('Error creating admin product:', err);
        throw err;
    }
}

export async function adminUpdateProduct(id, p) {
    try {
        const [prod] = await sql`
            UPDATE products SET
                name = ${p.name}, price = ${p.price}, original_price = ${p.original_price || 0},
                category = ${p.category}, brand = ${p.brand || ''}, description = ${p.description || ''},
                image_url = ${p.image_url}, badge = ${p.badge || ''}, in_stock = ${p.in_stock},
                rating = ${p.rating || 0}, review_count = ${p.review_count || 0},
                colors = ${JSON.stringify(p.colors)}, details = ${JSON.stringify(p.details)}
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
        
        // Mock tracking if missing, or fetch if exists
        // (Assuming tracking table is not fully implemented yet)
        const mockTracking = [
            { id: 1, label: 'Order Placed', status: 'confirmed', timestamp: order.created_at, is_current: order.status === 'confirmed' },
            { id: 2, label: 'Processing', status: 'processing', timestamp: new Date(new Date(order.created_at).getTime() + 3600000), is_current: order.status === 'processing' }
        ];

        return { 
            ...order, 
            order_items: items.map(i => ({ ...i, image_url: i.image_url || i.image })),
            order_tracking: mockTracking
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
    // For now, we update order status as a shortcut
    if (data.is_current) {
        await adminUpdateOrderStatus(data.order_id, data.status);
    }
    return { success: true };
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
