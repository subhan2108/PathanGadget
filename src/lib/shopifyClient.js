// v2.1 - Fixed TypeError and improved GID handling
export const SHOPIFY_DOMAIN = import.meta.env.VITE_SHOPIFY_DOMAIN || 'electrocart-13.myshopify.com';
export const SHOPIFY_STOREFRONT_TOKEN = import.meta.env.VITE_SHOPIFY_STOREFRONT_TOKEN || '9a8853b62939d98eba2f1622d19e608f';

export async function shopifyFetch({ query, variables = {} }) {
    const endpoint = `https://${SHOPIFY_DOMAIN}/api/2024-01/graphql.json`;

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Shopify-Storefront-Access-Token': SHOPIFY_STOREFRONT_TOKEN,
            },
            body: JSON.stringify({ query, variables }),
        });

        const json = await response.json();

        if (json.errors) {
            console.error('Shopify GraphQL Errors:', json.errors);
            throw new Error('Failed to fetch from Shopify API');
        }

        return json.data;
    } catch (error) {
        console.error('Shopify Fetch Error:', error);
        throw error;
    }
}

export async function createShopifyCheckout(cartItems) {
    if (!cartItems || cartItems.length === 0) {
        throw new Error('Cart is empty');
    }

    const lines = cartItems.map(item => {
        // Robust ID resolution
        let variantId = item.variantId;
        
        // If no explicit variantId, check the main id (if it's a Shopify GID string)
        if (!variantId && item.id && typeof item.id === 'string' && item.id.includes('ProductVariant')) {
            variantId = item.id;
        }

        // Fallback to first variant if available
        if (!variantId && item.variants && item.variants[0] && item.variants[0].id) {
            variantId = item.variants[0].id;
        }

        if (!variantId) {
            console.warn('Skipping item missing Shopify Variant ID:', item.name);
            return null;
        }

        return {
            merchandiseId: variantId,
            quantity: parseInt(item.quantity) || 1
        };
    }).filter(line => line !== null);

    if (lines.length === 0) {
        throw new Error('No valid Shopify products found in cart. Please clear cart and try again.');
    }

    const query = `
    mutation cartCreate($input: CartInput!) {
      cartCreate(input: $input) {
        cart {
          id
          checkoutUrl
        }
        userErrors {
          field
          message
        }
      }
    }
    `;

    const variables = {
        input: { lines }
    };

    const data = await shopifyFetch({ query, variables });
    
    if (data?.cartCreate?.userErrors?.length > 0) {
        throw new Error(data.cartCreate.userErrors[0].message);
    }

    const url = data?.cartCreate?.cart?.checkoutUrl;
    if (!url) {
        throw new Error('Shopify did not return a checkout URL');
    }

    return url;
}
