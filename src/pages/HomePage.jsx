import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { formatPrice } from '../data/mockData'
import { useProducts, useCategories } from '../hooks/useProducts'
import { useCart } from '../context/CartContext'
import { HeroCarousel } from '@/components/ui/hero-carousel'
import './HomePage.css'

const FEATURES = [
    { icon: 'bi-rocket-takeoff', title: 'Express Delivery', desc: '24–48 hr delivery to all major cities in India.', color: '#C99738' },
    { icon: 'bi-shield-check', title: '1-Year Warranty', desc: 'Every product comes with full brand warranty.', color: '#B88424' },
    { icon: 'bi-arrow-return-left', title: '7-Day Returns', desc: 'Hassle-free returns — no questions asked.', color: '#916312' },
    { icon: 'bi-lock-fill', title: 'Secure Payments', desc: 'UPI, Card, NetBanking — 100% encrypted.', color: '#A07018' },
]

const HERO_SLIDES = [
    {
        id: 'apex-watch',
        title: "Apex Ultra\nSmartwatch",
        image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=1400&auto=format&fit=crop",
        accent: "#C99738",
        link: "/products?category=watches",
        price: "₹3,499",
        originalPrice: "₹6,999",
        discount: "50% OFF",
        rating: "4.9",
        reviews: "2,450",
    },
    {
        id: 'studio-headphones',
        title: "Acoustic Pure\nHeadphones",
        image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?q=80&w=1400&auto=format&fit=crop",
        accent: "#B88424",
        link: "/products?category=headphones",
        price: "₹2,999",
        originalPrice: "₹5,499",
        discount: "45% OFF",
        rating: "4.8",
        reviews: "1,890",
    },
    {
        id: 'aeropods-wireless',
        title: "AeroPods Pro\nWireless",
        image: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?q=80&w=1400&auto=format&fit=crop",
        accent: "#00c8ff",
        link: "/products?category=airpods",
        price: "₹1,899",
        originalPrice: "₹3,999",
        discount: "52% OFF",
        rating: "4.9",
        reviews: "3,120",
    },
    {
        id: 'flagship-phone',
        title: "Cyber Optics\nUltra 5G",
        image: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?q=80&w=1400&auto=format&fit=crop",
        accent: "#e5231b",
        link: "/products?category=smartphones",
        price: "₹18,999",
        originalPrice: "₹24,999",
        discount: "24% OFF",
        rating: "4.7",
        reviews: "980",
    },
    {
        id: 'spatial-vr',
        title: "Horizon VR\nVision",
        image: "https://images.unsplash.com/photo-1593508512255-86ab42a8e620?q=80&w=1400&auto=format&fit=crop",
        accent: "#7c3aed",
        link: "/products",
        price: "₹12,499",
        originalPrice: "₹19,999",
        discount: "37% OFF",
        rating: "4.9",
        reviews: "750",
    },
    {
        id: 'ambient-speaker',
        title: "Monolith Bass\nSpeaker",
        image: "https://images.unsplash.com/photo-1545454675-3531b543be5d?q=80&w=1400&auto=format&fit=crop",
        accent: "#DFAC46",
        link: "/products",
        price: "₹4,299",
        originalPrice: "₹7,999",
        discount: "46% OFF",
        rating: "4.8",
        reviews: "1,420",
    },
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

            {/* ── Editorial Hero Carousel ── */}
            <section className="relative w-full h-[100dvh] min-h-[580px] overflow-hidden bg-black" id="hero-section">
                <HeroCarousel
                    items={HERO_SLIDES}
                    defaultIndex={0}
                    onShopNow={(item) => navigate(item?.link || '/products')}
                    autoplay={true}
                    autoplayDelay={4500}
                    className="h-[100dvh] min-h-[580px] w-full"
                />
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
                        <span className="section-label"><i className="bi bi-patch-check-fill" /> Why Smiley N Traders</span>
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
