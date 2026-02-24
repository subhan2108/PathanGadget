import { supabase } from './supabaseClient';
import { categories, formatPrice as mockFormatPrice } from '../data/mockData';

export const formatPrice = mockFormatPrice;

export async function fetchProducts(filters = {}, sortBy = 'featured') {
    let query = supabase.from('products').select('*');

    if (filters.category) {
        query = query.eq('category', filters.category);
    }

    if (filters.search) {
        query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
    }

    if (filters.colors && filters.colors.length > 0) {
        query = query.contains('colors', filters.colors);
    }

    if (filters.brands && filters.brands.length > 0) {
        query = query.in('brand', filters.brands);
    }

    if (filters.priceRange) {
        query = query.gte('price', filters.priceRange[0]).lte('price', filters.priceRange[1]);
    }

    if (filters.minRating > 0) {
        query = query.gte('rating', filters.minRating);
    }

    if (filters.inStockOnly) {
        query = query.eq('in_stock', true);
    }

    // Sort logic
    if (sortBy === 'price-asc') query = query.order('price', { ascending: true });
    else if (sortBy === 'price-desc') query = query.order('price', { ascending: false });
    else if (sortBy === 'rating') query = query.order('rating', { ascending: false });
    else if (sortBy === 'reviews') query = query.order('review_count', { ascending: false });
    else if (sortBy === 'discount') {
        // Since we don't have a computed column for discount, fallback to rating for now, or just default.
        query = query.order('rating', { ascending: false });
    }
    else query = query.order('rating', { ascending: false }); // featured fallback

    const { data, error } = await query;
    if (error) throw error;
    return data;
}

export async function fetchFilterMeta() {
    const { data: products, error } = await supabase.from('products').select('brand, colors, price');
    if (error || !products) return { brands: [], colors: [], minPrice: 0, maxPrice: 60000 };

    const brands = new Set();
    const colors = new Set();
    let minPrice = Infinity;
    let maxPrice = 0;

    products.forEach(p => {
        if (p.brand) brands.add(p.brand);
        if (p.colors && Array.isArray(p.colors)) {
            p.colors.forEach(c => colors.add(c));
        }
        if (p.price < minPrice) minPrice = p.price;
        if (p.price > maxPrice) maxPrice = p.price;
    });

    return {
        brands: Array.from(brands),
        colors: Array.from(colors),
        minPrice: minPrice === Infinity ? 0 : minPrice,
        maxPrice: maxPrice === 0 ? 60000 : maxPrice,
    };
}

export async function fetchCategories() {
    // Determine category counts dynamically from DB
    const { data, error } = await supabase.from('products').select('category');
    if (error) return categories; // Fallback to mocks if error

    // Group counts
    const counts = {};
    data.forEach(p => {
        if (p.category) counts[p.category] = (counts[p.category] || 0) + 1;
    });

    const categoryMeta = {
        'watches': { name: 'Smart Watches', description: 'Track your health and stay connected', icon: '⌚', color: '#0077FF', image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&h=400&fit=crop' },
        'airpods': { name: 'AirPods & Earbuds', description: 'Immersive sound, total freedom', icon: '🎧', color: '#2EA8FF', image: 'https://images.unsplash.com/photo-1606220588913-b3aacb4d2f46?w=600&h=400&fit=crop' },
        'headphones': { name: 'Headphones', description: 'Professional studio-grade audio', icon: '🎵', color: '#6C5CE7', image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&h=400&fit=crop' },
        'smartphones': { name: 'Smartphones', description: 'Latest flagship mobile devices', icon: '📱', color: '#00B894', image: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=600&h=400&fit=crop' },
    };

    return Object.keys(counts).map(id => ({
        id,
        count: counts[id],
        ...(categoryMeta[id] || {
            name: id.charAt(0).toUpperCase() + id.slice(1),
            description: `Explore our ${id} collection`,
            icon: '📦',
            color: '#888',
            image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&h=400&fit=crop'
        })
    }));
}

export async function fetchProductById(id) {
    const { data: product, error } = await supabase
        .from('products')
        .select('*, product_images(*)')
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
