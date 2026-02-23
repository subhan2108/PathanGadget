import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { useAuth } from '../context/AuthContext'
import { placeOrder } from '../lib/orderService'
import { formatPrice } from '../lib/productsService'
import './PaymentPage.css'

const PAYMENT_METHODS = [
    { id: 'upi', label: 'UPI', icon: 'bi-phone', desc: 'Pay via GPay, PhonePe, Paytm' },
    { id: 'card', label: 'Credit / Debit Card', icon: 'bi-credit-card', desc: 'Visa, Mastercard, RuPay' },
    { id: 'netbanking', label: 'Net Banking', icon: 'bi-bank', desc: 'All major Indian banks' },
    { id: 'cod', label: 'Cash on Delivery', icon: 'bi-cash-coin', desc: 'Available for orders under ₹10,000' },
]

function validate(form) {
    const err = {}
    if (!form.firstName?.trim()) err.firstName = 'First name is required'
    if (!form.lastName?.trim()) err.lastName = 'Last name is required'
    if (!form.email?.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) err.email = 'Enter a valid email'
    if (!form.phone?.match(/^[6-9]\d{9}$/)) err.phone = 'Enter a valid 10-digit phone number'
    if (!form.address?.trim()) err.address = 'Address is required'
    if (!form.city?.trim()) err.city = 'City is required'
    if (!form.state?.trim()) err.state = 'State is required'
    if (!form.pincode?.match(/^\d{6}$/)) err.pincode = 'Enter a valid 6-digit pincode'
    if (form.paymentMethod === 'card') {
        if (!form.cardNumber?.replace(/\s/g, '').match(/^\d{16}$/)) err.cardNumber = 'Enter a valid 16-digit card number'
        if (!form.cardName?.trim()) err.cardName = 'Name on card is required'
        if (!form.expiry?.match(/^\d{2}\/\d{2}$/)) err.expiry = 'Enter valid expiry (MM/YY)'
        if (!form.cvv?.match(/^\d{3,4}$/)) err.cvv = 'Enter valid CVV'
    }
    if (form.paymentMethod === 'upi') {
        if (!form.upiId?.match(/^[\w.-]+@[\w]+$/)) err.upiId = 'Enter a valid UPI ID (e.g. name@upi)'
    }
    return err
}

export default function PaymentPage() {
    const navigate = useNavigate()
    const { user } = useAuth()
    const { cartItems, cartTotal, clearCart } = useCart()
    const [form, setForm] = useState({ paymentMethod: 'upi' })
    const [errors, setErrors] = useState({})
    const [loading, setLoading] = useState(false)
    const [success, setSuccess] = useState(false)
    const [orderNumber] = useState(() => 'ORD-' + Math.random().toString(36).toUpperCase().slice(-6))

    // Use cart items
    const orderItems = cartItems
    const subtotal = cartTotal
    const shipping = subtotal >= 999 ? 0 : 99
    const tax = Math.round(subtotal * 0.18)
    const total = subtotal + shipping + tax

    const set = (key, val) => {
        setForm(f => ({ ...f, [key]: val }))
        setErrors(e => ({ ...e, [key]: undefined }))
    }

    const formatCard = (val) => {
        const digits = val.replace(/\D/g, '').slice(0, 16)
        return digits.replace(/(.{4})/g, '$1 ').trim()
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        const errs = validate(form)
        if (Object.keys(errs).length > 0) { setErrors(errs); return }

        if (!user) {
            alert('Please login to place an order.')
            return
        }

        setLoading(true)

        // ── Razorpay Integration ──
        if (['upi', 'card', 'netbanking'].includes(form.paymentMethod)) {
            const options = {
                key: 'rzp_test_mock_key', // Replace with your actual key
                amount: total * 100, // Razorpay expects amount in paise
                currency: 'INR',
                name: 'ElectroCart',
                description: `Order ${orderNumber}`,
                image: '/favicon.svg',
                handler: async function (response) {
                    // Payment successful — now place the order
                    try {
                        await placeOrder({
                            user_id: user.id,
                            order_number: orderNumber,
                            subtotal: subtotal,
                            delivery_fee: shipping,
                            total: total,
                            payment_method: form.paymentMethod,
                            payment_id: response.razorpay_payment_id,
                            items: orderItems,
                            shipping: { name: `${form.firstName} ${form.lastName}`, email: form.email, phone: form.phone, address: form.address, city: form.city, state: form.state, pincode: form.pincode }
                        })
                        setLoading(false)
                        setSuccess(true)
                        setTimeout(() => clearCart(), 100)
                    } catch (err) {
                        console.error('❌ Finalize order error:', err)
                        alert('Payment was successful but order creation failed. Please contact support.')
                        setLoading(false)
                    }
                },
                prefill: {
                    name: `${form.firstName} ${form.lastName}`,
                    email: form.email,
                    contact: form.phone
                },
                theme: { color: '#2563eb' },
                modal: {
                    ondismiss: function () {
                        setLoading(false)
                    }
                }
            }

            const rzp = new window.Razorpay(options)
            rzp.open()
        } else {
            // Cash on Delivery
            try {
                await placeOrder({
                    user_id: user.id,
                    order_number: orderNumber,
                    subtotal: subtotal,
                    delivery_fee: shipping,
                    total: total,
                    payment_method: form.paymentMethod,
                    items: orderItems,
                    shipping: { name: `${form.firstName} ${form.lastName}`, email: form.email, phone: form.phone, address: form.address, city: form.city, state: form.state, pincode: form.pincode }
                })
                setLoading(false)
                setSuccess(true)
                setTimeout(() => clearCart(), 100)
            } catch (err) {
                console.error('❌ COD error:', err)
                alert('Failed to place order: ' + err.message)
                setLoading(false)
            }
        }
    }


    // ── Success State ──
    if (success) {
        return (
            <div className="payment-success" id="payment-success">
                <div className="payment-success__card">
                    <div className="success-animation">
                        <div className="success-ring" />
                        <div className="success-checkmark"><i className="bi bi-check-lg" /></div>
                    </div>
                    <h2>Payment Successful!</h2>
                    <p>Your order <code>{orderNumber}</code> has been placed. You'll receive a confirmation email shortly.</p>
                    <div className="success-details">
                        <div className="success-detail-row">
                            <span><i className="bi bi-bag-check" /> Items</span>
                            <span>{orderItems.length} product{orderItems.length > 1 ? 's' : ''}</span>
                        </div>
                        <div className="success-detail-row">
                            <span><i className="bi bi-cash" /> Amount Paid</span>
                            <strong>{formatPrice(total)}</strong>
                        </div>
                        <div className="success-detail-row">
                            <span><i className="bi bi-truck" /> Expected Delivery</span>
                            <span>2–4 Business Days</span>
                        </div>
                    </div>
                    <div className="success-actions">
                        <button className="btn btn-primary btn-lg" onClick={() => navigate(`/track/${orderNumber}`)} id="success-track">
                            <i className="bi bi-geo-alt-fill" /> Track Your Order
                        </button>
                        <button className="btn btn-secondary" onClick={() => navigate('/')} id="success-home">
                            <i className="bi bi-house" /> Back to Home
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="payment-page page-enter" id="payment-page">
            {/* Header */}
            <div className="payment-header" id="payment-header">
                <div className="container">
                    <h1><i className="bi bi-lock-fill" /> Secure Checkout</h1>
                    <div className="payment-header__trust">
                        <span><i className="bi bi-shield-check" /> SSL Encrypted</span>
                        <span><i className="bi bi-credit-card" /> 100% Secure</span>
                        <span><i className="bi bi-lock" /> PCI DSS Compliant</span>
                    </div>
                </div>
            </div>

            <div className="container payment-body">
                <div className="payment-grid" id="payment-grid">
                    {/* Left: Form */}
                    <form className="payment-form" onSubmit={handleSubmit} id="payment-form" noValidate>
                        {/* Shipping */}
                        <div className="payment-section" id="shipping-section">
                            <h2><i className="bi bi-geo-alt-fill" /> Shipping Details</h2>
                            <div className="form-row">
                                <div className={`form-field ${errors.firstName ? 'error' : ''}`}>
                                    <label htmlFor="firstName"><i className="bi bi-person" /> First Name</label>
                                    <input id="firstName" type="text" placeholder="Arjun" value={form.firstName || ''} onChange={e => set('firstName', e.target.value)} />
                                    {errors.firstName && <span className="field-error"><i className="bi bi-exclamation-circle" /> {errors.firstName}</span>}
                                </div>
                                <div className={`form-field ${errors.lastName ? 'error' : ''}`}>
                                    <label htmlFor="lastName"><i className="bi bi-person" /> Last Name</label>
                                    <input id="lastName" type="text" placeholder="Sharma" value={form.lastName || ''} onChange={e => set('lastName', e.target.value)} />
                                    {errors.lastName && <span className="field-error"><i className="bi bi-exclamation-circle" /> {errors.lastName}</span>}
                                </div>
                            </div>
                            <div className="form-row">
                                <div className={`form-field ${errors.email ? 'error' : ''}`}>
                                    <label htmlFor="email"><i className="bi bi-envelope" /> Email</label>
                                    <input id="email" type="email" placeholder="arjun@example.com" value={form.email || ''} onChange={e => set('email', e.target.value)} />
                                    {errors.email && <span className="field-error"><i className="bi bi-exclamation-circle" /> {errors.email}</span>}
                                </div>
                                <div className={`form-field ${errors.phone ? 'error' : ''}`}>
                                    <label htmlFor="phone"><i className="bi bi-telephone" /> Phone</label>
                                    <input id="phone" type="tel" placeholder="98765 43210" maxLength={10} value={form.phone || ''} onChange={e => set('phone', e.target.value.replace(/\D/g, ''))} />
                                    {errors.phone && <span className="field-error"><i className="bi bi-exclamation-circle" /> {errors.phone}</span>}
                                </div>
                            </div>
                            <div className={`form-field ${errors.address ? 'error' : ''}`}>
                                <label htmlFor="address"><i className="bi bi-map" /> Full Address</label>
                                <input id="address" type="text" placeholder="42 Linking Road, Bandra West" value={form.address || ''} onChange={e => set('address', e.target.value)} />
                                {errors.address && <span className="field-error"><i className="bi bi-exclamation-circle" /> {errors.address}</span>}
                            </div>
                            <div className="form-row">
                                <div className={`form-field ${errors.city ? 'error' : ''}`}>
                                    <label htmlFor="city"><i className="bi bi-building" /> City</label>
                                    <input id="city" type="text" placeholder="Mumbai" value={form.city || ''} onChange={e => set('city', e.target.value)} />
                                    {errors.city && <span className="field-error"><i className="bi bi-exclamation-circle" /> {errors.city}</span>}
                                </div>
                                <div className={`form-field ${errors.state ? 'error' : ''}`}>
                                    <label htmlFor="state"><i className="bi bi-flag" /> State</label>
                                    <select id="state" value={form.state || ''} onChange={e => set('state', e.target.value)}>
                                        <option value="">Select State</option>
                                        {['Maharashtra', 'Delhi', 'Karnataka', 'Tamil Nadu', 'Gujarat', 'Rajasthan', 'West Bengal', 'Uttar Pradesh'].map(s => (
                                            <option key={s} value={s}>{s}</option>
                                        ))}
                                    </select>
                                    {errors.state && <span className="field-error"><i className="bi bi-exclamation-circle" /> {errors.state}</span>}
                                </div>
                                <div className={`form-field ${errors.pincode ? 'error' : ''}`}>
                                    <label htmlFor="pincode"><i className="bi bi-pin-map" /> Pincode</label>
                                    <input id="pincode" type="text" placeholder="400050" maxLength={6} value={form.pincode || ''} onChange={e => set('pincode', e.target.value.replace(/\D/g, ''))} />
                                    {errors.pincode && <span className="field-error"><i className="bi bi-exclamation-circle" /> {errors.pincode}</span>}
                                </div>
                            </div>
                        </div>

                        {/* Payment Method */}
                        <div className="payment-section" id="payment-method-section">
                            <h2><i className="bi bi-wallet2" /> Payment Method</h2>
                            <div className="payment-methods" id="payment-methods">
                                {PAYMENT_METHODS.map(m => (
                                    <label
                                        key={m.id}
                                        htmlFor={`pmethod-${m.id}`}
                                        id={`payment-method-${m.id}`}
                                        className={`payment-method-card ${form.paymentMethod === m.id ? 'active' : ''}`}
                                    >
                                        <input
                                            type="radio"
                                            id={`pmethod-${m.id}`}
                                            name="paymentMethod"
                                            value={m.id}
                                            checked={form.paymentMethod === m.id}
                                            onChange={() => set('paymentMethod', m.id)}
                                        />
                                        <div className="payment-method-icon"><i className={`bi ${m.icon}`} /></div>
                                        <div className="payment-method-info">
                                            <span className="payment-method-label">{m.label}</span>
                                            <span className="payment-method-desc">{m.desc}</span>
                                        </div>
                                        {form.paymentMethod === m.id && (
                                            <i className="bi bi-check-circle-fill payment-method-check" />
                                        )}
                                    </label>
                                ))}
                            </div>

                            {/* UPI Input */}
                            {form.paymentMethod === 'upi' && (
                                <div className={`form-field ${errors.upiId ? 'error' : ''}`} style={{ marginTop: 16 }}>
                                    <label htmlFor="upiId"><i className="bi bi-phone" /> UPI ID</label>
                                    <input id="upiId" type="text" placeholder="yourname@upi" value={form.upiId || ''} onChange={e => set('upiId', e.target.value)} />
                                    {errors.upiId && <span className="field-error"><i className="bi bi-exclamation-circle" /> {errors.upiId}</span>}
                                </div>
                            )}

                            {/* Card Fields */}
                            {form.paymentMethod === 'card' && (
                                <div className="card-fields" style={{ marginTop: 16 }}>
                                    <div className={`form-field ${errors.cardNumber ? 'error' : ''}`}>
                                        <label htmlFor="cardNumber"><i className="bi bi-credit-card" /> Card Number</label>
                                        <input id="cardNumber" type="text" placeholder="1234 5678 9012 3456" maxLength={19} value={form.cardNumber || ''} onChange={e => set('cardNumber', formatCard(e.target.value))} />
                                        {errors.cardNumber && <span className="field-error"><i className="bi bi-exclamation-circle" /> {errors.cardNumber}</span>}
                                    </div>
                                    <div className={`form-field ${errors.cardName ? 'error' : ''}`}>
                                        <label htmlFor="cardName"><i className="bi bi-person-badge" /> Name on Card</label>
                                        <input id="cardName" type="text" placeholder="ARJUN SHARMA" value={form.cardName || ''} onChange={e => set('cardName', e.target.value.toUpperCase())} />
                                        {errors.cardName && <span className="field-error"><i className="bi bi-exclamation-circle" /> {errors.cardName}</span>}
                                    </div>
                                    <div className="form-row">
                                        <div className={`form-field ${errors.expiry ? 'error' : ''}`}>
                                            <label htmlFor="expiry"><i className="bi bi-calendar" /> Expiry (MM/YY)</label>
                                            <input id="expiry" type="text" placeholder="08/27" maxLength={5} value={form.expiry || ''} onChange={e => {
                                                let v = e.target.value.replace(/\D/g, '')
                                                if (v.length > 2) v = v.slice(0, 2) + '/' + v.slice(2, 4)
                                                set('expiry', v)
                                            }} />
                                            {errors.expiry && <span className="field-error"><i className="bi bi-exclamation-circle" /> {errors.expiry}</span>}
                                        </div>
                                        <div className={`form-field ${errors.cvv ? 'error' : ''}`}>
                                            <label htmlFor="cvv"><i className="bi bi-lock" /> CVV</label>
                                            <input id="cvv" type="password" placeholder="•••" maxLength={4} value={form.cvv || ''} onChange={e => set('cvv', e.target.value.replace(/\D/g, ''))} />
                                            {errors.cvv && <span className="field-error"><i className="bi bi-exclamation-circle" /> {errors.cvv}</span>}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Net Banking */}
                            {form.paymentMethod === 'netbanking' && (
                                <div className="form-field" style={{ marginTop: 16 }}>
                                    <label htmlFor="bankSelect"><i className="bi bi-bank" /> Select Bank</label>
                                    <select id="bankSelect" value={form.bank || ''} onChange={e => set('bank', e.target.value)}>
                                        <option value="">Choose your bank</option>
                                        {['SBI', 'HDFC Bank', 'ICICI Bank', 'Axis Bank', 'Kotak Mahindra', 'PNB'].map(b => (
                                            <option key={b} value={b}>{b}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>

                        <button
                            id="place-order-btn"
                            type="submit"
                            className={`btn btn-primary btn-lg btn-full pay-btn ${loading ? 'loading' : ''}`}
                            disabled={loading}
                        >
                            {loading
                                ? <><span className="spinner" /> Processing…</>
                                : <><i className="bi bi-lock-fill" /> Place Order · {formatPrice(total)}</>
                            }
                        </button>

                        <p className="payment-disclaimer">
                            <i className="bi bi-shield-fill-check" /> Your payment is secured with 256-bit SSL encryption.
                        </p>
                    </form>

                    {/* Right: Summary */}
                    <div className="payment-summary-col" id="payment-summary">
                        <div className="payment-summary-card">
                            <h3><i className="bi bi-cart3" /> Order Summary</h3>
                            <div className="summary-items">
                                {orderItems.map(item => (
                                    <div key={item.id} className="summary-item">
                                        <img src={item.image} alt={item.name} />
                                        <div>
                                            <p className="summary-item__name">{item.name}</p>
                                            <p className="summary-item__qty"><i className="bi bi-layers" /> × {item.quantity}</p>
                                        </div>
                                        <span className="summary-item__price">{formatPrice(item.price * item.quantity)}</span>
                                    </div>
                                ))}
                            </div>
                            <hr className="divider" />
                            <div className="summary-calc-rows">
                                <div className="summary-calc-row">
                                    <span><i className="bi bi-tag" /> Subtotal</span>
                                    <span>{formatPrice(subtotal)}</span>
                                </div>
                                <div className="summary-calc-row">
                                    <span><i className="bi bi-truck" /> Shipping</span>
                                    <span className={shipping === 0 ? 'text-green' : ''}>{shipping === 0 ? 'FREE' : formatPrice(shipping)}</span>
                                </div>
                                <div className="summary-calc-row">
                                    <span><i className="bi bi-percent" /> GST (18%)</span>
                                    <span>{formatPrice(tax)}</span>
                                </div>
                            </div>
                            <hr className="divider" />
                            <div className="summary-total-row">
                                <strong><i className="bi bi-receipt" /> Total</strong>
                                <strong className="total-amount">{formatPrice(total)}</strong>
                            </div>
                            {shipping === 0 && (
                                <div className="free-shipping-badge">
                                    <i className="bi bi-truck" /> You get FREE shipping!
                                </div>
                            )}
                        </div>

                        {/* Trust Badges */}
                        <div className="trust-badges">
                            <div className="trust-badge"><i className="bi bi-shield-check" /><span>Secure Checkout</span></div>
                            <div className="trust-badge"><i className="bi bi-arrow-return-left" /><span>7-Day Returns</span></div>
                            <div className="trust-badge"><i className="bi bi-headset" /><span>24/7 Support</span></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
