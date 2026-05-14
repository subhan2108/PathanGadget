import { shopifyFetch } from './shopifyClient';
import { formatPrice as mockFormatPrice } from '../data/mockData';
import sql from './db';

export const formatPrice = mockFormatPrice;


// Convert Shopify Edges/Nodes to regular clean arrays
function flattenConnection(connection) {
  if (!connection) return [];
  return connection.edges.map(edge => edge.node);
}

export async function fetchProducts(filters = {}, sortBy = 'featured') {
  let sortKey = 'BEST_SELLING';
  let reverse = false;

  if (sortBy === 'price-asc') { sortKey = 'PRICE'; reverse = false; }
  else if (sortBy === 'price-desc') { sortKey = 'PRICE'; reverse = true; }
  else if (sortBy === 'rating') { sortKey = 'BEST_SELLING'; reverse = false; }

  let query = `query getProducts($sortKey: ProductSortKeys, $reverse: Boolean) {
      products(first: 50, sortKey: $sortKey, reverse: $reverse) {
        edges {
          node {
            id
            handle
            title
            description
            availableForSale
            priceRange {
              minVariantPrice {
                amount
              }
            }
            images(first: 1) {
              edges {
                node {
                  url
                }
              }
            }
            variants(first: 1) {
              edges {
                node {
                  id
                }
              }
            }
            collections(first: 1) {
              edges {
                node {
                  title
                }
              }
            }
          }
        }
      }
    }`;

  try {
    const data = await shopifyFetch({
      query,
      variables: { sortKey, reverse }
    });

    const rawProducts = flattenConnection(data.products);

    return rawProducts.map(p => ({
      id: p.id,
      handle: p.handle,
      name: p.title,
      description: p.description,
      category: flattenConnection(p.collections)[0]?.title || 'Gadgets',
      price: parseFloat(p.priceRange?.minVariantPrice?.amount || '0'),
      image_url: flattenConnection(p.images)[0]?.url || 'https://via.placeholder.com/300',
      in_stock: p.availableForSale,
      variantId: flattenConnection(p.variants)[0]?.id,
      rating: 5,
      review_count: 0
    }));
  } catch {
    return [];
  }
}

export async function fetchFilterMeta() {
  return {
    brands: ['All'],
    colors: [],
    minPrice: 0,
    maxPrice: 60000,
  };
}

export async function fetchCategories() {
  const query = `query getCollections {
        collections(first: 10) {
            edges {
             node {
                id
                handle
                title
                description
                image { url }
             }
            }
        }
    }`;

  try {
    const data = await shopifyFetch({ query });
    const collections = flattenConnection(data.collections);

    return collections.map(c => ({
      id: c.handle,
      name: c.title,
      description: c.description || `Explore our ${c.title} collection`,
      icon: '📦',
      color: '#2EA8FF',
      image: c.image?.url || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&h=400&fit=crop',
      count: 10
    }));
  } catch {
    return [];
  }
}

export async function fetchProductById(id) {
  const isGid = id.includes('gid://');

  const query = isGid
    ? `query getProductById($id: ID!) {
        product(id: $id) {
            id
            title
            handle
            descriptionHtml
            availableForSale
            priceRange {
                minVariantPrice { amount }
            }
            images(first: 5) {
                edges { node { url } }
            }
            variants(first: 10) {
                edges { node { id, title, availableForSale } }
            }
            collections(first: 1) {
              edges {
                node {
                  title
                }
              }
            }
        }
    }`
    : `query getProductByHandle($handle: String!) {
        productByHandle(handle: $handle) {
            id
            title
            handle
            descriptionHtml
            availableForSale
            priceRange {
                minVariantPrice { amount }
            }
            images(first: 5) {
                edges { node { url } }
            }
            variants(first: 10) {
                edges { node { id, title, availableForSale } }
            }
            collections(first: 1) {
              edges {
                node {
                  title
                }
              }
            }
        }
    }`;

  const variables = isGid ? { id } : { handle: id };
  const data = await shopifyFetch({ query, variables });
  const product = isGid ? data.product : data.productByHandle;

  if (!product) throw new Error('Product not found in Shopify');

  return {
    id: product.id,
    name: product.title,
    handle: product.handle,
    category: flattenConnection(product.collections)[0]?.title || 'Gadgets',
    description: product.descriptionHtml.replace(/<[^>]+>/g, ''),
    longDescription: product.descriptionHtml,
    price: parseFloat(product.priceRange.minVariantPrice.amount),
    image_url: flattenConnection(product.images)[0]?.url,
    in_stock: product.availableForSale,
    product_images: flattenConnection(product.images).map((img, i) => ({ id: i, image_url: img.url })),
    variants: flattenConnection(product.variants),
    variantId: flattenConnection(product.variants)[0]?.id,
    rating: 5,
    review_count: 0,
    highlights: [],
    specs: {}
  };
}

export async function fetchSimilarProducts(category, excludeId) {
  return fetchProducts();
}

export async function fetchReviews(productId) {
  try {
    const rows = await sql`
      SELECT * FROM reviews 
      WHERE product_id = ${productId}
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
      VALUES (${review.productId}, ${review.userId}, ${review.rating}, ${review.title}, ${review.body})
    `;
    return { success: true };
  } catch (err) {
    console.error('Error submitting review:', err);
    throw err;
  }
}
