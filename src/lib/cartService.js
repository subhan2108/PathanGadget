import { supabase } from './supabaseClient';

export async function fetchCart(userId) {
    if (!userId) return [];

    // Fetch cart items joined with product data
    const { data, error } = await supabase
        .from('cart_items')
        .select(`
            id,
            quantity,
            color,
            product_id,
            products (
                name,
                price,
                image_url,
                original_price
            )
        `)
        .eq('user_id', userId);

    if (error) {
        console.error('Error fetching cart:', error);
        return [];
    }

    // Transform data to match existing frontend structure
    return data.map(item => ({
        id: item.product_id, // frontend uses product.id as item.id often, or we should map it
        cartItemId: item.id,
        quantity: item.quantity,
        color: item.color,
        name: item.products.name,
        price: item.products.price,
        image: item.products.image_url,
        originalPrice: item.products.original_price
    }));
}

export async function addToCartDB(userId, item) {
    if (!userId) return null;

    // Upsert on user_id + product_id via RPC or onConflict
    const { data, error } = await supabase
        .from('cart_items')
        .upsert({
            user_id: userId,
            product_id: item.id,
            quantity: item.quantity,
            color: item.color || null
        }, { onConflict: 'user_id,product_id' })
        .select()
        .single();

    if (error) console.error('Error adding to cart DB:', error);
    return data;
}

export async function updateCartQtyDB(userId, productId, qty) {
    if (!userId) return null;

    if (qty <= 0) return removeFromCartDB(userId, productId);

    const { data, error } = await supabase
        .from('cart_items')
        .update({ quantity: qty })
        .eq('user_id', userId)
        .eq('product_id', productId)
        .select()
        .single();

    if (error) console.error('Error updating cart DB:', error);
    return data;
}

export async function removeFromCartDB(userId, productId) {
    if (!userId) return true;

    const { error } = await supabase
        .from('cart_items')
        .delete()
        .eq('user_id', userId)
        .eq('product_id', productId);

    if (error) {
        console.error('Error removing from cart DB:', error);
        return false;
    }
    return true;
}

export async function clearCartDB(userId) {
    if (!userId) return true;

    const { error } = await supabase
        .from('cart_items')
        .delete()
        .eq('user_id', userId);

    if (error) {
        console.error('Error clearing cart DB:', error);
        return false;
    }
    return true;
}
