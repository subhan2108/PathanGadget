import React, { useState, useEffect } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useProductDetail, useReviews, useAllProducts } from '../hooks/useProducts'
import { formatPrice, submitReview } from '../lib/productsService'
import { useCart } from '../context/CartContext'
import { useAuth } from '../context/AuthContext'
import { ProductCard } from '@/components/ui/product-card-2'
import './ProductDetailPage.css'

const DEFAULT_CATEGORY_GALLERIES = {
    watches: [
        'https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?w=600&h=600&fit=crop',
        'https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=600&h=600&fit=crop',
        'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=600&h=600&fit=crop',
        'https://images.unsplash.com/photo-1510017803434-a899398421b3?w=600&h=600&fit=crop',
    ],
    airpods: [
        'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=600&h=600&fit=crop',
        'https://images.unsplash.com/photo-1572536147248-ac59a8abfa4b?w=600&h=600&fit=crop',
        'https://images.unsplash.com/photo-1588423771073-b8903fbb85b5?w=600&h=600&fit=crop',
        'https://images.unsplash.com/photo-1572645315416-6c5bc4fcabba?w=600&h=600&fit=crop',
    ],
    headphones: [
        'https://images.unsplash.com/photo-1484704849700-f032a568e944?w=600&h=600&fit=crop',
        'https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=600&h=600&fit=crop',
        'https://images.unsplash.com/photo-1583394838336-acd977736f90?w=600&h=600&fit=crop',
        'https://images.unsplash.com/photo-1524678606370-a47ad25cb82a?w=600&h=600&fit=crop',
    ],
    smartphones: [
        'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=600&h=600&fit=crop',
        'https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=600&h=600&fit=crop',
        'https://images.unsplash.com/photo-1580910051074-3eb694886505?w=600&h=600&fit=crop',
    ]
};

export default function ProductDetailPage() {
    const { id } = useParams()
    const navigate = useNavigate()
    const { addToCart, checkout } = useCart()

    const { product, loading: productLoading, error: productError, similarProducts } = useProductDetail(id)
    const { reviews, loading: reviewsLoading, refresh: refreshReviews } = useReviews(id)
    const { user } = useAuth()
    const { products: allProducts } = useAllProducts()

    const [activeImg, setActiveImg] = useState(0)
    const [selectedColor, setSelectedColor] = useState(null)
    const [quantity, setQuantity] = useState(1)
    const [selectedVariant, setSelectedVariant] = useState('buy1')
    const [added, setAdded] = useState(false)
    const [copiedSku, setCopiedSku] = useState(false)

    const [reviewRating, setReviewRating] = useState(5)
    const [reviewTitle, setReviewTitle] = useState('')
    const [reviewComment, setReviewComment] = useState('')
    const [submittingReview, setSubmittingReview] = useState(false)

    const handleReviewSubmit = async (e) => {
        e.preventDefault()
        if (!user) return
        setSubmittingReview(true)
        try {
            await submitReview({
                productId: id,
                product_id: id,
                userId: user.id,
                user_id: user.id,
                user_name: user.name || user.email?.split('@')[0] || 'User',
                rating: reviewRating,
                title: reviewTitle,
                body: reviewComment,
                comment: reviewComment,
            })
            setReviewTitle('')
            setReviewComment('')
            setReviewRating(5)
            if (refreshReviews) refreshReviews()
        } catch (err) {
            console.error('Failed to submit review:', err)
        } finally {
            setSubmittingReview(false)
        }
    }

    useEffect(() => {
        window.scrollTo(0, 0)
        setActiveImg(0)
        setQuantity(1)
        setSelectedVariant('buy1')
    }, [id])

    // --- Backend Data Extraction (Strictly from DB) ---
    const basePrice = Number(product?.price) || 0
    const rawOrig = product?.original_price ?? product?.originalPrice
    const baseOriginalPrice = rawOrig ? Number(rawOrig) : null
    const hasDiscount = Boolean(baseOriginalPrice && baseOriginalPrice > basePrice)
    const discountPercentage = hasDiscount ? Math.round(((baseOriginalPrice - basePrice) / baseOriginalPrice) * 100) : 0
    const savingsAmount = hasDiscount ? baseOriginalPrice - basePrice : 0

    // Rating & Reviews (Directly from DB)
    const hasReviews = Array.isArray(reviews) && reviews.length > 0
    const dbReviewCount = (product?.review_count !== undefined && product?.review_count !== null && Number(product?.review_count) > 0)
        ? Number(product.review_count)
        : 0
    const reviewCount = hasReviews ? reviews.length : dbReviewCount

    const computedAvgRating = hasReviews
        ? (reviews.reduce((acc, r) => acc + (Number(r.rating) || 5), 0) / reviews.length).toFixed(1)
        : (product?.rating && Number(product.rating) > 0 ? Number(product.rating).toFixed(1) : null)

    const hasRatingOrReviews = Boolean(computedAvgRating || reviewCount > 0)

    // Build Gallery from DB (supports 4-6 images from backend/admin panel)
    const mainImg = (product?.image_url || product?.image || '').trim()
    let rawExtraList = []
    if (Array.isArray(product?.details?.extraImages)) {
        rawExtraList = product.details.extraImages
    } else if (typeof product?.details?.extraImages === 'string') {
        const trimmed = product.details.extraImages.trim()
        if (trimmed.startsWith('[')) {
            try { rawExtraList = JSON.parse(trimmed) } catch (e) { rawExtraList = [] }
        } else if (trimmed.startsWith('data:image/')) {
            rawExtraList = [trimmed]
        } else {
            rawExtraList = trimmed.split(/[\n,]+/)
        }
    } else if (Array.isArray(product?.product_images)) {
        rawExtraList = product.product_images.map(img => img.image_url || img)
    }

    let cleanExtraList = rawExtraList
        .map(u => typeof u === 'string' ? u.trim() : '')
        .filter(u => Boolean(u) && u !== mainImg)

    // If backend extraImages is empty or only contained copies of mainImg, provide category angles
    if (cleanExtraList.length === 0 && product?.category) {
        const catKey = product.category.toLowerCase()
        const fallbackAngles = DEFAULT_CATEGORY_GALLERIES[catKey] || []
        cleanExtraList = fallbackAngles.filter(u => u !== mainImg)
    }

    const gallery = [mainImg, ...cleanExtraList].filter(Boolean)

    // Colors from DB
    const colors = Array.isArray(product?.colors) && product.colors.length > 0 ? product.colors : []

    // Features, Specs & Details directly from DB (NO mock fallback)
    const details = product?.details || {}
    const highlights = (Array.isArray(details.highlights) && details.highlights.length > 0)
        ? details.highlights.filter(h => typeof h === 'string' && h.trim())
        : (Array.isArray(product?.highlights) && product.highlights.length > 0 ? product.highlights.filter(h => typeof h === 'string' && h.trim()) : [])

    const rawSpecs = (details.specifications && Object.keys(details.specifications).length > 0)
        ? details.specifications
        : (details.specs && Object.keys(details.specs).length > 0
            ? details.specs
            : (product?.specs && Object.keys(product.specs).length > 0 ? product.specs : {}))

    const specsWithSku = product?.sku && !rawSpecs.SKU && !rawSpecs.sku
        ? { SKU: product.sku, ...rawSpecs }
        : rawSpecs

    const mappedSpecs = Object.entries(specsWithSku)
        .filter(([_, v]) => v !== undefined && v !== null && String(v).trim() !== '')
        .map(([k, v]) => ({
            label: k.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            value: String(v)
        }))

    const hasValidDescription = Boolean(
        product?.description &&
        product.description.trim() &&
        product.description.trim().toLowerCase() !== 'na' &&
        product.description.trim().toLowerCase() !== 'n/a'
    )

    const whyChooseUs = (Array.isArray(details.whyChooseUs) && details.whyChooseUs.length > 0)
        ? details.whyChooseUs.filter(w => typeof w === 'string' && w.trim())
        : []


    // Trust Badges strictly from backend
    const trustBadges = (Array.isArray(details.trustBadges) && details.trustBadges.length > 0)
        ? details.trustBadges.filter(b => b && b.label)
        : []

    // Real Bundle Offer (ONLY if explicitly set with non-zero discounts in DB)
    const buy2Discount = Number(details.discounts?.buy2) || 0
    const buy3Discount = Number(details.discounts?.buy3) || 0
    const hasRealBundleOffer = details.hasOffer === true && (buy2Discount > 0 || buy3Discount > 0)

    const dynamicVariants = hasRealBundleOffer ? [
        { id: 'buy1', label: 'Buy 1', price: basePrice, originalPrice: baseOriginalPrice || basePrice, tag: null, discountApplied: 0, qty: 1 },
        ...(buy2Discount > 0 ? [{ id: 'buy2', label: 'Buy 2', price: Math.round(basePrice * 2 * (1 - buy2Discount / 100)), originalPrice: (baseOriginalPrice || basePrice) * 2, tag: `Extra ${buy2Discount}% Off`, discountApplied: buy2Discount, qty: 2 }] : []),
        ...(buy3Discount > 0 ? [{ id: 'buy3', label: 'Buy 3', price: Math.round(basePrice * 3 * (1 - buy3Discount / 100)), originalPrice: (baseOriginalPrice || basePrice) * 3, tag: 'Best Value', discountApplied: buy3Discount, qty: 3 }] : [])
    ] : null

    const activeVariant = dynamicVariants ? (dynamicVariants.find(v => v.id === selectedVariant) || dynamicVariants[0]) : null
    const finalQty = activeVariant ? activeVariant.qty : quantity
    const finalPrice = activeVariant ? activeVariant.price : basePrice * quantity
    const finalUnitCost = activeVariant ? (activeVariant.price / activeVariant.qty) : basePrice

    const hasStockInfo = product ? (product.in_stock !== undefined || product.inStock !== undefined) : false
    const isInStock = product ? (product.in_stock !== false && product.inStock !== false) : true

    // Set initial color based on what actually exists
    useEffect(() => {
        if (product && colors.length > 0) {
            setSelectedColor(colors[0])
        }
    }, [product, colors.length])

    const handleAddToCart = async () => {
        if (!isInStock) return
        await addToCart({
            ...product,
            sku: product.sku || `SMN-${(product.category || 'GEN').substring(0, 3).toUpperCase()}-${String(product.id).padStart(4, '0')}`,
            name: product.name,
            price: finalUnitCost,
            image: gallery[0] || product.image_url || null,
            image_url: gallery[0] || product.image_url || null,
            originalPrice: baseOriginalPrice,
            selectedColor: selectedColor || (colors[0] || null),
            variantId: activeVariant?.discountApplied > 0 ? `Buy ${activeVariant.qty} (${activeVariant.discountApplied}% Off)` : (selectedColor ? `Color: ${selectedColor}` : undefined),
            appliedOffer: activeVariant?.discountApplied > 0 ? `Buy ${activeVariant.qty} (${activeVariant.discountApplied}% Off)` : null
        }, finalQty)
        setAdded(true)
        setTimeout(() => setAdded(false), 1600)
    }

    const handleBuyNow = async () => {
        if (!isInStock) return
        await handleAddToCart()
        checkout()
    }

    if (productLoading) return (
        <div className="container" style={{ padding: '100px 0', textAlign: 'center' }}>
            <div className="spinner-border text-primary" role="status"></div>
            <p style={{ marginTop: 20, color: 'var(--text-muted)' }}>Loading product details...</p>
        </div>
    )

    if (productError || !product) return (
        <div className="container" style={{ padding: '100px 0', textAlign: 'center' }}>
            <h2 style={{ color: 'var(--accent)' }}>404: Product Not Found</h2>
            <p>The product you are looking for doesn't exist or has been removed.</p>
            <Link to="/products" className="btn btn-primary" style={{ marginTop: 20 }}>Return to Catalog</Link>
        </div>
    )

    return (
        <div className="product-detail-page" style={{ backgroundColor: '#FFFFFF', minHeight: '100vh' }}>
            {/* Breadcrumb Bar (Aligned with Navbar Logo) */}
            <div className="pdp-breadcrumb-bar">
                <div className="container">
                    <nav className="breadcrumb">
                        <Link to="/"><i className="bi bi-house" /> Home</Link>
                        <span>›</span>
                        <Link to="/products">Products</Link>
                        {product?.category && (
                            <>
                                <span>›</span>
                                <Link to={`/products?category=${encodeURIComponent(product.category)}`} style={{ textTransform: 'capitalize' }}>
                                    {product.category}
                                </Link>
                            </>
                        )}
                        <span>›</span>
                        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{product.name}</span>
                    </nav>
                </div>
            </div>

            <div className="container" style={{ padding: '28px 24px 64px' }}>

                {/* Two Column Layout (Aligned with Navbar Logo) */}
                <div className="pdp-layout-grid">

                    {/* Left Column: Image Gallery (Small thumbnails on LEFT, Big image on RIGHT) */}
                    <div className="pdp-gallery-wrap">
                        {/* Small images box (Thumbnails) on the LEFT */}
                        {gallery.length > 1 && (
                            <div className="pdp-thumbnail-strip">
                                {gallery.map((img, idx) => (
                                    <div
                                        key={idx}
                                        onClick={() => setActiveImg(idx)}
                                        onMouseEnter={() => setActiveImg(idx)}
                                        className={`pdp-thumb-item ${activeImg === idx ? 'active' : ''}`}
                                        style={{
                                            width: '74px',
                                            height: '74px',
                                            flexShrink: 0,
                                            backgroundColor: '#FFFFFF',
                                            borderRadius: '12px',
                                            cursor: 'pointer',
                                            border: `2px solid ${activeImg === idx ? 'var(--cta)' : '#E5E7EB'}`,
                                            overflow: 'hidden',
                                            padding: '6px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            transition: 'all 0.2s ease',
                                            boxShadow: activeImg === idx ? '0 2px 8px rgba(229, 184, 36, 0.25)' : 'none'
                                        }}
                                    >
                                        <img src={img} alt={`Thumb ${idx}`} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Big Image Box */}
                        <div style={{
                            flex: '1 1 auto',
                            backgroundColor: '#FFFFFF',
                            borderRadius: '20px',
                            aspectRatio: '1',
                            overflow: 'hidden',
                            position: 'relative',
                            border: '1px solid #E5E7EB',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '24px',
                            minWidth: '0'
                        }}>
                            {product.badge && (
                                <span style={{
                                    position: 'absolute',
                                    top: '16px',
                                    left: '16px',
                                    backgroundColor: 'var(--cta)',
                                    color: 'white',
                                    padding: '6px 14px',
                                    borderRadius: '20px',
                                    fontSize: '0.8rem',
                                    fontWeight: '800',
                                    zIndex: 10,
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.12)'
                                }}>
                                    {product.badge}
                                </span>
                            )}
                            {gallery.length > 0 ? (
                                <img
                                    src={gallery[activeImg] || gallery[0]}
                                    alt={product.name}
                                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                />
                            ) : (
                                <div style={{ color: '#9CA3AF', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                    <i className="bi bi-image" style={{ fontSize: '3rem' }} />
                                    <span style={{ fontSize: '0.9rem' }}>No image available</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Column: Product Purchasing Info & Direct Backend Details */}
                    <div className="pdp-details-column" style={{ display: 'flex', flexDirection: 'column', minWidth: '0' }}>

                        {/* Category, Brand & SKU Pills (Strictly from backend) */}
                        {(product.category || product.brand || product.sku) && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
                                {product.category && (
                                    <div style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        background: 'rgba(229, 184, 36, 0.1)',
                                        color: '#8C5E0F',
                                        padding: '4px 12px',
                                        borderRadius: '20px',
                                        fontSize: '0.8rem',
                                        fontWeight: '700',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.5px'
                                    }}>
                                        <i className="bi bi-tag-fill" />
                                        <span>{product.category}</span>
                                    </div>
                                )}
                                {product.brand && (
                                    <div style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        background: 'rgba(36, 113, 229, 0.08)',
                                        color: 'rgb(36, 113, 229)',
                                        border: '1px solid rgba(36, 113, 229, 0.25)',
                                        padding: '4px 12px',
                                        borderRadius: '20px',
                                        fontSize: '0.8rem',
                                        fontWeight: '700'
                                    }}>
                                        <i className="bi bi-building" />
                                        <span>{product.brand}</span>
                                    </div>
                                )}
                                {product.sku && (
                                    <div
                                        onClick={() => {
                                            if (navigator.clipboard) {
                                                navigator.clipboard.writeText(product.sku)
                                                setCopiedSku(true)
                                                setTimeout(() => setCopiedSku(false), 2000)
                                            }
                                        }}
                                        title="Click to copy SKU"
                                        style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            background: '#F3F4F6',
                                            color: '#374151',
                                            border: '1px solid #E5E7EB',
                                            padding: '4px 12px',
                                            borderRadius: '20px',
                                            fontSize: '0.8rem',
                                            fontWeight: '700',
                                            letterSpacing: '0.5px',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease',
                                            userSelect: 'none'
                                        }}
                                    >
                                        <i className="bi bi-upc-scan" style={{ color: 'var(--cta)', fontSize: '0.9rem' }} />
                                        <span>SKU: {product.sku}</span>
                                        <span style={{ fontSize: '0.72rem', color: copiedSku ? '#059669' : '#9CA3AF', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                            <i className={`bi ${copiedSku ? 'bi-check-lg' : 'bi-copy'}`} />
                                            {copiedSku && <span style={{ fontWeight: '800' }}>Copied!</span>}
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Product Name */}
                        <h1 style={{ fontSize: '2rem', fontWeight: '800', color: '#111827', margin: '0 0 14px 0', lineHeight: '1.25', letterSpacing: '-0.5px' }}>
                            {product.name}
                        </h1>

                        {/* Rating & Stock Status (Only show rating if backend has rating/reviews) */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
                            {hasRatingOrReviews && (
                                <>
                                    {computedAvgRating && (
                                        <div style={{ color: '#FBBF24', fontSize: '1.1rem', display: 'flex', gap: '2px' }}>
                                            {[1, 2, 3, 4, 5].map(i => (
                                                <i key={i} className={`bi ${i <= Math.floor(Number(computedAvgRating)) ? 'bi-star-fill' : Number(computedAvgRating) - Math.floor(Number(computedAvgRating)) >= 0.5 ? 'bi-star-half' : 'bi-star'}`} />
                                            ))}
                                        </div>
                                    )}
                                    <div style={{ fontSize: '1rem', color: '#111827', fontWeight: '800' }}>
                                        {computedAvgRating && <span>{computedAvgRating} </span>}
                                        {reviewCount > 0 && (
                                            <span style={{ color: '#6B7280', fontWeight: '500' }}>({reviewCount} reviews)</span>
                                        )}
                                    </div>
                                </>
                            )}

                            {hasStockInfo && (
                                <div style={{
                                    marginLeft: hasRatingOrReviews ? 'auto' : '0',
                                    backgroundColor: isInStock ? '#D1FAE5' : '#FEE2E2',
                                    color: isInStock ? '#065F46' : '#DC2626',
                                    padding: '4px 12px',
                                    borderRadius: '20px',
                                    fontSize: '0.825rem',
                                    fontWeight: '700',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                }}>
                                    <i className={`bi ${isInStock ? 'bi-check-circle-fill' : 'bi-x-circle-fill'}`} />
                                    {isInStock ? 'In Stock' : 'Out of Stock'}
                                </div>
                            )}
                        </div>

                        {/* Price Block */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '8px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '2.75rem', fontWeight: '900', color: '#111827', lineHeight: '1', letterSpacing: '-1px' }}>
                                ₹{finalPrice.toLocaleString()}
                            </span>
                            {hasDiscount && (
                                <span style={{ fontSize: '1.4rem', color: '#9CA3AF', textDecoration: 'line-through', fontWeight: '600' }}>
                                    ₹{(baseOriginalPrice * finalQty).toLocaleString()}
                                </span>
                            )}
                            {hasDiscount && (
                                <span style={{ backgroundColor: '#FEF3C7', color: '#92400E', padding: '6px 12px', borderRadius: '20px', fontSize: '0.875rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <i className="bi bi-tag-fill" /> {discountPercentage}% OFF
                                </span>
                            )}
                        </div>

                        {/* You Save (Only if discounted in backend) */}
                        {hasDiscount && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#059669', fontSize: '0.95rem', fontWeight: '600', marginBottom: '24px' }}>
                                <i className="bi bi-piggy-bank" style={{ fontSize: '1.15rem' }} />
                                <span>You save <strong style={{ fontWeight: '800' }}>₹{(savingsAmount * finalQty).toLocaleString()}</strong> on this order</span>
                            </div>
                        )}

                        {/* Colors (Only if available in backend) */}
                        {colors.length > 0 && (
                            <div style={{ marginBottom: '24px', marginTop: hasDiscount ? '0' : '16px' }}>
                                <div style={{ fontSize: '0.875rem', fontWeight: '700', color: '#374151', marginBottom: '8px' }}>
                                    Color: <span style={{ color: '#111827', fontWeight: '800' }}>{selectedColor || colors[0]}</span>
                                </div>
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                    {colors.map((c, i) => (
                                        <button
                                            key={i}
                                            type="button"
                                            onClick={() => setSelectedColor(c)}
                                            style={{
                                                padding: '6px 14px',
                                                borderRadius: '20px',
                                                border: `1.5px solid ${(selectedColor || colors[0]) === c ? 'var(--cta)' : '#E5E7EB'}`,
                                                backgroundColor: (selectedColor || colors[0]) === c ? 'rgba(229, 184, 36, 0.12)' : '#FFFFFF',
                                                color: (selectedColor || colors[0]) === c ? '#8C5E0F' : '#374151',
                                                fontSize: '0.85rem',
                                                fontWeight: '700',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            {c}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Bundle Offers (ONLY if configured with real discounts in backend) */}
                        {hasRealBundleOffer && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
                                {dynamicVariants.map((v) => (
                                    <div
                                        key={v.id}
                                        onClick={() => setSelectedVariant(v.id)}
                                        style={{
                                            position: 'relative',
                                            padding: '14px 16px',
                                            borderRadius: '12px',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            border: `2px solid ${selectedVariant === v.id ? 'var(--cta)' : '#E5E7EB'}`,
                                            backgroundColor: selectedVariant === v.id ? 'rgba(184, 132, 36, 0.06)' : 'white'
                                        }}
                                    >
                                        {v.tag && (
                                            <div style={{
                                                position: 'absolute',
                                                top: '-9px',
                                                right: '14px',
                                                backgroundColor: 'var(--cta)',
                                                color: 'white',
                                                fontSize: '0.65rem',
                                                fontWeight: '800',
                                                padding: '2px 8px',
                                                borderRadius: '10px',
                                                textTransform: 'uppercase'
                                            }}>
                                                {v.tag}
                                            </div>
                                        )}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <div style={{
                                                width: '18px',
                                                height: '18px',
                                                borderRadius: '50%',
                                                border: `2px solid ${selectedVariant === v.id ? 'var(--cta)' : '#D1D5DB'}`,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}>
                                                {selectedVariant === v.id && <div style={{ width: '8px', height: '8px', backgroundColor: 'var(--cta)', borderRadius: '50%' }} />}
                                            </div>
                                            <span style={{ fontWeight: '700', color: '#111827' }}>{v.label}</span>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontWeight: '800', color: 'var(--cta)' }}>₹{v.price.toLocaleString()}</div>
                                            {v.originalPrice > v.price && (
                                                <div style={{ fontSize: '0.75rem', color: '#9CA3AF', textDecoration: 'line-through' }}>₹{v.originalPrice.toLocaleString()}</div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Quantity Stepper (When no bundle variants configured) */}
                        {!hasRealBundleOffer && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
                                <span style={{ fontSize: '0.875rem', fontWeight: '700', color: '#374151' }}>Quantity:</span>
                                <div style={{ display: 'inline-flex', alignItems: 'center', border: '1.5px solid #E5E7EB', borderRadius: '10px', overflow: 'hidden', height: '38px', background: '#FFFFFF' }}>
                                    <button
                                        type="button"
                                        onClick={() => setQuantity(q => Math.max(1, q - 1))}
                                        style={{ width: '36px', height: '100%', border: 'none', background: '#F9FAFB', cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4B5563', transition: 'background 0.2s' }}
                                        onMouseOver={e => e.currentTarget.style.background = '#F3F4F6'}
                                        onMouseOut={e => e.currentTarget.style.background = '#F9FAFB'}
                                        aria-label="Decrease quantity"
                                    >
                                        <i className="bi bi-dash" />
                                    </button>
                                    <span style={{ minWidth: '40px', textAlign: 'center', fontWeight: '700', fontSize: '0.95rem', color: '#111827' }}>{quantity}</span>
                                    <button
                                        type="button"
                                        onClick={() => setQuantity(q => q + 1)}
                                        style={{ width: '36px', height: '100%', border: 'none', background: '#F9FAFB', cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4B5563', transition: 'background 0.2s' }}
                                        onMouseOver={e => e.currentTarget.style.background = '#F3F4F6'}
                                        onMouseOut={e => e.currentTarget.style.background = '#F9FAFB'}
                                        aria-label="Increase quantity"
                                    >
                                        <i className="bi bi-plus" />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="pdp-action-buttons">
                            <button
                                type="button"
                                id="pdp-add-to-cart"
                                className={`pdp-btn-cart ${added ? 'added' : ''}`}
                                onClick={handleAddToCart}
                                disabled={!isInStock}
                            >
                                {!isInStock ? (
                                    <><i className="bi bi-x-circle" /> Out of Stock</>
                                ) : added ? (
                                    <><i className="bi bi-check-circle-fill" /> Added to Cart!</>
                                ) : (
                                    <><i className="bi bi-cart-plus" /> Add to Cart</>
                                )}
                            </button>
                            <button
                                type="button"
                                id="pdp-buy-now"
                                className="pdp-btn-buy"
                                onClick={handleBuyNow}
                                disabled={!isInStock}
                            >
                                <i className="bi bi-lightning-fill" /> Buy Now
                            </button>
                        </div>

                        {/* Trust Badges (Only rendered if present in backend) */}
                        {trustBadges.length > 0 && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '16px', padding: '18px 0', borderTop: '1px solid #E5E7EB', borderBottom: '1px solid #E5E7EB', marginTop: '16px', marginBottom: '20px' }}>
                                {trustBadges.map((badge, i) => (
                                    <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', color: '#4B5563', textAlign: 'center' }}>
                                        <i className={`bi ${badge.icon || 'bi-patch-check'}`} style={{ fontSize: '1.35rem', color: 'var(--cta)' }} />
                                        <span style={{ fontSize: '0.6875rem', fontWeight: '700', textTransform: 'uppercase', lineHeight: '1.3', letterSpacing: '0.3px', whiteSpace: 'pre-line' }}>{badge.label}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* --- DIRECT BACKEND DETAILS SECTION --- */}

                        {/* 1. Description from Backend (Directly visible in product panel) */}
                        {hasValidDescription && (
                            <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '1px solid #E5E7EB' }}>
                                <h3 style={{ fontSize: '1.15rem', fontWeight: '800', color: '#111827', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <i className="bi bi-card-text" style={{ color: 'var(--cta)' }} /> Description
                                </h3>
                                <div
                                    style={{ color: '#4B5563', lineHeight: '1.75', fontSize: '1rem' }}
                                    dangerouslySetInnerHTML={{ __html: product.description }}
                                />
                            </div>
                        )}


                        {/* 3. Specifications from Backend (If present) */}
                        {mappedSpecs.length > 0 && (
                            <div style={{ marginTop: '28px', paddingTop: '24px', borderTop: '1px solid #E5E7EB' }}>
                                <h3 style={{ fontSize: '1.15rem', fontWeight: '800', color: '#111827', margin: '0 0 14px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <i className="bi bi-sliders" style={{ color: 'var(--cta)' }} /> Specifications
                                </h3>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                                    {mappedSpecs.map((spec, i) => (
                                        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '2px', padding: '10px 14px', background: '#F9FAFB', borderRadius: '10px', border: '1px solid #F3F4F6' }}>
                                            <span style={{ fontWeight: '600', color: '#6B7280', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{spec.label}</span>
                                            <span style={{ fontWeight: '700', color: '#111827', fontSize: '0.9rem' }}>{spec.value}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 4. Key Features / Highlights from Backend (If present) */}
                        {highlights.length > 0 && (
                            <div style={{ marginTop: '28px', paddingTop: '24px', borderTop: '1px solid #E5E7EB' }}>
                                <h3 style={{ fontSize: '1.15rem', fontWeight: '800', color: '#111827', margin: '0 0 14px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <i className="bi bi-check-circle" style={{ color: 'var(--cta)' }} /> Key Features
                                </h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    {highlights.map((feature, idx) => (
                                        <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                                            <i className="bi bi-check-circle-fill" style={{ color: 'var(--cta)', marginTop: '2px', fontSize: '1rem' }} />
                                            <span style={{ color: '#374151', lineHeight: '1.5', fontSize: '0.925rem' }}>{feature}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 5. Why Choose Us from Backend (If present) */}
                        {whyChooseUs.length > 0 && (
                            <div style={{ marginTop: '28px', paddingTop: '24px', borderTop: '1px solid #E5E7EB' }}>
                                <h3 style={{ fontSize: '1.15rem', fontWeight: '800', color: '#111827', margin: '0 0 14px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <i className="bi bi-patch-check" style={{ color: '#059669' }} /> Why Choose Us
                                </h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    {whyChooseUs.map((reason, idx) => (
                                        <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                                            <i className="bi bi-patch-check-fill" style={{ color: '#059669', marginTop: '2px', fontSize: '1rem' }} />
                                            <span style={{ color: '#374151', lineHeight: '1.5', fontSize: '0.925rem' }}>{reason}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                    </div>
                </div>
            </div>

            {/* Customer Reviews Section */}
            <div style={{ marginTop: '60px', borderTop: '1px solid #F3F4F6', backgroundColor: '#FFFFFF', padding: '60px 0' }}>
                <div className="container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 20px' }}>
                    <h3 style={{ fontSize: '1.8rem', fontWeight: '900', color: '#111827', marginBottom: '32px' }}>Customer Reviews</h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '32px', alignItems: 'flex-start' }}>

                        {/* Left Card: Summary & Write Review */}
                        <div style={{ flex: '1 1 300px', backgroundColor: 'white', padding: '32px', borderRadius: '16px', border: '1px solid #E5E7EB', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                            {hasRatingOrReviews ? (
                                <>
                                    <div style={{ fontSize: '3.75rem', fontWeight: '900', color: '#111827', lineHeight: '1' }}>
                                        {computedAvgRating}
                                    </div>
                                    <div style={{ color: '#FBBF24', fontSize: '1.4rem', margin: '14px 0' }}>
                                        {[1, 2, 3, 4, 5].map(i => (
                                            <i key={i} className={`bi bi-star${i <= Math.round(Number(computedAvgRating) || 0) ? '-fill' : ''}`} />
                                        ))}
                                    </div>
                                    <div style={{ color: '#6B7280', marginBottom: '24px', fontSize: '0.95rem' }}>
                                        {reviewCount > 0 ? `${reviewCount} verified ratings` : 'Ratings recorded'}
                                    </div>
                                </>
                            ) : (
                                <div style={{ padding: '8px 0 20px', color: '#6B7280' }}>
                                    <i className="bi bi-star" style={{ fontSize: '2.5rem', color: '#D1D5DB', display: 'block', marginBottom: '8px' }} />
                                    <div style={{ fontWeight: '700', color: '#374151', fontSize: '1.1rem' }}>No Ratings Yet</div>
                                    <div style={{ fontSize: '0.875rem', marginTop: '4px' }}>Be the first customer to rate this product!</div>
                                </div>
                            )}

                            {!user ? (
                                <p style={{ color: '#6B7280', fontSize: '0.95rem' }}>Please log in to write a review.</p>
                            ) : (
                                <form onSubmit={handleReviewSubmit} style={{ marginTop: '28px', textAlign: 'left', borderTop: '1px solid #E5E7EB', paddingTop: '20px' }}>
                                    <h4 style={{ fontSize: '1.05rem', fontWeight: '700', marginBottom: '14px' }}>Write a Review</h4>

                                    <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', color: '#FBBF24', fontSize: '1.4rem', cursor: 'pointer' }}>
                                        {[1, 2, 3, 4, 5].map(i => (
                                            <i key={i} onClick={() => setReviewRating(i)} className={`bi bi-star${i <= reviewRating ? '-fill' : ''}`} />
                                        ))}
                                    </div>

                                    <input
                                        type="text"
                                        placeholder="Review Title"
                                        value={reviewTitle}
                                        onChange={(e) => setReviewTitle(e.target.value)}
                                        required
                                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #D1D5DB', marginBottom: '10px', fontFamily: 'inherit' }}
                                    />

                                    <textarea
                                        placeholder="Write your review here..."
                                        value={reviewComment}
                                        onChange={(e) => setReviewComment(e.target.value)}
                                        required
                                        rows="4"
                                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #D1D5DB', marginBottom: '14px', fontFamily: 'inherit', resize: 'vertical' }}
                                    />

                                    <button
                                        type="submit"
                                        disabled={submittingReview}
                                        style={{
                                            width: '100%',
                                            padding: '12px',
                                            backgroundColor: 'var(--cta)',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '8px',
                                            fontWeight: '700',
                                            cursor: submittingReview ? 'not-allowed' : 'pointer',
                                            opacity: submittingReview ? 0.7 : 1
                                        }}
                                    >
                                        {submittingReview ? 'Submitting...' : 'Submit Review'}
                                    </button>
                                </form>
                            )}
                        </div>

                        {/* Right Card: Review List */}
                        <div style={{ flex: '2 1 500px', backgroundColor: 'white', padding: '32px', borderRadius: '16px', border: '1px solid #E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                            {reviewsLoading ? (
                                <div style={{ textAlign: 'center', padding: '40px 0', color: '#9CA3AF' }}>Loading reviews...</div>
                            ) : reviews && reviews.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
                                    {reviews.map((rev, idx) => (
                                        <div key={rev.id || idx} style={{ borderBottom: idx !== reviews.length - 1 ? '1px solid #E5E7EB' : 'none', paddingBottom: idx !== reviews.length - 1 ? '24px' : '0' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <div style={{ width: '38px', height: '38px', borderRadius: '50%', backgroundColor: 'var(--cta)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '1.1rem' }}>
                                                        {(rev.user_name || rev.author || 'U')[0].toUpperCase()}
                                                    </div>
                                                    <div style={{ fontWeight: '700', color: '#111827' }}>{rev.user_name || rev.author || 'Verified Customer'}</div>
                                                </div>
                                                {rev.created_at && (
                                                    <div style={{ fontSize: '0.85rem', color: '#9CA3AF', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        <i className="bi bi-calendar3" />
                                                        {new Date(rev.created_at).toLocaleDateString()}
                                                    </div>
                                                )}
                                            </div>

                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                                <div style={{ color: '#FBBF24', fontSize: '0.9rem', display: 'flex', gap: '2px' }}>
                                                    {[1, 2, 3, 4, 5].map(i => <i key={i} className={`bi bi-star${i <= (Number(rev.rating) || 5) ? '-fill' : ''}`} />)}
                                                </div>
                                                {rev.title && <div style={{ fontWeight: '700', color: '#111827', fontSize: '0.95rem' }}>{rev.title}</div>}
                                            </div>

                                            <p style={{ color: '#4B5563', lineHeight: '1.6', margin: '0' }}>{rev.body || rev.comment || rev.content}</p>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                                    <i className="bi bi-chat-square-text" style={{ fontSize: '2rem', color: '#D1D5DB', marginBottom: '12px', display: 'block' }} />
                                    <h4 style={{ fontWeight: '700', color: '#4B5563', marginBottom: '8px' }}>No Reviews Yet</h4>
                                    <p style={{ color: '#6B7280', fontSize: '0.9rem' }}>Be the first to share your thoughts on this product!</p>
                                </div>
                            )}
                        </div>

                    </div>
                </div>
            </div>

            {/* Suggested Products (Strictly if real similar products from backend exist) */}
            {similarProducts && similarProducts.length > 0 && (
                <div className="container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 20px 80px' }}>
                    <div style={{ marginTop: '40px', paddingTop: '40px', borderTop: '1px solid #E5E7EB' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                            <h2 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#111827', margin: 0 }}>
                                You May Also Like
                            </h2>
                            <Link to="/products" style={{ color: 'var(--cta)', fontWeight: '700', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                View All <i className="bi bi-arrow-right" />
                            </Link>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '24px' }}>
                            {similarProducts.slice(0, 4).map((prod) => (
                                <ProductCard key={prod.id} id={`similar-card-${prod.id}`} product={prod} />
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
