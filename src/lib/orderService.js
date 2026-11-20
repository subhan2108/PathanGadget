import sql from './db';

/**
 * Order Service (Neon Postgres Implementation)
 */

export async function lookupCustomerByPhone(phone) {
    if (!phone) return null;
    const cleanPhone = String(phone).replace(/\D/g, '').slice(-10);
    if (cleanPhone.length !== 10) return null;
    try {
        const rows = await sql`
            SELECT * FROM customers 
            WHERE phone = ${cleanPhone}
            LIMIT 1
        `;
        if (rows.length > 0) return rows[0];

        // Fallback: Check past orders if customers table doesn't have it yet
        const pastOrders = await sql`
            SELECT customer_phone, customer_shop_name, customer_address, 
                   customer_pincode, customer_city, customer_state, shipping_address
            FROM orders 
            WHERE customer_phone = ${cleanPhone} OR shipping_address->>'phone' LIKE ${'%' + cleanPhone}
            ORDER BY created_at DESC 
            LIMIT 1
        `;
        if (pastOrders.length > 0) {
            const po = pastOrders[0];
            const ship = typeof po.shipping_address === 'string' ? JSON.parse(po.shipping_address) : (po.shipping_address || {});
            return {
                phone: cleanPhone,
                name: po.customer_shop_name || ship.firstName || ship.name || '',
                shop_name: po.customer_shop_name || ship.shopName || ship.lastName || '',
                address: po.customer_address || ship.address || '',
                city: po.customer_city || ship.city || '',
                state: po.customer_state || ship.state || '',
                pincode: po.customer_pincode || ship.pincode || ''
            };
        }
        return null;
    } catch (err) {
        console.error('Error looking up customer by phone:', err);
        return null;
    }
}

export async function saveOrUpdateCustomer(customerData) {
    if (!customerData || !customerData.phone) return null;
    const cleanPhone = String(customerData.phone).replace(/\D/g, '').slice(-10);
    if (cleanPhone.length !== 10) return null;
    try {
        const name = (customerData.name || customerData.firstName || '').trim();
        const shopName = (customerData.shop_name || customerData.shopName || customerData.lastName || '').trim();
        const address = (customerData.address || '').trim();
        const pincode = (customerData.pincode || '').trim();
        const city = (customerData.city || '').trim();
        const state = (customerData.state || '').trim();

        const [saved] = await sql`
            INSERT INTO customers (phone, name, shop_name, address, pincode, city, state, updated_at)
            VALUES (${cleanPhone}, ${name}, ${shopName}, ${address}, ${pincode}, ${city}, ${state}, NOW())
            ON CONFLICT (phone) DO UPDATE SET
                name = COALESCE(NULLIF(EXCLUDED.name, ''), customers.name),
                shop_name = COALESCE(NULLIF(EXCLUDED.shop_name, ''), customers.shop_name),
                address = COALESCE(NULLIF(EXCLUDED.address, ''), customers.address),
                pincode = COALESCE(NULLIF(EXCLUDED.pincode, ''), customers.pincode),
                city = COALESCE(NULLIF(EXCLUDED.city, ''), customers.city),
                state = COALESCE(NULLIF(EXCLUDED.state, ''), customers.state),
                updated_at = NOW()
            RETURNING *
        `;
        return saved;
    } catch (err) {
        console.warn('Could not save customer record:', err);
        return null;
    }
}

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

/**
 * Fetch customer profile and all their past orders by 10-digit phone number.
 * No password or Gmail login needed.
 */
export async function fetchCustomerProfileAndOrders(phone) {
    if (!phone) return { customer: null, orders: [] };
    const cleanPhone = String(phone).replace(/\D/g, '').slice(-10);
    if (cleanPhone.length !== 10) return { customer: null, orders: [] };

    try {
        // 1. Fetch customer record
        let customer = null;
        const custRows = await sql`
            SELECT * FROM customers 
            WHERE phone = ${cleanPhone}
            LIMIT 1
        `;
        if (custRows.length > 0) {
            customer = custRows[0];
        }

        // 2. Fetch all orders matching phone
        const orders = await sql`
            SELECT * FROM orders 
            WHERE customer_phone = ${cleanPhone}
               OR shipping_address->>'phone' LIKE ${'%' + cleanPhone}
            ORDER BY created_at DESC
        `;

        // If customer was not in customers table, infer from newest order
        if (!customer && orders.length > 0) {
            const newest = orders[0];
            const ship = typeof newest.shipping_address === 'string' ? JSON.parse(newest.shipping_address) : (newest.shipping_address || {});
            customer = {
                phone: cleanPhone,
                name: newest.customer_shop_name || ship.shopName || ship.name || `${ship.firstName || ''} ${ship.lastName || ''}`.trim() || 'Valued Customer',
                shop_name: newest.customer_shop_name || ship.shopName || ship.name || '',
                address: newest.customer_address || ship.address || '',
                city: newest.customer_city || ship.city || '',
                state: newest.customer_state || ship.state || '',
                pincode: newest.customer_pincode || ship.pincode || ''
            };
        }

        if (orders.length === 0) {
            return { customer, orders: [] };
        }

        // 3. Fetch order items for all these orders
        const orderIds = orders.map(o => o.id);
        const allItems = await sql`
            SELECT * FROM order_items 
            WHERE order_id = ANY(${orderIds})
            ORDER BY id ASC
        `;

        const enrichedOrders = orders.map(o => {
            const ship = typeof o.shipping_address === 'string' ? JSON.parse(o.shipping_address) : (o.shipping_address || {});
            const items = allItems.filter(item => item.order_id === o.id).map(i => ({
                ...i,
                image: i.image_url || '/placeholder-key.svg'
            }));

            return {
                ...o,
                shipping: ship,
                items: items
            };
        });

        return {
            customer,
            orders: enrichedOrders
        };
    } catch (err) {
        console.error('Error in fetchCustomerProfileAndOrders:', err);
        return { customer: null, orders: [] };
    }
}

export async function fetchOrderDetails(query) {
    try {
        if (!query) return null;
        const str = String(query).trim();
        const upperStr = str.toUpperCase();

        // 1. Exact or case-insensitive match on order_number
        let orderRows = await sql`
            SELECT * FROM orders 
            WHERE UPPER(order_number) = ${upperStr}
               OR order_number = ${str}
            LIMIT 1
        `;

        // 2. Match on courier tracking / consignment number
        if (orderRows.length === 0) {
            orderRows = await sql`
                SELECT * FROM orders 
                WHERE tracking_number = ${str} 
                   OR UPPER(tracking_number) = ${upperStr}
                   OR tracking_number ILIKE ${'%' + str + '%'}
                ORDER BY created_at DESC LIMIT 1
            `;
        }

        // 3. Match on numeric database ID (e.g. 12)
        if (orderRows.length === 0 && !isNaN(str) && !upperStr.startsWith('ORD') && str.length < 8) {
            orderRows = await sql`SELECT * FROM orders WHERE id = ${parseInt(str)}`;
        }

        // 4. Match on customer phone number (only if not an ORD order number)
        if (orderRows.length === 0 && !upperStr.startsWith('ORD')) {
            const digitsOnly = str.replace(/\D/g, '');
            const cleanPhone = digitsOnly.slice(-10);
            if (cleanPhone.length === 10) {
                orderRows = await sql`
                    SELECT * FROM orders 
                    WHERE customer_phone = ${cleanPhone} 
                       OR customer_phone LIKE ${'%' + cleanPhone}
                       OR shipping_address->>'phone' LIKE ${'%' + cleanPhone}
                    ORDER BY created_at DESC LIMIT 1
                `;
            }
        }
        
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

        const shipping = orderData.shipping || {};
        const cleanPhone = (shipping.phone || orderData.customer_phone || '').replace(/\D/g, '').slice(-10);
        const shopName = shipping.shopName || shipping.name || `${shipping.firstName || ''} ${shipping.lastName || ''}`.trim();
        const address = shipping.address || '';
        const pincode = shipping.pincode || '';
        const city = shipping.city || '';
        const state = shipping.state || '';
        const initialStatus = orderData.status || (orderData.payment_method?.toLowerCase().includes('upi') || orderData.payment_method === 'WhatsApp' ? 'pending_verification' : 'processing');
        const utrNumber = (orderData.utr_number || '').trim() || null;

        // 1. Insert Order with full customer and tracking fields
        const [newOrder] = await sql`
            INSERT INTO orders (
                order_number, user_id, total, subtotal, 
                delivery_fee, payment_method, payment_id, shipping_address,
                status, utr_number, customer_phone, customer_shop_name,
                customer_address, customer_pincode, customer_city, customer_state
            ) VALUES (
                ${orderData.order_number},
                ${orderData.user_id || null},
                ${orderData.total},
                ${orderData.subtotal},
                ${orderData.delivery_fee || 0},
                ${orderData.payment_method || 'UPI'},
                ${orderData.payment_id || null},
                ${JSON.stringify(shipping)},
                ${initialStatus},
                ${utrNumber},
                ${cleanPhone || null},
                ${shopName || null},
                ${address || null},
                ${pincode || null},
                ${city || null},
                ${state || null}
            ) RETURNING id
        `;

        // 2. Insert initial tracking milestone
        try {
            const milestoneDesc = utrNumber 
                ? `Order #${orderData.order_number} registered. UPI Payment Verification Pending (UTR: ${utrNumber}).`
                : `Order #${orderData.order_number} registered. Awaiting payment confirmation via WhatsApp.`;

            await sql`
                INSERT INTO order_tracking (
                    order_id, label, description, status, is_current, timestamp
                ) VALUES (
                    ${newOrder.id},
                    ${'Order Placed'},
                    ${milestoneDesc},
                    ${initialStatus},
                    true,
                    NOW()
                )
            `;
        } catch (trackErr) {
            console.warn('Could not insert initial tracking milestone:', trackErr);
        }

        // 3. Save customer details for frictionless repeat checkouts
        if (cleanPhone) {
            saveOrUpdateCustomer({
                phone: cleanPhone,
                name: shopName,
                shop_name: shopName,
                address,
                pincode,
                city,
                state
            }).catch(e => console.warn('Customer auto-save warning:', e));
        }

        // 4. Insert Items
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

        return { success: true, id: newOrder.id, order_number: orderData.order_number };
    } catch (err) {
        console.error('Error placing order in Neon:', err);
        throw err;
    }
}
