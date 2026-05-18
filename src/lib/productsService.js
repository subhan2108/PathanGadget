import sql from './db';

// Format price helper
export const formatPrice = (price) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(price);

// Helper to map DB row to frontend product format
function mapProduct(row) {
  if (!row) return null;
  const colorsArray = typeof row.colors === 'string' ? JSON.parse(row.colors) : (row.colors || []);
  const detailsObj = typeof row.details === 'string' ? JSON.parse(row.details) : (row.details || {});
  
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    category: row.category,
    brand: row.brand,
    price: parseFloat(row.price || 0),
    originalPrice: row.original_price ? parseFloat(row.original_price) : undefined,
    original_price: row.original_price ? parseFloat(row.original_price) : undefined,
    image: row.image_url,
    image_url: row.image_url,
    badge: row.badge,
    inStock: row.in_stock,
    in_stock: row.in_stock,
    rating: parseFloat(row.rating || 0),
    review_count: parseInt(row.review_count || 0),
    reviews: parseInt(row.review_count || 0),
    colors: colorsArray,
    connectivity: detailsObj.connectivity || '',
    specs: detailsObj.specs || {},
    details: detailsObj
  };
}

export async function fetchProducts(filters = {}, sortBy = 'featured') {
  try {
    let query = 'SELECT * FROM products WHERE 1=1';
    const params = [];

    if (filters.category && filters.category !== 'All') {
      params.push(filters.category.toLowerCase());
      query += ` AND LOWER(category) = $${params.length}`;
    }

    if (filters.brand && filters.brand !== 'All') {
      params.push(filters.brand);
      query += ` AND brand = $${params.length}`;
    }

    if (filters.minPrice !== undefined) {
      params.push(filters.minPrice);
      query += ` AND price >= $${params.length}`;
    }

    if (filters.maxPrice !== undefined) {
      params.push(filters.maxPrice);
      query += ` AND price <= $${params.length}`;
    }

    if (filters.inStock === true) {
      query += ` AND in_stock = TRUE`;
    }

    if (filters.search) {
      params.push(`%${filters.search.toLowerCase()}%`);
      query += ` AND (LOWER(name) LIKE $${params.length} OR LOWER(description) LIKE $${params.length})`;
    }

    // Sort By
    if (sortBy === 'price-asc') {
      query += ' ORDER BY price ASC';
    } else if (sortBy === 'price-desc') {
      query += ' ORDER BY price DESC';
    } else if (sortBy === 'rating') {
      query += ' ORDER BY rating DESC';
    } else {
      query += ' ORDER BY id ASC';
    }

    const rows = await sql.query(query, params);
    return rows.map(mapProduct);
  } catch (err) {
    console.error('Error fetching products from Neon:', err);
    return [];
  }
}

export async function fetchFilterMeta() {
  try {
    const brandsRow = await sql`SELECT DISTINCT brand FROM products WHERE brand IS NOT NULL`;
    const priceRow = await sql`SELECT MIN(price) as min_p, MAX(price) as max_p FROM products`;
    
    const brands = ['All', ...brandsRow.map(b => b.brand)];
    const minPrice = parseFloat(priceRow[0]?.min_p || 0);
    const maxPrice = parseFloat(priceRow[0]?.max_p || 100000);
    
    return {
      brands,
      colors: [],
      minPrice,
      maxPrice,
    };
  } catch (err) {
    console.error('Error fetching filter meta:', err);
    return {
      brands: ['All'],
      colors: [],
      minPrice: 0,
      maxPrice: 60000,
    };
  }
}

export async function fetchCategories() {
  try {
    const counts = await sql`SELECT category, COUNT(*) as c FROM products GROUP BY category`;
    
    const categoryMap = {
      watches: {
        name: 'Smart Watches',
        description: 'Track your health and stay connected',
        icon: '⌚',
        color: '#0077FF',
        image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&h=400&fit=crop',
      },
      airpods: {
        name: 'AirPods & Earbuds',
        description: 'Immersive sound, total freedom',
        icon: '🎧',
        color: '#2EA8FF',
        image: 'https://images.unsplash.com/photo-1606220588913-b3aacb4d2f46?w=600&h=400&fit=crop',
      },
      headphones: {
        name: 'Headphones',
        description: 'Professional studio-grade audio',
        icon: '🎵',
        color: '#6C5CE7',
        image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&h=400&fit=crop',
      }
    };
    
    return counts.map(row => {
      const cat = row.category;
      const meta = categoryMap[cat] || {
        name: cat.toUpperCase(),
        description: `Explore our ${cat} collection`,
        icon: '📦',
        color: '#2EA8FF',
        image: 'https://via.placeholder.com/600x400'
      };
      
      return {
        id: cat,
        ...meta,
        count: parseInt(row.c || 0)
      };
    });
  } catch (err) {
    console.error('Error fetching categories from Neon:', err);
    return [];
  }
}

export async function fetchProductById(id) {
  try {
    const intId = parseInt(id);
    if (isNaN(intId)) {
      throw new Error('Invalid product ID');
    }
    
    const rows = await sql`SELECT * FROM products WHERE id = ${intId}`;
    if (rows.length === 0) {
      throw new Error(`Product with ID ${id} not found`);
    }
    
    const product = mapProduct(rows[0]);
    
    return {
      ...product,
      product_images: [{ id: 1, image_url: product.image_url }],
      highlights: [
        'Free delivery in 2 days',
        '1-Year Brand Warranty',
        '7-Day Easy Returns',
        '100% Genuine Product'
      ],
      longDescription: product.description,
      variants: product.colors.map((c, index) => ({ id: `${product.id}-${index}`, title: c, availableForSale: product.inStock }))
    };
  } catch (err) {
    console.error('Error fetching product by ID from Neon:', err);
    throw err;
  }
}

export async function fetchSimilarProducts(category, excludeId) {
  try {
    const intExcludeId = parseInt(excludeId);
    let rows;
    if (!isNaN(intExcludeId)) {
      rows = await sql`
        SELECT * FROM products 
        WHERE LOWER(category) = LOWER(${category}) AND id != ${intExcludeId}
        LIMIT 4
      `;
    } else {
      rows = await sql`
        SELECT * FROM products 
        WHERE LOWER(category) = LOWER(${category})
        LIMIT 4
      `;
    }
    return rows.map(mapProduct);
  } catch (err) {
    console.error('Error fetching similar products:', err);
    return [];
  }
}

export async function fetchReviews(productId) {
  try {
    const rows = await sql`
      SELECT * FROM reviews 
      WHERE product_id = ${productId.toString()}
      ORDER BY created_at DESC
    `;
    return rows;
  } catch (err) {
    console.error('Error fetching reviews:', err);
    return [];
  }
}

export async function submitReview(review) {
  try {
    await sql`
      INSERT INTO reviews (product_id, user_id, rating, title, body)
      VALUES (${review.productId.toString()}, ${review.userId}, ${review.rating}, ${review.title}, ${review.body})
    `;
    return { success: true };
  } catch (err) {
    console.error('Error submitting review:', err);
    throw err;
  }
}
