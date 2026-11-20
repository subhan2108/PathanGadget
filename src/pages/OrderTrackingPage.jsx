import React, { useState, useEffect } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { fetchOrderDetails } from '../lib/orderService'
import { formatPrice } from '../lib/productsService'
import './OrderTrackingPage.css'

const WHATSAPP_PHONE = '918178768308'

export default function OrderTrackingPage() {
    const { id } = useParams()
    const navigate = useNavigate()
    const [searchInput, setSearchInput] = useState(id || '')
    const [order, setOrder] = useState(null)
    const [loading, setLoading] = useState(Boolean(id))
    const [errorMsg, setErrorMsg] = useState('')
    const [copiedTracking, setCopiedTracking] = useState(false)

    const loadOrder = async (query, isSilentAuto = false) => {
        if (!query || !query.trim()) return
        setLoading(true)
        if (!isSilentAuto) setErrorMsg('')
        try {
            const data = await fetchOrderDetails(query.trim())
            if (data) {
                setOrder(data)
                setErrorMsg('')
            } else {
                setOrder(null)
                if (!isSilentAuto) {
                    setErrorMsg('No order found matching this Order Number, Mobile Number, or Tracking ID. Please double check and try again.')
                }
            }
        } catch (err) {
            console.error('Error fetching order tracking:', err)
            if (!isSilentAuto) {
                setErrorMsg('Unable to retrieve tracking information right now. Please try again.')
            }
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (id) {
            setSearchInput(id)
            loadOrder(id, false)
        } else {
            // Check if there's a saved customer phone in localStorage to auto-track recent order silently
            try {
                const profile = localStorage.getItem('sm_customer_profile')
                if (profile) {
                    const parsed = JSON.parse(profile)
                    if (parsed.phone) {
                        setSearchInput(parsed.phone)
                        loadOrder(parsed.phone, true)
                    }
                }
            } catch (e) {
                // Ignore
            }
        }
    }, [id])

    const handleSearch = (e) => {
        e.preventDefault()
        if (searchInput.trim()) {
            navigate(`/track/${encodeURIComponent(searchInput.trim())}`, { replace: true })
            loadOrder(searchInput.trim())
        }
    }

    const handleCopyTracking = (trackingNo) => {
        if (!trackingNo) return
        navigator.clipboard.writeText(trackingNo)
        setCopiedTracking(true)
        setTimeout(() => setCopiedTracking(false), 2500)
    }

    // Build official courier deep link
    const getCourierLink = (courierName, trackingNo) => {
        if (!trackingNo) return null
        const cName = (courierName || '').toLowerCase()
        if (cName.includes('dtdc')) {
            return {
                name: 'DTDC Courier',
                url: `https://track.dtdc.com/ct/tracking?trNo=${encodeURIComponent(trackingNo)}`,
                icon: 'bi-truck'
            }
        }
        if (cName.includes('maruti')) {
            return {
                name: 'Shree Maruti Courier',
                url: `https://www.shreemaruticourier.com/track-consignment/?consignment_no=${encodeURIComponent(trackingNo)}`,
                icon: 'bi-box-seam'
            }
        }
        if (cName.includes('delhivery')) {
            return {
                name: 'Delhivery',
                url: `https://www.delhivery.com/track/package/${encodeURIComponent(trackingNo)}`,
                icon: 'bi-truck'
            }
        }
        return {
            name: courierName || 'Courier',
            url: `https://www.google.com/search?q=${encodeURIComponent((courierName || 'courier') + ' tracking ' + trackingNo)}`,
            icon: 'bi-box-seam'
        }
    }

    // Stepper logic based on order status
    const getStepperState = (orderStatus) => {
        const s = (orderStatus || '').toLowerCase()
        if (s === 'delivered') return 5
        if (s === 'dispatched') return 4
        if (s === 'processing' || s === 'packed') return 3
        if (s === 'confirmed') return 2
        // Default pending verification
        return 1
    }

    const activeStep = order ? getStepperState(order.status) : 1
    const courierLink = order?.tracking_number ? getCourierLink(order.courier_name, order.tracking_number) : null
    const shipping = order ? (typeof order.shipping_address === 'string' ? JSON.parse(order.shipping_address) : (order.shipping_address || {})) : {}

    return (
        <div className="tracking-page page-enter" id="tracking-page">
            {/* Header with Search */}
            <div className="tracking-header" style={{ padding: '40px 0 32px' }}>
                <div className="container">
                    <nav className="breadcrumb">
                        <Link to="/"><i className="bi bi-house" /> Home</Link><span>›</span>
                        <Link to="/products">Catalog</Link><span>›</span>
                        <span>Track Order</span>
                    </nav>

                    <div style={{ maxWidth: '640px', margin: '0 auto', textAlign: 'center' }}>
                        <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#111827', marginBottom: '8px' }}>
                            <i className="bi bi-geo-alt-fill" style={{ color: '#D97706', marginRight: '10px' }} />
                            Live Order & Courier Tracking
                        </h1>
                        <p style={{ color: '#6B7280', fontSize: '1rem', marginBottom: '24px' }}>
                            Track your shipment status by entering your <strong>Mobile Number</strong>, <strong>Order Number</strong>, or <strong>Courier Tracking ID</strong>.
                        </p>

                        {/* Search Bar */}
                        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '8px', maxWidth: '520px', margin: '0 auto' }}>
                            <input 
                                type="text"
                                placeholder="Enter Mobile No / Order ID / Tracking ID"
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                style={{ flex: 1, padding: '12px 16px', borderRadius: '8px', border: '2px solid #D97706', fontSize: '1rem', outline: 'none' }}
                            />
                            <button 
                                type="submit" 
                                className="btn btn-primary"
                                style={{ padding: '12px 24px', fontWeight: 700, borderRadius: '8px', background: '#D97706', borderColor: '#D97706' }}
                            >
                                <i className="bi bi-search" /> Track
                            </button>
                        </form>
                    </div>
                </div>
            </div>

            <div className="container" style={{ padding: '32px 0 64px' }}>
                {loading && (
                    <div style={{ textAlign: 'center', padding: '60px 0' }}>
                        <div className="spinner-border text-warning" role="status" style={{ width: '3rem', height: '3rem' }} />
                        <p style={{ marginTop: '16px', color: '#6B7280', fontWeight: 600 }}>Fetching live order & courier details...</p>
                    </div>
                )}

                {errorMsg && !loading && (
                    <div style={{ maxWidth: '600px', margin: '20px auto', background: '#FEF2F2', border: '1px solid #F87171', borderRadius: '10px', padding: '20px', textAlign: 'center' }}>
                        <i className="bi bi-exclamation-triangle-fill" style={{ fontSize: '2rem', color: '#DC2626', marginBottom: '8px', display: 'block' }} />
                        <h4 style={{ color: '#991B1B', fontWeight: 700, marginBottom: '6px' }}>Order Not Found</h4>
                        <p style={{ color: '#7F1D1D', fontSize: '0.9375rem', margin: 0 }}>{errorMsg}</p>
                    </div>
                )}

                {order && !loading && (
                    <div className="tracking-results-container" style={{ maxWidth: '960px', margin: '0 auto' }}>
                        
                        {/* Status Summary Banner */}
                        <div style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '24px', marginBottom: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', borderBottom: '1px solid #F3F4F6', paddingBottom: '18px', marginBottom: '20px' }}>
                                <div>
                                    <div style={{ fontSize: '0.8125rem', color: '#6B7280', textTransform: 'uppercase', fontWeight: 700 }}>
                                        Order Number
                                    </div>
                                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#111827', fontFamily: 'monospace' }}>
                                        {order.order_number}
                                    </div>
                                    <div style={{ fontSize: '0.8125rem', color: '#9CA3AF', marginTop: '2px' }}>
                                        Placed on {new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                </div>

                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '0.8125rem', color: '#6B7280', textTransform: 'uppercase', fontWeight: 700 }}>
                                        Current Status
                                    </div>
                                    <div style={{ marginTop: '4px' }}>
                                        {order.status === 'pending_verification' && (
                                            <span style={{ background: '#FEF3C7', color: '#92400E', padding: '6px 14px', borderRadius: '999px', fontSize: '0.875rem', fontWeight: 800 }}>
                                                ⏳ Payment Verification Pending
                                            </span>
                                        )}
                                        {(order.status === 'processing' || order.status === 'confirmed') && (
                                            <span style={{ background: '#E0F2FE', color: '#0369A1', padding: '6px 14px', borderRadius: '999px', fontSize: '0.875rem', fontWeight: 800 }}>
                                                ⚙️ Processing & Packing
                                            </span>
                                        )}
                                        {order.status === 'dispatched' && (
                                            <span style={{ background: '#FEF08A', color: '#854D0E', padding: '6px 14px', borderRadius: '999px', fontSize: '0.875rem', fontWeight: 800 }}>
                                                🚚 Dispatched in Transit
                                            </span>
                                        )}
                                        {order.status === 'delivered' && (
                                            <span style={{ background: '#DCFCE7', color: '#15803D', padding: '6px 14px', borderRadius: '999px', fontSize: '0.875rem', fontWeight: 800 }}>
                                                ✅ Successfully Delivered
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* 5-Step Progress Stepper */}
                            <div className="stepper-wrapper" style={{ padding: '10px 0 20px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px', position: 'relative', textAlign: 'center' }}>
                                    {[
                                        { step: 1, label: 'Order Placed', icon: 'bi-cart-check' },
                                        { step: 2, label: 'Payment Verified', icon: 'bi-shield-check' },
                                        { step: 3, label: 'Packed & Ready', icon: 'bi-box-seam' },
                                        { step: 4, label: `Dispatched (${order.courier_name || 'Courier'})`, icon: 'bi-truck' },
                                        { step: 5, label: 'Delivered', icon: 'bi-house-check' }
                                    ].map((s) => {
                                        const isDone = activeStep >= s.step
                                        const isCurrent = activeStep === s.step
                                        return (
                                            <div key={s.step} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                <div 
                                                    style={{ 
                                                        width: '42px', 
                                                        height: '42px', 
                                                        borderRadius: '50%', 
                                                        background: isDone ? '#D97706' : '#F3F4F6', 
                                                        color: isDone ? '#FFFFFF' : '#9CA3AF',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        fontSize: '1.2rem',
                                                        fontWeight: 700,
                                                        border: isCurrent ? '3px solid #B45309' : 'none',
                                                        boxShadow: isCurrent ? '0 0 0 4px rgba(217,119,6,0.2)' : 'none',
                                                        marginBottom: '8px'
                                                    }}
                                                >
                                                    <i className={`bi ${s.icon}`} />
                                                </div>
                                                <div style={{ fontSize: '0.8125rem', fontWeight: isDone ? 700 : 500, color: isDone ? '#111827' : '#9CA3AF' }}>
                                                    {s.label}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* Courier Smart 1-Tap Deep Link Card */}
                            {courierLink && (
                                <div style={{ background: '#FFFBEB', border: '2px solid #FCD34D', borderRadius: '10px', padding: '20px', marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                            <span style={{ background: '#B45309', color: '#FFFFFF', fontSize: '0.75rem', fontWeight: 800, padding: '2px 8px', borderRadius: '4px' }}>
                                                {order.courier_name || 'Courier Partner'}
                                            </span>
                                            <strong style={{ fontSize: '1rem', color: '#78350F' }}>Consignment / Tracking Number:</strong>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <code style={{ fontSize: '1.35rem', fontWeight: 800, color: '#111827', letterSpacing: '0.5px' }}>
                                                {order.tracking_number}
                                            </code>
                                            <button 
                                                type="button"
                                                onClick={() => handleCopyTracking(order.tracking_number)}
                                                className="btn btn-secondary btn-sm"
                                                style={{ padding: '2px 8px', fontSize: '0.75rem' }}
                                            >
                                                {copiedTracking ? '✓ Copied' : 'Copy'}
                                            </button>
                                        </div>
                                        <p style={{ margin: '6px 0 0', fontSize: '0.8125rem', color: '#92400E' }}>
                                            Tap the button below to view live transit location directly on {courierLink.name}.
                                        </p>
                                    </div>

                                    <div>
                                        <a 
                                            href={courierLink.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="btn"
                                            style={{ background: '#D97706', color: '#FFFFFF', padding: '12px 20px', borderRadius: '8px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '8px', boxShadow: '0 2px 6px rgba(217,119,6,0.3)' }}
                                        >
                                            <i className="bi bi-box-arrow-up-right" />
                                            View Live Tracking on {courierLink.name}
                                        </a>
                                    </div>
                                </div>
                            )}

                            {/* Real Shipment Activity Log (Milestones from Admin) */}
                            {order.order_tracking && order.order_tracking.length > 0 && (
                                <div style={{ marginTop: '20px', background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '10px', padding: '16px 20px' }}>
                                    <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#1F2937', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <i className="bi bi-clock-history" style={{ color: '#D97706' }} />
                                        Shipment Milestones & Activity History
                                    </h4>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        {order.order_tracking.map((m, idx) => (
                                            <div key={idx} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', paddingBottom: '10px', borderBottom: idx !== order.order_tracking.length - 1 ? '1px solid #E5E7EB' : 'none' }}>
                                                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: m.is_current ? '#D97706' : '#E5E7EB', color: m.is_current ? '#FFFFFF' : '#6B7280', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', flexShrink: 0, marginTop: '2px' }}>
                                                    <i className={`bi ${m.status === 'delivered' ? 'bi-check-circle-fill' : m.status === 'dispatched' ? 'bi-truck' : 'bi-check'}`} />
                                                </div>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                                                        <strong style={{ fontSize: '0.9rem', color: '#111827' }}>
                                                            {m.label} {m.is_current && <span style={{ background: '#DCFCE7', color: '#15803D', fontSize: '0.72rem', padding: '1px 6px', borderRadius: '4px', marginLeft: '6px' }}>Current</span>}
                                                        </strong>
                                                        <span style={{ fontSize: '0.75rem', color: '#6B7280' }}>
                                                            {new Date(m.timestamp || m.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                    {m.description && (
                                                        <p style={{ margin: '3px 0 0', fontSize: '0.8125rem', color: '#4B5563' }}>{m.description}</p>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Order Details & Items Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                            {/* Shipping & Payment Info */}
                            <div style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '20px' }}>
                                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1F2937', marginBottom: '14px', borderBottom: '1px solid #F3F4F6', paddingBottom: '10px' }}>
                                    <i className="bi bi-truck" style={{ color: '#D97706', marginRight: '8px' }} />
                                    Delivery & Contact Details
                                </h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.875rem', color: '#374151' }}>
                                    <div>
                                        <strong style={{ color: '#111827' }}>Shop / Customer Name:</strong>{' '}
                                        {order.customer_shop_name || shipping.shopName || shipping.name || 'Direct Customer'}
                                    </div>
                                    <div>
                                        <strong style={{ color: '#111827' }}>Phone Number:</strong>{' '}
                                        +91 {order.customer_phone || shipping.phone}
                                    </div>
                                    <div>
                                        <strong style={{ color: '#111827' }}>Delivery Address:</strong>{' '}
                                        {order.customer_address || shipping.address}, {order.customer_city || shipping.city}, {order.customer_state || shipping.state} - {order.customer_pincode || shipping.pincode}
                                    </div>
                                    <div style={{ borderTop: '1px solid #F3F4F6', paddingTop: '8px', marginTop: '4px' }}>
                                        <strong style={{ color: '#111827' }}>Payment Method:</strong> {order.payment_method || 'UPI'}
                                        {order.utr_number && (
                                            <div style={{ color: '#6B7280', fontSize: '0.8125rem', marginTop: '2px' }}>
                                                UTR / Ref ID: <code>{order.utr_number}</code>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Items List */}
                            <div style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '20px' }}>
                                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1F2937', marginBottom: '14px', borderBottom: '1px solid #F3F4F6', paddingBottom: '10px' }}>
                                    <i className="bi bi-box2-fill" style={{ color: '#D97706', marginRight: '8px' }} />
                                    Ordered Items ({order.items?.length || 0})
                                </h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '240px', overflowY: 'auto' }}>
                                    {(order.items || []).map((item, idx) => (
                                        <div key={idx} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                            <img 
                                                src={item.image || item.image_url || '/logo.png'} 
                                                alt={item.name} 
                                                referrerPolicy="no-referrer"
                                                style={{ width: '40px', height: '40px', objectFit: 'contain', background: '#F9FAFB', borderRadius: '6px', border: '1px solid #E5E7EB' }}
                                            />
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1F2937', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {item.name}
                                                </div>
                                                <div style={{ fontSize: '0.75rem', color: '#6B7280' }}>
                                                    Qty: {item.quantity} × {formatPrice(item.price)} {item.sku ? `[${item.sku}]` : ''}
                                                </div>
                                            </div>
                                            <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#111827' }}>
                                                {formatPrice(Number(item.price) * Number(item.quantity))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div style={{ borderTop: '1px solid #F3F4F6', paddingTop: '10px', marginTop: '10px', display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '1.05rem', color: '#111827' }}>
                                    <span>Total:</span>
                                    <span style={{ color: '#D97706' }}>{formatPrice(order.total)}</span>
                                </div>
                            </div>
                        </div>

                        {/* WhatsApp Support CTA */}
                        <div style={{ textAlign: 'center', marginTop: '32px' }}>
                            <a 
                                href={`https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(`Hello! I have a question regarding my order #${order.order_number}`)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn"
                                style={{ background: '#25D366', color: '#FFFFFF', padding: '12px 24px', fontWeight: 700, borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                            >
                                <i className="bi bi-whatsapp" /> Need Help? Chat with Store on WhatsApp
                            </a>
                        </div>

                    </div>
                )}
            </div>
        </div>
    )
}
