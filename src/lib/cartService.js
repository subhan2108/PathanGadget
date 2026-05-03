import sql from './db';

/**
 * Cart Service (Neon Postgres Implementation)
 * Stores cart items with metadata to avoid unnecessary Shopify API calls.
 */

export async function fetchCart(userId) {
    if (!userId) return [];
    try {
        const rows = await sql`
            SELECT * FROM cart_items 
            WHERE user_id = ${userId}
            ORDER BY created_at DESC
        `;
        return rows.map(r => ({ ...r, image: r.image_url }));
    } catch (err) {
        console.error('Error fetching cart:', err);
        return [];
    }
}

export async function addToCartDB(userId, item) {
    if (!userId) return false;
    try {
        // We store the Shopify GID as product_id
        await sql`
            INSERT INTO cart_items (user_id, product_id, quantity, color, name, price, image_url)
            VALUES (
                ${userId}, 
                ${item.id}, 
                ${item.quantity || 1}, 
                ${item.color || null},
                ${item.name},
                ${item.price},
                ${item.image_url || item.image}
            )
            ON CONFLICT (user_id, product_id) 
            DO UPDATE SET 
                quantity = cart_items.quantity + EXCLUDED.quantity,
                color = EXCLUDED.color
        `;
        return true;
    } catch (err) {
        console.error('Error adding to cart:', err);
        return false;
    }
}

export async function updateCartQtyDB(userId, productId, qty) {
    if (!userId) return false;
    try {
        await sql`
            UPDATE cart_items 
            SET quantity = ${qty}
            WHERE user_id = ${userId} AND product_id = ${productId}
        `;
        return true;
    } catch (err) {
        console.error('Error updating cart qty:', err);
        return false;
    }
}

export async function removeFromCartDB(userId, productId) {
    if (!userId) return false;
    try {
        await sql`
            DELETE FROM cart_items 
            WHERE user_id = ${userId} AND product_id = ${productId}
        `;
        return true;
    } catch (err) {
        console.error('Error removing from cart:', err);
        return false;
    }
}

export async function clearCartDB(userId) {
    if (!userId) return false;
    try {
        await sql`
            DELETE FROM cart_items 
            WHERE user_id = ${userId}
        `;
        return true;
    } catch (err) {
        console.error('Error clearing cart:', err);
        return false;
    }
}
