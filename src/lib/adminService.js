/**
 * Admin Service (Mock)
 * Supabase logic has been removed.
 */

export async function adminGetProducts() {
    return [];
}

export async function adminCreateProduct(productData) {
    return { success: true, data: productData };
}

export async function adminUpdateProduct(id, productData) {
    return { success: true, data: productData };
}

export async function adminDeleteProduct(id) {
    return { success: true };
}

export async function adminGetOrders() {
    return [];
}

export async function adminGetOrderDetails(id) {
    return null;
}

export async function adminUpdateOrderStatus(orderId, status) {
    return { success: true };
}

export async function adminAddTrackingStep(trackingData) {
    return { success: true, data: trackingData };
}

// Keeping these for backward compatibility if needed
export async function fetchAllOrders() {
    return [];
}

export async function updateOrderStatus(orderId, status) {
    return { success: true };
}

export async function fetchStats() {
    return {
        totalSales: 0,
        orderCount: 0,
        customerCount: 0,
        recentOrders: []
    };
}
