import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
    adminGetProducts,
    adminCreateProduct,
    adminUpdateProduct,
    adminDeleteProduct,
    adminGetOrders,
    adminGetOrderDetails,
    adminUpdateOrderStatus,
    adminAddTrackingStep
} from '../lib/adminService'
import { useAuth } from '../context/AuthContext'
import './AdminPage.css'

export default function AdminPage() {
    const { user, profile } = useAuth()
    const [tab, setTab] = useState('products')
    const [loading, setLoading] = useState(false)

    // Data states
    const [products, setProducts] = useState([])
    const [orders, setOrders] = useState([])

    // Modals
    const [showProductModal, setShowProductModal] = useState(false)
    const [showOrderModal, setShowOrderModal] = useState(false)

    // Forms
    const [productForm, setProductForm] = useState({})
    const [editingProductId, setEditingProductId] = useState(null)
    const [selectedOrder, setSelectedOrder] = useState(null)
    const [trackingForm, setTrackingForm] = useState({ label: '', description: '', status: 'processing', is_current: true })

    useEffect(() => {
        if (!user) return
        if (tab === 'products') loadProducts()
        if (tab === 'orders') loadOrders()
    }, [tab, user])

    const loadProducts = async () => {
        setLoading(true)
        try {
            const data = await adminGetProducts()
            setProducts(data || [])
        } catch (err) { alert(err.message) }
        setLoading(false)
    }

    const loadOrders = async () => {
        setLoading(true)
        try {
            const data = await adminGetOrders()
            setOrders(data || [])
        } catch (err) { alert(err.message) }
        setLoading(false)
    }

    /* ── Product Functions ── */

    const openProductModal = (prod = null) => {
        setEditingProductId(prod ? prod.id : null)
        setProductForm(prod ? {
            ...prod,
            colors: prod.colors?.join(', ') || '',
            details: prod.details ? JSON.stringify(prod.details, null, 2) : '{}'
        } : {
            name: '', price: 0, original_price: 0, category: 'smartphones', brand: '',
            description: '', image_url: '', badge: '', in_stock: true,
            rating: 0, review_count: 0, colors: '', details: '{}'
        })
        setShowProductModal(true)
    }

    const handleProductSubmit = async (e) => {
        e.preventDefault()
        try {
            let parsedDetails = {};
            try {
                parsedDetails = JSON.parse(productForm.details || '{}');
            } catch (e) {
                alert("Invalid JSON format in Details field");
                return;
            }

            // format colors from comma separated
            const formattedForm = {
                ...productForm,
                colors: productForm.colors ? productForm.colors.split(',').map(c => c.trim()).filter(Boolean) : [],
                details: parsedDetails
            };

            if (editingProductId) {
                await adminUpdateProduct(editingProductId, formattedForm)
            } else {
                await adminCreateProduct(formattedForm)
            }
            setShowProductModal(false)
            loadProducts()
        } catch (err) {
            alert('Failed to save product: ' + err.message)
        }
    }

    const handleDeleteProduct = async (id) => {
        if (!window.confirm('Are you sure you want to delete this product?')) return
        try {
            await adminDeleteProduct(id)
            loadProducts()
        } catch (err) {
            alert('Failed to delete product: ' + err.message)
        }
    }

    /* ── Order Functions ── */

    const openOrderModal = async (id) => {
        try {
            const data = await adminGetOrderDetails(id)
            setSelectedOrder(data)
            setShowOrderModal(true)
        } catch (err) {
            alert(err.message)
        }
    }

    const handleUpdateOrderStatus = async (e) => {
        const status = e.target.value
        try {
            await adminUpdateOrderStatus(selectedOrder.id, status)
            setSelectedOrder({ ...selectedOrder, status })
            loadOrders() // refresh list in background
        } catch (err) { alert(err.message) }
    }

    const handleTrackingSubmit = async (e) => {
        e.preventDefault()
        try {
            await adminAddTrackingStep({
                order_id: selectedOrder.id,
                ...trackingForm
            })
            // Refresh order
            const refreshed = await adminGetOrderDetails(selectedOrder.id)
            setSelectedOrder(refreshed)
            setTrackingForm({ label: '', description: '', status: 'processing', is_current: true })
        } catch (err) {
            alert('Failed to add tracking: ' + err.message)
        }
    }

    if (!user) return <div className="admin-container"><p>Access Denied. Please Sign In.</p></div>

    return (
        <div className="admin-container page-enter">
            <header className="admin-header">
                <div>
                    <h1><i className="bi bi-shield-lock" /> ElectroCart Admin Panel</h1>
                    <p>Manage products, orders, and real-time shipment updates.</p>
                </div>
            </header>

            <div className="admin-tabs">
                <button className={`admin-tab ${tab === 'products' ? 'active' : ''}`} onClick={() => setTab('products')}>
                    <i className="bi bi-box" /> Products
                </button>
                <button className={`admin-tab ${tab === 'orders' ? 'active' : ''}`} onClick={() => setTab('orders')}>
                    <i className="bi bi-receipt" /> Orders
                </button>
            </div>

            <div className="admin-content">
                {loading ? <div className="spinner-border" /> : (
                    <>
                        {/* ── PRODUCTS TAB ── */}
                        {tab === 'products' && (
                            <div className="admin-panel">
                                <div className="admin-panel__header">
                                    <h2>Product Database</h2>
                                    <button className="btn btn-primary btn-sm" onClick={() => openProductModal(null)}>
                                        <i className="bi bi-plus" /> Add Product
                                    </button>
                                </div>
                                <div className="table-responsive">
                                    <table className="admin-table">
                                        <thead>
                                            <tr>
                                                <th>ID</th>
                                                <th>Image</th>
                                                <th>Name</th>
                                                <th>Price</th>
                                                <th>Category</th>
                                                <th>Stock</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {products.map(p => (
                                                <tr key={p.id}>
                                                    <td>{p.id}</td>
                                                    <td><img src={p.image_url} alt="" width="40" height="40" style={{ objectFit: 'contain' }} /></td>
                                                    <td><strong>{p.name}</strong></td>
                                                    <td>₹{p.price}</td>
                                                    <td><span className="badge badge-secondary">{p.category}</span></td>
                                                    <td>{p.in_stock ? <span className="text-success">In Stock</span> : <span className="text-danger">Out</span>}</td>
                                                    <td>
                                                        <button className="btn btn-sm btn-outline-primary" onClick={() => openProductModal(p)} style={{ marginRight: 8 }}>
                                                            <i className="bi bi-pencil" /> Edit
                                                        </button>
                                                        <button className="btn btn-sm btn-outline-danger" onClick={() => handleDeleteProduct(p.id)}>
                                                            <i className="bi bi-trash" /> Delete
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* ── ORDERS TAB ── */}
                        {tab === 'orders' && (
                            <div className="admin-panel">
                                <div className="admin-panel__header">
                                    <h2>Customer Orders</h2>
                                </div>
                                <div className="table-responsive">
                                    <table className="admin-table">
                                        <thead>
                                            <tr>
                                                <th>Order Number</th>
                                                <th>Customer</th>
                                                <th>Total</th>
                                                <th>Status</th>
                                                <th>Date</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {orders.map(o => (
                                                <tr key={o.id}>
                                                    <td><strong>{o.order_number}</strong></td>
                                                    <td>{o.profiles?.full_name || 'Guest'}</td>
                                                    <td>₹{o.total}</td>
                                                    <td><span className={`badge badge-${o.status === 'delivered' ? 'success' : o.status === 'processing' ? 'warning' : o.status === 'shipped' ? 'info' : 'primary'}`}>{o.status}</span></td>
                                                    <td>{new Date(o.created_at).toLocaleDateString()}</td>
                                                    <td>
                                                        <button className="btn btn-sm btn-primary" onClick={() => openOrderModal(o.id)}>
                                                            <i className="bi bi-gear" /> Manage Order
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* ── PRODUCT MODAL ── */}
            {showProductModal && (
                <div className="admin-modal-overlay" onClick={(e) => { if (e.target.className === 'admin-modal-overlay') setShowProductModal(false) }}>
                    <div className="admin-modal">
                        <div className="admin-modal__head">
                            <h3>{editingProductId ? 'Edit Product' : 'Add New Product'}</h3>
                            <button className="close-btn" onClick={() => setShowProductModal(false)}><i className="bi bi-x-lg" /></button>
                        </div>
                        <form className="admin-modal__body" onSubmit={handleProductSubmit}>
                            <div className="form-group mb-3">
                                <label>Product Name</label>
                                <input type="text" className="form-control" name="name" value={productForm.name || ''} onChange={e => setProductForm({ ...productForm, name: e.target.value })} required />
                            </div>
                            <div className="form-row mb-3" style={{ display: 'flex', gap: 15 }}>
                                <div className="form-group" style={{ flex: 1 }}>
                                    <label>Price (₹)</label>
                                    <input type="number" className="form-control" name="price" value={productForm.price || ''} onChange={e => setProductForm({ ...productForm, price: Number(e.target.value) })} required />
                                </div>
                                <div className="form-group" style={{ flex: 1 }}>
                                    <label>Original Price (₹)</label>
                                    <input type="number" className="form-control" name="original_price" value={productForm.original_price || ''} onChange={e => setProductForm({ ...productForm, original_price: Number(e.target.value) })} />
                                </div>
                            </div>
                            <div className="form-row mb-3" style={{ display: 'flex', gap: 15 }}>
                                <div className="form-group" style={{ flex: 1 }}>
                                    <label>Category</label>
                                    <select className="form-control" value={productForm.category || ''} onChange={e => setProductForm({ ...productForm, category: e.target.value })}>
                                        <option value="smartphones">Smartphones</option>
                                        <option value="laptops">Laptops</option>
                                        <option value="wearables">Wearables</option>
                                        <option value="audio">Audio</option>
                                    </select>
                                </div>
                                <div className="form-group" style={{ flex: 1 }}>
                                    <label>Brand</label>
                                    <input type="text" className="form-control" name="brand" value={productForm.brand || ''} onChange={e => setProductForm({ ...productForm, brand: e.target.value })} />
                                </div>
                            </div>
                            <div className="form-row mb-3" style={{ display: 'flex', gap: 15 }}>
                                <div className="form-group" style={{ flex: 1 }}>
                                    <label>Badge</label>
                                    <input type="text" className="form-control" placeholder="e.g. Best Seller" name="badge" value={productForm.badge || ''} onChange={e => setProductForm({ ...productForm, badge: e.target.value })} />
                                </div>
                                <div className="form-group" style={{ flex: 1 }}>
                                    <label>Colors (comma separated)</label>
                                    <input type="text" className="form-control" placeholder="Black, White, Blue" name="colors" value={productForm.colors || ''} onChange={e => setProductForm({ ...productForm, colors: e.target.value })} />
                                </div>
                            </div>
                            <div className="form-row mb-3" style={{ display: 'flex', gap: 15 }}>
                                <div className="form-group" style={{ flex: 1 }}>
                                    <label>Rating (0-5)</label>
                                    <input type="number" step="0.1" className="form-control" name="rating" value={productForm.rating || ''} onChange={e => setProductForm({ ...productForm, rating: Number(e.target.value) })} />
                                </div>
                                <div className="form-group" style={{ flex: 1 }}>
                                    <label>Review Count</label>
                                    <input type="number" className="form-control" name="review_count" value={productForm.review_count || ''} onChange={e => setProductForm({ ...productForm, review_count: Number(e.target.value) })} />
                                </div>
                            </div>
                            <div className="form-group mb-3">
                                <label>Image URL</label>
                                <input type="url" className="form-control" name="image_url" value={productForm.image_url || ''} onChange={e => setProductForm({ ...productForm, image_url: e.target.value })} required />
                            </div>
                            <div className="form-group mb-3">
                                <label>Description</label>
                                <textarea className="form-control" rows="3" value={productForm.description || ''} onChange={e => setProductForm({ ...productForm, description: e.target.value })} />
                            </div>
                            <div className="form-group mb-3">
                                <label>Advanced Details (JSON) — e.g. {`{"highlights": ["item 1"]}`}</label>
                                <textarea className="form-control" rows="5" style={{ fontFamily: 'monospace' }} value={productForm.details || ''} onChange={e => setProductForm({ ...productForm, details: e.target.value })} />
                            </div>
                            <div className="form-check" style={{ marginBottom: 20 }}>
                                <input type="checkbox" id="stockCheck" className="form-check-input" checked={productForm.in_stock || false} onChange={e => setProductForm({ ...productForm, in_stock: e.target.checked })} />
                                <label htmlFor="stockCheck" className="form-check-label">In Stock</label>
                            </div>
                            <button type="submit" className="btn btn-primary btn-full">Save Product</button>
                        </form>
                    </div>
                </div>
            )}

            {/* ── ORDER MANAGE MODAL ── */}
            {showOrderModal && selectedOrder && (
                <div className="admin-modal-overlay" onClick={(e) => { if (e.target.className === 'admin-modal-overlay') setShowOrderModal(false) }}>
                    <div className="admin-modal" style={{ maxWidth: 800 }}>
                        <div className="admin-modal__head">
                            <h3>Manage Order: {selectedOrder.order_number}</h3>
                            <button className="close-btn" onClick={() => setShowOrderModal(false)}><i className="bi bi-x-lg" /></button>
                        </div>
                        <div className="admin-modal__body" style={{ display: 'flex', gap: '30px', alignItems: 'flex-start' }}>
                            {/* Left: General info */}
                            <div style={{ flex: 1.5 }}>
                                <div style={{ marginBottom: 20, backgroundColor: '#f8fafc', padding: 15, borderRadius: 8, fontSize: '0.9rem' }}>
                                    <h5 style={{ marginTop: 0, marginBottom: 15, borderBottom: '1px solid #ddd', paddingBottom: 5 }}>Order Overview</h5>

                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 15 }}>
                                        <div>
                                            <p style={{ margin: '0 0 5px 0' }}><strong>Customer:</strong> {selectedOrder.profiles?.full_name || 'Guest'} {selectedOrder.profiles?.phone ? `(${selectedOrder.profiles.phone})` : ''}</p>
                                            <p style={{ margin: '0 0 5px 0' }}><strong>Payment:</strong> {selectedOrder.payment_method?.toUpperCase()}
                                                <span className={`badge badge-${selectedOrder.payment_status === 'paid' ? 'success' : 'warning'}`} style={{ marginLeft: 6 }}>
                                                    {selectedOrder.payment_status}
                                                </span>
                                            </p>
                                            <p style={{ margin: '0 0 5px 0' }}><strong>Razorpay ID:</strong> <code>{selectedOrder.razorpay_id || 'N/A'}</code></p>
                                            <p style={{ margin: 0 }}><strong>Date:</strong> {new Date(selectedOrder.created_at).toLocaleString()}</p>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <p style={{ margin: '0 0 5px 0' }}>Subtotal: ₹{selectedOrder.subtotal}</p>
                                            {selectedOrder.discount > 0 && <p style={{ margin: '0 0 5px 0', color: 'green' }}>Discount: -₹{selectedOrder.discount}</p>}
                                            <p style={{ margin: '0 0 5px 0' }}>Delivery: {selectedOrder.delivery_fee ? `₹${selectedOrder.delivery_fee}` : 'Free'}</p>
                                            <p style={{ margin: 0, fontWeight: 'bold', fontSize: '1.1rem' }}>Total: ₹{selectedOrder.total}</p>
                                        </div>
                                    </div>

                                    {/* Handle relation vs jsonb shipping details based on what exists */}
                                    {(selectedOrder.addresses || selectedOrder.shipping_details) && (() => {
                                        const addr = selectedOrder.addresses || selectedOrder.shipping_details;
                                        return (
                                            <div style={{ backgroundColor: '#fff', padding: 10, borderRadius: 6, border: '1px solid #eee' }}>
                                                <strong><i className="bi bi-geo-alt" /> Shipping To:</strong><br />
                                                {addr.full_name || addr.name}, {addr.phone}<br />
                                                {addr.line1 || addr.address}, {addr.city}, {addr.state} {addr.pincode}
                                            </div>
                                        )
                                    })()}
                                </div>

                                <h5><i className="bi bi-bag" /> Order Items</h5>
                                <div style={{ maxHeight: 180, overflowY: 'auto', marginBottom: 25, border: '1px solid #eee', borderRadius: 8, padding: 10 }}>
                                    {(selectedOrder.order_items || []).map(item => (
                                        <div key={item.id} style={{ display: 'flex', gap: 15, padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
                                            <img src={item.image_url} alt={item.name} width={50} height={50} style={{ objectFit: 'contain', borderRadius: 4, border: '1px solid #eee' }} />
                                            <div>
                                                <p style={{ margin: 0, fontWeight: 600 }}>{item.name} {item.color ? <span style={{ color: '#666', fontWeight: 400 }}>({item.color})</span> : ''}</p>
                                                <p style={{ margin: 0, fontSize: '0.85rem', color: '#666', marginTop: 4 }}>Qty: {item.quantity} × ₹{item.price}</p>
                                            </div>
                                        </div>
                                    ))}
                                    {(!selectedOrder.order_items || selectedOrder.order_items.length === 0) && <p style={{ color: '#999', margin: 0 }}>No items found.</p>}
                                </div>

                                <h5><i className="bi bi-arrow-repeat" /> Order Status</h5>
                                <select className="form-control" value={selectedOrder.status} onChange={handleUpdateOrderStatus} style={{ marginBottom: 20 }}>
                                    <option value="confirmed">Confirmed</option>
                                    <option value="processing">Processing</option>
                                    <option value="shipped">Shipped</option>
                                    <option value="out_for_delivery">Out for Delivery</option>
                                    <option value="delivered">Delivered</option>
                                    <option value="cancelled">Cancelled</option>
                                </select>

                                <h5 style={{ marginTop: 20 }}>Tracking History</h5>
                                <div className="admin-tracking-list">
                                    {(selectedOrder.order_tracking || []).map(t => (
                                        <div key={t.id} style={{ padding: '10px 0', borderBottom: '1px solid #eee' }}>
                                            <strong><i className="bi bi-clock" /> {new Date(t.timestamp).toLocaleString()}</strong>
                                            <p style={{ margin: '4px 0 0 0' }}>{t.label} <code>({t.status})</code> {t.is_current && <span className="badge badge-success">Active</span>}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Right: Add new milestone */}
                            <div style={{ flex: 1, backgroundColor: '#f9fafb', padding: '20px', borderRadius: '12px', border: '1px solid #eee' }}>
                                <h5><i className="bi bi-plus-circle" /> Broadcast New Update</h5>
                                <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: 20 }}>
                                    This broadcasts LIVE via WebSockets to the user's tracking page!
                                </p>
                                <form onSubmit={handleTrackingSubmit}>
                                    <div className="form-group mb-2">
                                        <label>Event Label (e.g. Scanned at Hub)</label>
                                        <input type="text" className="form-control" required value={trackingForm.label} onChange={e => setTrackingForm({ ...trackingForm, label: e.target.value })} />
                                    </div>
                                    <div className="form-group mb-2">
                                        <label>Description</label>
                                        <textarea className="form-control" rows="2" value={trackingForm.description} onChange={e => setTrackingForm({ ...trackingForm, description: e.target.value })} />
                                    </div>
                                    <div className="form-group mb-3">
                                        <label>Related System Status</label>
                                        <select className="form-control" value={trackingForm.status} onChange={e => setTrackingForm({ ...trackingForm, status: e.target.value })}>
                                            <option value="processing">Processing</option>
                                            <option value="shipped">Shipped</option>
                                            <option value="delivered">Delivered</option>
                                        </select>
                                    </div>
                                    <div className="form-check mb-3">
                                        <input type="checkbox" id="currentMilestone" className="form-check-input" checked={trackingForm.is_current} onChange={e => setTrackingForm({ ...trackingForm, is_current: e.target.checked })} />
                                        <label htmlFor="currentMilestone" className="form-check-label">Mark as Current Status</label>
                                    </div>
                                    <button type="submit" className="btn btn-primary btn-full">
                                        <i className="bi bi-broadcast" /> Push Update
                                    </button>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
