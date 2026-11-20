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
    const { cartItems, cartTotal, clearCart, updateQty, removeFromCart } = useCart()
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
                    <div className="payment-success__icon-wrap">
                        <i className="bi bi-whatsapp" />
                    </div>

                    <h2 className="payment-success__title">
                        Order Placed & Registered!
                    </h2>
                    <p className="payment-success__subtitle">
                        Thank you, <strong>{successOrder.customer.shopName || successOrder.customer.name}</strong>. Your order is registered in our system and ready for payment on WhatsApp.
                    </p>

                    <div className="payment-receipt-card">
                        <div className="payment-receipt-row">
                            <span className="receipt-label">Order Number:</span>
                            <strong className="receipt-val receipt-mono">{successOrder.order_number}</strong>
                        </div>
                        <div className="payment-receipt-row">
                            <span className="receipt-label">Total Amount:</span>
                            <strong className="receipt-val receipt-total">{formatPrice(successOrder.total)}</strong>
                        </div>
                        <div className="payment-receipt-row">
                            <span className="receipt-label">Payment Status:</span>
                            <span className="receipt-badge">
                                ⏳ Pending on WhatsApp
                            </span>
                        </div>
                        <div className="payment-receipt-row payment-receipt-row--address">
                            <span className="receipt-label">Delivery Address:</span>
                            <span className="receipt-val receipt-address">
                                {successOrder.customer.address}, {successOrder.customer.city} ({successOrder.customer.pincode})
                            </span>
                        </div>
                    </div>

                    <div className="payment-success-buttons">
                        <a 
                            href={successOrder.waUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-success-wa"
                        >
                            <i className="bi bi-whatsapp" /> Open WhatsApp Chat ({WHATSAPP_DISPLAY})
                        </a>

                        <Link 
                            to={`/track/${successOrder.order_number}`}
                            className="btn btn-primary btn-success-track"
                        >
                            <i className="bi bi-geo-alt-fill" /> Track Order Status
                        </Link>

                        <Link 
                            to="/products"
                            className="btn btn-secondary btn-success-home"
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
                <div className="container empty-cart-container">
                    <div className="empty-cart-icon">
                        <i className="bi bi-cart-x" />
                    </div>
                    <h2>Your Cart is Empty</h2>
                    <p>Please add products to your cart before proceeding to checkout.</p>
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
                        <span><i className="bi bi-truck" /> DTDC / Maruti Courier</span>
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
                                <div className="recognized-customer-banner">
                                    <div className="recognized-customer-banner__header">
                                        <span className="saved-badge">⚡ 1-Tap Saved Address</span>
                                        <button 
                                            type="button" 
                                            className="btn-change-address"
                                            onClick={() => setIsEditingDetails(true)}
                                        >
                                            <i className="bi bi-pencil-square" /> Change Address
                                        </button>
                                    </div>
                                    <h3 className="recognized-customer-name">
                                        {customer.shopName || customer.name}
                                    </h3>
                                    <div className="recognized-customer-details">
                                        <p><i className="bi bi-telephone-fill" /> <strong>+91 {customer.phone}</strong></p>
                                        <p><i className="bi bi-geo-alt-fill" /> {customer.address}, {customer.city}, {customer.state} - {customer.pincode}</p>
                                    </div>
                                </div>
                            ) : null}

                            {/* Editable Form Inputs */}
                            {(!isRecognizedCustomer || isEditingDetails) && (
                                <div className="customer-fields-container">
                                    <div className="form-field phone-field">
                                        <label htmlFor="phone">
                                            <i className="bi bi-phone-fill" style={{ color: '#D97706' }} /> 
                                            <span>Mobile / WhatsApp Number *</span>
                                            <span className="label-helper-text">
                                                (For WhatsApp order & courier updates)
                                            </span>
                                        </label>
                                        <div className="phone-input-wrap">
                                            <span className="phone-prefix">+91</span>
                                            <input 
                                                type="tel" 
                                                id="phone" 
                                                name="phone" 
                                                maxLength="10"
                                                inputMode="numeric"
                                                autoComplete="tel-national"
                                                value={customer.phone}
                                                onChange={handlePhoneChange}
                                                className={errors.phone ? 'error' : ''}
                                                placeholder="9876543210"
                                            />
                                            {lookupLoading && (
                                                <span className="phone-lookup-status">
                                                    Checking profile...
                                                </span>
                                            )}
                                        </div>
                                        {errors.phone && <span className="field-error"><i className="bi bi-exclamation-circle" /> {errors.phone}</span>}
                                    </div>

                                    <div className="form-row form-row--names">
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
                                    {errors.name && <span className="field-error name-field-error"><i className="bi bi-exclamation-circle" /> {errors.name}</span>}

                                    <div className="form-field address-field">
                                        <label htmlFor="address"><i className="bi bi-geo-alt" /> Delivery Address / Landmark *</label>
                                        <textarea 
                                            id="address" 
                                            name="address" 
                                            rows="2"
                                            value={customer.address}
                                            onChange={handleInputChange}
                                            className={errors.address ? 'error' : ''}
                                            placeholder="Shop No. 4, Station Road, Near Main Market"
                                        />
                                        {errors.address && <span className="field-error"><i className="bi bi-exclamation-circle" /> {errors.address}</span>}
                                    </div>

                                    <div className="form-row form-row--location">
                                        <div className="form-field pincode-field">
                                            <label htmlFor="pincode"><i className="bi bi-pin-map" /> Pincode *</label>
                                            <input 
                                                type="text" 
                                                id="pincode" 
                                                name="pincode" 
                                                maxLength="6"
                                                inputMode="numeric"
                                                value={customer.pincode}
                                                onChange={handleInputChange}
                                                className={errors.pincode ? 'error' : ''}
                                                placeholder="e.g. 302001"
                                            />
                                            {errors.pincode && <span className="field-error"><i className="bi bi-exclamation-circle" /> {errors.pincode}</span>}
                                        </div>
                                        <div className="form-field city-field">
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
                                        <div className="form-field state-field">
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
                                        <div className="done-editing-wrap">
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

                            <div className="whatsapp-info-box">
                                <div className="whatsapp-info-box__header">
                                    <div className="whatsapp-info-box__icon">
                                        <i className="bi bi-whatsapp" />
                                    </div>
                                    <div className="whatsapp-info-box__titles">
                                        <strong className="wa-title">
                                            Pay via WhatsApp (UPI / QR / Bank Transfer)
                                        </strong>
                                        <span className="wa-subtitle">
                                            Smiley N Traders Official: <strong>{WHATSAPP_DISPLAY}</strong>
                                        </span>
                                    </div>
                                </div>

                                <p className="whatsapp-info-box__desc">
                                    When you click <strong>"Place Order on WhatsApp"</strong> below:
                                </p>

                                <div className="whatsapp-steps-card">
                                    <ol>
                                        <li>Your order is <strong>instantly saved in our database</strong> with stock reserved.</li>
                                        <li>WhatsApp opens with your ordered items, quantities & order number.</li>
                                        <li>Our team shares the <strong>UPI QR code / bank info</strong> on WhatsApp. Once paid, we dispatch!</li>
                                    </ol>
                                </div>
                            </div>
                        </div>

                        {/* Submit Order Button */}
                        <button 
                            type="submit" 
                            className="btn-whatsapp-submit"
                            disabled={loading}
                            id="submit-order-btn"
                        >
                            {loading ? (
                                <>
                                    <span className="spinner-border spinner-border-sm" />
                                    <span>Saving Order & Opening WhatsApp...</span>
                                </>
                            ) : (
                                <>
                                    <i className="bi bi-whatsapp" />
                                    <span>Place Order on WhatsApp ({formatPrice(total)})</span>
                                </>
                            )}
                        </button>
                    </form>

                    {/* Order Summary */}
                    <div className="payment-summary" id="order-cart-summary">
                        <div className="payment-section">
                            <h2>
                                <i className="bi bi-bag-check-fill" />
                                Order Items ({cartItems.length})
                            </h2>

                            <div className="summary-items-list">
                                {cartItems.map((item) => (
                                    <div key={item.id} className="desktop-summary-item">
                                        <img 
                                            src={item.image || item.image_url || '/logo.png'} 
                                            alt={item.name} 
                                            referrerPolicy="no-referrer"
                                            className="desktop-summary-item__img"
                                        />
                                        <div className="desktop-summary-item__details">
                                            <div className="desktop-summary-item__name" title={item.name}>
                                                {item.name}
                                            </div>
                                            <div className="payment-qty-controls">
                                                <div className="payment-qty-stepper">
                                                    <button
                                                        type="button"
                                                        className="payment-qty-btn"
                                                        onClick={() => updateQty(item.id, Number(item.quantity) - 1)}
                                                        title="Decrease quantity"
                                                        aria-label="Decrease quantity"
                                                    >
                                                        <i className="bi bi-dash" />
                                                    </button>
                                                    <span className="payment-qty-val">{item.quantity}</span>
                                                    <button
                                                        type="button"
                                                        className="payment-qty-btn"
                                                        onClick={() => updateQty(item.id, Number(item.quantity) + 1)}
                                                        title="Increase quantity"
                                                        aria-label="Increase quantity"
                                                    >
                                                        <i className="bi bi-plus" />
                                                    </button>
                                                </div>
                                                <span className="payment-item-unit">× {formatPrice(item.price)}</span>
                                                <button
                                                    type="button"
                                                    className="payment-item-delete-btn"
                                                    onClick={() => removeFromCart(item.id)}
                                                    title="Remove item from order"
                                                    aria-label="Remove item"
                                                >
                                                    <i className="bi bi-trash3" />
                                                </button>
                                            </div>
                                        </div>
                                        <div className="desktop-summary-item__price">
                                            {formatPrice(Number(item.price) * Number(item.quantity))}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="desktop-summary-calc">
                                <div className="summary-calc-row">
                                    <span>Subtotal:</span>
                                    <span>{formatPrice(subtotal)}</span>
                                </div>
                                <div className="summary-calc-row text-green">
                                    <span>Courier Shipping:</span>
                                    <span>FREE</span>
                                </div>
                                <div className="summary-calc-row summary-calc-row--total">
                                    <span>Total Payable:</span>
                                    <span className="total-gold">{formatPrice(total)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
