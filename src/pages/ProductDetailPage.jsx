import React, { useState, useEffect } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useProductDetail, useReviews, useAllProducts } from '../hooks/useProducts'
import { formatPrice, submitReview } from '../lib/productsService'
import { useCart } from '../context/CartContext'
import { useAuth } from '../context/AuthContext'
import './ProductDetailPage.css'

export default function ProductDetailPage() {
    const { id } = useParams()
    const navigate = useNavigate()
    const { addToCart, checkout } = useCart()

    const { product, loading: productLoading, error: productError, similarProducts } = useProductDetail(id)
    const { reviews, loading: reviewsLoading, refresh: refreshReviews } = useReviews(id)
    const { user } = useAuth()
    const { products: allProducts } = useAllProducts()

    const [activeImg, setActiveImg] = useState(0)
    const [selectedVariant, setSelectedVariant] = useState('buy1')
    const [timeLeft, setTimeLeft] = useState({ hours: 1, minutes: 8, seconds: 30 })
    const [activeTab, setActiveTab] = useState('reviews')

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
                product_id: id,
                user_id: user.id,
                user_name: user.name || user.email?.split('@')[0] || 'User',
                rating: reviewRating,
                title: reviewTitle,
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
        setSelectedVariant('buy1')
    }, [id])

    useEffect(() => {
        const timer = setInterval(() => {
            setTimeLeft(prev => {
                if (prev.seconds > 0) return { ...prev, seconds: prev.seconds - 1 }
                if (prev.minutes > 0) return { ...prev, minutes: prev.minutes - 1, seconds: 59 }
                if (prev.hours > 0) return { hours: prev.hours - 1, minutes: 59, seconds: 59 }
                return prev
            })
        }, 1000)
        return () => clearInterval(timer)
    }, [])

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

    // --- Backend Data Mapping ---
    const basePrice = Number(product.price)
    const baseOriginalPrice = Number(product.original_price ?? product.originalPrice ?? product.price)

    const reviewCount = product.review_count ?? (Array.isArray(product.reviews) ? product.reviews.length : product.reviews) ?? reviews.length ?? 0
    const rating = product.rating || 4.8

    // Build Gallery from DB
    const mainImg = product.image_url ?? product.image;
    const gallery = mainImg ? [mainImg] : ["/pro1.jpg"];
    if (product.product_images && product.product_images.length > 0) {
        gallery.push(...[...product.product_images].sort((a, b) => a.sort_order - b.sort_order).map(img => img.image_url));
    }

    // Features & Specs
    const details = product.details || {}
    let highlights = Array.isArray(details.highlights) && details.highlights.length > 0 ? details.highlights : (product.highlights || [])
    let specsObj = details.specifications || product.specs || {}
    let mappedSpecs = Object.keys(specsObj).length > 0
        ? Object.entries(specsObj).map(([k, v]) => `${k.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}: ${v}`)
        : []

    // Dynamic Tags
    const productTags = product.badge ? [product.badge] : []

    const whyChooseUs = Array.isArray(details.whyChooseUs) && details.whyChooseUs.length > 0 ? details.whyChooseUs : [
        "100% Satisfaction Guarantee: We prioritize your satisfaction.",
        "Premium Quality: Top-tier materials and build.",
        "Fast & Free Shipping: Delivery directly to your door.",
        "24/7 Customer Support: We're here to help anytime."
    ]

    if (highlights.length === 0) highlights = [
        "Personalized Comfort: Adjustable 3-speed settings (Low/Medium/High)",
        "Multi-Functional: Cools, humidifies, and purifies the air",
        "Eco-friendly & Energy Efficient: Low energy consumption"
    ]
    if (mappedSpecs.length === 0) mappedSpecs = [
        "Material: High-quality ABS+PC",
        "Power Supply: USB plug-in"
    ]

    const marketingHeading = details.marketingHeading || "Stay Cool & Say Goodbye\nTO HEAT THIS SUMMER!"

    // Dynamic Variants based on DB Price
    const buy2Discount = details.discounts?.buy2 || 10;
    const buy3Discount = details.discounts?.buy3 || 15;

    const dynamicVariants = [
        { id: 'buy1', label: 'Buy 1', price: basePrice, originalPrice: baseOriginalPrice, tag: null, discountApplied: 0 },
        { id: 'buy2', label: 'Buy 2', price: Math.round(basePrice * 2 * (1 - buy2Discount/100)), originalPrice: baseOriginalPrice * 2, tag: `Extra ${buy2Discount}% Off`, discountApplied: buy2Discount },
        { id: 'buy3', label: 'Buy 3', price: Math.round(basePrice * 3 * (1 - buy3Discount/100)), originalPrice: baseOriginalPrice * 3, tag: 'Best Value', discountApplied: buy3Discount }
    ]

    const currentVariant = dynamicVariants.find(v => v.id === selectedVariant) || dynamicVariants[0]
    const selectedQty = parseInt(selectedVariant.replace('buy', '')) || 1

    const discountPercentage = Math.round(((currentVariant.originalPrice - currentVariant.price) / currentVariant.originalPrice) * 100)

    const handleBuyNow = async () => {
        await addToCart({
            ...product,
            name: product.name,
            price: currentVariant.price / selectedQty, // Store unit price for accurate cart math
            image: gallery[0],
            originalPrice: currentVariant.originalPrice / selectedQty,
            variantId: currentVariant.discountApplied > 0 ? `Buy ${selectedQty} (${currentVariant.discountApplied}% Off)` : `Buy ${selectedQty}`,
            appliedOffer: currentVariant.discountApplied > 0 ? `Buy ${selectedQty} (${currentVariant.discountApplied}% Off)` : null
        }, selectedQty)
        checkout()
    }

    const handleAddToCart = async () => {
        await addToCart({
            ...product,
            name: product.name,
            price: currentVariant.price / selectedQty,
            image: gallery[0],
            originalPrice: currentVariant.originalPrice / selectedQty,
            variantId: currentVariant.discountApplied > 0 ? `Buy ${selectedQty} (${currentVariant.discountApplied}% Off)` : `Buy ${selectedQty}`,
            appliedOffer: currentVariant.discountApplied > 0 ? `Buy ${selectedQty} (${currentVariant.discountApplied}% Off)` : null
        }, selectedQty)
    }

    return (
        <div style={{ backgroundColor: 'white', minHeight: '100vh' }}>
            <div className="container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 20px' }}>

                {/* Two Column Layout */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '40px', alignItems: 'flex-start' }}>

                    {/* Left Column: Images (Sticky) */}
                    <div style={{ flex: '1 1 400px', display: 'flex', flexDirection: 'column', gap: '16px', position: 'sticky', top: '100px' }}>
                        <div style={{ backgroundColor: '#E5E7EB', borderRadius: '16px', aspectRatio: '1', overflow: 'hidden', position: 'relative' }}>
                            {productTags.length > 0 && (
                                <div style={{ position: 'absolute', top: '16px', left: '16px', display: 'flex', gap: '8px', flexWrap: 'wrap', zIndex: 10 }}>
                                    {productTags.map((tag, idx) => (
                                        <span key={idx} style={{ backgroundColor: '#007BFF', color: 'white', padding: '6px 16px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: '800' }}>
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            )}
                            <img src={gallery[activeImg]} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                        {gallery.length > 1 && (
                            <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '8px' }}>
                                {gallery.map((img, idx) => (
                                    <div
                                        key={idx}
                                        onClick={() => setActiveImg(idx)}
                                        style={{
                                            width: '80px', height: '80px', flexShrink: 0,
                                            backgroundColor: '#E5E7EB', borderRadius: '8px', cursor: 'pointer',
                                            border: `2px solid ${activeImg === idx ? 'var(--cta)' : 'transparent'}`,
                                            overflow: 'hidden'
                                        }}
                                    >
                                        <img src={img} alt={`Thumb ${idx}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Right Column: Product Info & Extra Content (Scrollable) */}
                    <div style={{ flex: '1 1 400px', display: 'flex', flexDirection: 'column', gap: '48px' }}>

                        {/* Section 1: Product Purchasing Info */}
                        <div style={{ display: 'flex', flexDirection: 'column' }}>

                            {/* Category Badge */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#007BFF', fontSize: '0.85rem', fontWeight: '800', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '0.5px' }}>
                                <i className="bi bi-buildings"></i>
                                <span>{product.category || 'Category'}</span>
                            </div>

                            <h1 style={{ fontSize: '2.5rem', fontWeight: '900', color: '#021422', margin: '0 0 16px 0', lineHeight: '1.2', letterSpacing: '-0.5px' }}>{product.name}</h1>

                            {/* Reviews and In Stock */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
                                <div style={{ color: '#FBBF24', fontSize: '1.2rem', display: 'flex', gap: '2px' }}>
                                    {[1, 2, 3, 4, 5].map(i => (
                                        <i key={i} className={`bi ${i <= Math.floor(rating) ? 'bi-star-fill' : i - rating < 1 ? 'bi-star-half' : 'bi-star'}`}></i>
                                    ))}
                                </div>
                                <div style={{ fontSize: '1.1rem', color: '#111827', fontWeight: '800' }}>
                                    {rating} <span style={{ color: '#9CA3AF', fontWeight: '500', textDecoration: 'underline', textDecorationStyle: 'dotted', marginLeft: '4px' }}>({reviewCount} reviews)</span>
                                </div>
                                <div style={{ marginLeft: '12px', backgroundColor: '#D1FAE5', color: '#065F46', padding: '4px 12px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <i className="bi bi-check-circle-fill"></i> In Stock
                                </div>
                            </div>

                            {/* Price */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '12px', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '3rem', fontWeight: '900', color: '#007BFF', lineHeight: '1', letterSpacing: '-1px' }}>₹{currentVariant.price.toLocaleString()}</span>
                                {currentVariant.originalPrice > currentVariant.price && (
                                    <span style={{ fontSize: '1.5rem', color: '#9CA3AF', textDecoration: 'line-through', fontWeight: '600' }}>₹{currentVariant.originalPrice.toLocaleString()}</span>
                                )}
                                {discountPercentage > 0 && (
                                    <span style={{ backgroundColor: '#FEF3C7', color: '#92400E', padding: '6px 12px', borderRadius: '20px', fontSize: '0.9rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <i className="bi bi-tag-fill"></i> {discountPercentage}% OFF
                                    </span>
                                )}
                            </div>

                            {/* You Save */}
                            {currentVariant.originalPrice > currentVariant.price && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#059669', fontSize: '1rem', fontWeight: '600', marginBottom: '32px' }}>
                                    <i className="bi bi-piggy-bank" style={{ fontSize: '1.2rem' }}></i>
                                    <span>You save <span style={{ fontWeight: '800' }}>₹{(currentVariant.originalPrice - currentVariant.price).toLocaleString()}</span> on this purchase</span>
                                </div>
                            )}

                            {/* Timer */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
                                <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#374151' }}>HURRY! SALE ENDS IN:</span>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    {Object.entries(timeLeft).map(([unit, val]) => (
                                        <div key={unit} style={{ backgroundColor: 'var(--cta)', color: 'white', padding: '6px 12px', borderRadius: '6px', textAlign: 'center', minWidth: '46px' }}>
                                            <div style={{ fontSize: '1.1rem', fontWeight: '700', lineHeight: '1' }}>{String(val).padStart(2, '0')}</div>
                                            <div style={{ fontSize: '0.6rem', textTransform: 'uppercase', marginTop: '2px' }}>{unit}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Variants */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px' }}>
                                {dynamicVariants.map((v) => (
                                    <div
                                        key={v.id}
                                        onClick={() => setSelectedVariant(v.id)}
                                        style={{
                                            position: 'relative', padding: '16px', borderRadius: '12px', cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                            border: `2px solid ${selectedVariant === v.id ? 'var(--cta)' : '#E5E7EB'}`,
                                            backgroundColor: selectedVariant === v.id ? 'rgba(0, 119, 255, 0.04)' : 'white'
                                        }}
                                    >
                                        {v.tag && (
                                            <div style={{ position: 'absolute', top: '-10px', right: '16px', backgroundColor: 'var(--cta)', color: 'white', fontSize: '0.6rem', fontWeight: '800', padding: '2px 8px', borderRadius: '10px', textTransform: 'uppercase' }}>
                                                {v.tag}
                                            </div>
                                        )}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: `2px solid ${selectedVariant === v.id ? 'var(--cta)' : '#D1D5DB'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                {selectedVariant === v.id && <div style={{ width: '10px', height: '10px', backgroundColor: 'var(--cta)', borderRadius: '50%' }} />}
                                            </div>
                                            <span style={{ fontWeight: '700', color: '#111827' }}>{v.label}</span>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontWeight: '800', color: 'var(--cta)' }}>Rs. {v.price.toLocaleString()}</div>
                                            <div style={{ fontSize: '0.75rem', color: '#9CA3AF', textDecoration: 'line-through' }}>Rs. {v.originalPrice.toLocaleString()}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Buttons */}
                            <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
                                <button
                                    onClick={handleAddToCart}
                                    style={{
                                        flex: '1', backgroundColor: 'white', color: 'var(--cta)', border: '2px solid var(--cta)', padding: '16px', borderRadius: '12px',
                                        fontSize: '1.2rem', fontWeight: '800', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px',
                                        transition: 'transform 0.2s'
                                    }}
                                    onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#F0F7FF'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                                    onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'white'; e.currentTarget.style.transform = 'translateY(0)' }}
                                >
                                    <i className="bi bi-cart-plus"></i> Add to Cart
                                </button>
                                <button
                                    onClick={handleBuyNow}
                                    style={{
                                        flex: '1', backgroundColor: 'var(--cta)', color: 'white', border: 'none', padding: '16px', borderRadius: '12px',
                                        fontSize: '1.2rem', fontWeight: '800', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px',
                                        boxShadow: '0 4px 14px rgba(0, 119, 255, 0.3)', transition: 'transform 0.2s'
                                    }}
                                    onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                                    onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                                >
                                    <i className="bi bi-lightning-fill"></i> Buy Now
                                </button>
                            </div>

                            {/* Trust Badges */}
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '32px', padding: '20px 0', borderTop: '1px solid #E5E7EB', borderBottom: '1px solid #E5E7EB' }}>
                                {[
                                    { icon: 'bi-truck', label: 'Free\nShipping' },
                                    { icon: 'bi-shield-check', label: '1 Year\nWarranty' },
                                    { icon: 'bi-arrow-return-left', label: '7 Days\nReturn' }
                                ].map((badge, i) => (
                                    <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', color: '#4B5563' }}>
                                        <i className={`bi ${badge.icon}`} style={{ fontSize: '1.5rem', color: 'var(--cta)' }} />
                                        <span style={{ fontSize: '0.65rem', fontWeight: '800', textTransform: 'uppercase', textAlign: 'center', whiteSpace: 'pre-line' }}>{badge.label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Section 2: Extended Content */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '48px', paddingBottom: '60px' }}>

                            <div style={{ textAlign: 'center' }}>
                                <h2 style={{ fontSize: '1.8rem', fontWeight: '800', color: '#111827', margin: '0 0 24px 0', lineHeight: '1.3', whiteSpace: 'pre-line' }}>
                                    {marketingHeading}
                                </h2>
                                <div style={{ backgroundColor: '#E5E7EB', aspectRatio: '4/3', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', marginBottom: '24px', overflow: 'hidden' }}>
                                    <img src={gallery[0]} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                </div>
                            </div>

                            {/* Features block */}
                            <div style={{ backgroundColor: 'white', padding: '32px', borderRadius: '24px', border: '1px solid #F3F4F6', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                                <h3 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#111827', margin: '0 0 24px 0' }}>Key Features</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    {highlights.map((feature, idx) => (
                                        <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                                            <i className="bi bi-check-circle-fill" style={{ color: 'var(--cta)', marginTop: '2px', fontSize: '1.1rem' }} />
                                            <span style={{ color: '#4B5563', lineHeight: '1.5' }}>{feature}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Details block moved to tabs */}

                            {/* Why Choose Us block */}
                            <div style={{ backgroundColor: 'white', padding: '32px', borderRadius: '24px', border: '1px solid #F3F4F6', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                                <h3 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#111827', margin: '0 0 24px 0' }}>Why Choose Us?</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    {whyChooseUs.map((reason, idx) => (
                                        <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                                            <i className="bi bi-check-circle-fill" style={{ color: '#059669', marginTop: '2px', fontSize: '1.1rem' }} />
                                            <span style={{ color: '#4B5563', lineHeight: '1.5' }}>{reason}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Experience Image */}
                            <div style={{ textAlign: 'center' }}>
                                <h2 style={{ fontSize: '1.8rem', fontWeight: '800', color: '#111827', margin: '0 0 24px 0' }}>
                                    Experience the Difference
                                </h2>
                                <div style={{ backgroundColor: '#E5E7EB', aspectRatio: '16/9', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', marginBottom: '24px', overflow: 'hidden' }}>
                                    <img src={gallery[1] || gallery[0]} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            </div> {/* End main container to go full width */}

            {/* Tabs Section (Full Width) */}
            <div style={{ marginTop: '60px', borderTop: '1px solid #E5E7EB', backgroundColor: '#F8FAFC' }}>
                {/* Tab Headers */}
                <div style={{ backgroundColor: 'white', borderBottom: '1px solid #E5E7EB' }}>
                    <div className="container" style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', gap: '32px', padding: '0 20px' }}>
                        <button onClick={() => setActiveTab('overview')} style={{ padding: '16px 0', backgroundColor: 'transparent', border: 'none', borderBottom: `3px solid ${activeTab === 'overview' ? '#007BFF' : 'transparent'}`, color: activeTab === 'overview' ? '#007BFF' : '#6B7280', fontWeight: '700', fontSize: '1.05rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s' }}>
                            <i className="bi bi-info-circle"></i> Overview
                        </button>
                        <button onClick={() => setActiveTab('reviews')} style={{ padding: '16px 0', backgroundColor: 'transparent', border: 'none', borderBottom: `3px solid ${activeTab === 'reviews' ? '#007BFF' : 'transparent'}`, color: activeTab === 'reviews' ? '#007BFF' : '#6B7280', fontWeight: '700', fontSize: '1.05rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s' }}>
                            <i className="bi bi-chat-dots"></i> Reviews ({reviews?.length || 0})
                        </button>
                    </div>
                </div>

                {/* Tab Content */}
                <div className="container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 20px', minHeight: '300px' }}>
                    
                    {activeTab === 'overview' && (
                        <div style={{ color: '#4B5563', lineHeight: '1.8', fontSize: '1.05rem', maxWidth: '800px', backgroundColor: 'white', padding: '40px', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                            {product.description ? (
                                <div dangerouslySetInnerHTML={{ __html: product.description }} />
                            ) : (
                                <p>Discover the ultimate blend of innovation and convenience with this highly-rated product. Crafted using premium materials and engineered for maximum durability, it's designed to seamlessly integrate into your daily routine. Enjoy industry-leading performance combined with a sleek aesthetic that perfectly complements any setup.</p>
                            )}
                        </div>
                    )}

                    {activeTab === 'reviews' && (
                        <div>
                            <h3 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#111827', marginBottom: '24px' }}>Customer Reviews</h3>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '32px', alignItems: 'flex-start' }}>
                                
                                {/* Left Card: Summary & Write Review */}
                                <div style={{ flex: '1 1 300px', backgroundColor: 'white', padding: '32px', borderRadius: '16px', border: '1px solid #E5E7EB', textAlign: 'center' }}>
                                    <div style={{ fontSize: '4rem', fontWeight: '900', color: '#111827', lineHeight: '1' }}>{product.rating ? Number(product.rating).toFixed(1) : '5.0'}</div>
                                    <div style={{ color: '#FBBF24', fontSize: '1.5rem', margin: '16px 0' }}>
                                        {[1,2,3,4,5].map(i => <i key={i} className={`bi bi-star${i <= Math.round(product.rating || 5) ? '-fill' : ''}`}></i>)}
                                    </div>
                                    <div style={{ color: '#9CA3AF', marginBottom: '24px' }}>{product.review_count || 100} ratings</div>
                                    
                                    {!user ? (
                                        <p style={{ color: '#6B7280', fontSize: '0.95rem' }}>Please log in to write a review.</p>
                                    ) : (
                                        <form onSubmit={handleReviewSubmit} style={{ marginTop: '32px', textAlign: 'left', borderTop: '1px solid #E5E7EB', paddingTop: '24px' }}>
                                            <h4 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '16px' }}>Write a Review</h4>
                                            
                                            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', color: '#FBBF24', fontSize: '1.5rem', cursor: 'pointer' }}>
                                                {[1,2,3,4,5].map(i => (
                                                    <i key={i} onClick={() => setReviewRating(i)} className={`bi bi-star${i <= reviewRating ? '-fill' : ''}`}></i>
                                                ))}
                                            </div>

                                            <input 
                                                type="text" 
                                                placeholder="Review Title"
                                                value={reviewTitle}
                                                onChange={(e) => setReviewTitle(e.target.value)}
                                                required
                                                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #D1D5DB', marginBottom: '12px', fontFamily: 'inherit' }}
                                            />

                                            <textarea 
                                                placeholder="Write your review here..."
                                                value={reviewComment}
                                                onChange={(e) => setReviewComment(e.target.value)}
                                                required
                                                rows="4"
                                                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #D1D5DB', marginBottom: '16px', fontFamily: 'inherit', resize: 'vertical' }}
                                            />

                                            <button 
                                                type="submit" 
                                                disabled={submittingReview}
                                                style={{ width: '100%', padding: '12px', backgroundColor: 'var(--cta)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: submittingReview ? 'not-allowed' : 'pointer', opacity: submittingReview ? 0.7 : 1 }}
                                            >
                                                {submittingReview ? 'Submitting...' : 'Submit Review'}
                                            </button>
                                        </form>
                                    )}
                                </div>

                                {/* Right Card: Review List */}
                                <div style={{ flex: '2 1 500px', backgroundColor: 'white', padding: '32px', borderRadius: '16px', border: '1px solid #E5E7EB' }}>
                                    {reviewsLoading ? (
                                        <div style={{ textAlign: 'center', padding: '40px 0', color: '#9CA3AF' }}>Loading reviews...</div>
                                    ) : reviews && reviews.length > 0 ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                                            {reviews.slice(0, 5).map((rev, idx) => (
                                                <div key={rev.id || idx} style={{ borderBottom: idx !== reviews.slice(0,5).length - 1 ? '1px solid #E5E7EB' : 'none', paddingBottom: idx !== reviews.slice(0,5).length - 1 ? '32px' : '0' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                            <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#007BFF', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '1.2rem' }}>
                                                                {(rev.user_name || rev.author || 'A')[0].toUpperCase()}
                                                            </div>
                                                            <div style={{ fontWeight: '700', color: '#111827' }}>{rev.user_name || rev.author || 'Anonymous'}</div>
                                                        </div>
                                                        <div style={{ fontSize: '0.85rem', color: '#9CA3AF', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                            <i className="bi bi-calendar3"></i>
                                                            {rev.created_at ? new Date(rev.created_at).toLocaleDateString() : '5/21/2026'}
                                                        </div>
                                                    </div>
                                                    
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                                        <div style={{ color: '#FBBF24', fontSize: '0.9rem', display: 'flex', gap: '2px' }}>
                                                            {[1,2,3,4,5].map(i => <i key={i} className={`bi bi-star${i <= (rev.rating || 5) ? '-fill' : ''}`}></i>)}
                                                        </div>
                                                        {rev.title && <div style={{ fontWeight: '700', color: '#111827', fontSize: '0.95rem' }}>{rev.title}</div>}
                                                    </div>
                                                    
                                                    <p style={{ color: '#4B5563', lineHeight: '1.6', margin: '0' }}>{rev.comment || rev.content}</p>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div style={{ textAlign: 'center', padding: '40px 0' }}>
                                            <i className="bi bi-chat-square-text" style={{ fontSize: '2rem', color: '#D1D5DB', marginBottom: '12px', display: 'block' }}></i>
                                            <h4 style={{ fontWeight: '700', color: '#4B5563', marginBottom: '8px' }}>No Reviews Yet</h4>
                                            <p style={{ color: '#6B7280', fontSize: '0.9rem' }}>Be the first to share your thoughts on this product!</p>
                                        </div>
                                    )}
                                </div>

                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Re-open main container for Suggested Products */}
            <div className="container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 20px' }}>
                
                {/* Suggested Products Section */}
                <div style={{ marginTop: '80px', paddingTop: '40px', borderTop: '1px solid #E5E7EB' }}>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#111827', marginBottom: '32px' }}>
                        You may also like
                    </h2>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '24px' }}>
                        {(similarProducts?.length > 0 ? similarProducts : (allProducts?.filter(p => String(p.id) !== String(id)) || [])).slice(0, 4).map((prod) => (
                            <div 
                                key={prod.id} 
                                onClick={() => navigate(`/products/${prod.id}`)} 
                                style={{ display: 'flex', flexDirection: 'column', gap: '12px', cursor: 'pointer', transition: 'all 0.3s ease' }}
                                onMouseOver={(e) => {
                                    e.currentTarget.style.transform = 'scale(1.04) translateY(-4px)';
                                }}
                                onMouseOut={(e) => {
                                    e.currentTarget.style.transform = 'scale(1) translateY(0)';
                                }}
                            >
                                <div style={{ backgroundColor: '#E5E7EB', aspectRatio: '1', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }}>
                                    <img src={prod.image_url ?? prod.image ?? "/pro1.jpg"} alt={prod.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                </div>
                                <div>
                                    <h4 style={{ fontSize: '0.9rem', fontWeight: '700', color: '#111827', margin: '0 0 4px 0', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{prod.name}</h4>
                                    <div style={{ fontWeight: '800', color: 'var(--cta)' }}>Rs. {Number(prod.price).toLocaleString()}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

            </div>
        </div>
    )
}
