import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { useAuth } from '../context/AuthContext'
import { placeOrder } from '../lib/orderService'
import { formatPrice } from '../lib/productsService'
import './PaymentPage.css'

const MERCHANT_UPI_ID = import.meta.env.VITE_UPI_ID || 'subhan21@fam'
const MERCHANT_NAME = import.meta.env.VITE_UPI_NAME || 'ElectroCart'

const PAYMENT_METHODS = [
    { id: 'upi_qr', label: 'UPI / QR Code', icon: 'bi-qr-code-scan', desc: 'Scan and pay via GPay, PhonePe, Paytm, etc.' },
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

    if (form.paymentMethod === 'upi_qr') {
        if (!form.utr?.trim() || form.utr?.trim().length < 12) {
            err.utr = 'Enter a valid 12-digit UTR or Transaction ID'
        }
    }
    return err
}

export default function PaymentPage() {
    const navigate = useNavigate()
    const { user } = useAuth()
    const { cartItems, cartTotal, clearCart } = useCart()
    const [form, setForm] = useState({ paymentMethod: 'upi_qr' })
    const [errors, setErrors] = useState({})
    const [loading, setLoading] = useState(false)
    const [success, setSuccess] = useState(false)
    const [orderNumber] = useState(() => 'ORD-' + Math.random().toString(36).toUpperCase().slice(-6))

    // Use cart items
    const orderItems = cartItems
    const subtotal = cartTotal
    const shipping = subtotal >= 999 ? 0 : 99
    const total = subtotal + shipping

    const set = (key, val) => {
        setForm(f => ({ ...f, [key]: val }))
        setErrors(e => ({ ...e, [key]: undefined }))
    }

    // Generate UPI URL
    const upiLink = `upi://pay?pa=${MERCHANT_UPI_ID}&pn=${encodeURIComponent(MERCHANT_NAME)}&am=${total}&cu=INR&tr=${orderNumber}`
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiLink)}`

    const handleSubmit = async (e) => {
        e.preventDefault()
        const errs = validate(form)
        if (Object.keys(errs).length > 0) { setErrors(errs); return }

        if (!user) {
            alert('Please login to place an order.')
            return
        }

        setLoading(true)

        try {
            await placeOrder({
                user_id: user.id,
                order_number: orderNumber,
                subtotal: subtotal,
                delivery_fee: shipping,
                total: total,
                payment_method: form.paymentMethod === 'upi_qr' ? 'UPI' : 'COD',
                payment_id: form.paymentMethod === 'upi_qr' ? form.utr : undefined, // Save the UTR as the payment_id for UPI
                items: orderItems,
                shipping: { name: `${form.firstName} ${form.lastName}`, email: form.email, phone: form.phone, address: form.address, city: form.city, state: form.state, pincode: form.pincode }
            })
            setLoading(false)
            setSuccess(true)
            setTimeout(() => clearCart(), 100)
        } catch (err) {
            console.error('❌ Finalize order error:', err)
            alert('Failed to place order: ' + err.message)
            setLoading(false)
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
                    <h2>Order Placed Successfully!</h2>
                    <p>Your order <code>{orderNumber}</code> has been received. {form.paymentMethod === 'upi_qr' ? 'Administration will verify your UTR and process your order shortly.' : 'You will pay Cash on Delivery.'}</p>
                    <div className="success-details">
                        <div className="success-detail-row">
                            <span><i className="bi bi-bag-check" /> Items</span>
                            <span>{orderItems.length} product{orderItems.length > 1 ? 's' : ''}</span>
                        </div>
                        <div className="success-detail-row">
                            <span><i className="bi bi-cash" /> Amount {form.paymentMethod === 'upi_qr' ? 'Paid' : 'to Pay'}</span>
                            <strong>{formatPrice(total)}</strong>
                        </div>
                        {form.paymentMethod === 'upi_qr' && (
                            <div className="success-detail-row">
                                <span><i className="bi bi-hash" /> UTR Verified</span>
                                <span>{form.utr}</span>
                            </div>
                        )}
                        {form.paymentMethod === 'cod' && (
                            <div className="success-detail-row">
                                <span><i className="bi bi-cash-coin" /> Payment Status</span>
                                <span>Cash on Delivery</span>
                            </div>
                        )}
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
            <div className="payment-header" id="payment-header">
                <div className="container">
                    <h1><i className="bi bi-qr-code-scan" /> Secure UPI Checkout</h1>
                    <div className="payment-header__trust">
                        <span><i className="bi bi-shield-check" /> 100% Safe</span>
                        <span><i className="bi bi-phone" /> Pay via any UPI App</span>
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

                            {/* UPI QR Display */}
                            {form.paymentMethod === 'upi_qr' && (
                                <div className="upi-qr-section" style={{ marginTop: 24, textAlign: 'center', padding: 24, background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)' }}>
                                    <h4 style={{ marginBottom: 16 }}>Scan to Pay with any UPI App</h4>
                                    <img src={qrCodeUrl} alt="UPI QR Code" style={{ width: 200, height: 200, borderRadius: 8, border: '4px solid white', margin: '0 auto', display: 'block' }} />
                                    <div style={{ marginTop: 16, fontSize: 14, color: 'var(--text-secondary)' }}>
                                        <p>or pay to UPI ID:</p>
                                        <strong style={{ fontSize: 16, color: 'var(--text)', background: 'var(--background)', padding: '8px 16px', borderRadius: 8, display: 'inline-block', marginTop: 8 }}>{MERCHANT_UPI_ID}</strong>
                                    </div>
                                    <p style={{ marginTop: 16, marginBottom: 0, fontSize: 14, fontWeight: 500, color: 'var(--primary)' }}>Please pay EXACTLY: {formatPrice(total)}</p>
                                </div>
                            )}

                            {/* UTR Input */}
                            <div className={`form-field ${errors.utr ? 'error' : ''}`} style={{ marginTop: 24 }}>
                                <label htmlFor="utr"><i className="bi bi-hash" /> UTR / Transaction Reference Number</label>
                                <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>After payment, please enter the 12-digit UPI Transaction Reference Number to confirm your order.</p>
                                <input id="utr" type="text" placeholder="e.g. 312345678901" value={form.utr || ''} onChange={e => set('utr', e.target.value.replace(/\D/g, ''))} maxLength={12} />
                                {errors.utr && <span className="field-error"><i className="bi bi-exclamation-circle" /> {errors.utr}</span>}
                            </div>
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
                            <i className="bi bi-shield-fill-check" /> Admin manual verification required after order placement.
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
                            <div className="trust-badge"><i className="bi bi-qr-code" /><span>Verified Merchant</span></div>
                            <div className="trust-badge"><i className="bi bi-arrow-return-left" /><span>7-Day Returns</span></div>
                            <div className="trust-badge"><i className="bi bi-headset" /><span>24/7 Support</span></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

