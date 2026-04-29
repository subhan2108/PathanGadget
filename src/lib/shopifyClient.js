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

// Function to generate the secure Shopify Checkout URL based on current cart
export async function createShopifyCheckout(cartItems) {
    const lines = cartItems.map(item => {
        // If we don't have a specific Shopify Variant ID, we need to pass standard IDs. 
        // In this implementation, the "item.id" must be the Variant GID or Product GID.
        // For custom products, you typically need to fetch the variants first. 
        // Assuming item.variants[0].id is passed as the real ID.
        return {
            merchandiseId: item.variantId || item.id, // Must be a gid://shopify/ProductVariant/...
            quantity: item.quantity
        };
    });

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

    return data.cartCreate.cart.checkoutUrl;
}
