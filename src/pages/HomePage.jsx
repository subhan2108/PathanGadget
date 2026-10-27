import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { formatPrice } from '../lib/productsService'
import { useProducts, useCategories } from '../hooks/useProducts'
import { useCart } from '../context/CartContext'
import { HeroCarousel } from '@/components/ui/hero-carousel'
import { ProductCard } from '@/components/ui/product-card-2'
import './HomePage.css'

const FEATURES = [
    { icon: 'bi-rocket-takeoff', title: 'Express Delivery', desc: '24–48 hr delivery to all major cities in India.', color: '#C99738' },
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

function ProductCardSkeleton() {
    return (
        <div className="glass-card relative flex h-full w-full flex-col items-center justify-between p-6 text-center animate-pulse min-h-[440px]">
            <div className="mb-4 h-44 w-full rounded-xl bg-black/5" />
            <div className="h-5 w-3/4 rounded bg-black/5 mb-2" />
            <div className="h-4 w-1/2 rounded bg-black/5 mb-4" />
            <div className="h-7 w-24 rounded bg-black/5 mb-2" />
            <div className="h-6 w-32 rounded-full bg-black/5 mb-4" />
            <div className="w-full h-10 rounded-full bg-black/10 mt-2" />
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
                        {categories.map((cat, index) => {
                            const isTall = (categories.length === 5 && index === 2) || (categories.length % 3 === 2 && index === 2);
                            return (
                                <div
                                    key={cat.id}
                                    id={`category-${cat.id}`}
                                    className={`category-card ${isTall ? 'category-card--tall' : ''}`}
                                    onClick={() => navigate(`/products?category=${cat.id}`)}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault()
                                            navigate(`/products?category=${cat.id}`)
                                        }
                                    }}
                                >
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
                            )
                        })}
                    </div>
                </div>
            </section>

            {/* ── Featured Products ── */}
            <section className="section featured-section" id="featured">
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
                            ? Array(8).fill(null).map((_, i) => <ProductCardSkeleton key={i} />)
                            : displayed.map(raw => {
                                const product = {
                                    ...raw,
                                    originalPrice: raw.original_price ?? raw.originalPrice ?? raw.price,
                                    inStock: raw.in_stock ?? raw.inStock ?? true,
                                    reviewCount: raw.review_count ?? raw.reviewCount ?? raw.reviews ?? 0,
                                    image: raw.image_url ?? raw.image ?? '',
                                }
                                const discount = product.originalPrice > product.price
                                    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
                                    : 0
                                const offerText = product.badge || (discount > 0 ? `${discount}% Off` : 'Special Deal')
                                const tagline = product.tagline || product.description || (product.category ? `${product.category.toUpperCase()} Collection` : 'Premium Audio & Wearables')

                                return (
                                    <ProductCard
                                        key={product.id}
                                        id={`product-card-${product.id}`}
                                        product={product}
                                    />
                                )
                            })
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
            <section className="cta-section cta-banner" id="cta-banner">
                <div className="container">
                    <div className="cta-card">
                        {/* Ambient background glow elements */}
                        <div className="cta-card__glow-mesh" aria-hidden="true">
                            <div className="cta-glow-orb cta-glow-orb--gold" />
                            <div className="cta-glow-orb cta-glow-orb--amber" />
                            <div className="cta-glow-orb cta-glow-orb--white" />
                        </div>

                        {/* Subtle decorative dot pattern */}
                        <div className="cta-card__pattern" aria-hidden="true" />

                        <div className="cta-card__content">
                            {/* Circular border transparent badge */}
                            <div className="cta-badge">
                                <span className="cta-badge__dot">
                                    <span className="cta-badge__ping" />
                                </span>
                                <i className="bi bi-lightning-charge-fill cta-badge__icon" />
                                <span>VIP Member Privileges</span>
                            </div>

                            <h2 className="cta-card__title">
                                Ready to Elevate <br className="hidden sm:inline" />
                                <span className="cta-card__title-highlight">Your Tech Lifestyle?</span>
                            </h2>

                            <p className="cta-card__desc">
                                Join 50,000+ satisfied customers. Experience authentic luxury audio, smartwatches & guaranteed fast delivery with free priority shipping on your first order.
                            </p>

                            <div className="cta-card__trust">
                                <div className="cta-trust-item">
                                    <i className="bi bi-patch-check-fill" />
                                    <span>100% Authentic Tech</span>
                                </div>
                                <div className="cta-trust-divider" />
                                <div className="cta-trust-item">
                                    <i className="bi bi-truck" />
                                    <span>Free Express Shipping</span>
                                </div>
                                <div className="cta-trust-divider" />
                                <div className="cta-trust-item">
                                    <i className="bi bi-arrow-repeat" />
                                    <span>7-Day Return Guarantee</span>
                                </div>
                            </div>
                        </div>

                        <div className="cta-card__actions">
                            <a href="#featured" className="cta-btn cta-btn--primary" id="cta-shop-now">
                                <span className="cta-btn__text">Shop Collection</span>
                                <span className="cta-btn__circle">
                                    <i className="bi bi-arrow-right" />
                                </span>
                            </a>
                            <Link to="/track/ORD-2024-002" className="cta-btn cta-btn--glass" id="cta-track">
                                <i className="bi bi-geo-alt-fill" />
                                <span>Track Order</span>
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

        </div>
    )
}
