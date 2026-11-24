import React, { useState, useEffect } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useProductDetail, useReviews, useAllProducts } from '../hooks/useProducts'
import { formatPrice, submitReview } from '../lib/productsService'
import { useCart } from '../context/CartContext'
import { useAuth } from '../context/AuthContext'
import { ProductCard } from '@/components/ui/product-card-2'
import './ProductDetailPage.css'

const DEFAULT_CATEGORY_GALLERIES = {};

export default function ProductDetailPage() {
    const { id } = useParams()
    const navigate = useNavigate()
    const { cartItems, addToCart, updateQty, removeFromCart, checkout } = useCart()

    const { product, loading: productLoading, error: productError, similarProducts } = useProductDetail(id)
    const { reviews, loading: reviewsLoading, refresh: refreshReviews } = useReviews(id)
    const { user } = useAuth()
    const { products: allProducts } = useAllProducts()

    const inCartItem = (cartItems || []).find(i => String(i.id) === String(id))
    const cartQty = inCartItem ? inCartItem.quantity : 0

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

    const sanitizeImg = (u) => {
        if (!u || typeof u !== 'string') return '';
        const trimmed = u.trim();
        if (trimmed.startsWith('https://rkkeys.co.in/')) return trimmed.replace('https://rkkeys.co.in/', 'https://i0.wp.com/rkkeys.co.in/');
        if (trimmed.startsWith('http://rkkeys.co.in/')) return trimmed.replace('http://rkkeys.co.in/', 'https://i0.wp.com/rkkeys.co.in/');
        return trimmed;
    };

    const handleImgError = (e) => {
        const target = e.currentTarget;
        if (target.src && !target.src.includes('wsrv.nl') && !target.src.includes('placeholder-key.svg')) {
            const rawUrl = target.src.replace('https://i0.wp.com/', 'https://');
            target.src = `https://wsrv.nl/?url=${encodeURIComponent(rawUrl)}`;
        } else {
            target.src = '/placeholder-key.svg';
        }
    };

    // Build Gallery from DB (supports 4-6 images from backend/admin panel)
    const mainImg = sanitizeImg(product?.image_url || product?.image || '')
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
        .map(u => typeof u === 'string' ? sanitizeImg(u) : '')
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
        .filter(([k, v]) => k.toLowerCase() !== 'source' && k.toLowerCase() !== 'availability' && v !== undefined && v !== null && String(v).trim() !== '')
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
    const activeQty = cartQty > 0 ? cartQty : (activeVariant ? activeVariant.qty : 1)
    const finalPrice = activeVariant ? activeVariant.price : basePrice
    const finalOriginalPrice = activeVariant ? (activeVariant.originalPrice || activeVariant.price) : (baseOriginalPrice || basePrice)
    const finalSavings = (finalOriginalPrice > finalPrice) ? (finalOriginalPrice - finalPrice) : 0
    const finalUnitCost = activeVariant ? (activeVariant.price / activeVariant.qty) : basePrice

    const isInStock = product ? (product.in_stock !== false && product.inStock !== false) : true

    // Set initial color based on what actually exists
    useEffect(() => {
        if (product && colors.length > 0) {
            setSelectedColor(colors[0])
        }
    }, [product, colors.length])

    const handleAddToCart = async () => {
        if (!isInStock) {
            alert('Sorry, this product is currently out of stock.');
            return;
        }
        const qtyToAdd = activeVariant ? activeVariant.qty : (quantity || 1)
        const res = await addToCart({
            ...product,
            id: product?.id || id,
            in_stock: true,
            inStock: true,
            sku: product.sku || `SMN-${(product.category || 'GEN').substring(0, 3).toUpperCase()}-${String(product.id || id).padStart(4, '0')}`,
            name: product.name,
            price: finalUnitCost,
            image: gallery[0] || product.image_url || null,
            image_url: gallery[0] || product.image_url || null,
            originalPrice: baseOriginalPrice,
            selectedColor: selectedColor && selectedColor.toLowerCase() !== 'standard' ? selectedColor : null,
            variantId: activeVariant?.discountApplied > 0 ? `Buy ${activeVariant.qty} (${activeVariant.discountApplied}% Off)` : (selectedColor && selectedColor.toLowerCase() !== 'standard' ? `Color: ${selectedColor}` : undefined),
            appliedOffer: activeVariant?.discountApplied > 0 ? `Buy ${activeVariant.qty} (${activeVariant.discountApplied}% Off)` : null
        }, qtyToAdd)
        if (res && res.success === false) {
            return;
        }
        setAdded(true)
        setTimeout(() => setAdded(false), 650)
    }

    const handleBuyNow = async () => {
        if (!isInStock) {
            alert('Sorry, this product is currently out of stock.');
            return;
        }
        if (cartQty <= 0) {
            await handleAddToCart()
        }
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
                    <nav className="breadcrumb" aria-label="Breadcrumb">
                        <Link to="/"><i className="bi bi-house" /> Home</Link>
                        <span className="breadcrumb-separator">›</span>
                        <Link to="/products">Products</Link>
                        {product?.category && (
                            <>
                                <span className="breadcrumb-separator">›</span>
                                <Link to={`/products?category=${encodeURIComponent(product.category)}`} style={{ textTransform: 'capitalize' }}>
                                    {product.category}
                                </Link>
                            </>
                        )}
                        {product?.subcategory && (
                            <>
                                <span className="breadcrumb-separator">›</span>
                                <span style={{ color: 'var(--text-secondary)' }}>{product.subcategory}</span>
                            </>
                        )}
                        <span className="breadcrumb-separator">›</span>
                        <span className="breadcrumb-current" title={product?.name}>{product?.name}</span>
                    </nav>
                </div>
            </div>

            <div className="container pdp-container" style={{ padding: '28px 24px 64px' }}>

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
                                        <img src={img} alt={`Thumb ${idx}`} onError={handleImgError} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Big Image Box */}
                        <div className="pdp-big-image-box" style={{
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
                                    onError={handleImgError}
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
                                {product.subcategory && (
                                    <div style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        background: 'rgba(16, 185, 129, 0.08)',
                                        color: '#047857',
                                        border: '1px solid rgba(16, 185, 129, 0.25)',
                                        padding: '4px 12px',
                                        borderRadius: '20px',
                                        fontSize: '0.8rem',
                                        fontWeight: '700'
                                    }}>
                                        <i className="bi bi-diagram-3-fill" />
                                        <span>{product.subcategory}</span>
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

                            <div style={{
                                marginLeft: hasRatingOrReviews ? 'auto' : '0',
                                backgroundColor: !isInStock ? '#FEE2E2' : '#D1FAE5',
                                color: !isInStock ? '#DC2626' : '#065F46',
                                padding: '5px 14px',
                                borderRadius: '20px',
                                fontSize: '0.85rem',
                                fontWeight: '700',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}>
                                <i className={`bi ${!isInStock ? 'bi-x-circle-fill' : 'bi-check-circle-fill'}`} />
                                {!isInStock ? 'Out of Stock' : 'In Stock'}
                            </div>
                        </div>

                        {/* Price Block */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '8px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '2.75rem', fontWeight: '900', color: '#111827', lineHeight: '1', letterSpacing: '-1px' }}>
                                ₹{finalPrice.toLocaleString()}
                            </span>
                            {hasDiscount && (
                                <span style={{ fontSize: '1.4rem', color: '#9CA3AF', textDecoration: 'line-through', fontWeight: '600' }}>
                                    ₹{finalOriginalPrice.toLocaleString()}
                                </span>
                            )}
                            {hasDiscount && (
                                <span style={{ backgroundColor: '#FEF3C7', color: '#92400E', padding: '6px 12px', borderRadius: '20px', fontSize: '0.875rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <i className="bi bi-tag-fill" /> {discountPercentage}% OFF
                                </span>
                            )}
                        </div>

                        {/* You Save (Only if discounted in backend) */}
                        {hasDiscount && finalSavings > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#059669', fontSize: '0.95rem', fontWeight: '600', marginBottom: '24px' }}>
                                <i className="bi bi-piggy-bank" style={{ fontSize: '1.15rem' }} />
                                <span>You save <strong style={{ fontWeight: '800' }}>₹{finalSavings.toLocaleString()}</strong> on this order</span>
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



                        {/* Action Buttons */}
                        <div className="pdp-action-buttons">
                            {cartQty > 0 ? (
                                <div
                                    className="pdp-qty-stepper-pill"
                                    id="pdp-qty-stepper"
                                    style={{
                                        border: '2px solid #E58A1F',
                                        boxShadow: '0 0 0 1px #E58A1F, 0 2px 10px rgba(229, 138, 31, 0.20)',
                                    }}
                                >
                                    <button
                                        type="button"
                                        className="pdp-qty-stepper-btn"
                                        style={{ borderRight: '1.5px solid #FED7AA' }}
                                        onClick={() => {
                                            const targetId = product?.id || id
                                            if (cartQty <= 1) {
                                                removeFromCart(targetId)
                                            } else {
                                                updateQty(targetId, cartQty - 1)
                                            }
                                        }}
                                        aria-label="Decrease quantity"
                                    >
                                        —
                                    </button>
                                    <span className="pdp-qty-stepper-val">{cartQty}</span>
                                    <button
                                        type="button"
                                        className="pdp-qty-stepper-btn"
                                        style={{ borderLeft: '1.5px solid #FED7AA' }}
                                        onClick={() => {
                                            const targetId = product?.id || id
                                            updateQty(targetId, cartQty + 1)
                                        }}
                                        aria-label="Increase quantity"
                                    >
                                        +
                                    </button>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    id="pdp-add-to-cart"
                                    className="pdp-btn-cart"
                                    style={
                                        !isInStock
                                            ? { border: '2px solid #D1D5DB' }
                                            : {
                                                border: '2px solid #E58A1F',
                                                boxShadow: '0 0 0 1px #E58A1F, 0 2px 10px rgba(229, 138, 31, 0.18)',
                                                color: '#D97706',
                                                background: '#FFFDF9',
                                            }
                                    }
                                    onClick={handleAddToCart}
                                    disabled={!isInStock}
                                >
                                    {!isInStock ? (
                                        <><i className="bi bi-x-circle" /> Out of Stock</>
                                    ) : (
                                        <><i className="bi bi-cart-plus" /> Add to Cart</>
                                    )}
                                </button>
                            )}
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
                                <div className="pdp-specs-grid">
                                    {mappedSpecs.map((spec, i) => (
                                        <div key={i} className="pdp-spec-card">
                                            <span className="pdp-spec-label">{spec.label}</span>
                                            <span className="pdp-spec-value">{spec.value}</span>
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

            {/* Recommended Products Section (recommends 4 products as per current product category) */}
            {similarProducts && similarProducts.length > 0 && (
                <section className="recommended-products-section" style={{ maxWidth: '1240px', margin: '0 auto', padding: '20px 20px 80px' }}>
                    <div style={{ marginTop: '20px', paddingTop: '36px', borderTop: '1px solid #E5E7EB' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
                            <div>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--cta)', marginBottom: '4px' }}>
                                    <i className="bi bi-stars" /> Handpicked For You
                                </span>
                                <h2 style={{ fontSize: '1.75rem', fontWeight: '800', color: '#111827', margin: 0 }}>
                                    Recommended Products
                                </h2>
                                {product?.category && (
                                    <p style={{ margin: '4px 0 0 0', fontSize: '0.9rem', color: '#6B7280' }}>
                                        More high-demand items from <strong style={{ color: '#374151' }}>{product.category}</strong>
                                    </p>
                                )}
                            </div>
                            <Link 
                                to={product?.category ? `/products?category=${encodeURIComponent(product.category)}` : '/products'} 
                                style={{ 
                                    color: 'var(--cta)', 
                                    fontWeight: '700', 
                                    fontSize: '0.9rem', 
                                    display: 'inline-flex', 
                                    alignItems: 'center', 
                                    gap: '6px',
                                    textDecoration: 'none'
                                }}
                            >
                                View All in {product?.category || 'Catalog'} <i className="bi bi-arrow-right" />
                            </Link>
                        </div>
                        <div className="recommended-products-grid">
                            {similarProducts.slice(0, 4).map((prod) => (
                                <ProductCard key={prod.id} id={`recommended-card-${prod.id}`} product={prod} />
                            ))}
                        </div>
                    </div>
                </section>
            )}
        </div>
    )
}
