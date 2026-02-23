import { supabase } from './supabaseClient'

/* ── Products Admin ── */

export async function adminGetProducts() {
    const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false })
    if (error) throw error
    return data
}

export async function adminCreateProduct(productData) {
    const { data, error } = await supabase.from('products').insert([productData]).select().single()
    if (error) throw error
    return data
}

export async function adminUpdateProduct(id, updates) {
    const { data, error } = await supabase.from('products').update(updates).eq('id', id).select().single()
    if (error) throw error
    return data
}

export async function adminDeleteProduct(id) {
    const { error } = await supabase.from('products').delete().eq('id', id)
    if (error) throw error
}

/* ── Orders & Tracking Admin ── */

export async function adminGetOrders() {
    const { data, error } = await supabase
        .from('orders')
        .select(`
            id, order_number, status, total, created_at,
            profiles(full_name)
        `)
        .order('created_at', { ascending: false })
    if (error) throw error
    return data
}

export async function adminGetOrderDetails(id) {
    const { data: order, error } = await supabase
        .from('orders')
        .select('*, order_items(*), addresses(*), profiles(full_name, phone)')
        .eq('id', id)
        .single()
    if (error) throw error

    const { data: tracking } = await supabase
        .from('order_tracking')
        .select('*')
        .eq('order_id', order.id)
        .order('timestamp', { ascending: true })

    order.order_tracking = tracking || []
    return order
}

export async function adminUpdateOrderStatus(id, status) {
    const { data, error } = await supabase.from('orders').update({ status }).eq('id', id).select().single()
    if (error) throw error
    return data
}

export async function adminAddTrackingStep(trackingData) {
    // Optionally remove 'is_current' from others
    if (trackingData.is_current) {
        await supabase.from('order_tracking').update({ is_current: false }).eq('order_id', trackingData.order_id)
    }
    const { data, error } = await supabase.from('order_tracking').insert([trackingData]).select().single()
    if (error) throw error
    return data
}
