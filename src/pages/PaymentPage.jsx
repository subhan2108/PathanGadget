import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { useAuth } from '../context/AuthContext'
import { placeOrder } from '../lib/orderService'
import { formatPrice } from '../lib/productsService'
import './PaymentPage.css'

const WHATSAPP_PHONE = '918178768308'
const WHATSAPP_DISPLAY = '+91 81787 68308'

export default function PaymentPage() {
    const { cartItems, cartTotal, clearCart } = useCart()
    const { user } = useAuth()
    
    // Form fields
    const [shipping, setShipping] = useState({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        address: '',
        city: '',
        state: '',
        pincode: ''
    })
    
    const [errors, setErrors] = useState({})
    const [paymentMethod, setPaymentMethod] = useState('whatsapp') // 'whatsapp' or 'cod'
    const [loading, setLoading] = useState(false)
    const [successOrder, setSuccessOrder] = useState(null) // holds order info when successful

    // Autofill user info if signed in
    useEffect(() => {
        if (user) {
            setShipping(prev => ({
                ...prev,
                firstName: user.firstName || '',
                lastName: user.lastName || '',
                email: user.primaryEmailAddress?.emailAddress || '',
                phone: user.primaryPhoneNumber?.phoneNumber || ''
            }))
        }
    }, [user])

    const handleInputChange = (e) => {
        const { name, value } = e.target
        setShipping(prev => ({
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
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        const phoneRegex = /^[0-9+\s-]{10,15}$/

        if (!shipping.firstName.trim()) newErrors.firstName = 'First name is required'
        if (!shipping.lastName.trim()) newErrors.lastName = 'Last name is required'
        
        if (!shipping.email.trim()) {
            newErrors.email = 'Email is required'
        } else if (!emailRegex.test(shipping.email)) {
            newErrors.email = 'Please enter a valid email address'
        }

        if (!shipping.phone.trim()) {
            newErrors.phone = 'Phone number is required'
        } else if (!phoneRegex.test(shipping.phone)) {
            newErrors.phone = 'Please enter a valid 10-digit phone number'
        }

        if (!shipping.address.trim()) newErrors.address = 'Delivery address is required'
        if (!shipping.city.trim()) newErrors.city = 'City is required'
        if (!shipping.state.trim()) newErrors.state = 'State is required'
        
        if (!shipping.pincode.trim()) {
            newErrors.pincode = 'Pincode is required'
        } else if (shipping.pincode.trim().length < 6) {
            newErrors.pincode = 'Pincode must be at least 6 digits'
        }

        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }

    const handleSubmit = async (e) => {
        e.preventDefault()

        if (!validateForm()) {
            const firstErrorField = Object.keys(errors)[0]
            const el = document.getElementsByName(firstErrorField)[0]
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
            return
        }

        setLoading(true)

        const orderNumber = `ORD-${Date.now()}`
        const userId = user?.id || 'guest'
        const subtotal = cartTotal
        const deliveryFee = 0 // Free shipping
        const total = subtotal + deliveryFee

        // Map items with explicit sku, full image url, quantity, and name
        const orderItems = cartItems.map(item => {
            const sku = item.sku || (item.category ? `SMN-${item.category.substring(0, 3).toUpperCase()}-${String(item.id).padStart(4, '0')}` : `SMN-${String(item.id).padStart(4, '0')}`)
            
            // Build full absolute image URL for WhatsApp clicking
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
            let details = `${idx + 1}️⃣ *${item.name}*\n`
            details += `   • *SKU:* \`${item.sku}\`\n`
            details += `   • *Quantity:* ${item.quantity}\n`
            details += `   • *Price:* ${formatPrice(item.price)} each (Subtotal: ${formatPrice(lineTotal)})\n`
            if (item.variant_id) details += `   • *Option:* ${item.variant_id}\n`
            if (item.color) details += `   • *Color:* ${item.color}\n`
            details += `   • *Image Link:* ${item.image_url}`
            return details
        }).join('\n\n')

        const customerAddress = `${shipping.address}, ${shipping.city}, ${shipping.state} - ${shipping.pincode}`
        const paymentMethodTitle = paymentMethod === 'whatsapp' 
            ? 'Pay via WhatsApp (UPI / QR / Bank Transfer)' 
            : 'Cash on Delivery (COD)'

        // Complete WhatsApp message with all required details
        const waMessage = 
`🛍️ *NEW ORDER PLACED - #${orderNumber}*
━━━━━━━━━━━━━━━━━━━━━━━━━
👤 *CUSTOMER DETAILS*
• *Full Name:* ${shipping.firstName} ${shipping.lastName}
• *Phone Number:* ${shipping.phone}
• *Email Address:* ${shipping.email}
• *Delivery Address:* ${customerAddress}

━━━━━━━━━━━━━━━━━━━━━━━━━
📦 *ORDERED PRODUCTS (${orderItems.length} items)*

${itemsMessage}

━━━━━━━━━━━━━━━━━━━━━━━━━
💰 *ORDER SUMMARY*
• *Subtotal:* ${formatPrice(subtotal)}
• *Shipping:* FREE Express Delivery
• *Total Payable:* *${formatPrice(total)}*
• *Payment Method:* ${paymentMethodTitle}

━━━━━━━━━━━━━━━━━━━━━━━━━
💬 *Order Note:*
Hello! I have placed this order on your website. Please confirm my order and share the payment details (UPI QR Code / Account info) so I can complete the payment. Thank you!`

        const waUrl = `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(waMessage)}`

        const orderData = {
            order_number: orderNumber,
            user_id: userId,
            total,
            subtotal,
            delivery_fee: deliveryFee,
            payment_method: paymentMethod === 'whatsapp' ? 'WhatsApp' : 'COD',
            payment_id: paymentMethod === 'whatsapp' ? `WA-${Date.now()}` : `COD-${Date.now()}`,
            shipping,
            items: orderItems
        }

        try {
            const result = await placeOrder(orderData)
            
            // Set success view state
            setSuccessOrder({
                id: result?.id || orderNumber,
                order_number: orderNumber,
                total,
                payment_id: orderData.payment_id,
                payment_method: orderData.payment_method,
                waUrl,
                items: orderItems,
                shipping
            })

            // Clear local cart
            clearCart()

            // Automatically open WhatsApp in a new tab
            const openedWindow = window.open(waUrl, '_blank')
            if (!openedWindow) {
                // If browser blocked the popup, redirect directly
                window.location.href = waUrl
            }
        } catch (err) {
            console.error('Failed to save order in database:', err)
            // Even if DB fails, fulfill user request by opening WhatsApp and showing details
            setSuccessOrder({
                id: orderNumber,
                order_number: orderNumber,
                total,
                payment_id: orderData.payment_id,
                payment_method: orderData.payment_method,
                waUrl,
                items: orderItems,
                shipping
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
                    <div className="whatsapp-success-badge">
                        <i className="bi bi-whatsapp" />
                    </div>

                    <h2>Order Placed Successfully!</h2>
                    <p>
                        Thank you for shopping with <strong>Smiley N Traders</strong>. Your order has been registered and is ready for payment on WhatsApp.
                    </p>

                    {/* WhatsApp CTA Card */}
                    <div className="whatsapp-action-box">
                        <div className="whatsapp-action-header">
                            <i className="bi bi-chat-dots-fill" />
                            <span>Complete Payment on WhatsApp</span>
                        </div>
                        <p className="whatsapp-action-desc">
                            Click below to open WhatsApp chat with our verified payment team at <strong>{WHATSAPP_DISPLAY}</strong>. Your order summary and product details are pre-filled.
                        </p>
                        <a 
                            href={successOrder.waUrl} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="btn-whatsapp-cta"
                            id="open-whatsapp-btn"
                        >
                            <i className="bi bi-whatsapp" /> Open WhatsApp Chat ({WHATSAPP_DISPLAY})
                        </a>
                    </div>
                    
                    <div className="success-details">
                        <div className="success-detail-row">
                            <span><i className="bi bi-hash" /> Order No.</span>
                            <strong>{successOrder.order_number}</strong>
                        </div>
                        <div className="success-detail-row">
                            <span><i className="bi bi-wallet2" /> Payment Method</span>
                            <span style={{ color: '#059669', fontWeight: 700 }}>
                                {successOrder.payment_method === 'WhatsApp' ? 'WhatsApp Direct Payment' : 'Cash on Delivery'}
                            </span>
                        </div>
                        <div className="success-detail-row">
                            <span><i className="bi bi-telephone-forward" /> WhatsApp Number</span>
                            <strong>{WHATSAPP_DISPLAY}</strong>
                        </div>
                        <div className="success-detail-row">
                            <span><i className="bi bi-receipt" /> Total Amount</span>
                            <strong className="text-green" style={{ fontSize: '1.15rem' }}>{formatPrice(successOrder.total)}</strong>
                        </div>
                    </div>

                    {/* Ordered Items Preview */}
                    {successOrder.items && successOrder.items.length > 0 && (
                        <div className="success-items-preview">
                            <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: '#4B5563', textAlign: 'left' }}>
                                Items in Order ({successOrder.items.length}):
                            </h4>
                            <div className="success-items-list">
                                {successOrder.items.map((item, idx) => (
                                    <div key={idx} className="success-item-mini">
                                        <img 
                                            src={item.image_url || '/logo.png'} 
                                            alt={item.name} 
                                            style={{ width: 44, height: 44, objectFit: 'contain', borderRadius: 8, border: '1px solid #E5E7EB', background: '#FFF' }}
                                        />
                                        <div style={{ flex: 1, textAlign: 'left' }}>
                                            <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{item.name}</div>
                                            <div style={{ fontSize: '0.75rem', color: '#6B7280' }}>
                                                SKU: <code style={{ color: '#1E293B', fontWeight: 600 }}>{item.sku}</code> • Qty: {item.quantity}
                                            </div>
                                        </div>
                                        <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                                            {formatPrice(item.price * item.quantity)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="success-actions" style={{ marginTop: '24px' }}>
                        <Link to={`/orders/${successOrder.id}`} className="btn btn-primary btn-full">
                            <i className="bi bi-eye" /> View Order Details
                        </Link>
                        <Link to={`/track/${successOrder.order_number}`} className="btn btn-secondary btn-full">
                            <i className="bi bi-geo-alt-fill" /> Track Order Status
                        </Link>
                        <Link to="/" className="btn btn-secondary btn-full">
                            Continue Shopping
                        </Link>
                    </div>
                </div>
            </div>
        )
    }

    // Empty Cart Check
    if (cartItems.length === 0) {
        return (
            <div className="payment-page page-enter" style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="container" style={{ textAlign: 'center', padding: '60px 0' }}>
                    <i className="bi bi-cart-x" style={{ fontSize: '4rem', color: 'var(--text-muted)', marginBottom: '20px', display: 'block' }} />
                    <h2 style={{ marginBottom: '10px' }}>Your Cart is Empty</h2>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>Add products to your cart before proceeding to checkout.</p>
                    <Link to="/products" className="btn btn-primary">
                        <i className="bi bi-shop" /> Shop Now
                    </Link>
                </div>
            </div>
        )
    }

    return (
        <div className="payment-page page-enter" id="payment-page" style={{ backgroundColor: '#F8FAFC', minHeight: '100vh' }}>
            {/* Header */}
            <header className="payment-header" id="payment-header" style={{ backgroundColor: '#FFFFFF' }}>
                <div className="container">
                    <h1>
                        <i className="bi bi-shield-lock-fill" style={{ color: '#059669' }} />
                        Secure Checkout & Order
                    </h1>
                    <div className="payment-header__trust">
                        <span><i className="bi bi-whatsapp" style={{ color: '#25D366' }} /> WhatsApp Payment Support</span>
                        <span><i className="bi bi-truck" style={{ color: '#2563EB' }} /> Free Express Shipping</span>
                        <span><i className="bi bi-arrow-counterclockwise" style={{ color: '#D97706' }} /> 7-Day Easy Returns</span>
                    </div>
                </div>
            </header>

            {/* Body */}
            <div className="container payment-body">
                <form onSubmit={handleSubmit} className="payment-grid" id="payment-form">
                    
                    {/* Left Column - Form */}
                    <div className="payment-form">
                        
                        {/* Shipping Address */}
                        <div className="payment-section" id="shipping-address-section">
                            <h2>
                                <i className="bi bi-geo-alt-fill" />
                                Customer & Shipping Details
                            </h2>
                            
                            <div className="form-row">
                                <div className="form-field">
                                    <label htmlFor="firstName"><i className="bi bi-person" /> First Name *</label>
                                    <input 
                                        type="text" 
                                        id="firstName" 
                                        name="firstName" 
                                        value={shipping.firstName}
                                        onChange={handleInputChange}
                                        className={errors.firstName ? 'error' : ''}
                                        placeholder="John"
                                    />
                                    {errors.firstName && <span className="field-error"><i className="bi bi-exclamation-circle" /> {errors.firstName}</span>}
                                </div>
                                
                                <div className="form-field">
                                    <label htmlFor="lastName"><i className="bi bi-person" /> Last Name *</label>
                                    <input 
                                        type="text" 
                                        id="lastName" 
                                        name="lastName" 
                                        value={shipping.lastName}
                                        onChange={handleInputChange}
                                        className={errors.lastName ? 'error' : ''}
                                        placeholder="Doe"
                                    />
                                    {errors.lastName && <span className="field-error"><i className="bi bi-exclamation-circle" /> {errors.lastName}</span>}
                                </div>
                            </div>

                            <div className="form-row" style={{ marginTop: '16px' }}>
                                <div className="form-field">
                                    <label htmlFor="email"><i className="bi bi-envelope" /> Email Address *</label>
                                    <input 
                                        type="email" 
                                        id="email" 
                                        name="email" 
                                        value={shipping.email}
                                        onChange={handleInputChange}
                                        className={errors.email ? 'error' : ''}
                                        placeholder="john.doe@example.com"
                                    />
                                    {errors.email && <span className="field-error"><i className="bi bi-exclamation-circle" /> {errors.email}</span>}
                                </div>

                                <div className="form-field">
                                    <label htmlFor="phone"><i className="bi bi-telephone" /> Phone / WhatsApp Number *</label>
                                    <input 
                                        type="tel" 
                                        id="phone" 
                                        name="phone" 
                                        value={shipping.phone}
                                        onChange={handleInputChange}
                                        className={errors.phone ? 'error' : ''}
                                        placeholder="+91 9876543210"
                                    />
                                    {errors.phone && <span className="field-error"><i className="bi bi-exclamation-circle" /> {errors.phone}</span>}
                                </div>
                            </div>

                            <div className="form-field" style={{ marginTop: '16px' }}>
                                <label htmlFor="address"><i className="bi bi-house-door" /> Flat / House No / Street Address *</label>
                                <input 
                                    type="text" 
                                    id="address" 
                                    name="address" 
                                    value={shipping.address}
                                    onChange={handleInputChange}
                                    className={errors.address ? 'error' : ''}
                                    placeholder="42, Linking Road, Bandra West"
                                />
                                {errors.address && <span className="field-error"><i className="bi bi-exclamation-circle" /> {errors.address}</span>}
                            </div>

                            <div className="form-row" style={{ marginTop: '16px' }}>
                                <div className="form-field">
                                    <label htmlFor="city"><i className="bi bi-building" /> City *</label>
                                    <input 
                                        type="text" 
                                        id="city" 
                                        name="city" 
                                        value={shipping.city}
                                        onChange={handleInputChange}
                                        className={errors.city ? 'error' : ''}
                                        placeholder="Mumbai"
                                    />
                                    {errors.city && <span className="field-error"><i className="bi bi-exclamation-circle" /> {errors.city}</span>}
                                </div>

                                <div className="form-field">
                                    <label htmlFor="state"><i className="bi bi-map" /> State *</label>
                                    <input 
                                        type="text" 
                                        id="state" 
                                        name="state" 
                                        value={shipping.state}
                                        onChange={handleInputChange}
                                        className={errors.state ? 'error' : ''}
                                        placeholder="Maharashtra"
                                    />
                                    {errors.state && <span className="field-error"><i className="bi bi-exclamation-circle" /> {errors.state}</span>}
                                </div>

                                <div className="form-field">
                                    <label htmlFor="pincode"><i className="bi bi-pin" /> Pincode *</label>
                                    <input 
                                        type="text" 
                                        id="pincode" 
                                        name="pincode" 
                                        maxLength="6"
                                        value={shipping.pincode}
                                        onChange={handleInputChange}
                                        className={errors.pincode ? 'error' : ''}
                                        placeholder="400050"
                                    />
                                    {errors.pincode && <span className="field-error"><i className="bi bi-exclamation-circle" /> {errors.pincode}</span>}
                                </div>
                            </div>
                        </div>

                        {/* Payment Selection */}
                        <div className="payment-section" id="payment-method-section">
                            <h2>
                                <i className="bi bi-credit-card-2-front-fill" />
                                Payment & Order Options
                            </h2>

                            <div className="payment-methods">
                                {/* WhatsApp Payment */}
                                <label className={`payment-method-card whatsapp-card ${paymentMethod === 'whatsapp' ? 'active' : ''}`}>
                                    <input 
                                        type="radio" 
                                        name="paymentMethod" 
                                        value="whatsapp" 
                                        checked={paymentMethod === 'whatsapp'}
                                        onChange={() => setPaymentMethod('whatsapp')}
                                    />
                                    <div className="payment-method-icon whatsapp-icon">
                                        <i className="bi bi-whatsapp" />
                                    </div>
                                    <div className="payment-method-info">
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                            <span className="payment-method-label">Pay via WhatsApp (UPI / QR / Bank)</span>
                                            <span className="whatsapp-badge">Recommended</span>
                                        </div>
                                        <span className="payment-method-desc">
                                            Pay directly via Google Pay, PhonePe, Paytm, or NetBanking with our team on WhatsApp ({WHATSAPP_DISPLAY})
                                        </span>
                                    </div>
                                    <div className="payment-method-check">
                                        <i className={`bi ${paymentMethod === 'whatsapp' ? 'bi-check-circle-fill' : 'bi-circle'}`} />
                                    </div>
                                </label>

                                {/* Cash on Delivery */}
                                <label className={`payment-method-card ${paymentMethod === 'cod' ? 'active' : ''}`}>
                                    <input 
                                        type="radio" 
                                        name="paymentMethod" 
                                        value="cod" 
                                        checked={paymentMethod === 'cod'}
                                        onChange={() => setPaymentMethod('cod')}
                                    />
                                    <div className="payment-method-icon">
                                        <i className="bi bi-cash-stack" />
                                    </div>
                                    <div className="payment-method-info">
                                        <span className="payment-method-label">Cash on Delivery (COD)</span>
                                        <span className="payment-method-desc">
                                            Pay cash when order arrives at your doorstep. Confirmed on WhatsApp ({WHATSAPP_DISPLAY})
                                        </span>
                                    </div>
                                    <div className="payment-method-check">
                                        <i className={`bi ${paymentMethod === 'cod' ? 'bi-check-circle-fill' : 'bi-circle'}`} />
                                    </div>
                                </label>
                            </div>

                            {/* WhatsApp Process Explainer */}
                            <div className="whatsapp-notice-card">
                                <div className="whatsapp-notice-title">
                                    <i className="bi bi-info-circle-fill" />
                                    <span>How Payment on WhatsApp Works:</span>
                                </div>
                                <ol className="whatsapp-steps-list">
                                    <li>Enter your shipping details above and click the green button below.</li>
                                    <li>You will be redirected to WhatsApp chat with <strong>{WHATSAPP_DISPLAY}</strong> with your order, products, quantities, and SKUs pre-filled.</li>
                                    <li>Send the message to our team. We will send you our official UPI QR code or bank details to complete payment immediately.</li>
                                </ol>
                            </div>
                        </div>

                        {/* Complete Payment Button */}
                        <button 
                            type="submit" 
                            className={`pay-btn ${paymentMethod === 'whatsapp' ? 'pay-btn-whatsapp' : ''} ${loading ? 'loading' : ''}`}
                            disabled={loading}
                            id="pay-now-btn"
                        >
                            {loading ? (
                                <>
                                    <span className="spinner" />
                                    Creating Order & Connecting to WhatsApp...
                                </>
                            ) : paymentMethod === 'whatsapp' ? (
                                <>
                                    <i className="bi bi-whatsapp" style={{ fontSize: '1.25rem' }} />
                                    Proceed to WhatsApp for Payment ({formatPrice(cartTotal)})
                                </>
                            ) : (
                                <>
                                    <i className="bi bi-whatsapp" style={{ fontSize: '1.25rem' }} />
                                    Confirm COD Order on WhatsApp ({formatPrice(cartTotal)})
                                </>
                            )}
                        </button>
                        
                        <p className="payment-disclaimer">
                            <i className="bi bi-shield-check" style={{ color: '#059669' }} />
                            Direct merchant checkout powered by Smiley N Traders WhatsApp Support ({WHATSAPP_DISPLAY}).
                        </p>
                    </div>

                    {/* Right Column - Summary */}
                    <div className="payment-summary-col">
                        <div className="payment-summary-card">
                            <h3>
                                <i className="bi bi-cart3" />
                                Order Summary
                            </h3>

                            <div className="summary-items">
                                {cartItems.map(item => {
                                    const itemSku = item.sku || (item.category ? `SMN-${item.category.substring(0, 3).toUpperCase()}-${String(item.id).padStart(4, '0')}` : `SMN-${String(item.id).padStart(4, '0')}`)
                                    return (
                                        <div key={item.id} className="summary-item">
                                            <img 
                                                src={item.image || item.image_url || '/logo.png'} 
                                                alt={item.name}
                                                style={{
                                                    width: '60px',
                                                    height: '60px',
                                                    borderRadius: '10px',
                                                    objectFit: 'contain',
                                                    backgroundColor: '#FFFFFF',
                                                    border: '1px solid #E5E7EB',
                                                    padding: '4px',
                                                    flexShrink: 0
                                                }}
                                                onError={(e) => {
                                                    e.currentTarget.onerror = null;
                                                    e.currentTarget.src = 'https://images.unsplash.com/photo-1558611848-73f7eb4001a1?w=200&q=80';
                                                }}
                                            />
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <p className="summary-item__name" style={{ wordBreak: 'break-word', fontWeight: 600 }}>{item.name}</p>
                                                <p style={{ margin: '2px 0', fontSize: '0.75rem', color: '#4B5563', fontFamily: 'monospace' }}>
                                                    SKU: <strong>{itemSku}</strong>
                                                </p>
                                                {item.variantId && <p className="summary-item__variant" style={{ fontSize: '0.78rem', color: '#6366F1', fontWeight: 600, margin: '2px 0' }}>Offer: {item.variantId}</p>}
                                                <p className="summary-item__qty">
                                                    <i className="bi bi-layers" /> Qty: {item.quantity}
                                                </p>
                                            </div>
                                            <span className="summary-item__price" style={{ color: '#111827', fontWeight: '700', fontSize: '0.9375rem' }}>
                                                {formatPrice(item.price * item.quantity)}
                                            </span>
                                        </div>
                                    )
                                })}
                            </div>

                            <hr className="divider" style={{ margin: '16px 0' }} />

                            <div className="summary-calc-rows">
                                <div className="summary-calc-row">
                                    <span><i className="bi bi-tag" /> Subtotal</span>
                                    <span style={{ color: '#111827', fontWeight: '600' }}>{formatPrice(cartTotal)}</span>
                                </div>
                                <div className="summary-calc-row">
                                    <span><i className="bi bi-truck" /> Shipping</span>
                                    <span className="text-green">FREE</span>
                                </div>
                                <div className="summary-calc-row">
                                    <span><i className="bi bi-percent" /> Taxes (18% GST)</span>
                                    <span>Included</span>
                                </div>
                            </div>

                            <hr className="divider" style={{ margin: '16px 0' }} />

                            <div className="summary-total-row">
                                <strong>Total Amount</strong>
                                <strong className="total-amount" style={{ color: '#111827', fontWeight: '800', fontSize: '1.25rem' }}>{formatPrice(cartTotal)}</strong>
                            </div>

                            <div className="free-shipping-badge">
                                <i className="bi bi-gift-fill" />
                                You qualify for FREE express shipping!
                            </div>
                        </div>

                        {/* Trust Badges */}
                        <div className="trust-badges">
                            <div className="trust-badge">
                                <i className="bi bi-whatsapp" style={{ color: '#25D366' }} />
                                Direct WhatsApp
                            </div>
                            <div className="trust-badge">
                                <i className="bi bi-truck" style={{ color: '#2563EB' }} />
                                Fast Shipping
                            </div>
                            <div className="trust-badge">
                                <i className="bi bi-arrow-left-right" style={{ color: '#D97706' }} />
                                Easy Returns
                            </div>
                        </div>
                    </div>

                </form>
            </div>
        </div>
    )
}
