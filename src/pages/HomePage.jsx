import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { formatPrice } from '../data/mockData'
import { useProducts, useCategories } from '../hooks/useProducts'
import { useCart } from '../context/CartContext'
import './HomePage.css'

const FEATURES = [
    { icon: 'bi-rocket-takeoff', title: 'Express Delivery', desc: '24–48 hr delivery to all major cities in India.', color: '#0077FF' },
    { icon: 'bi-shield-check', title: '1-Year Warranty', desc: 'Every product comes with full brand warranty.', color: '#2EA8FF' },
    { icon: 'bi-arrow-return-left', title: '7-Day Returns', desc: 'Hassle-free returns — no questions asked.', color: '#6C5CE7' },
    { icon: 'bi-lock-fill', title: 'Secure Payments', desc: 'UPI, Card, NetBanking — 100% encrypted.', color: '#00B894' },
]

const STATS = [
    { value: '50K+', label: 'Happy Customers', icon: 'bi-people-fill' },
    { value: '200+', label: 'Products', icon: 'bi-grid-fill' },
    { value: '4.9★', label: 'Avg Rating', icon: 'bi-star-fill' },
    { value: '99%', label: 'On-Time Delivery', icon: 'bi-clock-fill' },
]

const CATEGORY_ICONS = {
    watches: 'bi-smartwatch',
    airpods: 'bi-earbuds',
    headphones: 'bi-headphones',
    smartphones: 'bi-phone',
}

function ProductCard({ product: raw, loading }) {
    const { addToCart } = useCart()
    const navigate = useNavigate()
    const [added, setAdded] = useState(false)

    if (loading || !raw) {
        return (
            <div className="product-card product-card--skeleton">
                <div className="skeleton product-card__img-wrap" />
                <div className="product-card__body">
                    <div className="skeleton" style={{ height: 16, width: '70%', marginBottom: 8 }} />
                    <div className="skeleton" style={{ height: 14, width: '50%', marginBottom: 16 }} />
                    <div className="skeleton" style={{ height: 36, width: '100%' }} />
                </div>
            </div>
        )
    }

    const product = {
        ...raw,
        originalPrice: raw.original_price ?? raw.originalPrice ?? raw.price,
        inStock: raw.in_stock ?? raw.inStock ?? true,
        reviewCount: raw.review_count ?? raw.reviewCount ?? raw.reviews ?? 0,
        image: raw.image_url ?? raw.image ?? '',
    }

    const handleAdd = (e) => {
        e.stopPropagation()
        addToCart(product)
        setAdded(true)
        setTimeout(() => setAdded(false), 1500)
    }

    const discount = product.originalPrice > product.price
        ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
        : 0

    return (
        <div className="product-card" id={`product-card-${product.id}`}>
            <div
                className="product-card__img-wrap"
                onClick={() => navigate(`/products/${product.id}`)}
                style={{ cursor: 'pointer' }}
            >
                <img src={product.image} alt={product.name} className="product-card__img" loading="lazy" />
                {product.badge && <span className="product-card__badge">{product.badge}</span>}
                {!product.inStock && <div className="product-card__out-of-stock"><i className="bi bi-x-circle" /> Out of Stock</div>}
                {discount > 0 && <span className="product-card__discount">-{discount}%</span>}
                <div className="product-card__img-overlay">
                    <span><i className="bi bi-eye" /> View Details</span>
                </div>
            </div>
            <div className="product-card__body">
                <p className="product-card__category">
                    <i className={`bi ${CATEGORY_ICONS[product.category] || 'bi-box'}`} />
                    {product.category}
                </p>
                <h3
                    className="product-card__title"
                    onClick={() => navigate(`/products/${product.id}`)}
                    style={{ cursor: 'pointer' }}
                >{product.name}</h3>
                <div className="product-card__rating">
                    {[...Array(5)].map((_, i) => (
                        <i key={i} className={`bi ${i < Math.floor(product.rating) ? 'bi-star-fill' : 'bi-star'}`} />
                    ))}
                    <span className="rating-val">{product.rating}</span>
                    <span className="rating-count">({product.reviewCount.toLocaleString()})</span>
                </div>
                <div className="product-card__pricing">
                    <span className="price-current">{formatPrice(product.price)}</span>
                    <span className="price-original">{formatPrice(product.originalPrice)}</span>
                </div>
                <div className="product-card__cta-group">
                    <button
                        id={`add-to-cart-${product.id}`}
                        className={`btn btn-primary product-card__cta ${added ? 'added' : ''}`}
                        onClick={handleAdd}
                        disabled={!product.inStock}
                    >
                        {!product.inStock
                            ? <><i className="bi bi-x-circle" /> Out of Stock</>
                            : added
                                ? <><i className="bi bi-check-circle-fill" /> Added!</>
                                : <><i className="bi bi-cart-plus" /> Add to Cart</>
                        }
                    </button>
                    <button
                        id={`view-details-${product.id}`}
                        className="btn btn-outline product-card__details-btn"
                        onClick={() => navigate(`/products/${product.id}`)}
                        title="View Details"
                    >
                        <i className="bi bi-eye" />
                    </button>
                </div>
            </div>
        </div>
    )
}

export default function HomePage() {
    const navigate = useNavigate()
    const [activeCategory, setActiveCategory] = useState('all')
    const [visibleCount, setVisibleCount] = useState(8)

    // Fetch live products based on the active featured tab
    const filters = activeCategory === 'all' ? {} : { category: activeCategory }
    const { products: filtered, loading } = useProducts(filters, 'featured')
    const { categories } = useCategories()

    const displayed = filtered.slice(0, visibleCount)

    return (
        <div className="home-page page-enter" id="home-page">

            {/* ── Hero ── */}
            <section className="hero" id="hero-section">
                <div className="hero__bg-gradient" />
                <div className="hero__floating-orb hero__floating-orb--1" />
                <div className="hero__floating-orb hero__floating-orb--2" />
                <div className="container hero__inner">
                    <div className="hero__content">
                        <span className="section-label hero__label">
                            <i className="bi bi-fire" /> New Arrivals 2024
                        </span>
                        <h1 className="hero__title">
                            Premium Tech<br />
                            <span className="hero__title-accent">Unbeatable Prices</span>
                        </h1>
                        <p className="hero__subtitle">
                            Shop the finest watches, AirPods, and headphones. Free delivery on orders above ₹999. Guaranteed authentic.
                        </p>
                        <div className="hero__actions">
                            <a href="#featured" className="btn btn-primary btn-lg" id="hero-shop-now">
                                <i className="bi bi-bag-fill" /> Shop Now
                            </a>
                            <Link to="/orders" className="btn btn-secondary btn-lg" id="hero-my-orders">
                                <i className="bi bi-box-seam" /> My Orders
                            </Link>
                        </div>
                        <div className="hero__trust">
                            <span><i className="bi bi-shield-fill-check" /> 1-Year Warranty</span>
                            <span><i className="bi bi-arrow-return-left" /> Free Returns</span>
                            <span><i className="bi bi-lock-fill" /> Secure Pay</span>
                        </div>
                    </div>
                    <div className="hero__visual">
                        <div className="hero__product-showcase">
                            <div className="hero__showcase-ring" />
                            <img
                                src="https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=520&h=520&fit=crop"
                                alt="Premium Smart Watch"
                                className="hero__showcase-img"
                            />
                            <div className="hero__floating-card hero__floating-card--1">
                                <i className="bi bi-smartwatch floating-card__icon" />
                                <div>
                                    <p className="floating-card__title">ProWatch Ultra</p>
                                    <p className="floating-card__price">₹24,999</p>
                                </div>
                            </div>
                            <div className="hero__floating-card hero__floating-card--2">
                                <i className="bi bi-trophy-fill floating-card__icon" />
                                <div>
                                    <p className="floating-card__title">Best Seller</p>
                                    <p className="floating-card__price">4.8 ★ Rating</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── Stats ── */}
            <section className="stats-bar" id="stats-section">
                <div className="container stats-bar__inner">
                    {STATS.map((s, i) => (
                        <div key={i} className="stat-item">
                            <i className={`bi ${s.icon} stat-bi-icon`} />
                            <span className="stat-value">{s.value}</span>
                            <span className="stat-label">{s.label}</span>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── Categories ── */}
            <section className="section categories-section" id="categories-section">
                <div className="container">
                    <div className="section-header">
                        <span className="section-label"><i className="bi bi-grid-3x3-gap-fill" /> Browse by Category</span>
                        <h2>Shop by Collection</h2>
                        <p>Curated electronics for the modern lifestyle</p>
                    </div>
                    <div className="categories-grid" id="categories-grid">
                        {categories.map(cat => (
                            <div
                                key={cat.id}
                                id={`category-${cat.id}`}
                                className="category-card"
                                onClick={() => navigate(`/products?category=${cat.id}`)}
                                role="button"
                                tabIndex={0}
                                onKeyDown={e => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault()
                                        navigate(`/products?category=${cat.id}`)
                                    }
                                }}                            >
                                <div className="category-card__img-wrap">
                                    <img src={cat.image} alt={cat.name} className="category-card__img" loading="lazy" />
                                    <div className="category-card__overlay" />
                                </div>
                                <div className="category-card__glass">
                                    <i className={`bi ${CATEGORY_ICONS[cat.id]} category-card__icon`} />
                                    <div>
                                        <h3 className="category-card__name">{cat.name}</h3>
                                        <p className="category-card__desc">{cat.description}</p>
                                    </div>
                                    <span className="category-card__count">
                                        <i className="bi bi-box-seam" /> {cat.count} items
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Featured Products ── */}
            <section className="section featured-section" id="featured" style={{ background: 'var(--neutral-bg)' }}>
                <div className="container">
                    <div className="section-header">
                        <span className="section-label"><i className="bi bi-stars" /> Handpicked for You</span>
                        <h2>Featured Products</h2>
                        <p>Top-rated electronics with fast shipping</p>
                    </div>

                    {/* Filter Tabs */}
                    <div className="filter-tabs" id="product-filters" role="tablist">
                        {[
                            { id: 'all', label: 'All Products', icon: 'bi-grid' },
                            ...categories.map(c => ({ id: c.id, label: c.name, icon: CATEGORY_ICONS[c.id] || c.icon || 'bi-box' }))
                        ].map(cat => (
                            <button
                                key={cat.id}
                                id={`filter-${cat.id}`}
                                role="tab"
                                aria-selected={activeCategory === cat.id}
                                className={`filter-tab ${activeCategory === cat.id ? 'active' : ''}`}
                                onClick={() => { setActiveCategory(cat.id); setVisibleCount(8) }}
                            >
                                <i className={`bi ${cat.icon}`} /> {cat.label}
                            </button>
                        ))}
                    </div>

                    {/* Products Grid */}
                    <div className="products-grid" id="products-grid">
                        {loading
                            ? Array(8).fill(null).map((_, i) => <ProductCard key={i} loading />)
                            : displayed.map(p => <ProductCard key={p.id} product={p} />)
                        }
                    </div>

                    {!loading && filtered.length > visibleCount && (
                        <div style={{ textAlign: 'center', marginTop: 32 }}>
                            <button id="load-more" className="btn btn-secondary btn-lg" onClick={() => setVisibleCount(v => v + 4)}>
                                <i className="bi bi-plus-circle" /> Load More Products
                            </button>
                        </div>
                    )}
                </div>
            </section>

            {/* ── Why Choose Us ── */}
            <section className="section features-section" id="features-section">
                <div className="container">
                    <div className="section-header">
                        <span className="section-label"><i className="bi bi-patch-check-fill" /> Why Pathan Gadgets</span>
                        <h2>Built for Trust & Speed</h2>
                        <p>Every purchase backed by our premium guarantee</p>
                    </div>
                    <div className="features-grid" id="features-grid">
                        {FEATURES.map((f, i) => (
                            <div key={i} className="feature-card" id={`feature-${i + 1}`}>
                                <div className="feature-card__icon-wrap" style={{ background: f.color + '18', borderColor: f.color + '30' }}>
                                    <i className={`bi ${f.icon} feature-card__icon`} style={{ color: f.color }} />
                                </div>
                                <h3>{f.title}</h3>
                                <p>{f.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── CTA Banner ── */}
            <section className="cta-banner" id="cta-banner">
                <div className="container cta-banner__inner">
                    <div>
                        <h2><i className="bi bi-lightning-charge-fill" /> Ready to Elevate Your Tech?</h2>
                        <p>Join 50,000+ happy customers. Free shipping on your first order.</p>
                    </div>
                    <div className="cta-banner__actions">
                        <a href="#featured" className="btn btn-primary btn-lg" id="cta-shop-now">
                            <i className="bi bi-bag-fill" /> Shop Now
                        </a>
                        <Link to="/track/ORD-2024-002" className="btn btn-lg cta-ghost" id="cta-track">
                            <i className="bi bi-geo-alt-fill" /> Track Order
                        </Link>
                    </div>
                </div>
            </section>

        </div>
    )
}
