import sql from './db';

// Format price helper
export const formatPrice = (price) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(price);

// Helper to sanitize & route image URLs through high-speed CDN to bypass origin anti-hotlinking
export function formatImageUrl(url, size = 'thumb') {
  if (!url || typeof url !== 'string') return '/placeholder-key.svg';
  const trimmed = url.trim();
  if (!trimmed) return '/placeholder-key.svg';

  // Cloudinary High-Speed Edge CDN Delivery
  if (trimmed.includes('res.cloudinary.com')) {
    if (trimmed.includes('/upload/') && !trimmed.includes('/upload/f_auto')) {
      const transform = size === 'hero' ? 'f_auto,q_auto,w_800,c_limit' : 'f_auto,q_auto,w_360,c_limit';
      return trimmed.replace('/upload/', `/upload/${transform}/`);
    }
    return trimmed;
  }

  let cdnUrl = trimmed;
  if (trimmed.startsWith('https://rkkeys.co.in/')) {
    cdnUrl = trimmed.replace('https://rkkeys.co.in/', 'https://i0.wp.com/rkkeys.co.in/');
  } else if (trimmed.startsWith('http://rkkeys.co.in/')) {
    cdnUrl = trimmed.replace('http://rkkeys.co.in/', 'https://i0.wp.com/rkkeys.co.in/');
  }

  if (cdnUrl.includes('i0.wp.com') && !cdnUrl.includes('?')) {
    if (size === 'hero') {
      return `${cdnUrl}?w=800&quality=85&strip=all`;
    } else if (size === 'thumb') {
      return `${cdnUrl}?w=360&quality=80&strip=all`;
    }
  }

  return cdnUrl;
}

// In-memory caches for high-speed instant navigation and filtering
export const productCache = new Map();
const categoryProductsCache = new Map();
const similarProductsCache = new Map();
let filterMetaCache = null;
let filterMetaCacheTime = 0;
let categoriesCache = null;
let categoriesCacheTime = 0;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

export function cacheProduct(p) {
  if (p && p.id) {
    productCache.set(String(p.id), p);
    productCache.set(Number(p.id), p);
  }
}

export function getCachedProduct(id) {
  if (!id) return null;
  return productCache.get(String(id)) || productCache.get(Number(id)) || null;
}

// Helper to map DB row to frontend product format
function mapProduct(row) {
  if (!row) return null;
  const colorsArray = typeof row.colors === 'string' ? JSON.parse(row.colors) : (row.colors || []);
  const detailsObj = typeof row.details === 'string' ? JSON.parse(row.details) : (row.details || {});
  const skuCode = row.sku || detailsObj.sku || (row.id ? `SMN-${(row.category || 'GEN').substring(0, 3).toUpperCase()}-${String(row.id).padStart(4, '0')}` : '');
  const formattedImageUrl = formatImageUrl(row.image_url, 'thumb');

  if (Array.isArray(detailsObj.images)) {
    detailsObj.images = detailsObj.images.map(img => formatImageUrl(img, 'hero'));
  }
  if (Array.isArray(detailsObj.extraImages)) {
    detailsObj.extraImages = detailsObj.extraImages.map(img => formatImageUrl(img, 'hero'));
  }

  const product = {
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
    inStock: row.in_stock !== false,
    in_stock: row.in_stock !== false,
    is_featured: row.is_featured === true,
    rating: parseFloat(row.rating || 0),
    review_count: parseInt(row.review_count || 0),
    reviews: parseInt(row.review_count || 0),
    colors: colorsArray,
    connectivity: detailsObj.connectivity || '',
    specs: detailsObj.specs || {},
    details: detailsObj
  };

  cacheProduct(product);
  return product;
}

// High-speed in-memory filtering engine (<1ms response time)
export function filterProductsInMemory(list, filters = {}, sortBy = 'featured') {
  if (!Array.isArray(list)) return [];
  let result = list;

  // Subcategories Filter
  const selectedSubcats = Array.isArray(filters.subcategories) && filters.subcategories.length > 0
    ? filters.subcategories.filter(s => s && s !== 'All')
    : (filters.subcategory && filters.subcategory !== 'All' ? [filters.subcategory] : []);

  if (selectedSubcats.length > 0) {
    result = result.filter(p => p.subcategory && selectedSubcats.includes(p.subcategory));
  }

  // Brands Filter
  const selectedBrands = Array.isArray(filters.brands) && filters.brands.length > 0
    ? filters.brands.filter(b => b && b !== 'All')
    : (filters.brand && filters.brand !== 'All' ? [filters.brand] : []);

  if (selectedBrands.length > 0) {
    result = result.filter(p => p.brand && selectedBrands.includes(p.brand));
  }

  // Price Range Filter
  let minP = filters.minPrice;
  let maxP = filters.maxPrice;
  if (Array.isArray(filters.priceRange) && filters.priceRange.length === 2) {
    minP = filters.priceRange[0];
    maxP = filters.priceRange[1];
  }
  if (minP !== undefined && minP !== null && !isNaN(minP)) {
    result = result.filter(p => p.price >= Number(minP));
  }
  if (maxP !== undefined && maxP !== null && !isNaN(maxP)) {
    result = result.filter(p => p.price <= Number(maxP));
  }

  // In-stock Filter
  if (filters.inStockOnly === true || filters.inStock === true) {
    result = result.filter(p => p.inStock === true || p.in_stock === true);
  }

  // Minimum Rating Filter
  if (filters.minRating && Number(filters.minRating) > 0) {
    result = result.filter(p => Number(p.rating || 0) >= Number(filters.minRating));
  }

  // Color Filter
  if (Array.isArray(filters.colors) && filters.colors.length > 0) {
    result = result.filter(p => Array.isArray(p.colors) && p.colors.some(c => filters.colors.includes(c)));
  }

  // Search Filter
  if (filters.search && filters.search.trim()) {
    const term = filters.search.trim().toLowerCase();
    result = result.filter(p =>
      (p.name && p.name.toLowerCase().includes(term)) ||
      (p.description && p.description.toLowerCase().includes(term)) ||
      (p.brand && p.brand.toLowerCase().includes(term)) ||
      (p.subcategory && p.subcategory.toLowerCase().includes(term)) ||
      (p.sku && p.sku.toLowerCase().includes(term))
    );
  }

  // Featured only
  if (filters.featuredOnly === true) {
    result = result.filter(p => p.is_featured === true);
  }

  // Sort By
  result = [...result];
  if (sortBy === 'price-asc') {
    result.sort((a, b) => a.price - b.price);
  } else if (sortBy === 'price-desc') {
    result.sort((a, b) => b.price - a.price);
  } else if (sortBy === 'rating') {
    result.sort((a, b) => (b.rating || 0) - (a.rating || 0) || (b.review_count || 0) - (a.review_count || 0));
  } else if (sortBy === 'reviews') {
    result.sort((a, b) => (b.review_count || 0) - (a.review_count || 0) || (b.rating || 0) - (a.rating || 0));
  } else if (sortBy === 'discount') {
    result.sort((a, b) => ((b.originalPrice || b.price) - b.price) - ((a.originalPrice || a.price) - a.price));
  } else if (sortBy === 'featured') {
    result.sort((a, b) => (b.is_featured ? 1 : 0) - (a.is_featured ? 1 : 0) || a.id - b.id);
  } else {
    result.sort((a, b) => a.id - b.id);
  }

  return result;
}

export async function fetchProducts(filters = {}, sortBy = 'featured') {
  // High-speed caching key by category
  const rawCat = (filters.category && filters.category !== 'all' && filters.category !== 'All')
    ? filters.category.trim().toLowerCase()
    : 'all';

  // If products for this category are already cached, return instant in-memory filtered result (0ms)
  if (categoryProductsCache.has(rawCat)) {
    const allCatProducts = categoryProductsCache.get(rawCat);
    return filterProductsInMemory(allCatProducts, filters, sortBy);
  }

  try {
    let baseQuery = 'SELECT * FROM products WHERE 1=1';
    const baseParams = [];

    if (rawCat !== 'all') {
      const normCat = rawCat.replace(/&/g, 'and').replace(/[^a-z0-9]/g, '');
      baseParams.push(rawCat);
      const catParamIdx = baseParams.length;
      baseParams.push(normCat);
      const normParamIdx = baseParams.length;
      baseQuery += ` AND (
        LOWER(category) = $${catParamIdx} 
        OR LOWER(REPLACE(category, ' ', '-')) = $${catParamIdx}
        OR LOWER(REPLACE(category, '-', ' ')) = $${catParamIdx}
        OR LOWER(REPLACE(category, '+', ' ')) = $${catParamIdx}
        OR REGEXP_REPLACE(LOWER(REPLACE(REPLACE(category, '&', 'and'), '+', ' ')), '[^a-z0-9]', '', 'g') = $${normParamIdx}
      )`;
    }

    baseQuery += ' ORDER BY id ASC';
    const rows = await sql.query(baseQuery, baseParams);
    const mapped = rows.map(mapProduct);

    // Cache the whole category dataset
    categoryProductsCache.set(rawCat, mapped);

    // Apply active filters and sorting
    return filterProductsInMemory(mapped, filters, sortBy);
  } catch (err) {
    console.error('Error fetching products from Neon:', err);
    return [];
  }
}

export async function fetchFilterMeta() {
  if (filterMetaCache && (Date.now() - filterMetaCacheTime < CACHE_TTL)) {
    return filterMetaCache;
  }
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      const stored = window.sessionStorage.getItem('smn_filter_meta_cache');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.timestamp && (Date.now() - parsed.timestamp < CACHE_TTL) && parsed.data) {
          filterMetaCache = parsed.data;
          filterMetaCacheTime = parsed.timestamp;
          return filterMetaCache;
        }
      }
    } catch (_) {}
  }

  try {
    const brandsRow = await sql`
      SELECT DISTINCT category, brand 
      FROM products 
      WHERE brand IS NOT NULL AND brand != '' 
      ORDER BY brand ASC
    `;
    const subcatsRow = await sql`
      SELECT DISTINCT category, subcategory 
      FROM products 
      WHERE subcategory IS NOT NULL AND subcategory != '' 
      ORDER BY subcategory ASC
    `;
    const subcatImagesRow = await sql`
      SELECT DISTINCT ON (subcategory) subcategory, image_url
      FROM products
      WHERE subcategory IS NOT NULL AND subcategory != '' AND image_url IS NOT NULL AND image_url != ''
      ORDER BY subcategory, id ASC
    `;
    const subcategoryImages = {};
    for (const row of subcatImagesRow) {
      if (row.subcategory && row.image_url) {
        subcategoryImages[row.subcategory.trim()] = row.image_url;
      }
    }
    const priceRow = await sql`SELECT MIN(price) as min_p, MAX(price) as max_p FROM products`;

    const allBrandsSet = new Set();
    const brandsByCategory = {};
    for (const row of brandsRow) {
      if (!row.brand) continue;
      const b = row.brand.trim();
      if (!b || b === 'All') continue;
      allBrandsSet.add(b);

      if (!row.category) continue;
      const cat = row.category.trim();
      const lower = cat.toLowerCase();
      const slug = lower.replace(/\s+/g, '-');
      const unhyphen = lower.replace(/-/g, ' ');
      const singular = lower.endsWith('s') ? lower.slice(0, -1) : lower;
      const plural = `${lower}s`;
      const norm = lower.replace(/&/g, 'and').replace(/[^a-z0-9]/g, '');

      const keys = [cat, lower, slug, unhyphen, singular, plural, norm];
      for (const k of keys) {
        if (!brandsByCategory[k]) brandsByCategory[k] = [];
        if (!brandsByCategory[k].includes(b)) {
          brandsByCategory[k].push(b);
        }
      }
    }

    const brands = ['All', ...Array.from(allBrandsSet).sort((a, b) => a.localeCompare(b))];
    const subcategories = Array.from(new Set(subcatsRow.map(s => s.subcategory)));
    const subcategoriesByCategory = {};
    for (const row of subcatsRow) {
      if (!row.category) continue;
      const cat = row.category.trim();
      const lower = cat.toLowerCase();
      const slug = lower.replace(/\s+/g, '-');
      const unhyphen = lower.replace(/-/g, ' ');
      const singular = lower.endsWith('s') ? lower.slice(0, -1) : lower;
      const plural = `${lower}s`;
      const norm = lower.replace(/&/g, 'and').replace(/[^a-z0-9]/g, '');

      const keys = [cat, lower, slug, unhyphen, singular, plural, norm];
      for (const k of keys) {
        if (!subcategoriesByCategory[k]) subcategoriesByCategory[k] = [];
        if (!subcategoriesByCategory[k].includes(row.subcategory)) {
          subcategoriesByCategory[k].push(row.subcategory);
        }
      }
    }

    const minPrice = parseFloat(priceRow[0]?.min_p || 0);
    const maxPrice = parseFloat(priceRow[0]?.max_p || 100000);

    const metaResult = {
      brands,
      brandsByCategory,
      subcategories,
      subcategoriesByCategory,
      subcategoryImages,
      colors: [],
      minPrice,
      maxPrice,
    };

    filterMetaCache = metaResult;
    filterMetaCacheTime = Date.now();
    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        window.sessionStorage.setItem('smn_filter_meta_cache', JSON.stringify({ timestamp: filterMetaCacheTime, data: metaResult }));
      } catch (_) {}
    }

    return metaResult;
  } catch (err) {
    console.error('Error fetching filter meta:', err);
    return {
      brands: ['All'],
      brandsByCategory: {},
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
      const normCat = category.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]/g, '');
      const rows = await sql`
        SELECT DISTINCT subcategory FROM products 
        WHERE (
          LOWER(category) = LOWER(${category}) 
          OR LOWER(REPLACE(category, '-', ' ')) = LOWER(REPLACE(${category}, '-', ' '))
          OR REGEXP_REPLACE(LOWER(REPLACE(REPLACE(category, '&', 'and'), '+', ' ')), '[^a-z0-9]', '', 'g') = ${normCat}
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
  if (categoriesCache && (Date.now() - categoriesCacheTime < CACHE_TTL)) {
    return categoriesCache;
  }
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      const stored = window.sessionStorage.getItem('smn_categories_cache');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.timestamp && (Date.now() - parsed.timestamp < CACHE_TTL) && Array.isArray(parsed.data)) {
          categoriesCache = parsed.data;
          categoriesCacheTime = parsed.timestamp;
          return categoriesCache;
        }
      }
    } catch (_) {}
  }

  try {
    const counts = await sql`
      SELECT 
        p1.category, 
        COUNT(*) as c,
        (
          SELECT COALESCE(NULLIF(p2.image_url, ''), (p2.details->'images'->>0))
          FROM products p2 
          WHERE (p2.category = p1.category OR LOWER(p2.category) = LOWER(p1.category))
            AND (
              (p2.image_url IS NOT NULL AND TRIM(p2.image_url) != '' AND p2.image_url NOT LIKE '%placeholder%')
              OR 
              (p2.details->'images'->>0 IS NOT NULL AND TRIM(p2.details->'images'->>0) != '' AND p2.details->'images'->>0 NOT LIKE '%placeholder%')
            )
          ORDER BY p2.id ASC 
          LIMIT 1
        ) as first_product_image
      FROM products p1
      WHERE p1.category IS NOT NULL AND TRIM(p1.category) != ''
      GROUP BY p1.category
      ORDER BY p1.category ASC
    `;

    const categoryMap = {
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

    const categoryResults = counts.map(row => {
      const cat = row.category;
      const lowerCat = cat.toLowerCase();
      const slugCat = lowerCat.replace(/\s+/g, '-');
      const meta = categoryMap[cat] || categoryMap[lowerCat] || categoryMap[slugCat] || {
        name: cat,
        description: `Explore our ${cat} collection`,
        icon: '📦',
        color: '#2EA8FF',
      };

      // Automatically take image from the first product in this category
      let categoryImage = row.first_product_image;
      if (!categoryImage || categoryImage.includes('via.placeholder.com')) {
        categoryImage = (meta.image && !meta.image.includes('via.placeholder.com'))
          ? meta.image
          : '/placeholder-key.svg';
      }

      return {
        id: cat,
        ...meta,
        image: formatImageUrl(categoryImage),
        count: parseInt(row.c || 0)
      };
    });

    // Custom order configured in Admin Homepage Showcase
    try {
      const orderRow = await sql`SELECT settings FROM homepage_settings WHERE id = 'category_order'`;
      if (orderRow.length > 0) {
        const catOrder = typeof orderRow[0].settings === 'string' ? JSON.parse(orderRow[0].settings) : (orderRow[0].settings || []);
        if (Array.isArray(catOrder) && catOrder.length > 0) {
          const orderMap = new Map();
          catOrder.forEach((name, i) => {
            if (name) orderMap.set(name.toLowerCase().trim(), i);
          });
          categoryResults.sort((a, b) => {
            const idxA = orderMap.has(a.id.toLowerCase().trim()) ? orderMap.get(a.id.toLowerCase().trim()) : 9999;
            const idxB = orderMap.has(b.id.toLowerCase().trim()) ? orderMap.get(b.id.toLowerCase().trim()) : 9999;
            if (idxA !== idxB) return idxA - idxB;
            return a.id.localeCompare(b.id);
          });
        }
      }
    } catch (_) {}

    categoriesCache = categoryResults;
    categoriesCacheTime = Date.now();
    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        window.sessionStorage.setItem('smn_categories_cache', JSON.stringify({ timestamp: categoriesCacheTime, data: categoryResults }));
      } catch (_) {}
    }

    return categoryResults;
  } catch (err) {
    console.error('Error fetching categories from Neon:', err);
    return [];
  }
}

export async function fetchHomepageSettings() {
  try {
    const rows = await sql`SELECT id, settings FROM homepage_settings`;
    const res = {};
    for (const r of rows) {
      res[r.id] = typeof r.settings === 'string' ? JSON.parse(r.settings) : r.settings;
    }
    return {
      heroSlides: Array.isArray(res.hero_slides) ? res.hero_slides : [],
      categoryOrder: Array.isArray(res.category_order) ? res.category_order : [],
      featuredProductIds: Array.isArray(res.featured_product_ids) ? res.featured_product_ids : []
    };
  } catch (err) {
    console.error('Error fetching homepage settings:', err);
    return { heroSlides: [], categoryOrder: [], featuredProductIds: [] };
  }
}

export async function fetchProductById(id) {
  const intId = parseInt(id);
  if (isNaN(intId)) {
    throw new Error('Invalid product ID');
  }

  const cached = getCachedProduct(id);
  if (cached && (cached.product_images || cached.details?.images || cached.details?.extraImages)) {
    return cached;
  }

  try {
    const rows = await sql`SELECT * FROM products WHERE id = ${intId}`;
    if (rows.length === 0) {
      if (cached) return cached;
      throw new Error(`Product with ID ${id} not found`);
    }

    const product = mapProduct(rows[0]);
    const fullProduct = {
      ...product,
      product_images: (
        (Array.isArray(product.details?.extraImages) && product.details.extraImages.length > 0)
          ? product.details.extraImages
          : (Array.isArray(product.details?.images) ? product.details.images : [])
      ).map((url, i) => ({ id: i + 1, image_url: formatImageUrl(url, 'hero'), sort_order: i })),
      highlights: product.details?.highlights || [],
      longDescription: product.description,
      variants: product.colors.map((c, index) => ({ id: `${product.id}-${index}`, title: c, availableForSale: product.inStock }))
    };

    cacheProduct(fullProduct);
    return fullProduct;
  } catch (err) {
    if (cached) return cached;
    console.error('Error fetching product by ID from Neon:', err);
    throw err;
  }
}

export async function fetchSimilarProducts(category, excludeId, brand = '') {
  try {
    const intExcludeId = parseInt(excludeId);
    const brandVal = (brand && brand !== 'Universal') ? String(brand).trim().toLowerCase() : '';
    const cacheKey = `${category || 'all'}_${excludeId || '0'}_${brandVal}`;

    if (similarProductsCache.has(cacheKey)) {
      return similarProductsCache.get(cacheKey);
    }

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
            id DESC
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
            id DESC
          LIMIT 4
        `;
      }
    }

    if (rows.length < 4) {
      const existingIds = rows.map(r => r.id);
      if (!isNaN(intExcludeId)) existingIds.push(intExcludeId);

      const needed = 4 - rows.length;
      const fallbackRows = await sql`
        SELECT * FROM products 
        WHERE id != ALL(${existingIds})
        ORDER BY id DESC
        LIMIT ${needed}
      `;
      rows = [...rows, ...fallbackRows];
    }

    const mapped = rows.map(mapProduct);
    similarProductsCache.set(cacheKey, mapped);
    return mapped;
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
