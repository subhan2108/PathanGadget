import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { useAuth } from '../context/AuthContext'
import { placeOrder, lookupCustomerByPhone, saveOrUpdateCustomer } from '../lib/orderService'
import { formatPrice } from '../lib/productsService'
import './PaymentPage.css'

const WHATSAPP_PHONE = '918178768308'
const WHATSAPP_DISPLAY = '+91 81787 68308'

export default function PaymentPage() {
    const { cartItems, cartTotal, clearCart } = useCart()
    const { user } = useAuth()
    const navigate = useNavigate()
    
    // Customer Details (Aged-customer friendly: No Gmail, No passwords)
    const [customer, setCustomer] = useState({
        phone: '',
        name: '',
        shopName: '',
        address: '',
        city: '',
        state: '',
        pincode: ''
    })
    
    const [isRecognizedCustomer, setIsRecognizedCustomer] = useState(false)
    const [isEditingDetails, setIsEditingDetails] = useState(true)
    const [lookupLoading, setLookupLoading] = useState(false)
    const [errors, setErrors] = useState({})
    const [loading, setLoading] = useState(false)
    const [successOrder, setSuccessOrder] = useState(null)

    // Load customer profile from browser localStorage on mount
    useEffect(() => {
        try {
            const savedProfile = localStorage.getItem('sm_customer_profile')
            if (savedProfile) {
                const parsed = JSON.parse(savedProfile)
                if (parsed.phone && parsed.address) {
                    setCustomer(parsed)
                    setIsRecognizedCustomer(true)
                    setIsEditingDetails(false)
                    return
                }
            }
        } catch (e) {
            console.warn('Could not read saved profile:', e)
        }

        // Fallback: If user is signed in through Clerk
        if (user) {
            setCustomer(prev => ({
                ...prev,
                name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
                phone: user.primaryPhoneNumber?.phoneNumber?.replace(/\D/g, '').slice(-10) || prev.phone
            }))
        }
    }, [user])

    // Auto-lookup customer details when a 10-digit phone number is entered
    const handlePhoneChange = async (e) => {
        const val = e.target.value.replace(/\D/g, '').slice(0, 10)
        setCustomer(prev => ({ ...prev, phone: val }))

        if (errors.phone) {
            setErrors(prev => ({ ...prev, phone: '' }))
        }

        if (val.length === 10) {
            setLookupLoading(true)
            try {
                const found = await lookupCustomerByPhone(val)
                if (found && (found.address || found.shop_name || found.name)) {
                    const updated = {
                        phone: val,
                        name: found.name || found.shop_name || '',
                        shopName: found.shop_name || found.name || '',
                        address: found.address || '',
                        city: found.city || '',
                        state: found.state || '',
                        pincode: found.pincode || ''
                    }
                    setCustomer(updated)
                    setIsRecognizedCustomer(true)
                    setIsEditingDetails(false)
                    localStorage.setItem('sm_customer_profile', JSON.stringify(updated))
                }
            } catch (err) {
                console.warn('Phone lookup error:', err)
            } finally {
                setLookupLoading(false)
            }
        }
    }

    const handleInputChange = (e) => {
        const { name, value } = e.target
        setCustomer(prev => ({
            ...prev,
            [name]: value
        }))
        if (errors[name]) {
            setErrors(prev => ({
                ...prev,
                [name]: ''
            }))
        }
    }

    const validateForm = () => {
        const newErrors = {}
        const cleanPhone = customer.phone.replace(/\D/g, '')

        if (!cleanPhone || cleanPhone.length !== 10) {
            newErrors.phone = 'Please enter a valid 10-digit mobile number'
        }

        const displayName = customer.shopName.trim() || customer.name.trim()
        if (!displayName) {
            newErrors.name = 'Please enter your name or shop name'
        }

        if (!customer.address.trim()) {
            newErrors.address = 'Delivery / Shop address is required'
        }

        if (!customer.pincode.trim() || customer.pincode.trim().length < 6) {
            newErrors.pincode = 'Valid 6-digit Pincode is required'
        }

        if (!customer.city.trim()) {
            newErrors.city = 'City is required'
        }

        if (!customer.state.trim()) {
            newErrors.state = 'State is required'
        }

        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }

    const orderNumber = `ORD-${Date.now()}`
    const subtotal = cartTotal
    const deliveryFee = 0 // Free Shipping
    const total = subtotal + deliveryFee

    const handleSubmit = async (e) => {
        e.preventDefault()

        if (!validateForm()) {
            const firstErrorField = Object.keys(errors)[0]
            const el = document.getElementsByName(firstErrorField)[0]
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
            return
        }

        setLoading(true)

        // Save customer profile to browser localStorage for future 1-tap ordering
        try {
            localStorage.setItem('sm_customer_profile', JSON.stringify(customer))
        } catch (e) {
            console.warn('Could not save to localStorage:', e)
        }

        // Map items
        const orderItems = cartItems.map(item => {
            const sku = item.sku || (item.category ? `SMN-${item.category.substring(0, 3).toUpperCase()}-${String(item.id).padStart(4, '0')}` : `SMN-${String(item.id).padStart(4, '0')}`)
            
            let fullImageUrl = item.image || item.image_url || ''
            if (fullImageUrl && !fullImageUrl.startsWith('http://') && !fullImageUrl.startsWith('https://')) {
                fullImageUrl = `${window.location.origin}${fullImageUrl.startsWith('/') ? '' : '/'}${fullImageUrl}`
            } else if (!fullImageUrl) {
                fullImageUrl = `${window.location.origin}/logo.png`
            }

            return {
                id: item.id.toString(),
                sku,
                name: item.name,
                price: Number(item.price),
                quantity: Number(item.quantity) || 1,
                image_url: fullImageUrl,
                image: fullImageUrl,
                color: item.selectedColor || item.color || null,
                variant_id: item.variantId || null
            }
        })

        // Build item text list for WhatsApp message
        const itemsMessage = orderItems.map((item, idx) => {
            const lineTotal = item.price * item.quantity
            return `${idx + 1}. *${item.name}* (Qty: ${item.quantity}) - ${formatPrice(lineTotal)} [SKU: \`${item.sku}\`]`
        }).join('\n')

        const customerAddress = `${customer.address}, ${customer.city}, ${customer.state} - ${customer.pincode}`
        const trackingLink = `${window.location.origin}/track/${orderNumber}`

        const waMessage = 
`🛍️ *NEW ORDER - #${orderNumber}*
━━━━━━━━━━━━━━━━━━━━━━━━━
👤 *CUSTOMER / SHOP:*
• *Shop / Name:* ${customer.shopName || customer.name}
• *Phone:* +91 ${customer.phone}
• *Delivery Address:* ${customerAddress}

📦 *ORDER ITEMS (${orderItems.length}):*
${itemsMessage}

💰 *ORDER TOTAL:*
• *Total Amount:* *${formatPrice(total)}*
• *Payment Mode:* WhatsApp (UPI / Bank)
• *Status:* Order Registered in System

🔗 *Live Order Tracking:*
${trackingLink}

💬 *Hello Smiley N Traders! I have placed this order on your website. Please share your payment QR code so I can complete payment. Thank you!*`

        const waUrl = `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(waMessage)}`

        const orderData = {
            order_number: orderNumber,
            user_id: user?.id || 'guest',
            total,
            subtotal,
            delivery_fee: deliveryFee,
            payment_method: 'WhatsApp',
            payment_id: `WA-${Date.now()}`,
            utr_number: null,
            status: 'pending_verification',
            shipping: {
                firstName: customer.name,
                lastName: customer.shopName,
                name: customer.name,
                shopName: customer.shopName,
                phone: customer.phone,
                address: customer.address,
                city: customer.city,
                state: customer.state,
                pincode: customer.pincode
            },
            items: orderItems
        }

        try {
            // 1. Save order to Neon DB (reserves stock, creates order record with status 'pending_verification')
            const result = await placeOrder(orderData)
            
            // 2. Set success view state
            setSuccessOrder({
                id: result?.id || orderNumber,
                order_number: orderNumber,
                total,
                payment_method: 'WhatsApp (UPI)',
                waUrl,
                items: orderItems,
                customer
            })

            // 3. Clear shopping cart
            clearCart()

            // 4. Automatically open WhatsApp in new tab
            const openedWindow = window.open(waUrl, '_blank')
            if (!openedWindow) {
                // If popup blocker blocked the new tab, redirect directly
                window.location.href = waUrl
            }
        } catch (err) {
            console.error('Failed to save order in database:', err)
            // Even if DB has an issue, ensure customer request goes through to WhatsApp
            setSuccessOrder({
                id: orderNumber,
                order_number: orderNumber,
                total,
                payment_method: 'WhatsApp (UPI)',
                waUrl,
                items: orderItems,
                customer
            })
            clearCart()
            window.open(waUrl, '_blank')
        } finally {
            setLoading(false)
        }
    }

    // Success View
    if (successOrder) {
        return (
            <div className="payment-success page-enter" id="payment-success-section">
                <div className="payment-success__card">
                    <div className="payment-success__icon" style={{ background: '#DCFCE7', color: '#16A34A', width: '70px', height: '70px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: '2rem' }}>
                        <i className="bi bi-whatsapp" />
                    </div>

                    <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#1F2937', marginBottom: '8px' }}>
                        Order Placed & Registered!
                    </h2>
                    <p style={{ color: '#4B5563', fontSize: '1rem', maxWidth: '500px', margin: '0 auto 20px' }}>
                        Thank you, <strong>{successOrder.customer.shopName || successOrder.customer.name}</strong>. Your order is registered in our system and ready for payment on WhatsApp.
                    </p>

                    <div className="payment-receipt" style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '20px', textAlign: 'left', margin: '20px 0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #E5E7EB', paddingBottom: '10px', marginBottom: '10px' }}>
                            <span style={{ color: '#6B7280', fontSize: '0.875rem' }}>Order Number:</span>
                            <strong style={{ color: '#111827', fontFamily: 'monospace', fontSize: '0.95rem' }}>{successOrder.order_number}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #E5E7EB', paddingBottom: '10px', marginBottom: '10px' }}>
                            <span style={{ color: '#6B7280', fontSize: '0.875rem' }}>Total Amount:</span>
                            <strong style={{ color: '#B45309', fontSize: '1.1rem' }}>{formatPrice(successOrder.total)}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #E5E7EB', paddingBottom: '10px', marginBottom: '10px' }}>
                            <span style={{ color: '#6B7280', fontSize: '0.875rem' }}>Payment Status:</span>
                            <span style={{ background: '#FEF3C7', color: '#92400E', padding: '2px 10px', borderRadius: '999px', fontSize: '0.8125rem', fontWeight: 700 }}>
                                ⏳ Pending Payment on WhatsApp
                            </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#6B7280', fontSize: '0.875rem' }}>Delivery Address:</span>
                            <span style={{ color: '#374151', fontSize: '0.875rem', textAlign: 'right', maxWidth: '60%' }}>
                                {successOrder.customer.address}, {successOrder.customer.city} ({successOrder.customer.pincode})
                            </span>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap', marginTop: '24px' }}>
                        <a 
                            href={successOrder.waUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn"
                            style={{ background: '#25D366', color: '#FFFFFF', padding: '12px 24px', fontWeight: 800, borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '1rem' }}
                        >
                            <i className="bi bi-whatsapp" style={{ fontSize: '1.2rem' }} /> Open WhatsApp Chat ({WHATSAPP_DISPLAY})
                        </a>

                        <Link 
                            to={`/track/${successOrder.order_number}`}
                            className="btn btn-primary"
                            style={{ padding: '12px 24px', fontWeight: 700, borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                        >
                            <i className="bi bi-geo-alt-fill" /> Track Order Status
                        </Link>

                        <Link 
                            to="/products"
                            className="btn btn-secondary"
                            style={{ padding: '12px 20px', borderRadius: '8px' }}
                        >
                            Continue Shopping
                        </Link>
                    </div>
                </div>
            </div>
        )
    }

    if (cartItems.length === 0) {
        return (
            <div className="payment-page page-enter">
                <div className="container" style={{ padding: '80px 0', textAlign: 'center' }}>
                    <div style={{ fontSize: '3.5rem', color: '#D1D5DB', marginBottom: '16px' }}>
                        <i className="bi bi-cart-x" />
                    </div>
                    <h2>Your Cart is Empty</h2>
                    <p style={{ color: '#6B7280', margin: '12px 0 24px' }}>Please add products to your cart before proceeding to checkout.</p>
                    <Link to="/products" className="btn btn-primary">Browse Key Blanks & Shells</Link>
                </div>
            </div>
        )
    }

    return (
        <div className="payment-page page-enter" id="payment-page">
            <div className="payment-header">
                <div className="container">
                    <nav className="breadcrumb">
                        <Link to="/"><i className="bi bi-house" /> Home</Link><span>›</span>
                        <Link to="/products">Catalog</Link><span>›</span>
                        <span>Place Order</span>
                    </nav>
                    <h1>
                        <i className="bi bi-whatsapp" style={{ color: '#25D366' }} />
                        Express Checkout via WhatsApp
                    </h1>
                    <div className="payment-header__trust">
                        <span><i className="bi bi-lightning-charge-fill" /> No Password / No Gmail Required</span>
                        <span><i className="bi bi-whatsapp" /> Instant Order on WhatsApp</span>
                        <span><i className="bi bi-truck" /> DTDC / Shree Maruti Courier</span>
                    </div>
                </div>
            </div>

            <div className="container payment-body">
                <div className="payment-grid">
                    {/* Left Column: Form & WhatsApp Payment */}
                    <form onSubmit={handleSubmit} className="payment-form" id="checkout-form">
                        
                        {/* Section 1: Customer Details */}
                        <div className="payment-section" id="customer-details-section">
                            <h2>
                                <i className="bi bi-person-badge-fill" />
                                1. Customer & Delivery Address
                            </h2>

                            {/* Recognized Customer Memory Card */}
                            {isRecognizedCustomer && !isEditingDetails ? (
                                <div className="recognized-customer-banner" style={{ background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: '10px', padding: '16px', marginBottom: '20px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                                        <div>
                                            <span style={{ background: '#B45309', color: '#FFFFFF', fontSize: '0.75rem', fontWeight: 800, padding: '2px 8px', borderRadius: '4px', textTransform: 'uppercase' }}>
                                                ⚡ 1-Tap Saved Address
                                            </span>
                                            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#92400E', margin: '8px 0 4px' }}>
                                                {customer.shopName || customer.name}
                                            </h3>
                                            <p style={{ margin: 0, color: '#78350F', fontSize: '0.875rem' }}>
                                                <i className="bi bi-telephone-fill" style={{ marginRight: '6px' }} />
                                                <strong>+91 {customer.phone}</strong>
                                            </p>
                                            <p style={{ margin: '4px 0 0', color: '#78350F', fontSize: '0.875rem' }}>
                                                <i className="bi bi-geo-alt-fill" style={{ marginRight: '6px' }} />
                                                {customer.address}, {customer.city}, {customer.state} - {customer.pincode}
                                            </p>
                                        </div>
                                        <button 
                                            type="button" 
                                            className="btn btn-secondary btn-sm"
                                            onClick={() => setIsEditingDetails(true)}
                                            style={{ background: '#FFFFFF', borderColor: '#D97706', color: '#B45309', fontWeight: 700 }}
                                        >
                                            <i className="bi bi-pencil-square" /> Change Address
                                        </button>
                                    </div>
                                </div>
                            ) : null}

                            {/* Editable Form Inputs */}
                            {(!isRecognizedCustomer || isEditingDetails) && (
                                <div className="customer-fields-container">
                                    <div className="form-field" style={{ marginBottom: '16px' }}>
                                        <label htmlFor="phone">
                                            <i className="bi bi-phone-fill" style={{ color: '#D97706' }} /> 
                                            Mobile / WhatsApp Number * 
                                            <span style={{ fontSize: '0.75rem', color: '#6B7280', fontWeight: 'normal', marginLeft: '6px' }}>
                                                (Used for WhatsApp order confirmation & tracking)
                                            </span>
                                        </label>
                                        <div style={{ position: 'relative' }}>
                                            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontWeight: 700, color: '#6B7280' }}>+91</span>
                                            <input 
                                                type="tel" 
                                                id="phone" 
                                                name="phone" 
                                                maxLength="10"
                                                value={customer.phone}
                                                onChange={handlePhoneChange}
                                                className={errors.phone ? 'error' : ''}
                                                placeholder="9876543210"
                                                style={{ paddingLeft: '48px', fontSize: '1rem', fontWeight: 600 }}
                                            />
                                            {lookupLoading && (
                                                <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.8125rem', color: '#B45309' }}>
                                                    Checking profile...
                                                </span>
                                            )}
                                        </div>
                                        {errors.phone && <span className="field-error"><i className="bi bi-exclamation-circle" /> {errors.phone}</span>}
                                    </div>

                                    <div className="form-row" style={{ marginBottom: '16px' }}>
                                        <div className="form-field">
                                            <label htmlFor="shopName"><i className="bi bi-shop" /> Shop / Business Name *</label>
                                            <input 
                                                type="text" 
                                                id="shopName" 
                                                name="shopName" 
                                                value={customer.shopName}
                                                onChange={handleInputChange}
                                                className={errors.name ? 'error' : ''}
                                                placeholder="e.g. Sharma Key Makers"
                                            />
                                        </div>
                                        <div className="form-field">
                                            <label htmlFor="name"><i className="bi bi-person" /> Contact Person Name *</label>
                                            <input 
                                                type="text" 
                                                id="name" 
                                                name="name" 
                                                value={customer.name}
                                                onChange={handleInputChange}
                                                placeholder="e.g. Ramesh Sharma"
                                            />
                                        </div>
                                    </div>
                                    {errors.name && <span className="field-error" style={{ display: 'block', marginTop: '-10px', marginBottom: '12px' }}><i className="bi bi-exclamation-circle" /> {errors.name}</span>}

                                    <div className="form-field" style={{ marginBottom: '16px' }}>
                                        <label htmlFor="address"><i className="bi bi-geo-alt" /> Delivery Address / Landmark *</label>
                                        <textarea 
                                            id="address" 
                                            name="address" 
                                            rows="2"
                                            value={customer.address}
                                            onChange={handleInputChange}
                                            className={errors.address ? 'error' : ''}
                                            placeholder="Shop No. 4, Station Road, Near Main Market"
                                            style={{ width: '100%', borderRadius: '8px', border: '1px solid #D1D5DB', padding: '10px' }}
                                        />
                                        {errors.address && <span className="field-error"><i className="bi bi-exclamation-circle" /> {errors.address}</span>}
                                    </div>

                                    <div className="form-row">
                                        <div className="form-field">
                                            <label htmlFor="pincode"><i className="bi bi-pin-map" /> Pincode *</label>
                                            <input 
                                                type="text" 
                                                id="pincode" 
                                                name="pincode" 
                                                maxLength="6"
                                                value={customer.pincode}
                                                onChange={handleInputChange}
                                                className={errors.pincode ? 'error' : ''}
                                                placeholder="e.g. 302001"
                                            />
                                            {errors.pincode && <span className="field-error"><i className="bi bi-exclamation-circle" /> {errors.pincode}</span>}
                                        </div>
                                        <div className="form-field">
                                            <label htmlFor="city"><i className="bi bi-building" /> City *</label>
                                            <input 
                                                type="text" 
                                                id="city" 
                                                name="city" 
                                                value={customer.city}
                                                onChange={handleInputChange}
                                                className={errors.city ? 'error' : ''}
                                                placeholder="e.g. Jaipur"
                                            />
                                            {errors.city && <span className="field-error"><i className="bi bi-exclamation-circle" /> {errors.city}</span>}
                                        </div>
                                        <div className="form-field">
                                            <label htmlFor="state"><i className="bi bi-map" /> State *</label>
                                            <input 
                                                type="text" 
                                                id="state" 
                                                name="state" 
                                                value={customer.state}
                                                onChange={handleInputChange}
                                                className={errors.state ? 'error' : ''}
                                                placeholder="e.g. Rajasthan"
                                            />
                                            {errors.state && <span className="field-error"><i className="bi bi-exclamation-circle" /> {errors.state}</span>}
                                        </div>
                                    </div>

                                    {isRecognizedCustomer && (
                                        <div style={{ marginTop: '12px', textAlign: 'right' }}>
                                            <button 
                                                type="button" 
                                                className="btn btn-secondary btn-sm"
                                                onClick={() => setIsEditingDetails(false)}
                                            >
                                                Done Editing
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Section 2: WhatsApp Payment Info */}
                        <div className="payment-section" id="payment-options-section">
                            <h2>
                                <i className="bi bi-whatsapp" style={{ color: '#25D366' }} />
                                2. Payment & Confirmation via WhatsApp
                            </h2>

                            <div style={{ background: '#F0FDF4', border: '2px solid #86EFAC', borderRadius: '12px', padding: '20px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                                    <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#25D366', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', flexShrink: 0 }}>
                                        <i className="bi bi-whatsapp" />
                                    </div>
                                    <div>
                                        <strong style={{ fontSize: '1.05rem', color: '#166534', display: 'block' }}>
                                            Pay via WhatsApp (UPI / QR / Bank Transfer)
                                        </strong>
                                        <span style={{ fontSize: '0.85rem', color: '#15803D' }}>
                                            Smiley N Traders Official: <strong>{WHATSAPP_DISPLAY}</strong>
                                        </span>
                                    </div>
                                </div>

                                <p style={{ margin: '0 0 14px 0', fontSize: '0.875rem', color: '#166534', lineHeight: 1.5 }}>
                                    When you click <strong>"Place Order on WhatsApp"</strong> below:
                                </p>

                                <div style={{ background: '#FFFFFF', border: '1px solid #BBF7D0', borderRadius: '8px', padding: '14px 16px', fontSize: '0.8125rem', color: '#374151' }}>
                                    <ol style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        <li>Your order will be <strong>instantly saved in our database</strong> with stock reserved.</li>
                                        <li>WhatsApp will automatically open with your ordered items, quantities, and order number.</li>
                                        <li>Our team will share the <strong>UPI QR code / payment info</strong> directly on WhatsApp. Once paid, we approve your order and dispatch!</li>
                                    </ol>
                                </div>
                            </div>
                        </div>

                        {/* Submit Order Button */}
                        <button 
                            type="submit" 
                            className="btn"
                            disabled={loading}
                            id="submit-order-btn"
                            style={{ 
                                padding: '16px 24px', 
                                fontSize: '1.15rem', 
                                fontWeight: 800, 
                                borderRadius: '10px', 
                                background: '#25D366', 
                                color: '#FFFFFF', 
                                border: 'none', 
                                display: 'flex', 
                                justifyContent: 'center', 
                                alignItems: 'center', 
                                gap: '10px',
                                boxShadow: '0 4px 14px rgba(37, 211, 102, 0.35)',
                                cursor: 'pointer'
                            }}
                        >
                            {loading ? (
                                <>
                                    <span className="spinner-border spinner-border-sm" />
                                    Saving Order & Opening WhatsApp...
                                </>
                            ) : (
                                <>
                                    <i className="bi bi-whatsapp" style={{ fontSize: '1.4rem' }} />
                                    Place Order on WhatsApp ({formatPrice(total)})
                                </>
                            )}
                        </button>
                    </form>

                    {/* Right Column: Order Summary */}
                    <div className="payment-summary">
                        <div className="payment-section" id="order-cart-summary">
                            <h2>
                                <i className="bi bi-bag-check-fill" />
                                Order Items ({cartItems.length})
                            </h2>

                            <div className="summary-items-list" style={{ maxHeight: '360px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px', paddingRight: '4px' }}>
                                {cartItems.map((item) => (
                                    <div key={item.id} style={{ display: 'flex', gap: '12px', alignItems: 'center', borderBottom: '1px solid #F3F4F6', paddingBottom: '10px' }}>
                                        <img 
                                            src={item.image || item.image_url || '/logo.png'} 
                                            alt={item.name} 
                                            referrerPolicy="no-referrer"
                                            style={{ width: '48px', height: '48px', objectFit: 'contain', background: '#F9FAFB', borderRadius: '6px', border: '1px solid #E5E7EB' }}
                                        />
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1F2937', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {item.name}
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: '#6B7280' }}>
                                                Qty: {item.quantity} × {formatPrice(item.price)}
                                            </div>
                                        </div>
                                        <div style={{ fontWeight: 700, color: '#111827', fontSize: '0.875rem' }}>
                                            {formatPrice(Number(item.price) * Number(item.quantity))}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div style={{ borderTop: '2px solid #E5E7EB', paddingTop: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#4B5563', fontSize: '0.875rem' }}>
                                    <span>Subtotal:</span>
                                    <span>{formatPrice(subtotal)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#10B981', fontSize: '0.875rem', fontWeight: 600 }}>
                                    <span>Courier Shipping:</span>
                                    <span>FREE</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#111827', fontSize: '1.25rem', fontWeight: 800, borderTop: '1px solid #E5E7EB', paddingTop: '8px' }}>
                                    <span>Total Payable:</span>
                                    <span style={{ color: '#D97706' }}>{formatPrice(total)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
