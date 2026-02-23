import React, { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchOrderDetails } from '../lib/orderService'
import { formatPrice } from '../lib/productsService'
import './OrderDetailsPage.css'

const TIMELINE_ICONS = {
    'Order Placed': 'bi-bag-check',
    'Confirmed': 'bi-check-circle',
    'Shipped': 'bi-truck',
    'Delivered': 'bi-box-seam',
}

export default function OrderDetailsPage() {
    const { id } = useParams()
    const [order, setOrder] = useState(null)
    const [loading, setLoading] = useState(true)
    const [expandedSpec, setExpandedSpec] = useState(null)

    useEffect(() => {
        setLoading(true)
        fetchOrderDetails(id).then(data => {
            setOrder(data)
            setLoading(false)
        })
    }, [id])

    if (loading) return (
        <div className="order-details-page page-enter">
            <div className="container" style={{ padding: '100px 0', textAlign: 'center' }}>
                <div className="spinner-border text-primary" />
                <p style={{ marginTop: 20 }}>Loading order details...</p>
            </div>
        </div>
    )

    if (!order) return (
        <div className="order-details-page page-enter">
            <div className="container" style={{ padding: '100px 0', textAlign: 'center' }}>
                <h3>Order not found</h3>
                <Link to="/orders" className="btn btn-primary">Back to Orders</Link>
            </div>
        </div>
    )

    const getStatusColor = (status) => {
        const s = status?.toLowerCase()
        if (s === 'delivered') return 'success'
        if (s === 'processing' || s === 'confirmed') return 'warning'
        if (s === 'shipped') return 'info'
        if (s === 'cancelled') return 'danger'
        return 'primary'
    }

    const subtotal = order.subtotal
    const shipping = order.delivery_fee
    const tax = Math.round(subtotal * 0.18)
    const progressPct = order.order_tracking?.length > 0
        ? (order.order_tracking.filter(t => t.is_current || t.id).length / 4) * 100
        : 25


    return (
        <div className="order-details-page page-enter" id="order-details-page">
            {/* Header */}
            <div className="order-details-header" id="order-details-header">
                <div className="container">
                    <nav className="breadcrumb">
                        <Link to="/"><i className="bi bi-house" /> Home</Link><span>›</span>
                        <Link to="/orders"><i className="bi bi-box-seam" /> My Orders</Link><span>›</span>
                        <span>{order.id}</span>
                    </nav>
                    <div className="order-details-title-row">
                        <div>
                            <h1><i className="bi bi-receipt" /> Order Details</h1>
                            <p><i className="bi bi-hash" />{order.id} ·
                                <span className="order-date">
                                    <i className="bi bi-calendar3" />
                                    {new Date(order.created_at || order.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                                </span>
                            </p>
                        </div>
                        <span className={`badge badge-${getStatusColor(order.status)}`} style={{ fontSize: '0.9375rem', padding: '8px 18px' }}>
                            {order.status || 'Confirmed'}
                        </span>
                    </div>
                </div>
            </div>

            <div className="container order-details-body">
                <div className="order-details-grid" id="order-details-grid">
                    {/* Left Column */}
                    <div className="order-details-left">
                        {/* Timeline */}
                        <div className="order-section" id="order-timeline">
                            <h2><i className="bi bi-activity" /> Order Timeline</h2>
                            <div className="timeline-steps-inline">
                                {(order.order_tracking || []).map((step, i) => (
                                    <div key={i} className="timeline-step-inline done">
                                        <div className="timeline-step-inline__icon">
                                            <i className="bi bi-check-lg" />
                                        </div>
                                        <span className="timeline-step-inline__label">{step.label}</span>
                                        {i < (order.order_tracking.length - 1) && (
                                            <div className="timeline-step-inline__connector done" />
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* Progress Bar */}
                            <div className="timeline-progress-bar" role="progressbar" aria-valuenow={progressPct}>
                                <div className="timeline-progress-bar__fill" style={{ width: `${progressPct}%` }} />
                            </div>
                            {/* Step List */}
                            <div className="timeline-list">
                                {(order.order_tracking || []).map((step, i) => (
                                    <div key={i} className="timeline-list__item done">
                                        <div className="timeline-list__dot">
                                            <i className="bi bi-check-circle-fill" />
                                        </div>
                                        <div>
                                            <p className="timeline-list__step">{step.label}</p>
                                            <p className="timeline-list__date">
                                                <i className="bi bi-clock" /> {new Date(step.event_time).toLocaleString()}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                        </div>

                        {/* Items */}
                        <div className="order-section" id="order-items">
                            <h2><i className="bi bi-bag" /> Items in Order</h2>
                            <div className="order-items-list">
                                {(order.order_items || []).map(item => (
                                    <div key={item.id} className="order-detail-item">
                                        <img src={item.image_url} alt={item.name} className="order-detail-item__img" />
                                        <div className="order-detail-item__info">
                                            <h3>{item.name}</h3>
                                            <p><i className="bi bi-layers" /> Qty: {item.quantity}</p>
                                            <p className="order-detail-item__price">{formatPrice(item.price)}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>


                        {/* Shipping */}
                        <div className="order-section" id="order-shipping">
                            <h2><i className="bi bi-geo-alt-fill" /> Shipping Address</h2>
                            <div className="shipping-address-card">
                                <div className="shipping-address-icon"><i className="bi bi-house-door-fill" /></div>
                                <div>
                                    <p className="shipping-name"><i className="bi bi-person-fill" /> Customer</p>
                                    <p className="shipping-addr"><i className="bi bi-map" /> Shipping to registered address</p>
                                </div>
                            </div>
                        </div>

                    </div>

                    {/* Right Column */}
                    <div className="order-details-right">
                        {/* Order Summary */}
                        <div className="order-summary-card" id="order-summary">
                            <h3><i className="bi bi-receipt" /> Order Summary</h3>
                            <div className="summary-row">
                                <span><i className="bi bi-tag" /> Subtotal</span>
                                <span>{formatPrice(subtotal)}</span>
                            </div>
                            <div className="summary-row">
                                <span><i className="bi bi-truck" /> Shipping</span>
                                <span className="text-green">{shipping === 0 ? 'FREE' : formatPrice(shipping)}</span>
                            </div>
                            <div className="summary-row">
                                <span><i className="bi bi-percent" /> GST (18%)</span>
                                <span>{formatPrice(tax)}</span>
                            </div>
                            <hr className="divider" />
                            <div className="summary-row summary-total">
                                <strong>Total Paid</strong>
                                <strong>{formatPrice(order.total)}</strong>
                            </div>
                        </div>

                        {/* Payment Info */}
                        <div className="payment-info-card" id="payment-info">
                            <h3><i className="bi bi-credit-card" /> Payment Info</h3>
                            <div className="payment-row">
                                <span><i className="bi bi-wallet" /> Method</span>
                                <strong style={{ textTransform: 'uppercase' }}>{order.payment_method}</strong>
                            </div>
                            <div className="payment-row">
                                <span><i className="bi bi-hash" /> Order No.</span>
                                <code>{order.order_number}</code>
                            </div>
                            <div className="payment-row">
                                <span><i className="bi bi-shield-check" /> Status</span>
                                <span className="text-green"><i className="bi bi-check-circle-fill" /> {order.payment_status || 'Paid'}</span>
                            </div>
                        </div>


                        {/* Actions */}
                        <div className="order-actions" id="order-actions">
                            {['shipped', 'confirmed', 'processing'].includes(order.status) && (
                                <Link to={`/track/${order.order_number}`} className="btn btn-primary btn-full" id="track-package-btn">
                                    <i className="bi bi-geo-alt-fill" /> Track Package
                                </Link>
                            )}

                            <button id="download-invoice" className="btn btn-secondary btn-full">
                                <i className="bi bi-download" /> Download Invoice
                            </button>
                            <button id="contact-support" className="btn btn-secondary btn-full">
                                <i className="bi bi-headset" /> Contact Support
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
