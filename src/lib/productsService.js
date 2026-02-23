import { supabase } from './supabaseClient';
import { categories, formatPrice as mockFormatPrice } from '../data/mockData';

export const formatPrice = mockFormatPrice;

export async function fetchProducts(filters = {}, sortBy = 'featured') {
    let query = supabase.from('products').select('*');

    if (filters.category) {
        query = query.eq('category', filters.category);
    }

    // Sort logic
    if (sortBy === 'price_asc') query = query.order('price', { ascending: true });
    else if (sortBy === 'price_desc') query = query.order('price', { ascending: false });
    else query = query.order('rating', { ascending: false }); // featured fallback

    const { data, error } = await query;
    if (error) throw error;
    return data;
}

export async function fetchFilterMeta() {
    return {
        brands: ['TechBrand', 'AirBuds', 'SoundPeak', 'BassMax', 'Quantum'],
        colors: ['Black', 'White', 'Blue', 'Silver', 'Red', 'Pink', 'Green', 'Midnight', 'Starlight'],
        minPrice: 0,
        maxPrice: 60000
    };
}

export async function fetchCategories() {
    return categories;
}

export async function fetchProductById(id) {
    const { data: product, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .single();

    if (error || !product) throw new Error('Product not found: ' + (error?.message || ''));

    // Parse jsonb details from db schema
    const productData = { ...product };
    if (productData.details) {
        productData.longDescription = productData.details.long_description || productData.description;
        productData.highlights = productData.details.highlights || [];
        productData.specs = productData.details.specifications || {};
    }

    return productData;
}

export async function fetchSimilarProducts(category, excludeId) {
    const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('category', category)
        .neq('id', excludeId)
        .limit(4);

    if (error) throw error;
    return data;
}

export async function fetchReviews(productId) {
    const { data, error } = await supabase
        .from('reviews')
        .select(`
            id,
            rating,
            title,
            body,
            verified,
            helpful,
            created_at,
            user_id,
            profiles (full_name, avatar_url)
        `)
        .eq('product_id', productId)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
}

export async function submitReview({ productId, userId, rating, title, body }) {
    const { data, error } = await supabase
        .from('reviews')
        .insert([{
            product_id: productId,
            user_id: userId,
            rating,
            title,
            body
        }]);

    if (error) throw error;
    return { success: true, message: 'Review submitted successfully', data };
}
