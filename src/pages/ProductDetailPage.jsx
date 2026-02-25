import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useProductDetail, useReviews } from '../hooks/useProducts'
import { formatPrice, submitReview } from '../lib/productsService'
import { useCart } from '../context/CartContext'
import { useAuth } from '../context/AuthContext'
import './ProductDetailPage.css'

/* ─── Star Row Component ─────────────────────────── */
function Stars({ rating, size = '0.875rem' }) {
    const r = rating || 0
    return (
        <span className="stars-row" style={{ fontSize: size }}>
            {[1, 2, 3, 4, 5].map(i => (
                <i key={i} className={`bi ${i <= Math.floor(r) ? 'bi-star-fill' : i - r < 1 ? 'bi-star-half' : 'bi-star'}`} />
            ))}
        </span>
    )
}

/* ─── Rating Breakdown Bar ───────────────────────── */
function RatingBar({ label, pct }) {
    return (
        <div className="rating-bar-row">
            <span className="rb-label">{label} <i className="bi bi-star-fill" /></span>
            <div className="rb-track"><div className="rb-fill" style={{ width: `${pct}%` }} /></div>
            <span className="rb-pct">{pct}%</span>
        </div>
    )
}

/* ─── Review Card ────────────────────────────────── */
function ReviewCard({ review }) {
    // review.profiles is joined from Supabase; fallback for mock data
    const user = review.profiles?.full_name || review.user || 'Anonymous'
    const avatar = review.avatar || (user).charAt(0)

    return (
        <div className="review-card" id={`review-${review.id}`}>
            <div className="review-header">
                <div className="review-avatar">{avatar}</div>
                <div className="review-meta">
                    <span className="review-user">{user}</span>
                    {review.verified && (
                        <span className="review-verified"><i className="bi bi-patch-check-fill" /> Verified Purchase</span>
                    )}
                </div>
                <span className="review-date">
                    <i className="bi bi-calendar3" /> {review.created_at ? new Date(review.created_at).toLocaleDateString() : (review.date || 'Recent')}
                </span>
            </div>
            <div className="review-rating">
                <Stars rating={review.rating} />
                <strong className="review-title">{review.title}</strong>
            </div>
            <p className="review-body">{review.body}</p>
        </div>
    )
}

/* ─── Similar Product Card ───────────────────────── */
function SimilarProductCard({ product }) {
    const { addToCart } = useCart()
    const navigate = useNavigate()
    const originalPrice = Number(product.original_price || product.price)
    const price = Number(product.price)
    const discount = Math.round(((originalPrice - price) / originalPrice) * 100)

    return (
        <div className="similar-card" id={`similar-${product.id}`}>
            <div className="similar-card__img-wrap" onClick={() => navigate(`/products/${product.id}`)}>
                <img src={product.image_url ?? product.image} alt={product.name} loading="lazy" />
                {product.badge && <span className="similar-card__badge">{product.badge}</span>}
                {discount > 0 && <span className="similar-card__discount">-{discount}%</span>}
            </div>
            <div className="similar-card__body">
                <p className="similar-card__name">{product.name}</p>
                <div className="similar-card__rating">
                    <Stars rating={product.rating} size="0.75rem" />
                    <span className="similar-rating-count">({product.review_count ?? (Array.isArray(product.reviews) ? product.reviews.length : product.reviews) ?? 0})</span>
                </div>
                <div className="similar-card__pricing">
                    <span className="similar-price">{formatPrice(price)}</span>
                    <span className="similar-orig">{formatPrice(originalPrice)}</span>
                </div>
                <button className="btn btn-primary btn-sm btn-full" onClick={() => addToCart({
                    ...product,
                    image: product.image_url ?? product.image,
                    originalPrice: product.original_price ?? product.originalPrice
                })}>
                    <i className="bi bi-cart-plus" /> Add to Cart
                </button>
            </div>
        </div>
    )
}

/* ─── Image Zoom Component ───────────────────────── */
function ZoomImage({ src, alt }) {
    const [style, setStyle] = useState({ transformOrigin: 'center center', transform: 'scale(1)' })
    const [zoomed, setZoomed] = useState(false)

    const handleMouseMove = (e) => {
        const { left, top, width, height } = e.currentTarget.getBoundingClientRect()
        // Default to center if dimensions somehow fail
        if (!width || !height) return;
        const x = ((e.clientX - left) / width) * 100
        const y = ((e.clientY - top) / height) * 100
        setStyle({ transformOrigin: `${x}% ${y}%`, transform: 'scale(2.2)' }) // Zoom strength 2.2x
    }

    const handleMouseLeave = () => {
        setZoomed(false)
        setStyle({ transformOrigin: 'center center', transform: 'scale(1)' })
    }

    return (
        <div
            className="zoom-container"
            onMouseEnter={() => setZoomed(true)}
            onMouseLeave={handleMouseLeave}
            onMouseMove={handleMouseMove}
        >
            <img
                src={src}
                alt={alt}
                className={`main-product-img ${zoomed ? 'is-zoomed' : ''}`}
                style={style}
            />
        </div>
    )
}


/* ─── Main Page ──────────────────────────────────── */
export default function ProductDetailPage() {
    const { id } = useParams()
    const navigate = useNavigate()
    const { addToCart } = useCart()

    // ── Live Data from Supabase ──
    const { product, loading: productLoading, error: productError, similarProducts } = useProductDetail(id)
    const { reviews, loading: reviewsLoading, refresh: refreshReviews } = useReviews(id)
    const { user } = useAuth()

    const [activeImg, setActiveImg] = useState(0)
    const [activeColor, setActiveColor] = useState(0)
    const [qty, setQty] = useState(1)
    const [added, setAdded] = useState(false)
    const [activeTab, setActiveTab] = useState('overview')

    // Reset state on ID change
    useEffect(() => {
        window.scrollTo(0, 0)
        setActiveImg(0)
        setActiveColor(0)
        setQty(1)
    }, [id])

    if (productLoading) return (
        <div className="container" style={{ padding: '100px 0', textAlign: 'center' }}>
            <div className="spinner-border text-primary" role="status"></div>
            <p style={{ marginTop: 20, color: 'var(--text-muted)' }}>Loading product excellence...</p>
        </div>
    )

    if (productError || !product) return (
        <div className="container" style={{ padding: '100px 0', textAlign: 'center' }}>
            <h2 style={{ color: 'var(--accent)' }}>404: Product Not Found</h2>
            <p>The product you are looking for doesn't exist or has been removed.</p>
            <Link to="/" className="btn btn-primary" style={{ marginTop: 20 }}>Return to Catalog</Link>
        </div>
    )

    // Normalize fields (Handle both Supabase snake_case and MockData camelCase)
    const price = Number(product.price)
    const originalPrice = Number(product.original_price ?? product.originalPrice ?? product.price)
    const discount = Math.round(((originalPrice - price) / originalPrice) * 100)

    const inStock = product.in_stock ?? product.inStock ?? true
    const reviewCount = product.review_count ?? (Array.isArray(product.reviews) ? product.reviews.length : product.reviews) ?? 0

    const colors = product.colors || []

    // Gallery: primary image first, then extra product_images if they exist
    const mainImg = product.image_url ?? product.image;
    const gallery = mainImg ? [mainImg] : [];
    if (product.product_images && product.product_images.length > 0) {
        gallery.push(...[...product.product_images].sort((a, b) => a.sort_order - b.sort_order).map(img => img.url));
    }

    // Specs/Description from 'details' (Supabase) or 'specs' (MockData)
    const details = product.details || {}
    const highlights = Array.isArray(details.highlights) ? details.highlights : (product.highlights || [])
    const specs = details.specifications || product.specs || {}
    const longDescription = details.long_description || product.description || 'No detailed description available.'

    const handleAddToCart = () => {
        addToCart({
            ...product,
            image: product.image_url ?? product.image,
            originalPrice: originalPrice
        }, qty)
        setAdded(true)
        setTimeout(() => setAdded(false), 2000)
    }

    return (
        <div className="product-detail-page page-enter" id="product-detail-page">

            {/* ── Breadcrumb ── */}
            <div className="pdp-breadcrumb-bar">
                <div className="container">
                    <nav className="breadcrumb">
                        <Link to="/"><i className="bi bi-house" /> Home</Link><span>›</span>
                        <Link to="/products">
                            <i className="bi bi-grid" /> {product.category?.charAt(0).toUpperCase() + product.category?.slice(1)}
                        </Link><span>›</span>
                        <span>{product.name}</span>
                    </nav>
                </div>
            </div>

            {/* ── Main Product Section ── */}
            <section className="pdp-main" id="pdp-main">
                <div className="container pdp-main__inner">

                    {/* Left: Image Gallery */}
                    <div className="pdp-gallery" id="pdp-gallery">
                        {/* Thumbnails */}
                        <div className="pdp-thumbnails" id="pdp-thumbnails">
                            {gallery.map((img, i) => (
                                <button
                                    key={i}
                                    id={`thumb-${i}`}
                                    className={`pdp-thumb ${activeImg === i ? 'active' : ''}`}
                                    onClick={() => setActiveImg(i)}
                                >
                                    <img src={img} alt={`${product.name} view ${i + 1}`} />
                                </button>
                            ))}
                        </div>

                        {/* Main Image with Zoom */}
                        <div className="pdp-main-image-wrap">
                            <ZoomImage src={gallery[activeImg]} alt={product.name} />
                            <div className="zoom-hint">
                                <i className="bi bi-zoom-in" /> Hover to zoom
                            </div>
                            {gallery.length > 1 && (
                                <>
                                    <button className="img-nav img-nav--prev" id="img-prev" onClick={() => setActiveImg(i => (i - 1 + gallery.length) % gallery.length)}>
                                        <i className="bi bi-chevron-left" />
                                    </button>
                                    <button className="img-nav img-nav--next" id="img-next" onClick={() => setActiveImg(i => (i + 1) % gallery.length)}>
                                        <i className="bi bi-chevron-right" />
                                    </button>
                                </>
                            )}
                            <div className="img-counter">{activeImg + 1} / {gallery.length}</div>
                            {product.badge && <span className="pdp-badge">{product.badge}</span>}
                        </div>
                    </div>

                    {/* Right: Product Info */}
                    <div className="pdp-info" id="pdp-info">
                        <div className="pdp-brand">
                            <span className="brand-name"><i className="bi bi-building" /> {product.brand}</span>
                            <span className="pdp-sku"><i className="bi bi-upc" /> SKU: {details.sku || `PC-${product.id}`}</span>
                        </div>

                        <h1 className="pdp-title">{product.name}</h1>

                        <div className="pdp-rating-row">
                            <Stars rating={product.rating} size="1rem" />
                            <span className="pdp-rating-val">{product.rating}</span>
                            <span className="pdp-rating-count">({reviewCount} reviews)</span>
                            <span className="pdp-rating-divider">·</span>
                            <span className={`pdp-stock-badge ${inStock ? 'in-stock' : 'out-stock'}`}>
                                <i className={`bi ${inStock ? 'bi-check-circle-fill' : 'bi-x-circle-fill'}`} />
                                {inStock ? 'In Stock' : 'Out of Stock'}
                            </span>
                        </div>

                        <div className="pdp-price-block">
                            <span className="pdp-price">{formatPrice(price)}</span>
                            {discount > 0 && <span className="pdp-orig-price">{formatPrice(originalPrice)}</span>}
                            {discount > 0 && (
                                <span className="pdp-discount-pill">
                                    <i className="bi bi-tag-fill" /> {discount}% OFF
                                </span>
                            )}
                        </div>
                        {discount > 0 && (
                            <p className="pdp-savings">
                                <i className="bi bi-piggy-bank" /> You save <strong>{formatPrice(originalPrice - price)}</strong> on this purchase
                            </p>
                        )}

                        <hr className="pdp-divider" />

                        {/* Colors */}
                        {colors.length > 0 && (
                            <div className="pdp-color-section" id="pdp-colors">
                                <p className="pdp-option-label">
                                    <i className="bi bi-palette" /> Color: <strong>{colors[activeColor]}</strong>
                                </p>
                                <div className="color-name-tags">
                                    {colors.map((c, i) => (
                                        <button
                                            key={i}
                                            className={`color-tag ${activeColor === i ? 'active' : ''}`}
                                            onClick={() => setActiveColor(i)}
                                        >
                                            {c}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Quantity */}
                        <div className="pdp-qty-section">
                            <p className="pdp-option-label"><i className="bi bi-layers" /> Quantity</p>
                            <div className="qty-stepper">
                                <button className="qty-btn" onClick={() => setQty(q => Math.max(1, q - 1))} disabled={qty <= 1}>
                                    <i className="bi bi-dash" />
                                </button>
                                <span className="qty-val">{qty}</span>
                                <button className="qty-btn" onClick={() => setQty(q => Math.min(10, q + 1))} disabled={qty >= 10}>
                                    <i className="bi bi-plus" />
                                </button>
                            </div>
                        </div>

                        {/* CTA Buttons */}
                        <div className="pdp-cta-group">
                            <button
                                className={`btn btn-secondary btn-lg pdp-cart-btn ${added ? 'added' : ''}`}
                                onClick={handleAddToCart}
                                disabled={!inStock}
                            >
                                {added
                                    ? <><i className="bi bi-check-circle-fill" /> Added to Cart!</>
                                    : <><i className="bi bi-cart-plus" /> Add to Cart</>
                                }
                            </button>
                            <button
                                className="btn btn-primary btn-lg pdp-buy-btn"
                                onClick={() => { handleAddToCart(); navigate('/cart') }}
                                disabled={!inStock}
                            >
                                <i className="bi bi-lightning-charge-fill" /> Buy Now
                            </button>
                        </div>

                        {/* Highlights */}
                        <div className="pdp-highlights">
                            {highlights.map((h, i) => (
                                <div key={i} className="pdp-highlight-item">
                                    <i className="bi bi-check-circle-fill" />
                                    <span>{h}</span>
                                </div>
                            ))}
                        </div>

                        <div className="pdp-actions-row">
                            <button className="text-action-btn"><i className="bi bi-heart" /> Wishlist</button>
                            <button className="text-action-btn"><i className="bi bi-share" /> Share</button>
                        </div>
                    </div>
                </div>
            </section>

            {/* Delivery Banner */}
            <div className="pdp-delivery-banner">
                <div className="container pdp-delivery-inner">
                    <div><i className="bi bi-truck" /><span>Free delivery in <strong>2 days</strong></span></div>
                    <div><i className="bi bi-arrow-return-left" /><span><strong>7-day</strong> returns</span></div>
                    <div><i className="bi bi-shield-check" /><span><strong>1-year</strong> warranty</span></div>
                    <div><i className="bi bi-lock-fill" /><span><strong>Secure</strong> payment</span></div>
                </div>
            </div>

            {/* Tabs */}
            <div className="pdp-tabs-section">
                <div className="container">
                    <div className="pdp-tabs" role="tablist">
                        {[
                            { id: 'overview', label: 'Overview', icon: 'bi-info-circle' },
                            { id: 'specs', label: 'Specifications', icon: 'bi-list-columns' },
                            { id: 'reviews', label: `Reviews (${reviews.length})`, icon: 'bi-chat-quote' },
                        ].map(tab => (
                            <button
                                key={tab.id}
                                className={`pdp-tab ${activeTab === tab.id ? 'active' : ''}`}
                                onClick={() => setActiveTab(tab.id)}
                            >
                                <i className={`bi ${tab.icon}`} /> {tab.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Tab Content */}
            <div className="pdp-tab-content">
                <div className="container">
                    {activeTab === 'overview' && (
                        <div className="tab-panel">
                            <h2><i className="bi bi-info-circle" /> About this Product</h2>
                            <p className="overview-long-desc">{longDescription}</p>
                            <div className="overview-highlights-box">
                                <h3><i className="bi bi-stars" /> Key Features</h3>
                                <div className="features-grid-pdp">
                                    {highlights.length > 0 ? highlights.map((h, i) => (
                                        <div key={i} className="feature-tile">
                                            <div className="feature-tile__icon"><i className="bi bi-check2-circle" /></div>
                                            <p>{h}</p>
                                        </div>
                                    )) : (
                                        <div className="feature-tile">
                                            <div className="feature-tile__icon"><i className="bi bi-check2-circle" /></div>
                                            <p>Premium quality guaranteed</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'specs' && (
                        <div className="tab-panel">
                            <h2><i className="bi bi-list-columns" /> Technical Specifications</h2>
                            <div className="specs-table-wrap">
                                <table className="specs-table">
                                    <tbody>
                                        <tr className="spec-section-row"><td colSpan={2}>General</td></tr>
                                        <tr><td>Brand</td><td>{product.brand}</td></tr>
                                        <tr><td>Category</td><td>{product.category}</td></tr>
                                        <tr><td>Model</td><td>{product.name}</td></tr>
                                        {Object.keys(specs).length > 0 && (
                                            <>
                                                <tr className="spec-section-row"><td colSpan={2}>Details</td></tr>
                                                {Object.entries(specs).map(([k, v]) => (
                                                    <tr key={k}>
                                                        <td>{k.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</td>
                                                        <td>{String(v)}</td>
                                                    </tr>
                                                ))}
                                            </>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {activeTab === 'reviews' && (
                        <div className="tab-panel">
                            <div className="reviews-layout">
                                <div className="reviews-summary">
                                    <div className="rs-score-block">
                                        <span className="rs-big-score">{product.rating || '0.0'}</span>
                                        <Stars rating={product.rating || 0} size="1.25rem" />
                                        <span className="rs-count">{reviewCount} ratings</span>
                                    </div>
                                    <ReviewForm productId={product.id} onSubmitted={refreshReviews} />
                                </div>
                                <div className="reviews-list-col">
                                    <h2>Customer Reviews</h2>
                                    <div className="reviews-list">
                                        {reviews.length > 0
                                            ? reviews.map(r => <ReviewCard key={r.id} review={r} />)
                                            : <p>No reviews yet. Be the first to review!</p>
                                        }
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                </div>
            </div>

            {/* Similar Products */}
            {similarProducts.length > 0 && (
                <section className="pdp-similar">
                    <div className="container">
                        <div className="pdp-similar__header">
                            <span className="section-label"><i className="bi bi-stars" /> Related Items</span>
                            <h2>Similar Products</h2>
                        </div>
                        <div className="similar-grid">
                            {similarProducts.map(p => <SimilarProductCard key={p.id} product={p} />)}
                        </div>
                    </div>
                </section>
            )}
        </div>
    )
}

/**
 * Form to submit a new review.
 */
function ReviewForm({ productId, onSubmitted }) {
    const { user } = useAuth()
    const [rating, setRating] = useState(5)
    const [title, setTitle] = useState('')
    const [body, setBody] = useState('')
    const [loading, setLoading] = useState(false)
    const [success, setSuccess] = useState(false)

    if (!user) return (
        <div className="review-form-login">
            <p className="alert alert-info" style={{ fontSize: '0.875rem' }}>Please log in to write a review.</p>
        </div>
    )

    if (success) return (
        <div className="review-form-success">
            <i className="bi bi-check-circle-fill" /> Review submitted!
        </div>
    )

    const handleSubmit = async (e) => {
        e.preventDefault()
        setLoading(true)
        try {
            await submitReview({ productId, userId: user.id, rating, title, body })
            setSuccess(true)
            if (onSubmitted) onSubmitted()
        } catch (err) {
            alert('Error submitting review: ' + err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <form className="review-form" onSubmit={handleSubmit}>
            <h3>Write a Review</h3>
            <div className="form-group" style={{ marginBottom: 15 }}>
                <label style={{ display: 'block', marginBottom: 5, fontWeight: 600 }}>Rating</label>
                <div className="star-rating-input">
                    {[1, 2, 3, 4, 5].map(s => (
                        <i
                            key={s}
                            className={`bi ${s <= rating ? 'bi-star-fill' : 'bi-star'}`}
                            onClick={() => setRating(s)}
                            style={{ cursor: 'pointer', color: '#f39c12', fontSize: '1.25rem', marginRight: 4 }}
                        />
                    ))}
                </div>
            </div>
            <div className="form-group" style={{ marginBottom: 15 }}>
                <label style={{ display: 'block', marginBottom: 5, fontWeight: 600 }}>Headline</label>
                <input
                    type="text"
                    className="form-control"
                    placeholder="Briefly summarize your experience"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    required
                />
            </div>
            <div className="form-group" style={{ marginBottom: 15 }}>
                <label style={{ display: 'block', marginBottom: 5, fontWeight: 600 }}>Your Review</label>
                <textarea
                    className="form-control"
                    placeholder="What did you like or dislike?"
                    value={body}
                    onChange={e => setBody(e.target.value)}
                    required
                    style={{ minHeight: 80 }}
                />
            </div>
            <button className="btn btn-primary btn-sm btn-full" disabled={loading}>
                {loading ? 'Submitting...' : 'Post Review'}
            </button>
        </form>
    )
}
