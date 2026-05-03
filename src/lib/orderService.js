import sql from './db';

/**
 * Order Service (Neon Postgres Implementation)
 */

export async function fetchUserOrders(userId) {
    if (!userId) return [];
    try {
        // Fetch orders and their items using a join or multiple queries
        const orders = await sql`
            SELECT * FROM orders 
            WHERE user_id = ${userId}
            ORDER BY created_at DESC
        `;
        
        if (orders.length === 0) return [];

        // Fetch all items for these orders
        const orderIds = orders.map(o => o.id);
        const allItems = await sql`
            SELECT * FROM order_items 
            WHERE order_id IN (${orderIds})
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
        
        // Mock tracking data since we don't have a tracking table yet
        const mockTracking = [
            { id: 1, label: 'Order Placed', description: 'Your order has been successfully placed.', timestamp: order.created_at },
            { id: 2, label: 'Processing', description: 'Our team is preparing your package.', timestamp: new Date(new Date(order.created_at).getTime() + 3600000) }
        ];

        return { ...order, items: normalizedItems, order_tracking: mockTracking };
    } catch (err) {
        console.error('Error fetching order details:', err);
        return null;
    }
}

export async function placeOrder(orderData) {
    try {
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
                    ${item.color || null}
                )
            `;
        }

        return { success: true, id: newOrder.id };
    } catch (err) {
        console.error('Error placing order in Neon:', err);
        throw err;
    }
}
