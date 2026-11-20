import React, { useState, useEffect, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { fetchCustomerProfileAndOrders } from '../lib/orderService'
import { formatPrice } from '../lib/productsService'
import './ProfilePage.css'

const WHATSAPP_SUPPORT_PHONE = '918178768308'

const TIME_FILTERS = [
    { id: 'all', label: 'All Time', icon: 'bi-infinity' },
    { id: '7days', label: 'Last 7 Days', icon: 'bi-calendar-week' },
    { id: '30days', label: 'Last 30 Days', icon: 'bi-calendar-month' },
    { id: '3months', label: 'Last 3 Months', icon: 'bi-calendar-range' },
    { id: 'year', label: 'This Year', icon: 'bi-calendar' },
]

const STATUS_FILTERS = [
    { id: 'all', label: 'All Orders', icon: 'bi-collection' },
    { id: 'delivered', label: 'Successful / Delivered', icon: 'bi-check-circle-fill' },
    { id: 'dispatched', label: 'Dispatched / In Transit', icon: 'bi-truck' },
    { id: 'pending', label: 'Pending Payment', icon: 'bi-clock-history' },
    { id: 'processing', label: 'Confirmed / Packing', icon: 'bi-box-seam' },
    { id: 'cancelled', label: 'Cancelled / Failed', icon: 'bi-x-circle-fill' },
]

export default function ProfilePage() {
    const [searchParams, setSearchParams] = useSearchParams()
    const queryPhone = searchParams.get('phone') || ''

    const [phoneInput, setPhoneInput] = useState('')
    const [activePhone, setActivePhone] = useState('')
    const [customer, setCustomer] = useState(null)
    const [orders, setOrders] = useState([])
    const [loading, setLoading] = useState(false)
    const [hasSearched, setHasSearched] = useState(false)
    const [errorMsg, setErrorMsg] = useState('')

    // Filters & Search
    const [timeFilter, setTimeFilter] = useState('all')
    const [statusFilter, setStatusFilter] = useState('all')
    const [itemSearchQuery, setItemSearchQuery] = useState('')

    // Load customer on mount: from URL param OR from localStorage address memory
    useEffect(() => {
        let initialPhone = queryPhone.replace(/\D/g, '').slice(-10)

        if (!initialPhone) {
            try {
                const saved = localStorage.getItem('sm_customer_profile')
                if (saved) {
                    const parsed = JSON.parse(saved)
                    if (parsed.phone) {
                        initialPhone = String(parsed.phone).replace(/\D/g, '').slice(-10)
                    }
                }
            } catch (e) {
                // Ignore localStorage errors
            }
        }

        if (initialPhone && initialPhone.length === 10) {
            setPhoneInput(initialPhone)
            lookupOrders(initialPhone)
        }
    }, [queryPhone])

    const lookupOrders = async (phone) => {
        const clean = String(phone).replace(/\D/g, '').slice(-10)
        if (clean.length !== 10) {
            setErrorMsg('Please enter a valid 10-digit mobile number.')
            return
        }

        setErrorMsg('')
        setLoading(true)
        setActivePhone(clean)
        setHasSearched(true)

        try {
            const { customer: custData, orders: orderList } = await fetchCustomerProfileAndOrders(clean)
            setCustomer(custData)
            setOrders(orderList)

            // Cache phone in localStorage for instant 1-tap recognition
            try {
                const existing = localStorage.getItem('sm_customer_profile')
                let merged = custData || { phone: clean }
                if (existing) {
                    const prev = JSON.parse(existing)
                    merged = { ...prev, ...merged, phone: clean }
                }
                localStorage.setItem('sm_customer_profile', JSON.stringify(merged))
            } catch (err) {
                // Ignore storage errors
            }
        } catch (err) {
            console.error('Failed to load profile orders:', err)
            setErrorMsg('Unable to retrieve orders at this moment. Please check connection.')
        } finally {
            setLoading(false)
        }
    }

    const handleFormSubmit = (e) => {
        e.preventDefault()
        lookupOrders(phoneInput)
    }

    const handleClearPhone = () => {
        setPhoneInput('')
        setActivePhone('')
        setCustomer(null)
        setOrders([])
        setHasSearched(false)
        setErrorMsg('')
        setTimeFilter('all')
        setStatusFilter('all')
        setItemSearchQuery('')
    }

    // Filter Logic
    const filteredOrders = useMemo(() => {
        const now = new Date()

        return orders.filter(order => {
            const orderDate = new Date(order.created_at)

            // 1. Time Filter
            if (timeFilter === '7days') {
                const diffDays = (now - orderDate) / (1000 * 60 * 60 * 24)
                if (diffDays > 7) return false
            } else if (timeFilter === '30days') {
                const diffDays = (now - orderDate) / (1000 * 60 * 60 * 24)
                if (diffDays > 30) return false
            } else if (timeFilter === '3months') {
                const diffDays = (now - orderDate) / (1000 * 60 * 60 * 24)
                if (diffDays > 90) return false
            } else if (timeFilter === 'year') {
                if (orderDate.getFullYear() !== now.getFullYear()) return false
            }

            // 2. Status Filter
            const s = (order.status || '').toLowerCase()
            if (statusFilter === 'delivered') {
                if (s !== 'delivered') return false
            } else if (statusFilter === 'dispatched') {
                if (s !== 'dispatched' && s !== 'shipped') return false
            } else if (statusFilter === 'pending') {
                if (s !== 'pending_verification' && s !== 'pending') return false
            } else if (statusFilter === 'processing') {
                if (s !== 'processing' && s !== 'confirmed') return false
            } else if (statusFilter === 'cancelled') {
                if (s !== 'cancelled' && s !== 'failed') return false
            }

            // 3. Search query filter (search Order # or Item names)
            if (itemSearchQuery.trim()) {
                const q = itemSearchQuery.toLowerCase().trim()
                const orderNumMatch = (order.order_number || '').toLowerCase().includes(q)
                const itemMatch = (order.items || []).some(item => (item.name || '').toLowerCase().includes(q))
                if (!orderNumMatch && !itemMatch) return false
            }

            return true
        })
    }, [orders, timeFilter, statusFilter, itemSearchQuery])

    // Metric Calculations
    const totalSpent = useMemo(() => {
        return orders.reduce((sum, o) => sum + (parseFloat(o.total) || 0), 0)
    }, [orders])

    const deliveredCount = useMemo(() => {
        return orders.filter(o => (o.status || '').toLowerCase() === 'delivered').length
    }, [orders])

    const pendingCount = useMemo(() => {
        return orders.filter(o => ['pending_verification', 'pending'].includes((o.status || '').toLowerCase())).length
    }, [orders])

    const dispatchedCount = useMemo(() => {
        return orders.filter(o => ['dispatched', 'shipped'].includes((o.status || '').toLowerCase())).length
    }, [orders])

    const getStatusBadge = (status) => {
        const s = (status || '').toLowerCase()
        if (s === 'delivered') {
            return {
                bg: '#DEF7EC',
                color: '#03543F',
                border: '#BCF0DA',
                icon: 'bi-check-circle-fill',
                label: 'Delivered / Successful'
            }
        }
        if (s === 'dispatched' || s === 'shipped') {
            return {
                bg: '#E1EFFE',
                color: '#1E429F',
                border: '#B3C6E8',
                icon: 'bi-truck',
                label: 'Dispatched / In Transit'
            }
        }
        if (s === 'pending_verification' || s === 'pending') {
            return {
                bg: '#FEF08A',
                color: '#854D0E',
                border: '#FDE047',
                icon: 'bi-clock-history',
                label: 'Pending Payment Verification'
            }
        }
        if (s === 'cancelled' || s === 'failed') {
            return {
                bg: '#FDE8E8',
                color: '#9B1C1C',
                border: '#FBD5D5',
                icon: 'bi-x-circle-fill',
                label: 'Cancelled / Failed'
            }
        }
        return {
            bg: '#F3E8FF',
            color: '#6B21A8',
            border: '#E9D5FF',
            icon: 'bi-box-seam',
            label: 'Confirmed & Packing'
        }
    }

    return (
        <div className="profile-page page-enter">
            {/* Header Banner */}
            <div className="profile-header">
                <div className="container">
                    <nav className="breadcrumb" style={{ marginBottom: '12px' }}>
                        <Link to="/"><i className="bi bi-house" /> Home</Link>
                        <span>›</span>
                        <span>Customer Profile & Orders</span>
                    </nav>

                    <div className="profile-header__content">
                        <div>
                            <h1>
                                <i className="bi bi-person-badge-fill" style={{ color: 'var(--cta, #D97706)' }} /> 
                                Customer Profile & Order History
                            </h1>
                            <p>
                                Enter your 10-digit mobile number to view your past orders, real-time shipment status, and delivery details. Zero passwords or Gmail login needed.
                            </p>
                        </div>

                        {activePhone && (
                            <button 
                                className="btn btn-outline-secondary btn-sm" 
                                onClick={handleClearPhone}
                                title="Look up a different phone number"
                                style={{ borderRadius: '10px', fontWeight: 600 }}
                            >
                                <i className="bi bi-arrow-repeat" /> Switch Phone Number
                            </button>
                        )}
                    </div>

                    {/* Phone Lookup Form Box */}
                    <div className="profile-lookup-card">
                        <form onSubmit={handleFormSubmit} className="profile-lookup-form">
                            <div className="profile-phone-input-group">
                                <span className="profile-phone-prefix">
                                    🇮🇳 +91
                                </span>
                                <input
                                    type="tel"
                                    maxLength={10}
                                    placeholder="Enter your 10-digit mobile number (e.g. 9718867135)"
                                    value={phoneInput}
                                    onChange={(e) => {
                                        const val = e.target.value.replace(/\D/g, '')
                                        setPhoneInput(val)
                                        if (errorMsg) setErrorMsg('')
                                    }}
                                    className="profile-phone-input"
                                    autoFocus={!activePhone}
                                />
                                {phoneInput && (
                                    <button 
                                        type="button" 
                                        className="profile-input-clear" 
                                        onClick={() => setPhoneInput('')}
                                        aria-label="Clear input"
                                    >
                                        <i className="bi bi-x-circle-fill" />
                                    </button>
                                )}
                            </div>

                            <button 
                                type="submit" 
                                className="btn btn-primary profile-lookup-btn"
                                disabled={loading || phoneInput.length !== 10}
                            >
                                {loading ? (
                                    <>
                                        <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                                        <span>Fetching Records...</span>
                                    </>
                                ) : (
                                    <>
                                        <i className="bi bi-search" />
                                        <span>View My Orders</span>
                                    </>
                                )}
                            </button>
                        </form>

                        {errorMsg && (
                            <div className="profile-lookup-error">
                                <i className="bi bi-exclamation-triangle-fill" />
                                <span>{errorMsg}</span>
                            </div>
                        )}

                        <div className="profile-lookup-footer">
                            <span className="profile-lookup-hint">
                                <i className="bi bi-shield-check" /> Your phone number is remembered on this device for effortless 1-tap re-ordering.
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="container profile-body">
                {loading ? (
                    <div className="profile-loading-state">
                        <div className="spinner-border text-primary" style={{ width: '3rem', height: '3rem' }} />
                        <h3>Retrieving your orders from database...</h3>
                        <p>Connecting to Neon PostgreSQL server</p>
                    </div>
                ) : !hasSearched ? (
                    /* Initial Prompt State (when no number entered yet) */
                    <div className="profile-empty-initial">
                        <div className="profile-empty-icon">
                            <i className="bi bi-receipt-cutoff" />
                        </div>
                        <h3>Check Your Past Orders Anytime</h3>
                        <p>
                            Enter your registered mobile number in the box above to immediately view all items, dispatch status, tracking links, and delivery addresses associated with your account.
                        </p>
                        <div className="profile-feature-chips">
                            <span><i className="bi bi-check-lg" /> No Password / Gmail Barrier</span>
                            <span><i className="bi bi-truck" /> DTDC & Shree Maruti Live Tracking</span>
                            <span><i className="bi bi-whatsapp" /> 1-Tap WhatsApp Support</span>
                        </div>
                    </div>
                ) : orders.length === 0 ? (
                    /* No Orders Found State */
                    <div className="profile-empty-initial">
                        <div className="profile-empty-icon" style={{ background: '#FFF1F2', color: '#E11D48' }}>
                            <i className="bi bi-inbox" />
                        </div>
                        <h3>No Orders Found for +91 {activePhone}</h3>
                        <p>
                            We could not find any past orders associated with this mobile number in our database. Please make sure you entered the same number provided during WhatsApp checkout.
                        </p>
                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '20px', flexWrap: 'wrap' }}>
                            <button className="btn btn-outline-secondary" onClick={() => setPhoneInput('')}>
                                <i className="bi bi-pencil" /> Try Another Number
                            </button>
                            <Link to="/products" className="btn btn-primary">
                                <i className="bi bi-bag" /> Browse Products Catalog
                            </Link>
                        </div>
                    </div>
                ) : (
                    /* Customer Profile & Orders Found */
                    <>
                        {/* Customer Info & Stats Card */}
                        <div className="profile-summary-card">
                            <div className="profile-summary-header">
                                <div className="profile-avatar">
                                    {(customer?.shop_name || customer?.name || 'Customer').charAt(0).toUpperCase()}
                                </div>
                                <div className="profile-details">
                                    <h2>{customer?.shop_name || customer?.name || 'Smiley N Traders Partner'}</h2>
                                    <div className="profile-meta-row">
                                        <span className="profile-badge-phone">
                                            <i className="bi bi-phone-fill" /> +91 {activePhone}
                                        </span>
                                        {customer?.address && (
                                            <span className="profile-badge-address" title="Registered Delivery Address">
                                                <i className="bi bi-geo-alt-fill" /> {customer.address}, {customer.city ? `${customer.city}, ` : ''}{customer.state ? `${customer.state} ` : ''}- {customer.pincode}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Stat Counters */}
                            <div className="profile-stats-grid">
                                <div className="profile-stat-box">
                                    <div className="profile-stat-icon" style={{ background: '#EFF6FF', color: '#2563EB' }}>
                                        <i className="bi bi-box-seam-fill" />
                                    </div>
                                    <div>
                                        <div className="profile-stat-val">{orders.length}</div>
                                        <div className="profile-stat-lbl">Total Orders</div>
                                    </div>
                                </div>

                                <div className="profile-stat-box">
                                    <div className="profile-stat-icon" style={{ background: '#ECFDF5', color: '#059669' }}>
                                        <i className="bi bi-check-circle-fill" />
                                    </div>
                                    <div>
                                        <div className="profile-stat-val">{deliveredCount}</div>
                                        <div className="profile-stat-lbl">Delivered</div>
                                    </div>
                                </div>

                                <div className="profile-stat-box">
                                    <div className="profile-stat-icon" style={{ background: '#FFFBEB', color: '#D97706' }}>
                                        <i className="bi bi-hourglass-split" />
                                    </div>
                                    <div>
                                        <div className="profile-stat-val">{pendingCount + dispatchedCount}</div>
                                        <div className="profile-stat-lbl">In Progress</div>
                                    </div>
                                </div>

                                <div className="profile-stat-box">
                                    <div className="profile-stat-icon" style={{ background: '#FAF5FF', color: '#7C3AED' }}>
                                        <i className="bi bi-currency-rupee" />
                                    </div>
                                    <div>
                                        <div className="profile-stat-val">{formatPrice(totalSpent)}</div>
                                        <div className="profile-stat-lbl">Total Lifetime Purchases</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Filter Bar */}
                        <div className="profile-filters-section">
                            <div className="profile-filter-controls">
                                {/* Time Filter Pills */}
                                <div className="profile-filter-group">
                                    <span className="profile-filter-label"><i className="bi bi-calendar3" /> Time Range:</span>
                                    <div className="profile-filter-pills">
                                        {TIME_FILTERS.map(tf => (
                                            <button
                                                key={tf.id}
                                                type="button"
                                                className={`profile-pill-btn ${timeFilter === tf.id ? 'active' : ''}`}
                                                onClick={() => setTimeFilter(tf.id)}
                                            >
                                                <i className={`bi ${tf.icon}`} />
                                                {tf.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Status Filter Pills */}
                                <div className="profile-filter-group">
                                    <span className="profile-filter-label"><i className="bi bi-funnel-fill" /> Status:</span>
                                    <div className="profile-filter-pills">
                                        {STATUS_FILTERS.map(sf => {
                                            let count = orders.length
                                            if (sf.id === 'delivered') count = deliveredCount
                                            else if (sf.id === 'dispatched') count = dispatchedCount
                                            else if (sf.id === 'pending') count = pendingCount
                                            else if (sf.id === 'processing') count = orders.filter(o => ['processing', 'confirmed'].includes((o.status || '').toLowerCase())).length
                                            else if (sf.id === 'cancelled') count = orders.filter(o => ['cancelled', 'failed'].includes((o.status || '').toLowerCase())).length

                                            return (
                                                <button
                                                    key={sf.id}
                                                    type="button"
                                                    className={`profile-pill-btn ${statusFilter === sf.id ? 'active' : ''}`}
                                                    onClick={() => setStatusFilter(sf.id)}
                                                >
                                                    <i className={`bi ${sf.icon}`} />
                                                    {sf.label}
                                                    <span className="profile-pill-count">{count}</span>
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>

                                {/* Order Search Input */}
                                <div className="profile-search-bar">
                                    <i className="bi bi-search profile-search-icon" />
                                    <input
                                        type="text"
                                        placeholder="Search by Order # or item name..."
                                        value={itemSearchQuery}
                                        onChange={(e) => setItemSearchQuery(e.target.value)}
                                        className="profile-search-input"
                                    />
                                    {itemSearchQuery && (
                                        <button 
                                            type="button" 
                                            onClick={() => setItemSearchQuery('')} 
                                            className="profile-search-clear"
                                        >
                                            <i className="bi bi-x" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Orders List Heading */}
                        <div className="profile-orders-header">
                            <h3>
                                <i className="bi bi-box" /> Orders ({filteredOrders.length} {filteredOrders.length === 1 ? 'order' : 'orders'} showing)
                            </h3>
                            {(timeFilter !== 'all' || statusFilter !== 'all' || itemSearchQuery) && (
                                <button 
                                    className="profile-reset-btn" 
                                    onClick={() => {
                                        setTimeFilter('all')
                                        setStatusFilter('all')
                                        setItemSearchQuery('')
                                    }}
                                >
                                    <i className="bi bi-arrow-counterclockwise" /> Reset Filters
                                </button>
                            )}
                        </div>

                        {/* Orders Grid / Cards */}
                        {filteredOrders.length === 0 ? (
                            <div className="profile-no-filter-match">
                                <i className="bi bi-filter-circle" />
                                <h4>No orders match your filter criteria</h4>
                                <p>Try selecting "All Time" or "All Orders" to view your complete order history.</p>
                                <button 
                                    className="btn btn-secondary btn-sm" 
                                    onClick={() => {
                                        setTimeFilter('all')
                                        setStatusFilter('all')
                                        setItemSearchQuery('')
                                    }}
                                >
                                    Clear Filters
                                </button>
                            </div>
                        ) : (
                            <div className="profile-orders-list">
                                {filteredOrders.map(order => {
                                    const badge = getStatusBadge(order.status)
                                    const ship = order.shipping || {}
                                    const items = order.items || []

                                    const whatsappMsg = `Hello Smiley N Traders, I have an inquiry regarding my Order #${order.order_number} (Amount: ₹${order.total}).`

                                    return (
                                        <div key={order.id} className="profile-order-card">
                                            {/* Card Top: Order Number, Date, Status */}
                                            <div className="profile-order-card__head">
                                                <div className="profile-order-id-block">
                                                    <span className="profile-order-num">
                                                        #{order.order_number}
                                                    </span>
                                                    <span className="profile-order-date">
                                                        <i className="bi bi-calendar3" />
                                                        {new Date(order.created_at).toLocaleDateString('en-IN', {
                                                            day: '2-digit',
                                                            month: 'short',
                                                            year: 'numeric'
                                                        })} at {new Date(order.created_at).toLocaleTimeString('en-IN', {
                                                            hour: '2-digit',
                                                            minute: '2-digit',
                                                            hour12: true
                                                        })}
                                                    </span>
                                                </div>

                                                <span 
                                                    className="profile-order-status-badge"
                                                    style={{
                                                        background: badge.bg,
                                                        color: badge.color,
                                                        border: `1px solid ${badge.border}`
                                                    }}
                                                >
                                                    <i className={`bi ${badge.icon}`} />
                                                    {badge.label}
                                                </span>
                                            </div>

                                            {/* Courier Dispatched Info Banner if applicable */}
                                            {order.tracking_number && (
                                                <div className="profile-order-courier-banner">
                                                    <i className="bi bi-truck-flatbed" />
                                                    <span>
                                                        Shipped via <strong>{order.courier_name || 'Courier'}</strong> | AWB / Consignment No: <code>{order.tracking_number}</code>
                                                    </span>
                                                    <Link 
                                                        to={`/track/${order.order_number}`}
                                                        className="profile-courier-track-link"
                                                    >
                                                        Live Tracking ›
                                                    </Link>
                                                </div>
                                            )}

                                            {/* Items List */}
                                            <div className="profile-order-items">
                                                {items.map((item, idx) => (
                                                    <div key={item.id || idx} className="profile-order-item-row">
                                                        <img 
                                                            src={item.image_url || item.image || '/placeholder-key.svg'} 
                                                            alt={item.name} 
                                                            className="profile-order-item-img"
                                                            onError={(e) => {
                                                                e.currentTarget.onerror = null
                                                                e.currentTarget.src = '/placeholder-key.svg'
                                                            }}
                                                        />
                                                        <div className="profile-order-item-info">
                                                            <div className="profile-order-item-name">
                                                                {item.name}
                                                            </div>
                                                            <div className="profile-order-item-meta">
                                                                <span>Qty: <strong>{item.quantity}</strong></span>
                                                                <span>×</span>
                                                                <span>{formatPrice(item.price)} each</span>
                                                                {item.sku && <span className="profile-item-sku">SKU: {item.sku}</span>}
                                                            </div>
                                                        </div>
                                                        <div className="profile-order-item-total">
                                                            {formatPrice((parseFloat(item.price) || 0) * (parseInt(item.quantity) || 1))}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Card Foot: Total & Direct Actions */}
                                            <div className="profile-order-card__foot">
                                                <div className="profile-order-foot-left">
                                                    <div className="profile-order-total-lbl">Total Order Amount</div>
                                                    <div className="profile-order-total-val">{formatPrice(order.total)}</div>
                                                    <div className="profile-order-pay-mode">
                                                        Payment: {order.payment_method || 'WhatsApp / UPI'}
                                                    </div>
                                                </div>

                                                <div className="profile-order-foot-actions">
                                                    <Link 
                                                        to={`/track/${order.order_number}`}
                                                        className="btn btn-outline-primary btn-sm profile-action-btn"
                                                    >
                                                        <i className="bi bi-geo-alt-fill" /> Live Tracking
                                                    </Link>

                                                    <a 
                                                        href={`https://wa.me/${WHATSAPP_SUPPORT_PHONE}?text=${encodeURIComponent(whatsappMsg)}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="btn btn-outline-success btn-sm profile-action-btn"
                                                        title="Contact shop on WhatsApp regarding this order"
                                                    >
                                                        <i className="bi bi-whatsapp" /> WhatsApp Help
                                                    </a>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    )
}
