import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { useAuth } from '../context/AuthContext'
import { placeOrder } from '../lib/orderService'
import { formatPrice } from '../lib/productsService'
import { loadRazorpayScript, openRazorpayCheckout } from '../lib/razorpayService'
import './PaymentPage.css'

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
    const [paymentMethod, setPaymentMethod] = useState('razorpay') // 'razorpay' or 'cod'
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
            newErrors.email = 'Please enter a valid email'
        }

        if (!shipping.phone.trim()) {
            newErrors.phone = 'Phone number is required'
        } else if (!phoneRegex.test(shipping.phone)) {
            newErrors.phone = 'Please enter a valid phone number'
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

        const orderData = {
            order_number: orderNumber,
            user_id: userId,
            total,
            subtotal,
            delivery_fee: deliveryFee,
            payment_method: paymentMethod === 'razorpay' ? 'Razorpay' : 'COD',
            shipping,
            items: cartItems.map(item => ({
                id: item.id.toString(),
                name: item.name,
                price: item.price,
                quantity: item.quantity,
                image_url: item.image || item.image_url,
                image: item.image || item.image_url,
                color: item.color || null,
                variant_id: item.variantId || null
            }))
        }

        if (paymentMethod === 'razorpay') {
            const loaded = await loadRazorpayScript()
            if (!loaded) {
                alert('Could not load Razorpay SDK. Please check your internet connection.')
                setLoading(false)
                return
            }

            try {
                await openRazorpayCheckout({
                    amount: total,
                    name: "Pathan Gadgets",
                    description: `Checkout payment for Order #${orderNumber}`,
                    user: {
                        firstName: shipping.firstName,
                        lastName: shipping.lastName,
                        email: shipping.email,
                        phone: shipping.phone,
                        address: `${shipping.address}, ${shipping.city}, ${shipping.state} - ${shipping.pincode}`
                    },
                    onSuccess: async (response) => {
                        try {
                            orderData.payment_id = response.razorpay_payment_id
                            const result = await placeOrder(orderData)
                            if (result.success) {
                                setSuccessOrder({
                                    id: result.id,
                                    order_number: orderNumber,
                                    total,
                                    payment_id: response.razorpay_payment_id
                                })
                                clearCart()
                            }
                        } catch (err) {
                            console.error('Failed to save order in Neon DB:', err)
                            alert(`Payment of ${formatPrice(total)} was SUCCESSFUL (ID: ${response.razorpay_payment_id}), but saving order to database failed. Please contact customer support with your payment ID immediately!`)
                        } finally {
                            setLoading(false)
                        }
                    },
                    onDismiss: () => {
                        setLoading(false)
                    }
                })
            } catch (err) {
                console.error('Razorpay process failed:', err)
                alert('Payment window failed to load. Please try again.')
                setLoading(false)
            }
        } else {
            // Cash on Delivery (COD)
            try {
                orderData.payment_id = 'COD-' + Date.now()
                const result = await placeOrder(orderData)
                if (result.success) {
                    setSuccessOrder({
                        id: result.id,
                        order_number: orderNumber,
                        total,
                        payment_id: 'CASH_ON_DELIVERY'
                    })
                    clearCart()
                }
            } catch (err) {
                console.error('Failed to create COD order:', err)
                alert('Failed to place order. Please try again.')
            } finally {
                setLoading(false)
            }
        }
    }

    // Success View
    if (successOrder) {
        return (
            <div className="payment-success page-enter" id="payment-success-section">
                <div className="payment-success__card">
                    <div className="success-animation">
                        <div className="success-ring" />
                        <div className="success-checkmark">
                            <i className="bi bi-check-lg" />
                        </div>
                    </div>
                    <h2>Order Confirmed!</h2>
                    <p>Thank you for shopping with Pathan Gadgets. Your order has been placed and is being processed.</p>
                    
                    <div className="success-details">
                        <div className="success-detail-row">
                            <span><i className="bi bi-hash" /> Order No.</span>
                            <strong>{successOrder.order_number}</strong>
                        </div>
                        <div className="success-detail-row">
                            <span><i className="bi bi-wallet2" /> Payment Method</span>
                            <span>{paymentMethod === 'razorpay' ? 'Razorpay Online' : 'Cash on Delivery'}</span>
                        </div>
                        <div className="success-detail-row">
                            <span><i className="bi bi-shield-check" /> Transaction ID</span>
                            <span style={{ fontSize: '0.8rem', wordBreak: 'break-all' }}>{successOrder.payment_id}</span>
                        </div>
                        <div className="success-detail-row">
                            <span><i className="bi bi-receipt" /> Total Amount</span>
                            <strong className="text-green">{formatPrice(successOrder.total)}</strong>
                        </div>
                    </div>

                    <div className="success-actions">
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
        <div className="payment-page page-enter" id="payment-page">
            {/* Header */}
            <header className="payment-header" id="payment-header">
                <div className="container">
                    <h1>
                        <i className="bi bi-shield-lock-fill" />
                        Secure Checkout
                    </h1>
                    <div className="payment-header__trust">
                        <span><i className="bi bi-check-circle-fill" /> 256-Bit SSL Encryption</span>
                        <span><i className="bi bi-truck" /> Free Express Shipping</span>
                        <span><i className="bi bi-arrow-counterclockwise" /> 7-Day Easy Returns</span>
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
                                Shipping & Contact details
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
                                    <label htmlFor="phone"><i className="bi bi-telephone" /> Phone Number *</label>
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
                                Payment Method
                            </h2>
                            <div className="payment-methods">
                                <label className={`payment-method-card ${paymentMethod === 'razorpay' ? 'active' : ''}`}>
                                    <input 
                                        type="radio" 
                                        name="paymentMethod" 
                                        value="razorpay" 
                                        checked={paymentMethod === 'razorpay'}
                                        onChange={() => setPaymentMethod('razorpay')}
                                    />
                                    <div className="payment-method-icon">
                                        <i className="bi bi-wallet" />
                                    </div>
                                    <div className="payment-method-info">
                                        <span className="payment-method-label">Razorpay Secure Online</span>
                                        <span className="payment-method-desc">Pay safely with UPI, Cards, Netbanking, or Wallet</span>
                                    </div>
                                    <div className="payment-method-check">
                                        <i className={`bi ${paymentMethod === 'razorpay' ? 'bi-check-circle-fill' : 'bi-circle'}`} />
                                    </div>
                                </label>

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
                                        <span className="payment-method-desc">Pay cash when your order is delivered at your doorstep</span>
                                    </div>
                                    <div className="payment-method-check">
                                        <i className={`bi ${paymentMethod === 'cod' ? 'bi-check-circle-fill' : 'bi-circle'}`} />
                                    </div>
                                </label>
                            </div>
                        </div>

                        {/* Complete Payment Button */}
                        <button 
                            type="submit" 
                            className={`pay-btn ${loading ? 'loading' : ''}`}
                            disabled={loading}
                            id="pay-now-btn"
                        >
                            {loading ? (
                                <>
                                    <span className="spinner" />
                                    Processing Order...
                                </>
                            ) : paymentMethod === 'razorpay' ? (
                                <>
                                    <i className="bi bi-shield-lock" />
                                    Pay securely with Razorpay ({formatPrice(cartTotal)})
                                </>
                            ) : (
                                <>
                                    <i className="bi bi-bag-check" />
                                    Place Cash on Delivery Order ({formatPrice(cartTotal)})
                                </>
                            )}
                        </button>
                        
                        <p className="payment-disclaimer">
                            <i className="bi bi-lock-fill" />
                            Your transaction is secured using industry-grade SSL encryption protocol.
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
                                {cartItems.map(item => (
                                    <div key={item.id} className="summary-item">
                                        <img src={item.image} alt={item.name} />
                                        <div>
                                            <p className="summary-item__name">{item.name}</p>
                                            {item.variantId && <p className="summary-item__variant" style={{ fontSize: '0.8rem', color: 'var(--cta)', fontWeight: 600, margin: '2px 0 4px' }}>Offer: {item.variantId}</p>}
                                            <p className="summary-item__qty">
                                                <i className="bi bi-layers" /> Qty: {item.quantity}
                                            </p>
                                        </div>
                                        <span className="summary-item__price">
                                            {formatPrice(item.price * item.quantity)}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            <hr className="divider" style={{ margin: '16px 0' }} />

                            <div className="summary-calc-rows">
                                <div className="summary-calc-row">
                                    <span><i className="bi bi-tag" /> Subtotal</span>
                                    <span>{formatPrice(cartTotal)}</span>
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
                                <strong className="total-amount">{formatPrice(cartTotal)}</strong>
                            </div>

                            <div className="free-shipping-badge">
                                <i className="bi bi-gift-fill" />
                                You qualify for FREE premium express shipping!
                            </div>
                        </div>

                        {/* Trust Badges */}
                        <div className="trust-badges">
                            <div className="trust-badge">
                                <i className="bi bi-shield-check" />
                                Safe Payments
                            </div>
                            <div className="trust-badge">
                                <i className="bi bi-truck" />
                                Fast Shipping
                            </div>
                            <div className="trust-badge">
                                <i className="bi bi-arrow-left-right" />
                                Easy Returns
                            </div>
                        </div>
                    </div>

                </form>
            </div>
        </div>
    )
}
