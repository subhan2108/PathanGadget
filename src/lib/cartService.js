import sql from './db';

/**
 * Cart Service (Neon Postgres Implementation)
 * Stores cart items with metadata to avoid unnecessary Shopify API calls.
 */

export async function fetchCart(userId) {
    if (!userId) return [];
    try {
        const rows = await sql`
            SELECT c.*, p.sku as product_sku, p.category as product_category 
            FROM cart_items c
            LEFT JOIN products p ON c.product_id::text = p.id::text
            WHERE c.user_id = ${userId}
            ORDER BY c.created_at DESC
        `;
        return rows.map(r => {
            const fallbackSku = r.product_category 
                ? `SMN-${r.product_category.substring(0, 3).toUpperCase()}-${String(r.product_id).padStart(4, '0')}`
                : `SMN-${r.product_id}`;
            return {
                ...r, 
                id: r.product_id, // Map product_id back to id for the frontend
                sku: r.product_sku || fallbackSku,
                variantId: r.variant_id, 
                image: r.image_url 
            };
        });
    } catch (err) {
        console.error('Error fetching cart:', err);
        return [];
    }
}

export async function addToCartDB(userId, item) {
    if (!userId) return false;
    try {
        await sql`
            INSERT INTO cart_items (user_id, product_id, variant_id, name, price, image_url, quantity, color)
            VALUES (
                ${userId}, 
                ${item.id}, 
                ${item.variantId || null},
                ${item.name},
                ${item.price},
                ${item.image_url || item.image},
                ${item.quantity || 1}, 
                ${item.color || null}
            )
            ON CONFLICT (user_id, product_id) 
            DO UPDATE SET 
                quantity = cart_items.quantity + EXCLUDED.quantity,
                variant_id = EXCLUDED.variant_id,
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
