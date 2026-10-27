import sql from './db';

/**
 * Order Service (Neon Postgres Implementation)
 */

export async function fetchUserOrders(userId) {
    console.log('Fetching orders for user:', userId);
    if (!userId) return [];
    try {
        const orders = await sql`
            SELECT * FROM orders 
            WHERE user_id = ${userId}
            ORDER BY created_at DESC
        `;
        console.log('Orders found in DB for user:', orders.length);
        
        if (orders.length === 0) return [];

        // Fetch all items for these orders
        const orderIds = orders.map(o => o.id);
        const allItems = await sql`
            SELECT * FROM order_items 
            WHERE order_id = ANY(${orderIds})
        `;

        // Map items back to orders
        return orders.map(order => ({
            ...order,
            items: allItems.filter(item => item.order_id === order.id).map(i => ({
                ...i,
                image: i.image_url
            }))
        }));
    } catch (err) {
        console.error('Error fetching user orders:', err);
        return [];
    }
}

export async function fetchOrderDetails(orderNumberOrId) {
    try {
        // Handle both order_number (string) and id (integer)
        const isNumericId = !isNaN(orderNumberOrId) && !String(orderNumberOrId).startsWith('ORD');
        
        const orderRows = isNumericId 
            ? await sql`SELECT * FROM orders WHERE id = ${parseInt(orderNumberOrId)}`
            : await sql`SELECT * FROM orders WHERE order_number = ${orderNumberOrId}`;
        
        if (orderRows.length === 0) return null;
        
        const order = orderRows[0];
        const items = await sql`
            SELECT * FROM order_items 
            WHERE order_id = ${order.id}
        `;
        const normalizedItems = items.map(i => ({ ...i, image: i.image_url }));
        
        // Fetch real dynamic tracking milestones from order_tracking table
        const tracking = await sql`
            SELECT * FROM order_tracking 
            WHERE order_id = ${order.id} 
            ORDER BY timestamp ASC, id ASC
        `;

        return { ...order, items: normalizedItems, order_tracking: tracking };
    } catch (err) {
        console.error('Error fetching order details:', err);
        return null;
    }
}

let orderSkuColumnChecked = false;
async function ensureOrderSkuColumn() {
    if (orderSkuColumnChecked) return;
    try {
        await sql`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS sku TEXT`;
        orderSkuColumnChecked = true;
    } catch (e) {
        // Safe ignore if permission or already exists
    }
}

export async function placeOrder(orderData) {
    try {
        await ensureOrderSkuColumn();

        // 1. Insert Order
        const [newOrder] = await sql`
            INSERT INTO orders (
                order_number, user_id, total, subtotal, 
                delivery_fee, payment_method, payment_id, shipping_address
            ) VALUES (
                ${orderData.order_number},
                ${orderData.user_id || null},
                ${orderData.total},
                ${orderData.subtotal},
                ${orderData.delivery_fee},
                ${orderData.payment_method},
                ${orderData.payment_id || null},
                ${JSON.stringify(orderData.shipping)}
            ) RETURNING id
        `;

        // 2. Insert Items
        for (const item of orderData.items) {
            try {
                await sql`
                    INSERT INTO order_items (
                        order_id, product_id, name, price, quantity, image_url, color, sku
                    ) VALUES (
                        ${newOrder.id},
                        ${item.id},
                        ${item.name},
                        ${item.price},
                        ${item.quantity},
                        ${item.image_url || item.image},
                        ${item.variant_id || item.color || null},
                        ${item.sku || null}
                    )
                `;
            } catch (itemErr) {
                // Fallback in case sku column is absent in restricted schema
                await sql`
                    INSERT INTO order_items (
                        order_id, product_id, name, price, quantity, image_url, color
                    ) VALUES (
                        ${newOrder.id},
                        ${item.id},
                        ${item.name},
                        ${item.price},
                        ${item.quantity},
                        ${item.image_url || item.image},
                        ${item.variant_id || item.color || null}
                    )
                `;
            }
        }

        return { success: true, id: newOrder.id };
    } catch (err) {
        console.error('Error placing order in Neon:', err);
        throw err;
    }
}
