import sql from './db';

// Format price helper
export const formatPrice = (price) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(price);

// Helper to sanitize & route image URLs through high-speed CDN to bypass origin anti-hotlinking
export function formatImageUrl(url) {
  if (!url || typeof url !== 'string') return '/placeholder-key.svg';
  const trimmed = url.trim();
  if (!trimmed) return '/placeholder-key.svg';
  if (trimmed.startsWith('https://rkkeys.co.in/')) {
    return trimmed.replace('https://rkkeys.co.in/', 'https://i0.wp.com/rkkeys.co.in/');
  }
  if (trimmed.startsWith('http://rkkeys.co.in/')) {
    return trimmed.replace('http://rkkeys.co.in/', 'https://i0.wp.com/rkkeys.co.in/');
  }
  return trimmed;
}

// Helper to map DB row to frontend product format
function mapProduct(row) {
  if (!row) return null;
  const colorsArray = typeof row.colors === 'string' ? JSON.parse(row.colors) : (row.colors || []);
  const detailsObj = typeof row.details === 'string' ? JSON.parse(row.details) : (row.details || {});
  const skuCode = row.sku || detailsObj.sku || (row.id ? `SMN-${(row.category || 'GEN').substring(0, 3).toUpperCase()}-${String(row.id).padStart(4, '0')}` : '');
  const formattedImageUrl = formatImageUrl(row.image_url);

  if (Array.isArray(detailsObj.images)) {
    detailsObj.images = detailsObj.images.map(formatImageUrl);
  }
  if (Array.isArray(detailsObj.extraImages)) {
    detailsObj.extraImages = detailsObj.extraImages.map(formatImageUrl);
  }

  return {
    id: row.id,
    sku: skuCode,
    name: row.name,
    description: row.description,
    category: row.category,
    subcategory: row.subcategory || detailsObj.subcategory || '',
    brand: row.brand,
    price: parseFloat(row.price || 0),
    originalPrice: row.original_price ? parseFloat(row.original_price) : undefined,
    original_price: row.original_price ? parseFloat(row.original_price) : undefined,
    image: formattedImageUrl,
    image_url: formattedImageUrl,
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

    // Category Filter
    if (filters.category && filters.category !== 'all' && filters.category !== 'All') {
      const catVal = filters.category.trim().toLowerCase();
      params.push(catVal);
      query += ` AND (
        LOWER(category) = $${params.length} 
        OR LOWER(REPLACE(category, ' ', '-')) = $${params.length}
        OR LOWER(REPLACE(category, '-', ' ')) = $${params.length}
      )`;
    }

    // Subcategories Filter (supports array of subcategories or single subcategory)
    const selectedSubcats = Array.isArray(filters.subcategories) && filters.subcategories.length > 0
      ? filters.subcategories.filter(s => s && s !== 'All')
      : (filters.subcategory && filters.subcategory !== 'All' ? [filters.subcategory] : []);

    if (selectedSubcats.length > 0) {
      params.push(selectedSubcats);
      query += ` AND subcategory = ANY($${params.length})`;
    }

    // Brands Filter (supports array of brands or single brand)
    const selectedBrands = Array.isArray(filters.brands) && filters.brands.length > 0
      ? filters.brands.filter(b => b && b !== 'All')
      : (filters.brand && filters.brand !== 'All' ? [filters.brand] : []);

    if (selectedBrands.length > 0) {
      params.push(selectedBrands);
      query += ` AND brand = ANY($${params.length})`;
    }

    // Price Range Filter (supports priceRange [min, max] or minPrice / maxPrice)
    let minP = filters.minPrice;
    let maxP = filters.maxPrice;
    if (Array.isArray(filters.priceRange) && filters.priceRange.length === 2) {
      minP = filters.priceRange[0];
      maxP = filters.priceRange[1];
    }

    if (minP !== undefined && minP !== null && !isNaN(minP)) {
      params.push(Number(minP));
      query += ` AND price >= $${params.length}`;
    }

    if (maxP !== undefined && maxP !== null && !isNaN(maxP)) {
      params.push(Number(maxP));
      query += ` AND price <= $${params.length}`;
    }

    // In Stock Only Filter
    if (filters.inStockOnly === true || filters.inStock === true) {
      query += ` AND in_stock = TRUE`;
    }

    // Minimum Rating Filter
    if (filters.minRating && Number(filters.minRating) > 0) {
      params.push(Number(filters.minRating));
      query += ` AND rating >= $${params.length}`;
    }

    // Color Filter (if colors array supplied)
    if (Array.isArray(filters.colors) && filters.colors.length > 0) {
      params.push(filters.colors);
      query += ` AND colors ?| $${params.length}`;
    }

    // Search Query
    if (filters.search && filters.search.trim()) {
      const term = `%${filters.search.trim().toLowerCase()}%`;
      params.push(term);
      query += ` AND (
        LOWER(name) LIKE $${params.length} 
        OR LOWER(description) LIKE $${params.length} 
        OR LOWER(brand) LIKE $${params.length} 
        OR LOWER(category) LIKE $${params.length} 
        OR LOWER(COALESCE(subcategory, '')) LIKE $${params.length} 
        OR LOWER(sku) LIKE $${params.length}
      )`;
    }

    // Sort By
    if (sortBy === 'price-asc') {
      query += ' ORDER BY price ASC, id ASC';
    } else if (sortBy === 'price-desc') {
      query += ' ORDER BY price DESC, id ASC';
    } else if (sortBy === 'rating') {
      query += ' ORDER BY rating DESC, review_count DESC, id ASC';
    } else if (sortBy === 'reviews') {
      query += ' ORDER BY review_count DESC, rating DESC, id ASC';
    } else if (sortBy === 'discount') {
      query += ' ORDER BY (COALESCE(original_price, price) - price) DESC, id ASC';
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
    const brandsRow = await sql`SELECT DISTINCT brand FROM products WHERE brand IS NOT NULL AND brand != '' ORDER BY brand ASC`;
    const subcatsRow = await sql`SELECT DISTINCT category, subcategory FROM products WHERE subcategory IS NOT NULL AND subcategory != '' ORDER BY subcategory ASC`;
    const priceRow = await sql`SELECT MIN(price) as min_p, MAX(price) as max_p FROM products`;

    const brands = ['All', ...brandsRow.map(b => b.brand)];
    const subcategories = Array.from(new Set(subcatsRow.map(s => s.subcategory)));
    const subcategoriesByCategory = {};
    for (const row of subcatsRow) {
      if (!row.category) continue;
      const catKey = row.category.toLowerCase();
      if (!subcategoriesByCategory[catKey]) {
        subcategoriesByCategory[catKey] = [];
      }
      if (!subcategoriesByCategory[catKey].includes(row.subcategory)) {
        subcategoriesByCategory[catKey].push(row.subcategory);
      }
    }

    const minPrice = parseFloat(priceRow[0]?.min_p || 0);
    const maxPrice = parseFloat(priceRow[0]?.max_p || 100000);

    return {
      brands,
      subcategories,
      subcategoriesByCategory,
      colors: [],
      minPrice,
      maxPrice,
    };
  } catch (err) {
    console.error('Error fetching filter meta:', err);
    return {
      brands: ['All'],
      subcategories: [],
      subcategoriesByCategory: {},
      colors: [],
      minPrice: 0,
      maxPrice: 60000,
    };
  }
}

export async function fetchSubcategories(category) {
  try {
    if (category && category !== 'All' && category !== 'all') {
      const rows = await sql`
        SELECT DISTINCT subcategory FROM products 
        WHERE (
          LOWER(category) = LOWER(${category}) 
          OR LOWER(REPLACE(category, '-', ' ')) = LOWER(REPLACE(${category}, '-', ' '))
        )
        AND subcategory IS NOT NULL AND subcategory != ''
        ORDER BY subcategory ASC
      `;
      return rows.map(r => r.subcategory);
    }
    const rows = await sql`
      SELECT DISTINCT subcategory FROM products 
      WHERE subcategory IS NOT NULL AND subcategory != ''
      ORDER BY subcategory ASC
    `;
    return rows.map(r => r.subcategory);
  } catch (err) {
    console.error('Error fetching subcategories:', err);
    return [];
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
      },
      Remote: {
        name: 'Car Key Remotes',
        description: 'Universal smart remotes, key fobs & transponders',
        icon: '🔑',
        color: '#FF6B6B',
        image: 'https://qubakeys.com/uploads/course/3c4ce9e976a6a245a89abb2eac505e5b.png',
      },
      remote: {
        name: 'Car Key Remotes',
        description: 'Universal smart remotes, key fobs & transponders',
        icon: '🔑',
        color: '#FF6B6B',
        image: 'https://qubakeys.com/uploads/course/3c4ce9e976a6a245a89abb2eac505e5b.png',
      },
      'Remote Shell': {
        name: 'Remote Shells',
        description: 'Replacement car key shells, flip cases & remote housings',
        icon: '🗝️',
        color: '#FFA502',
        image: 'https://qubakeys.com/uploads/course/3bc259dec1804b89d415620b3272ea1f.jpg',
      },
      'remote shell': {
        name: 'Remote Shells',
        description: 'Replacement car key shells, flip cases & remote housings',
        icon: '🗝️',
        color: '#FFA502',
        image: 'https://qubakeys.com/uploads/course/3bc259dec1804b89d415620b3272ea1f.jpg',
      },
      'remote-shell': {
        name: 'Remote Shells',
        description: 'Replacement car key shells, flip cases & remote housings',
        icon: '🗝️',
        color: '#FFA502',
        image: 'https://qubakeys.com/uploads/course/3bc259dec1804b89d415620b3272ea1f.jpg',
      },
      'Xhorse Smart Key': {
        name: 'Xhorse Smart Key',
        description: 'Universal smart proximity car keys with Keyless-Go and XM38 support (XS-Series)',
        icon: '✨',
        color: '#9B59B6',
        image: 'https://www.xhorsekey.com/uploads/item/26090217883335467201.jpg',
      },
      'xhorse smart key': {
        name: 'Xhorse Smart Key',
        description: 'Universal smart proximity car keys with Keyless-Go and XM38 support (XS-Series)',
        icon: '✨',
        color: '#9B59B6',
        image: 'https://www.xhorsekey.com/uploads/item/26090217883335467201.jpg',
      },
      'xhorse-smart-key': {
        name: 'Xhorse Smart Key',
        description: 'Universal smart proximity car keys with Keyless-Go and XM38 support (XS-Series)',
        icon: '✨',
        color: '#9B59B6',
        image: 'https://www.xhorsekey.com/uploads/item/26090217883335467201.jpg',
      },
      'Xhorse Wireless Remote': {
        name: 'Xhorse Wireless Remote',
        description: 'Universal wireless car key remotes with built-in NXP transponder chip (XN-Series)',
        icon: '📶',
        color: '#20BF6B',
        image: 'https://www.xhorsekey.com/uploads/item/166680246457251403.jpg',
      },
      'xhorse wireless remote': {
        name: 'Xhorse Wireless Remote',
        description: 'Universal wireless car key remotes with built-in NXP transponder chip (XN-Series)',
        icon: '📶',
        color: '#20BF6B',
        image: 'https://www.xhorsekey.com/uploads/item/166680246457251403.jpg',
      },
      'xhorse-wireless-remote': {
        name: 'Xhorse Wireless Remote',
        description: 'Universal wireless car key remotes with built-in NXP transponder chip (XN-Series)',
        icon: '📶',
        color: '#20BF6B',
        image: 'https://www.xhorsekey.com/uploads/item/166680246457251403.jpg',
      },
      'Xhorse Wire Remote': {
        name: 'Xhorse Wire Remote',
        description: 'Universal programmable wired car key remotes (XK-Series)',
        icon: '🔑',
        color: '#E5B824',
        image: 'https://www.xhorsekey.com/uploads/item/166680208623513407.jpg',
      },
      'xhorse wire remote': {
        name: 'Xhorse Wire Remote',
        description: 'Universal programmable wired car key remotes (XK-Series)',
        icon: '🔑',
        color: '#E5B824',
        image: 'https://www.xhorsekey.com/uploads/item/166680208623513407.jpg',
      },
      'xhorse-wire-remote': {
        name: 'Xhorse Wire Remote',
        description: 'Universal programmable wired car key remotes (XK-Series)',
        icon: '🔑',
        color: '#E5B824',
        image: 'https://www.xhorsekey.com/uploads/item/166680208623513407.jpg',
      },
      'Xhorse Super Remote': {
        name: 'Xhorse Super Remote',
        description: 'Universal programmable remotes with built-in XT27A / XT57 Super Chip (XE-Series)',
        icon: '⚡',
        color: '#8854D0',
        image: 'https://www.xhorsekey.com/uploads/item/26081317866363822022.jpg',
      },
      'xhorse super remote': {
        name: 'Xhorse Super Remote',
        description: 'Universal programmable remotes with built-in XT27A / XT57 Super Chip (XE-Series)',
        icon: '⚡',
        color: '#8854D0',
        image: 'https://www.xhorsekey.com/uploads/item/26081317866363822022.jpg',
      },
      'xhorse-super-remote': {
        name: 'Xhorse Super Remote',
        description: 'Universal programmable remotes with built-in XT27A / XT57 Super Chip (XE-Series)',
        icon: '⚡',
        color: '#8854D0',
        image: 'https://www.xhorsekey.com/uploads/item/26081317866363822022.jpg',
      },
      'Car Remote': {
        name: 'Car Remote',
        description: 'OEM & replacement car remote transmitters, central locking fobs',
        icon: '🚗',
        color: '#E67E22',
        image: 'https://dukanindia.com/wp-content/uploads/2023/11/Nippon.webp',
      },
      'car remote': {
        name: 'Car Remote',
        description: 'OEM & replacement car remote transmitters, central locking fobs',
        icon: '🚗',
        color: '#E67E22',
        image: 'https://dukanindia.com/wp-content/uploads/2023/11/Nippon.webp',
      },
      'car-remote': {
        name: 'Car Remote',
        description: 'OEM & replacement car remote transmitters, central locking fobs',
        icon: '🚗',
        color: '#E67E22',
        image: 'https://dukanindia.com/wp-content/uploads/2023/11/Nippon.webp',
      },
      'Transponder Shell': {
        name: 'Transponder Shell',
        description: 'Transponder key shells, chip housings & replacement cases',
        icon: '🔑',
        color: '#E74C3C',
        image: 'https://qubakeys.com/uploads/course/6388aa2406a96311efc8cacc1ed325f8.png',
      },
      'transponder shell': {
        name: 'Transponder Shell',
        description: 'Transponder key shells, chip housings & replacement cases',
        icon: '🔑',
        color: '#E74C3C',
        image: 'https://qubakeys.com/uploads/course/6388aa2406a96311efc8cacc1ed325f8.png',
      },
      'transponder-shell': {
        name: 'Transponder Shell',
        description: 'Transponder key shells, chip housings & replacement cases',
        icon: '🔑',
        color: '#E74C3C',
        image: 'https://qubakeys.com/uploads/course/6388aa2406a96311efc8cacc1ed325f8.png',
      },
      'ID Chip': {
        name: 'ID Chip',
        description: 'Automotive transponder chips, glass & ceramic immobilizer ICs',
        icon: '💾',
        color: '#10B981',
        image: 'https://d35dnv3xp3it3x.cloudfront.net/media/catalog/product/x/mz/xmz9j6gnp6o91yw1531636291.jpg',
      },
      'id chip': {
        name: 'ID Chip',
        description: 'Automotive transponder chips, glass & ceramic immobilizer ICs',
        icon: '💾',
        color: '#10B981',
        image: 'https://d35dnv3xp3it3x.cloudfront.net/media/catalog/product/x/mz/xmz9j6gnp6o91yw1531636291.jpg',
      },
      'id-chip': {
        name: 'ID Chip',
        description: 'Automotive transponder chips, glass & ceramic immobilizer ICs',
        icon: '💾',
        color: '#10B981',
        image: 'https://d35dnv3xp3it3x.cloudfront.net/media/catalog/product/x/mz/xmz9j6gnp6o91yw1531636291.jpg',
      },
      'KEYDIY UNIVERSAL REMOTE': {
        name: 'Keydiy Universal Remote',
        description: 'Multi-frequency programmable car keys, B-Series & NB-Series remotes',
        icon: '📟',
        color: '#0984E3',
        image: 'https://5.imimg.com/data5/SELLER/Default/2024/11/468326697/VN/QU/PL/186187450/b14-3-1-universal-keydiy-flip-remote-500x500.png',
      },
      'keydiy universal remote': {
        name: 'Keydiy Universal Remote',
        description: 'Multi-frequency programmable car keys, B-Series & NB-Series remotes',
        icon: '📟',
        color: '#0984E3',
        image: 'https://5.imimg.com/data5/SELLER/Default/2024/11/468326697/VN/QU/PL/186187450/b14-3-1-universal-keydiy-flip-remote-500x500.png',
      },
      'keydiy-universal-remote': {
        name: 'Keydiy Universal Remote',
        description: 'Multi-frequency programmable car keys, B-Series & NB-Series remotes',
        icon: '📟',
        color: '#0984E3',
        image: 'https://5.imimg.com/data5/SELLER/Default/2024/11/468326697/VN/QU/PL/186187450/b14-3-1-universal-keydiy-flip-remote-500x500.png',
      },
      'Key Cover': {
        name: 'Key Cover',
        description: 'Premium metal alloy, leather, TPU & silicone car key protective cases',
        icon: '🛡️',
        color: '#E67E22',
        image: 'https://keycept.in/cdn/shop/files/03_de1ac36f-420b-4c58-a026-364b06dc92bc.jpg?v=1749700690',
      },
      'key cover': {
        name: 'Key Cover',
        description: 'Premium metal alloy, leather, TPU & silicone car key protective cases',
        icon: '🛡️',
        color: '#E67E22',
        image: 'https://keycept.in/cdn/shop/files/03_de1ac36f-420b-4c58-a026-364b06dc92bc.jpg?v=1749700690',
      },
      'key-cover': {
        name: 'Key Cover',
        description: 'Premium metal alloy, leather, TPU & silicone car key protective cases',
        icon: '🛡️',
        color: '#E67E22',
        image: 'https://keycept.in/cdn/shop/files/03_de1ac36f-420b-4c58-a026-364b06dc92bc.jpg?v=1749700690',
      },
      'Domestic Keys': {
        name: 'Domestic Keys',
        description: 'High-precision residential & commercial lock key blanks, lever keys & cylinder keys',
        icon: '🏠',
        color: '#E67E22',
        image: 'https://rkkeys.co.in/wp-content/uploads/2026/08/T8261-7-LEVER-@-18-.jpg',
      },
      'domestic keys': {
        name: 'Domestic Keys',
        description: 'High-precision residential & commercial lock key blanks, lever keys & cylinder keys',
        icon: '🏠',
        color: '#E67E22',
        image: 'https://rkkeys.co.in/wp-content/uploads/2026/08/T8261-7-LEVER-@-18-.jpg',
      },
      'domestic-keys': {
        name: 'Domestic Keys',
        description: 'High-precision residential & commercial lock key blanks, lever keys & cylinder keys',
        icon: '🏠',
        color: '#E67E22',
        image: 'https://rkkeys.co.in/wp-content/uploads/2026/08/T8261-7-LEVER-@-18-.jpg',
      },
      'Remote Batteries': {
        name: 'Remote Batteries',
        description: 'Long-life 3V lithium coin cell batteries for automotive remotes & smart proximity keys',
        icon: '🔋',
        color: '#27AE60',
        image: 'https://rkkeys.co.in/wp-content/uploads/2026/07/2032-@-24.jpeg',
      },
      'remote batteries': {
        name: 'Remote Batteries',
        description: 'Long-life 3V lithium coin cell batteries for automotive remotes & smart proximity keys',
        icon: '🔋',
        color: '#27AE60',
        image: 'https://rkkeys.co.in/wp-content/uploads/2026/07/2032-@-24.jpeg',
      },
      'remote-batteries': {
        name: 'Remote Batteries',
        description: 'Long-life 3V lithium coin cell batteries for automotive remotes & smart proximity keys',
        icon: '🔋',
        color: '#27AE60',
        image: 'https://rkkeys.co.in/wp-content/uploads/2026/07/2032-@-24.jpeg',
      },
      'Flip Blades': {
        name: 'Flip Blades',
        description: 'Uncut automotive flip key blade blanks for OEM, KD & VVDI universal remotes',
        icon: '🗡️',
        color: '#34495E',
        image: 'https://rkkeys.co.in/wp-content/uploads/2026/07/SWIFT-NEW-7343-@25-600x896.jpeg',
      },
      'flip blades': {
        name: 'Flip Blades',
        description: 'Uncut automotive flip key blade blanks for OEM, KD & VVDI universal remotes',
        icon: '🗡️',
        color: '#34495E',
        image: 'https://rkkeys.co.in/wp-content/uploads/2026/07/SWIFT-NEW-7343-@25-600x896.jpeg',
      },
      'flip-blades': {
        name: 'Flip Blades',
        description: 'Uncut automotive flip key blade blanks for OEM, KD & VVDI universal remotes',
        icon: '🗡️',
        color: '#34495E',
        image: 'https://rkkeys.co.in/wp-content/uploads/2026/07/SWIFT-NEW-7343-@25-600x896.jpeg',
      },
      'Keypads': {
        name: 'Keypads',
        description: 'Replacement rubber button pads & half-body keypads for automotive remote keys',
        icon: '🔘',
        color: '#8E44AD',
        image: 'https://rkkeys.co.in/wp-content/uploads/2026/08/I20-OLD-KEPAD-@22.jpeg',
      },
      '2-Wheeler Keys': {
        name: '2-Wheeler Keys',
        description: 'Motorcycle & scooter flip keys, key blanks & transponder keys',
        icon: '🏍️',
        color: '#3498DB',
        image: 'https://rkkeys.co.in/wp-content/uploads/2026/10/ML-10220-1361.jpeg',
      },
      'Automotive Key Blanks': {
        name: 'Automotive Key Blanks',
        description: 'Minda Silca & A1 precision key blanks for 2-wheelers and 4-wheelers',
        icon: '🔑',
        color: '#16A085',
        image: 'https://rkkeys.co.in/wp-content/uploads/2026/10/7283.jpeg',
      },
      'Car Accessories': {
        name: 'Car Accessories',
        description: 'General automotive accessories, gadgets & styling components',
        icon: '🚗',
        color: '#34495E',
        image: 'https://rkkeys.co.in/wp-content/uploads/2026/10/CG-B08.jpeg',
      },
      'Car Lighting': {
        name: 'Car Lighting',
        description: 'High-power LED bulbs, fog lamps, projector lenses & grill lights',
        icon: '💡',
        color: '#F1C40F',
        image: 'https://rkkeys.co.in/wp-content/uploads/2026/10/WhatsApp-Image-2026-10-22-at-16.40.43.jpeg',
      },
      'Xhorse Products': {
        name: 'Xhorse Products',
        description: 'VVDI universal smart keys, wire remotes, wireless remotes & super chips',
        icon: '✨',
        color: '#9B59B6',
        image: 'https://rkkeys.co.in/wp-content/uploads/2026/10/WhatsApp-Image-2026-10-20-at-12.20.11.jpeg',
      },
      'Keychains': {
        name: 'Keychains',
        description: 'High-grade metal, leather & braided vehicle keychains and rings',
        icon: '🔗',
        color: '#E91E63',
        image: 'https://rkkeys.co.in/wp-content/uploads/2026/10/WhatsApp-Image-2026-10-22-at-13.28.23-e1792659279253.jpeg',
      },
      'Car Fragrance': {
        name: 'Car Fragrance',
        description: 'Premium automotive perfumes, air fresheners & scent diffusers',
        icon: '🌸',
        color: '#8E44AD',
        image: 'https://rkkeys.co.in/wp-content/uploads/2026/10/B-K-ONE-B0-21.jpeg',
      },
      'Locksmith Tools': {
        name: 'Locksmith Tools',
        description: 'Professional key cutting cutters, tracers, pick sets & decoders',
        icon: '🔧',
        color: '#7F8C8D',
        image: 'https://rkkeys.co.in/wp-content/uploads/2026/11/WhatsApp-Image-2026-11-02-at-11.30.16-1.jpeg',
      },
      'Car Electronics': {
        name: 'Car Electronics',
        description: 'Reverse parking cameras, chargers, horns, speakers & tracking systems',
        icon: '⚡',
        color: '#2980B9',
        image: 'https://rkkeys.co.in/wp-content/uploads/2026/11/WhatsApp-Image-2026-11-03-at-13.34.44.jpeg',
      },
      'Smart Keys': {
        name: 'Smart Keys',
        description: 'OEM proximity smart keys, keyless entry push-start fobs',
        icon: '✨',
        color: '#1ABC9C',
        image: 'https://rkkeys.co.in/wp-content/uploads/2026/10/WhatsApp-Image-2026-10-20-at-15.08.00.jpeg',
      },
      'KeyDIY Products': {
        name: 'KeyDIY Products',
        description: 'Universal programmable KD B-Series, NB-Series & smart keys',
        icon: '📟',
        color: '#0984E3',
        image: 'https://rkkeys.co.in/wp-content/uploads/2026/09/WhatsApp-Image-2026-09-25-at-12.24.26.jpeg',
      },
      'Transponder Chips': {
        name: 'Transponder Chips',
        description: 'Automotive transponder chips, glass & ceramic immobilizer ICs',
        icon: '💾',
        color: '#10B981',
        image: 'https://rkkeys.co.in/wp-content/uploads/2026/07/TRANSPONDER.jpeg',
      },
      'Car Care & Accessories': {
        name: 'Car Care & Accessories',
        description: 'Petro Wax car wash shampoo, tire tonic, polishes & microfiber towels',
        icon: '✨',
        color: '#E67E22',
        image: 'https://rkkeys.co.in/wp-content/uploads/2026/10/WhatsApp-Image-2026-10-12-at-14.50.54-3.jpeg',
      }
    };

    return counts.map(row => {
      const cat = row.category;
      const lowerCat = cat.toLowerCase();
      const slugCat = lowerCat.replace(/\s+/g, '-');
      const meta = categoryMap[cat] || categoryMap[lowerCat] || categoryMap[slugCat] || {
        name: cat,
        description: `Explore our ${cat} collection`,
        icon: '📦',
        color: '#2EA8FF',
        image: 'https://via.placeholder.com/600x400'
      };

      return {
        id: cat,
        ...meta,
        image: formatImageUrl(meta.image),
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
      // Map details.extraImages or details.images to the legacy product_images format for backward compatibility
      product_images: (
        (Array.isArray(product.details?.extraImages) && product.details.extraImages.length > 0)
          ? product.details.extraImages
          : (Array.isArray(product.details?.images) ? product.details.images : [])
      ).map((url, i) => ({ id: i + 1, image_url: formatImageUrl(url), sort_order: i })),
      highlights: product.details?.highlights || [],
      longDescription: product.description,
      variants: product.colors.map((c, index) => ({ id: `${product.id}-${index}`, title: c, availableForSale: product.inStock }))
    };
  } catch (err) {
    console.error('Error fetching product by ID from Neon:', err);
    throw err;
  }
}

export async function fetchSimilarProducts(category, excludeId, brand = '') {
  try {
    const intExcludeId = parseInt(excludeId);
    const brandVal = (brand && brand !== 'Universal') ? String(brand).trim().toLowerCase() : '';
    const seed = !isNaN(intExcludeId) ? String(intExcludeId) : 'seed';
    let rows = [];

    if (category) {
      if (!isNaN(intExcludeId)) {
        rows = await sql`
          SELECT * FROM products 
          WHERE (
            LOWER(category) = LOWER(${category}) 
            OR LOWER(REPLACE(category, '-', ' ')) = LOWER(REPLACE(${category}, '-', ' '))
          )
          AND id != ${intExcludeId}
          ORDER BY 
            (CASE WHEN ${brandVal} != '' AND LOWER(brand) = ${brandVal} THEN 0 ELSE 1 END),
            md5(concat(id::text, '-', ${seed}::text))
          LIMIT 4
        `;
      } else {
        rows = await sql`
          SELECT * FROM products 
          WHERE (
            LOWER(category) = LOWER(${category}) 
            OR LOWER(REPLACE(category, '-', ' ')) = LOWER(REPLACE(${category}, '-', ' '))
          )
          ORDER BY 
            (CASE WHEN ${brandVal} != '' AND LOWER(brand) = ${brandVal} THEN 0 ELSE 1 END),
            md5(concat(id::text, '-', ${seed}::text))
          LIMIT 4
        `;
      }
    }

    // If fewer than 4 products were found in this category, backfill with diverse products
    if (rows.length < 4) {
      const existingIds = rows.map(r => r.id);
      if (!isNaN(intExcludeId)) existingIds.push(intExcludeId);
      
      const needed = 4 - rows.length;
      const fallbackRows = await sql`
        SELECT * FROM products 
        WHERE id != ALL(${existingIds})
        ORDER BY md5(concat(id::text, '-', ${seed}::text))
        LIMIT ${needed}
      `;
      rows = [...rows, ...fallbackRows];
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
    const prodId = String(review.productId || review.product_id || '');
    const uId = String(review.userId || review.user_id || 'anonymous');
    const ratingVal = Number(review.rating) || 5;
    const titleVal = String(review.title || '');
    const bodyVal = String(review.body || review.comment || review.reviewComment || '');

    await sql`
      INSERT INTO reviews (product_id, user_id, rating, title, body)
      VALUES (${prodId}, ${uId}, ${ratingVal}, ${titleVal}, ${bodyVal})
    `;
    return { success: true };
  } catch (err) {
    console.error('Error submitting review:', err);
    throw err;
  }
}
