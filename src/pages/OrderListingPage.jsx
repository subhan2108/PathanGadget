import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { fetchUserOrders } from '../lib/orderService'
import { formatPrice } from '../lib/productsService'
import './OrderListingPage.css'

const STATUS_TABS = [
    { id: 'all', label: 'All Orders', icon: 'bi-box-seam' },
    { id: 'processing', label: 'Processing', icon: 'bi-arrow-repeat' },
    { id: 'shipped', label: 'Shipped', icon: 'bi-truck' },
    { id: 'delivered', label: 'Delivered', icon: 'bi-check-circle' },
    { id: 'cancelled', label: 'Cancelled', icon: 'bi-x-circle' },
]

const STATUS_ICONS = {
    processing: 'bi-arrow-repeat',
    shipped: 'bi-truck',
    delivered: 'bi-check-circle-fill',
    cancelled: 'bi-x-circle-fill',
}

const ITEMS_PER_PAGE = 5

export default function OrderListingPage() {
    const { user } = useAuth()
    const [orders, setOrders] = useState([])
    const [loading, setLoading] = useState(true)
    const [activeStatus, setActiveStatus] = useState('all')
    const [page, setPage] = useState(1)

    useEffect(() => {
        if (!user) return
        setLoading(true)
        fetchUserOrders(user.id).then(data => {
            setOrders(data)
            setLoading(false)
        })
    }, [user])

    const getStatusColor = (status) => {
        const s = status?.toLowerCase()
        if (s === 'delivered') return 'success'
        if (s === 'processing' || s === 'confirmed') return 'warning'
        if (s === 'shipped') return 'info'
        if (s === 'cancelled') return 'danger'
        return 'primary'
    }

    const filtered = activeStatus === 'all' ? orders : orders.filter(o => o.status === activeStatus)
    const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE)
    const displayed = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE)

    const handleTabChange = (id) => {
        setActiveStatus(id)
        setPage(1)
    }

    return (
        <div className="order-listing-page page-enter" id="order-listing-page">
            {/* Header */}
            <div className="order-listing-header" id="order-listing-header">
                <div className="container">
                    <nav className="breadcrumb">
                        <Link to="/"><i className="bi bi-house" /> Home</Link><span>›</span>
                        <span>My Orders</span>
                    </nav>
                    <div className="order-listing-title-row">
                        <div>
                            <h1><i className="bi bi-box-seam" /> My Orders</h1>
                            <p>{orders.length} total orders in your history</p>
                        </div>
                        <Link to={orders.length > 0 ? `/track/${orders[0].order_number || orders[0].id}` : '#'} className="btn btn-secondary" id="track-order-btn">
                            <i className="bi bi-geo-alt-fill" /> Track a Package
                        </Link>
                    </div>
                </div>
            </div>

            <div className="container order-listing-body">
                {/* Status Filters */}
                <div className="order-status-tabs" id="order-status-tabs" role="tablist">
                    {STATUS_TABS.map(t => {
                        const count = t.id === 'all' ? orders.length : orders.filter(o => o.status === t.id).length
                        return (
                            <button
                                key={t.id}
                                id={`status-tab-${t.id}`}
                                role="tab"
                                aria-selected={activeStatus === t.id}
                                className={`status-tab ${activeStatus === t.id ? 'active' : ''}`}
                                onClick={() => handleTabChange(t.id)}
                            >
                                <i className={`bi ${t.icon}`} />
                                {t.label}
                                <span className="tab-count">{count}</span>
                            </button>
                        )
                    })}
                </div>

                {/* Orders */}
                {loading ? (
                    <div className="orders-empty" style={{ padding: '80px 0' }}>
                        <div className="spinner-border text-primary" />
                        <p style={{ marginTop: 20 }}>Fetching your order history...</p>
                    </div>
                ) : displayed.length === 0 ? (
                    <div className="orders-empty" id="orders-empty">
                        <i className="bi bi-inbox orders-empty__icon" />
                        <h3>No orders found</h3>
                        <p>You don't have any {activeStatus !== 'all' ? activeStatus : ''} orders yet.</p>
                        <Link to="/" className="btn btn-primary"><i className="bi bi-bag-fill" /> Start Shopping</Link>
                    </div>
                ) : (
                    <div className="orders-list" id="orders-list">
                        {displayed.map(order => (
                            <div key={order.id} className="order-card" id={`order-card-${order.id}`}>
                                {/* Card Header */}
                                <div className="order-card__header">
                                    <div className="order-card__meta">
                                        <span className="order-id"><i className="bi bi-hash" />{order.id}</span>
                                        <span className="order-date">
                                            <i className="bi bi-calendar3" />
                                            {new Date(order.created_at || order.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                                        </span>
                                    </div>
                                    <span className={`badge badge-${getStatusColor(order.status)}`}>
                                        <i className={`bi ${STATUS_ICONS[order.status]}`} />
                                        {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                                    </span>
                                </div>

                                {/* Items */}
                                <div className="order-card__items">
                                    {(order.order_items || order.items || []).map((item, index) => (
                                        <div key={item.id || index} className="order-item-row">
                                            <img src={item.image_url || item.image} alt={item.name} className="order-item-row__img" />
                                            <div className="order-item-row__info">
                                                <p className="order-item-row__name">{item.name}</p>
                                                <p className="order-item-row__qty">
                                                    <i className="bi bi-layers" /> Qty: {item.quantity} ×{' '}
                                                    {formatPrice(item.price)}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Footer */}
                                <div className="order-card__footer">
                                    <div className="order-card__total">
                                        <span><i className="bi bi-receipt" /> Total</span>
                                        <strong>{formatPrice(order.total)}</strong>
                                    </div>
                                    <div className="order-card__actions">
                                        <Link
                                            to={`/orders/${order.id}`}
                                            id={`view-details-${order.id}`}
                                            className="btn btn-secondary btn-sm"
                                        >
                                            <i className="bi bi-eye" /> View Details
                                        </Link>
                                        {['shipped', 'confirmed', 'processing'].includes(order.status) && (
                                            <Link
                                                to={`/track/${order.order_number || order.id}`}
                                                id={`track-${order.id}`}
                                                className="btn btn-primary btn-sm"
                                            >
                                                <i className="bi bi-geo-alt-fill" /> Track
                                            </Link>
                                        )}
                                        {order.status === 'delivered' && (
                                            <button id={`reorder-${order.id}`} className="btn btn-primary btn-sm">
                                                <i className="bi bi-arrow-clockwise" /> Reorder
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="pagination" id="orders-pagination">
                        <button
                            id="prev-page"
                            className="btn btn-secondary btn-sm"
                            disabled={page === 1}
                            onClick={() => setPage(p => p - 1)}
                        >
                            <i className="bi bi-chevron-left" /> Prev
                        </button>
                        {Array.from({ length: totalPages }, (_, i) => (
                            <button
                                key={i + 1}
                                id={`page-${i + 1}`}
                                className={`page-btn ${page === i + 1 ? 'active' : ''}`}
                                onClick={() => setPage(i + 1)}
                            >
                                {i + 1}
                            </button>
                        ))}
                        <button
                            id="next-page"
                            className="btn btn-secondary btn-sm"
                            disabled={page === totalPages}
                            onClick={() => setPage(p => p + 1)}
                        >
                            Next <i className="bi bi-chevron-right" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
