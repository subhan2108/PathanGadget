import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchOrderDetails } from '../lib/orderService'
import { supabase } from '../lib/supabaseClient'
import './OrderTrackingPage.css'

// Bootstrap icon names for each tracking step
const STEP_ICONS = ['bi-box-seam', 'bi-building', 'bi-truck', 'bi-scooter', 'bi-gift']

export default function OrderTrackingPage() {
    const { id } = useParams()
    const [order, setOrder] = useState(null)
    const [loading, setLoading] = useState(true)
    const [animatedStep, setAnimatedStep] = useState(-1)

    useEffect(() => {
        setLoading(true)
        fetchOrderDetails(id, true).then(data => {
            setOrder(data)
            setLoading(false)
            if (data?.order_tracking) {
                data.order_tracking.forEach((_, i) => {
                    setTimeout(() => setAnimatedStep(i), i * 350 + 200)
                })
            }
        })
    }, [id])

    useEffect(() => {
        if (!order?.id) return;

        // ── Realtime Subscription ──
        const channel = supabase.channel(`order-${order.id}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'order_tracking',
                filter: `order_id=eq.${order.id}`
            }, (payload) => {
                console.log('📡 Realtime Tracking Update:', payload)
                // Re-fetch or update state locally
                fetchOrderDetails(id, true).then(data => {
                    setOrder(data)
                    if (data?.order_tracking) {
                        data.order_tracking.forEach((_, i) => {
                            setTimeout(() => setAnimatedStep(i), i * 350 + 200)
                        })
                    }
                })
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [order?.id, id])

    if (loading) return (
        <div className="tracking-page page-enter">
            <div className="container" style={{ padding: '100px 0', textAlign: 'center' }}>
                <div className="spinner-border text-primary" />
                <p style={{ marginTop: 20 }}>Fetching live tracking data...</p>
            </div>
        </div>
    )

    if (!order) return (
        <div className="tracking-page page-enter">
            <div className="container" style={{ padding: '100px 0', textAlign: 'center' }}>
                <h3>Tracking information not available</h3>
                <Link to="/orders" className="btn btn-primary">Back to Orders</Link>
            </div>
        </div>
    )

    const steps = order.order_tracking || []
    const doneCount = steps.length
    const progressPct = steps.length > 0 ? (steps.length / 4) * 100 : 25


    return (
        <div className="tracking-page page-enter" id="tracking-page">

            {/* Page Header */}
            <div className="tracking-header" id="tracking-header">
                <div className="tracking-header__bg" />
                <div className="container tracking-header__inner">
                    <nav className="breadcrumb">
                        <Link to="/"><i className="bi bi-house" /> Home</Link><span>›</span>
                        <Link to="/orders"><i className="bi bi-box-seam" /> My Orders</Link><span>›</span>
                        <span>Track Order</span>
                    </nav>

                    <div className="tracking-hero">
                        <div className="tracking-status-badge" id="tracking-status-badge">
                            <i className="bi bi-truck status-icon" />
                            <span className="status-text">Your Order is On the Way!</span>
                        </div>
                        <h1 className="tracking-title">Live Order Tracking</h1>
                        <p className="tracking-subtitle">
                            We're delivering your package as fast as possible. You can track every step below.
                        </p>
                    </div>

                    {/* Meta Cards */}
                    <div className="tracking-meta-cards" id="tracking-meta-cards">
                        <div className="tracking-meta-card" id="tracking-order-id">
                            <span className="meta-label"><i className="bi bi-hash" /> Order ID</span>
                            <code className="meta-value">{order.id}</code>
                        </div>
                        <div className="tracking-meta-card" id="tracking-number">
                            <span className="meta-label"><i className="bi bi-upc-scan" /> Order No.</span>
                            <code className="meta-value">{order.order_number}</code>
                        </div>
                        <div className="tracking-meta-card tracking-meta-card--eta" id="tracking-eta">
                            <span className="meta-label"><i className="bi bi-calendar3" /> Est. Delivery</span>
                            <span className="meta-value meta-value--eta">2–4 Days</span>
                        </div>
                        <div className="tracking-meta-card" id="tracking-carrier">
                            <span className="meta-label"><i className="bi bi-buildings" /> Carrier</span>
                            <span className="meta-value">FastTrack India</span>
                        </div>
                    </div>

                </div>
            </div>

            <div className="container tracking-body">
                <div className="tracking-grid" id="tracking-grid">

                    {/* Left: Timeline */}
                    <div className="tracking-left">
                        <div className="tracking-card" id="tracking-timeline-card">
                            <div className="tracking-card__header">
                                <h2><i className="bi bi-activity" /> Tracking Timeline</h2>
                                <span className="tracking-progress-chip">
                                    <i className="bi bi-check-circle" /> {doneCount} Milestone{doneCount !== 1 ? 's' : ''}
                                </span>
                            </div>

                            {/* Progress Bar */}
                            <div className="tracking-progress-bar" id="tracking-progress-bar" role="progressbar" aria-valuenow={progressPct} aria-valuemin={0} aria-valuemax={100}>
                                <div className="tracking-progress-bar__fill" style={{ width: `${progressPct}%` }} />
                            </div>

                            {/* Steps */}
                            <ol className="tracking-steps" id="tracking-steps">
                                {steps.map((step, i) => {
                                    const isAnimated = animatedStep >= i
                                    return (
                                        <li
                                            key={step.id}
                                            id={`tracking-step-${i}`}
                                            className={`tracking-step done visible ${isAnimated ? 'animated' : ''}`}
                                        >
                                            <div className="step-icon-wrap">
                                                <i className={`bi ${STEP_ICONS[i] || 'bi-circle-fill'}`} />
                                            </div>
                                            <div className="step-content">
                                                <div className="step-header">
                                                    <h3 className="step-label">{step.label}</h3>
                                                    <span className="step-date">
                                                        <i className="bi bi-clock" /> {new Date(step.timestamp || step.event_time).toLocaleString()}
                                                    </span>
                                                </div>
                                                <p className="step-desc">{step.description}</p>
                                            </div>
                                        </li>
                                    )
                                })}
                            </ol>

                        </div>
                    </div>

                    {/* Right: Details + Map + Support */}
                    <div className="tracking-right">

                        {/* Shipment Details */}
                        <div className="tracking-card" id="shipment-details">
                            <h3 className="tracking-card__subtitle"><i className="bi bi-geo-alt-fill" /> Shipment Details</h3>
                            <div className="shipment-detail-rows">
                                <div className="shipment-row">
                                    <span><i className="bi bi-building" /> From</span>
                                    <span>Mumbai Warehouse, MH</span>
                                </div>
                                <div className="shipment-row">
                                    <span><i className="bi bi-house-door" /> To</span>
                                    <span>Bandra West, Mumbai 400050</span>
                                </div>
                                <div className="shipment-row">
                                    <span><i className="bi bi-box2" /> Weight</span>
                                    <span>450g</span>
                                </div>
                                <div className="shipment-row">
                                    <span><i className="bi bi-rocket-takeoff" /> Service</span>
                                    <span>Express Delivery</span>
                                </div>
                                <div className="shipment-row">
                                    <span><i className="bi bi-truck" /> Carrier</span>
                                    <span>FastTrack India</span>
                                </div>
                            </div>
                        </div>

                        {/* Map Placeholder */}
                        <div className="tracking-map-placeholder" id="tracking-map">
                            <div className="map-placeholder__content">
                                <div className="map-pulse">
                                    <div className="map-pulse__dot" />
                                    <div className="map-pulse__ring map-pulse__ring--1" />
                                    <div className="map-pulse__ring map-pulse__ring--2" />
                                </div>
                                <p className="map-placeholder__label"><i className="bi bi-geo-alt-fill" /> Live Map Tracking</p>
                                <p className="map-placeholder__sub">Your package is currently in transit.</p>
                                <p className="map-placeholder__sub" style={{ marginTop: 4, fontWeight: 600 }}>
                                    <i className="bi bi-arrow-right" /> Mumbai → Bandra West
                                </p>
                            </div>
                        </div>

                        {/* Delivery Info */}
                        <div className="tracking-card tracking-delivery-card" id="delivery-info">
                            <i className="bi bi-calendar-event delivery-icon" />
                            <div>
                                <p className="delivery-heading"><i className="bi bi-clock" /> Estimated Delivery</p>
                                <p className="delivery-date">2–4 Business Days</p>
                                <p className="delivery-note"><i className="bi bi-sun" /> Between 10 AM – 8 PM</p>
                            </div>
                        </div>

                        {/* Support CTA */}
                        <div className="tracking-support" id="tracking-support">
                            <i className="bi bi-headset support-icon" />
                            <h3>Need Help?</h3>
                            <p>Our support team is available 24/7 to assist with your order.</p>
                            <div className="support-actions">
                                <button id="call-support" className="btn btn-primary btn-full">
                                    <i className="bi bi-telephone-fill" /> Call Support
                                </button>
                                <button id="chat-support" className="btn btn-secondary btn-full">
                                    <i className="bi bi-chat-dots-fill" /> Live Chat
                                </button>
                            </div>
                        </div>

                    </div>
                </div>
            </div>

        </div>
    )
}
