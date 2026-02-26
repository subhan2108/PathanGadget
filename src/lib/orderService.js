import { supabase } from './supabaseClient';

export async function fetchUserOrders(userId) {
    if (!userId) return [];

    const { data, error } = await supabase
        .from('orders')
        .select(`
            *,
            order_items (*)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching orders:', error);
        return [];
    }

    // Map data to match frontend requirements if needed
    return data;
}

export async function fetchOrderDetails(orderNumberOrId, withTracking = false) {
    // Determine if it looks like a numeric ID or the ORD- string
    let query = supabase.from('orders').select('*, order_items (*), addresses(*)');

    if (String(orderNumberOrId).startsWith('ORD')) {
        query = query.eq('order_number', orderNumberOrId);
    } else {
        query = query.eq('id', orderNumberOrId);
    }

    const { data: order, error } = await query.single();
    if (error || !order) return null;

    if (withTracking) {
        const { data: tracking } = await supabase
            .from('order_tracking')
            .select('*')
            .eq('order_id', order.id)
            .order('timestamp', { ascending: true });

        order.order_tracking = tracking || [];
    }

    return order;
}

export async function placeOrder(orderData) {
    const userId = orderData.user_id;
    // Calculate a unique order number (for simplicity randomly base generator)
    const orderNumber = orderData.order_number || `ORD-${new Date().getFullYear()}-${Math.floor(Math.random() * 900000) + 100000}`;

    // Create Address first (Or bind if already exists)
    let addressRef = null;
    if (orderData.shipping) {
        // Insert fallback directly or store JSON fallback
        const { data: addressData, error: addressError } = await supabase
            .from('addresses')
            .insert([{
                user_id: userId,
                full_name: orderData.shipping.name || '',
                phone: orderData.shipping.phone || '',
                line1: orderData.shipping.address || '',
                city: typeof orderData.shipping === 'object' ? (orderData.shipping.city || 'City') : '',
                state: 'State',
                pincode: '000000'
            }])
            .select()
            .single();

        if (!addressError && addressData) {
            addressRef = addressData.id;
        }
    }

    // Create the Order
    const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert([{
            user_id: userId,
            order_number: orderNumber,
            status: 'processing',
            subtotal: orderData.subtotal,
            delivery_fee: orderData.delivery_fee || 0,
            total: orderData.total,
            payment_method: orderData.payment_method || 'Card',
            payment_status: orderData.payment_id ? 'paid' : 'pending',
            razorpay_id: orderData.payment_id || null,
            address_id: addressRef,
            shipping_details: typeof orderData.shipping === 'object' ? orderData.shipping : { address: orderData.shipping }
        }])
        .select()
        .single();

    if (orderError) throw new Error('Could not create order: ' + orderError.message);

    // Create order items
    if (orderData.items && orderData.items.length > 0) {
        const orderItemsMap = orderData.items.map(item => ({
            order_id: order.id,
            product_id: item.id || null, // Assuming product has id 
            name: item.name,
            image_url: item.image || item.image_url,
            price: item.price,
            quantity: item.quantity,
            color: item.color || null
        }));

        const { error: itemsError } = await supabase.from('order_items').insert(orderItemsMap);
        if (itemsError) console.error("Could not insert order items: ", itemsError);
    }

    // Insert initial tracking event
    await supabase.from('order_tracking').insert([{
        order_id: order.id,
        status: 'processing',
        label: 'Order Placed',
        description: 'Your order has been placed and is being processed.',
        is_current: true
    }]);

    return order;
}
