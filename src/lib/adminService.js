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
        await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_quantity INTEGER DEFAULT 5`;
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
                in_stock: r.in_stock !== false,
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
        const inStockVal = p.in_stock !== false;
        const stockQty = inStockVal ? 9999 : 0;
        const detailsWithSku = {
            ...(p.details || {}),
            sku: skuVal,
            subcategory: subcatVal
        };

        const [prod] = await sql`
            INSERT INTO products (
                name, sku, price, original_price, category, subcategory, brand, 
                description, image_url, badge, in_stock, stock_quantity,
                rating, review_count, colors, details
            ) VALUES (
                ${p.name}, ${skuVal}, ${p.price}, ${p.original_price || 0}, ${p.category}, ${subcatVal}, ${p.brand || ''},
                ${p.description || ''}, ${p.image_url}, ${p.badge || ''}, ${inStockVal}, ${stockQty},
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
        const inStockVal = p.in_stock !== false;
        const stockQty = inStockVal ? 9999 : 0;
        const detailsWithSku = {
            ...(p.details || {}),
            sku: skuVal,
            subcategory: subcatVal
        };

        const [prod] = await sql`
            UPDATE products SET
                name = ${p.name}, sku = ${skuVal}, price = ${p.price}, original_price = ${p.original_price || 0},
                category = ${p.category}, subcategory = ${subcatVal}, brand = ${p.brand || ''}, description = ${p.description || ''},
                image_url = ${p.image_url}, badge = ${p.badge || ''}, in_stock = ${inStockVal}, stock_quantity = ${stockQty},
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

export async function adminBulkUpdateCategory(productIds, newCategory) {
    try {
        await ensureSchema();
        if (!Array.isArray(productIds) || productIds.length === 0) {
            throw new Error('No products selected.');
        }
        const trimmedCat = (newCategory || '').trim();
        if (!trimmedCat) {
            throw new Error('Please select or enter a category name.');
        }
        const numIds = productIds.map(Number).filter(n => !isNaN(n));

        const result = await sql`
            UPDATE products
            SET category = ${trimmedCat}
            WHERE id = ANY(${numIds})
            RETURNING id
        `;
        return { success: true, count: result.length };
    } catch (err) {
        console.error('Error bulk updating category:', err);
        throw err;
    }
}

export async function adminBulkUpdateCategoryAndSubcategory(productIds, { category, subcategory } = {}) {
    try {
        await ensureSchema();
        if (!Array.isArray(productIds) || productIds.length === 0) {
            throw new Error('No products selected.');
        }
        const numIds = productIds.map(Number).filter(n => !isNaN(n));
        const trimmedCat = category !== undefined ? (category || '').trim() : null;
        const trimmedSubcat = subcategory !== undefined ? (subcategory || '').trim() : null;

        if (!trimmedCat && !trimmedSubcat) {
            throw new Error('Please enter a Category or Subcategory to assign.');
        }

        let result;
        if (trimmedCat && trimmedSubcat) {
            result = await sql`
                UPDATE products
                SET category = ${trimmedCat}, subcategory = ${trimmedSubcat}
                WHERE id = ANY(${numIds})
                RETURNING id
            `;
        } else if (trimmedCat) {
            result = await sql`
                UPDATE products
                SET category = ${trimmedCat}
                WHERE id = ANY(${numIds})
                RETURNING id
            `;
        } else {
            result = await sql`
                UPDATE products
                SET subcategory = ${trimmedSubcat}
                WHERE id = ANY(${numIds})
                RETURNING id
            `;
        }
        return { success: true, count: result.length };
    } catch (err) {
        console.error('Error bulk updating category & subcategory:', err);
        throw err;
    }
}

export async function adminGetOrders() {
    try {
        return await sql`SELECT * FROM orders ORDER BY created_at DESC`;
    } catch (err) {
        console.error('Error fetching admin orders:', err);
        return [];
    }
}

export async function adminApprovePayment(orderId) {
    try {
        await sql`
            UPDATE orders 
            SET status = 'processing' 
            WHERE id = ${orderId}
        `;
        await sql`UPDATE order_tracking SET is_current = false WHERE order_id = ${orderId}`;
        await sql`
            INSERT INTO order_tracking (order_id, label, description, status, is_current, timestamp)
            VALUES (${orderId}, ${'Payment Verified'}, ${'UPI Payment received and verified by store admin.'}, ${'processing'}, true, NOW())
        `;
        return { success: true };
    } catch (err) {
        console.error('Error approving payment:', err);
        throw err;
    }
}

export async function adminDispatchOrder(orderId, { courier_name, tracking_number }) {
    try {
        const courier = (courier_name || 'DTDC').trim();
        const tracking = (tracking_number || '').trim();

        await sql`
            UPDATE orders 
            SET status = 'dispatched',
                courier_name = ${courier},
                tracking_number = ${tracking},
                dispatched_at = NOW()
            WHERE id = ${orderId}
        `;
        await sql`UPDATE order_tracking SET is_current = false WHERE order_id = ${orderId}`;
        await sql`
            INSERT INTO order_tracking (order_id, label, description, status, is_current, timestamp)
            VALUES (
                ${orderId}, 
                ${'Dispatched via ' + courier}, 
                ${tracking ? 'Consignment No: ' + tracking : 'Package handed over to courier.'}, 
                ${'dispatched'}, 
                true, 
                NOW()
            )
        `;
        return { success: true };
    } catch (err) {
        console.error('Error dispatching order:', err);
        throw err;
    }
}

export async function adminMarkDelivered(orderId) {
    try {
        await sql`
            UPDATE orders 
            SET status = 'delivered'
            WHERE id = ${orderId}
        `;
        await sql`UPDATE order_tracking SET is_current = false WHERE order_id = ${orderId}`;
        await sql`
            INSERT INTO order_tracking (order_id, label, description, status, is_current, timestamp)
            VALUES (${orderId}, ${'Delivered'}, ${'Package successfully delivered to customer.'}, ${'delivered'}, true, NOW())
        `;
        return { success: true };
    } catch (err) {
        console.error('Error marking delivered:', err);
        throw err;
    }
}

export async function adminExportToVyapar(orderIds) {
    try {
        let ordersQuery;
        if (Array.isArray(orderIds) && orderIds.length > 0) {
            const numIds = orderIds.map(Number).filter(n => !isNaN(n));
            ordersQuery = await sql`SELECT * FROM orders WHERE id = ANY(${numIds}) ORDER BY created_at DESC`;
        } else {
            ordersQuery = await sql`SELECT * FROM orders WHERE is_exported_to_vyapar = false OR is_exported_to_vyapar IS NULL ORDER BY created_at DESC`;
        }

        if (ordersQuery.length === 0) {
            return { rows: [], count: 0, csvContent: '' };
        }

        const ids = ordersQuery.map(o => o.id);
        const allItems = await sql`SELECT * FROM order_items WHERE order_id = ANY(${ids})`;

        // Build flat array matching Vyapar's Sales Invoice Import format
        const vyaparRows = [];
        for (const order of ordersQuery) {
            const ship = typeof order.shipping_address === 'string' ? JSON.parse(order.shipping_address) : (order.shipping_address || {});
            const customerName = order.customer_shop_name || ship.shopName || ship.name || `${ship.firstName || ''} ${ship.lastName || ''}`.trim() || 'Direct Customer';
            const customerPhone = order.customer_phone || ship.phone || '';
            const fullAddress = order.customer_address || ship.address || '';
            const city = order.customer_city || ship.city || '';
            const state = order.customer_state || ship.state || '';
            const pincode = order.customer_pincode || ship.pincode || '';
            const orderDate = new Date(order.created_at).toLocaleDateString('en-GB'); // DD/MM/YYYY
            const items = allItems.filter(i => i.order_id === order.id);

            if (items.length === 0) {
                vyaparRows.push({
                    'Invoice Date': orderDate,
                    'Invoice Number': order.order_number,
                    'Party Name': customerName,
                    'Phone Number': customerPhone,
                    'Item Name': 'Automotive Key / Blank',
                    'Item SKU': 'MISC',
                    'Quantity': 1,
                    'Unit': 'PCS',
                    'Sale Price': order.total,
                    'Total Amount': order.total,
                    'Payment Type': order.payment_method || 'UPI',
                    'Payment Reference / UTR': order.utr_number || '',
                    'Shipping Address': `${fullAddress}, ${city}, ${state} ${pincode}`.trim(),
                    'City': city,
                    'State': state,
                    'Pincode': pincode
                });
            } else {
                for (const it of items) {
                    vyaparRows.push({
                        'Invoice Date': orderDate,
                        'Invoice Number': order.order_number,
                        'Party Name': customerName,
                        'Phone Number': customerPhone,
                        'Item Name': it.name,
                        'Item SKU': it.sku || `PROD-${it.product_id}`,
                        'Quantity': it.quantity,
                        'Unit': 'PCS',
                        'Sale Price': it.price,
                        'Total Amount': Number(it.price) * Number(it.quantity),
                        'Payment Type': order.payment_method || 'UPI',
                        'Payment Reference / UTR': order.utr_number || '',
                        'Shipping Address': `${fullAddress}, ${city}, ${state} ${pincode}`.trim(),
                        'City': city,
                        'State': state,
                        'Pincode': pincode
                    });
                }
            }
        }

        // Generate CSV content
        if (vyaparRows.length > 0) {
            const headers = Object.keys(vyaparRows[0]);
            const csvLines = [
                headers.map(h => `"${h.replace(/"/g, '""')}"`).join(',')
            ];
            for (const r of vyaparRows) {
                const line = headers.map(h => {
                    const val = r[h] !== undefined && r[h] !== null ? String(r[h]) : '';
                    return `"${val.replace(/"/g, '""')}"`;
                }).join(',');
                csvLines.push(line);
            }
            const csvContent = csvLines.join('\r\n');

            // Mark as exported in database
            await sql`
                UPDATE orders 
                SET is_exported_to_vyapar = true 
                WHERE id = ANY(${ids})
            `;

            return { rows: vyaparRows, count: ordersQuery.length, csvContent };
        }

        return { rows: [], count: 0, csvContent: '' };
    } catch (err) {
        console.error('Error preparing Vyapar export:', err);
        throw err;
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
