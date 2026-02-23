/**
 * src/hooks/useProducts.js
 * React hooks providing static mock data for the store.
 * Reverted from Supabase to ensure stability as requested.
 */
import { useState, useEffect } from 'react'
import {
    fetchProducts,
    fetchFilterMeta,
    fetchCategories,
    fetchProductById,
    fetchSimilarProducts,
    fetchReviews
} from '../lib/productsService'

/**
 * Hook for the Product Listing Page.
 * Filters the static mock data locally.
 */
export function useProducts(filters = {}, sortBy = 'featured') {
    const [products, setProducts] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        let isMounted = true
        async function load() {
            setLoading(true)
            setError(null)
            try {
                const data = await fetchProducts(filters, sortBy)
                if (isMounted) setProducts(data)
            } catch (err) {
                if (isMounted) setError(err.message)
            } finally {
                if (isMounted) setLoading(false)
            }
        }
        load()
        return () => { isMounted = false }
    }, [JSON.stringify(filters), sortBy])

    return { products, loading, error }
}

/**
 * Hook for the Home Page.
 */
export function useAllProducts() {
    const [products, setProducts] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchProducts().then(data => {
            setProducts(data)
            setLoading(false)
        })
    }, [])

    return { products, loading, error: null }
}

/**
 * Hook for filter metadata based on the static data available.
 */
export function useFilterMeta() {
    const [meta, setMeta] = useState({ brands: [], colors: [], minPrice: 0, maxPrice: 200000 })
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchFilterMeta().then(data => {
            setMeta(data)
            setLoading(false)
        })
    }, [])

    return { meta, loading }
}

/**
 * Hook for categories.
 */
export function useCategories() {
    const [categories, setCategories] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchCategories().then(data => {
            setCategories(data)
            setLoading(false)
        })
    }, [])

    return { categories, loading }
}

/**
 * Hook for a single product's detail page.
 */
export function useProductDetail(id) {
    const [product, setProduct] = useState(null)
    const [similarProducts, setSimilarProducts] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        if (!id) return
        setLoading(true)
        setError(null)

        fetchProductById(id)
            .then(data => {
                setProduct(data)
                if (data?.category) {
                    return fetchSimilarProducts(data.category, id)
                }
                return []
            })
            .then(similar => {
                setSimilarProducts(similar)
            })
            .catch(err => {
                setError(err.message)
            })
            .finally(() => {
                setLoading(false)
            })
    }, [id])

    return { product, similarProducts, loading, error }
}

export function useSimilarProducts(category, excludeId) {
    const [products, setProducts] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!category) return
        fetchSimilarProducts(category, excludeId)
            .then(data => setProducts(data))
            .finally(() => setLoading(false))
    }, [category, excludeId])

    return { products, loading }
}

/**
 * Fetch reviews for a specific product.
 */
export function useReviews(productId) {
    const [reviews, setReviews] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        if (!productId) return
        setLoading(true)
        fetchReviews(productId)
            .then(data => {
                setReviews(data)
                setLoading(false)
            })
            .catch(err => {
                setError(err.message)
                setLoading(false)
            })
    }, [productId])

    return { reviews, loading, error, refresh: () => fetchReviews(productId).then(setReviews) }
}
