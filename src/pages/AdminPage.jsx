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
import { useCategories } from '../hooks/useProducts'
import { syncMockDataToNeon } from '../lib/syncService'
import { compressImageFile, formatFileSize, getDataUrlSize } from '../lib/imageUtils'
import './AdminPage.css'

export default function AdminPage() {
    const { user, profile } = useAuth()
    const { categories } = useCategories()
    const [tab, setTab] = useState('products')
    const [loading, setLoading] = useState(false)
    const [syncing, setSyncing] = useState(false)

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

    // Image Upload States
    const [uploadingSlot, setUploadingSlot] = useState(null)
    const [bulkProgress, setBulkProgress] = useState(null)
    const [showUrlInputs, setShowUrlInputs] = useState({})

    const handleSingleImageUpload = async (slotKey, e) => {
        const file = e.target.files?.[0]
        if (!file) return
        try {
            setUploadingSlot(slotKey)
            const compressed = await compressImageFile(file, 1200, 1200, 0.82)
            setProductForm(prev => ({ ...prev, [slotKey]: compressed }))
        } catch (err) {
            alert('Failed to process image: ' + err.message)
        } finally {
            setUploadingSlot(null)
            e.target.value = ''
        }
    }

    const handleBulkImageUpload = async (e) => {
        const files = Array.from(e.target.files || []).slice(0, 6)
        if (files.length === 0) return
        try {
            setUploadingSlot('bulk')
            const slotKeys = ['image_url', 'image2', 'image3', 'image4', 'image5', 'image6']
            const updated = { ...productForm }

            for (let i = 0; i < files.length && i < slotKeys.length; i++) {
                setBulkProgress(`Optimizing ${i + 1} of ${files.length} from gallery...`)
                const compressed = await compressImageFile(files[i], 1200, 1200, 0.82)
                updated[slotKeys[i]] = compressed
            }

            setProductForm(updated)
        } catch (err) {
            alert('Bulk upload error: ' + err.message)
        } finally {
            setUploadingSlot(null)
            setBulkProgress(null)
            e.target.value = ''
        }
    }

    const handleRemoveSlotImage = (slotKey) => {
        setProductForm(prev => ({ ...prev, [slotKey]: '' }))
    }

    const toggleUrlInput = (slotKey) => {
        setShowUrlInputs(prev => ({ ...prev, [slotKey]: !prev[slotKey] }))
    }

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

    const handleSyncMockData = async () => {
        if (!window.confirm('Sync and populate all products, orders, and tracking data from mockData.js into Neon PostgreSQL?')) return
        setSyncing(true)
        try {
            const res = await syncMockDataToNeon()
            if (res.success) {
                alert('Database synchronized successfully with all products, orders, and tracking milestones!')
                loadProducts()
                loadOrders()
            } else {
                alert('Sync failed: ' + res.error)
            }
        } catch (err) {
            alert('Sync error: ' + err.message)
        } finally {
            setSyncing(false)
        }
    }

    const handleAutoGenerateSku = () => {
        const cat = (productForm.category || 'GEN').substring(0, 3).toUpperCase();
        const rand = Math.floor(1000 + Math.random() * 9000);
        setProductForm(prev => ({ ...prev, sku: `SMN-${cat}-${rand}` }));
    };

    /* ── Product Functions ── */

    const openProductModal = (prod = null) => {
        setEditingProductId(prod ? prod.id : null)
        
        const detailsObj = prod?.details || {};
        const existingSpecs = (detailsObj.specifications && Object.keys(detailsObj.specifications).length > 0)
            ? detailsObj.specifications
            : (detailsObj.specs && Object.keys(detailsObj.specs).length > 0
                ? detailsObj.specs
                : (prod?.specs || {}));
        
        let existingExtraImages = [];
        if (Array.isArray(detailsObj.extraImages)) {
            existingExtraImages = detailsObj.extraImages;
        } else if (typeof detailsObj.extraImages === 'string') {
            const trimmed = detailsObj.extraImages.trim();
            if (trimmed.startsWith('[')) {
                try { existingExtraImages = JSON.parse(trimmed); } catch (e) { existingExtraImages = []; }
            } else if (trimmed.startsWith('data:image/')) {
                existingExtraImages = [trimmed];
            } else {
                existingExtraImages = trimmed.split(/[\n,]+/).map(u => u.trim()).filter(Boolean);
            }
        }

        const existingSku = prod?.sku || detailsObj.sku || (prod?.id ? `SMN-${(prod.category || 'GEN').substring(0, 3).toUpperCase()}-${String(prod.id).padStart(4, '0')}` : '');

        setProductForm(prod ? {
            ...prod,
            sku: existingSku,
            colors: prod.colors?.join(', ') || '',
            image_url: prod.image_url || prod.image || '',
            image2: existingExtraImages[0] || '',
            image3: existingExtraImages[1] || '',
            image4: existingExtraImages[2] || '',
            image5: existingExtraImages[3] || '',
            image6: existingExtraImages[4] || '',
            highlights: (detailsObj.highlights || prod?.highlights || []).join('\n'),
            specifications: Object.entries(existingSpecs).filter(([k]) => k.toUpperCase() !== 'SKU').map(([k,v]) => `${k}: ${v}`).join('\n'),
            whyChooseUs: (detailsObj.whyChooseUs || []).join('\n'),
            buy2Discount: detailsObj.discounts?.buy2 || 0,
            buy3Discount: detailsObj.discounts?.buy3 || 0,
            hasOffer: detailsObj.hasOffer !== false // default to true
        } : {
            name: '', sku: '', price: 0, original_price: 0, category: 'smartphones', brand: '',
            description: '', image_url: '', badge: '', in_stock: true,
            rating: 0, review_count: 0, colors: '', 
            image2: '', image3: '', image4: '', image5: '', image6: '',
            highlights: '', specifications: '', whyChooseUs: '', 
            buy2Discount: 0, buy3Discount: 0, hasOffer: true
        })
        setShowProductModal(true)
    }

    const handleProductSubmit = async (e) => {
        e.preventDefault()
        try {
            const { 
                image2, image3, image4, image5, image6,
                highlights, specifications, whyChooseUs, 
                buy2Discount, buy3Discount, hasOffer,
                ...restForm 
            } = productForm;
            
            // Parse specifications (Key: Value)
            const specsObj = {};
            if (specifications) {
                specifications.split('\n').forEach(line => {
                    const idx = line.indexOf(':');
                    if (idx > -1) {
                        const k = line.slice(0, idx).trim();
                        const v = line.slice(idx + 1).trim();
                        if (k) specsObj[k] = v;
                    }
                });
            }

            // Determine final SKU
            const finalSku = (restForm.sku && restForm.sku.trim()) || `SMN-${(restForm.category || 'GEN').substring(0, 3).toUpperCase()}-${Date.now().toString().slice(-4)}`;

            // Collect all extra gallery images (Slots 2-6)
            const extraList = [image2, image3, image4, image5, image6]
                .map(u => typeof u === 'string' ? u.trim() : '')
                .filter(u => Boolean(u) && u !== restForm.image_url);

            const parsedDetails = {
                sku: finalSku,
                extraImages: extraList,
                highlights: highlights ? highlights.split('\n').map(u => u.trim()).filter(Boolean) : [],
                specifications: { SKU: finalSku, ...specsObj },
                specs: { SKU: finalSku, ...specsObj },
                whyChooseUs: whyChooseUs ? whyChooseUs.split('\n').map(u => u.trim()).filter(Boolean) : [],
                hasOffer: hasOffer !== false, // explicitly save boolean
                discounts: {
                    buy2: Number(buy2Discount) || 0,
                    buy3: Number(buy3Discount) || 0
                }
            };

            const formattedForm = {
                ...restForm,
                sku: finalSku,
                colors: restForm.colors ? restForm.colors.split(',').map(c => c.trim()).filter(Boolean) : [],
                details: parsedDetails,
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
            <header className="admin-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                    <h1><i className="bi bi-shield-lock" /> Smiley N Traders Admin Panel</h1>
                    <p>Manage products, orders, and real-time shipment updates.</p>
                </div>
                <button 
                    className="btn btn-outline-primary"
                    onClick={handleSyncMockData}
                    disabled={syncing}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 18px', borderRadius: '10px', fontWeight: '700', fontSize: '0.9rem' }}
                >
                    <i className={`bi ${syncing ? 'bi-arrow-repeat bi-spin' : 'bi-database-fill-gear'}`} />
                    {syncing ? 'Syncing to Neon DB...' : 'Sync Mock Data to Database'}
                </button>
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
                                                    <td>
                                                        <strong>{p.name}</strong>
                                                        {p.sku && (
                                                            <div style={{ fontSize: '0.75rem', color: '#6B7280', fontFamily: 'monospace', marginTop: '2px' }}>
                                                                SKU: {p.sku}
                                                            </div>
                                                        )}
                                                    </td>
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
                                            {orders.map(o => {
                                                const shipping = o.shipping_address || {};
                                                const customerName = shipping.firstName ? `${shipping.firstName} ${shipping.lastName}` : 'Guest';
                                                return (
                                                    <tr key={o.id}>
                                                        <td><strong>{o.order_number}</strong></td>
                                                        <td>{customerName}</td>
                                                        <td>₹{o.total}</td>
                                                        <td><span className={`badge badge-${o.status === 'delivered' ? 'success' : o.status === 'processing' ? 'warning' : o.status === 'shipped' ? 'info' : 'primary'}`}>{o.status}</span></td>
                                                        <td>{new Date(o.created_at).toLocaleDateString()}</td>
                                                        <td>
                                                            <button className="btn btn-sm btn-primary" onClick={() => openOrderModal(o.id)}>
                                                                <i className="bi bi-gear" /> Manage Order
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
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
                            <div className="form-row mb-3" style={{ display: 'flex', gap: 15, alignItems: 'flex-start' }}>
                                <div className="form-group" style={{ flex: 1.2 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                        <label style={{ margin: 0, fontWeight: '600', fontSize: '0.9rem' }}>SKU (Stock Keeping Unit)</label>
                                        <button
                                            type="button"
                                            onClick={handleAutoGenerateSku}
                                            style={{ background: 'none', border: 'none', color: 'var(--cta-dark)', fontSize: '0.72rem', fontWeight: '700', cursor: 'pointer', padding: 0 }}
                                            title="Generate SKU based on category"
                                        >
                                            <i className="bi bi-magic" /> Auto-Gen
                                        </button>
                                    </div>
                                    <input 
                                        type="text" 
                                        className="form-control" 
                                        placeholder="e.g. SMN-WAT-0001" 
                                        name="sku" 
                                        value={productForm.sku || ''} 
                                        onChange={e => setProductForm({ ...productForm, sku: e.target.value })}
                                        style={{ fontFamily: 'monospace', fontWeight: '700', letterSpacing: '0.5px' }} 
                                    />
                                </div>
                                <div className="form-group" style={{ flex: 1 }}>
                                    <label style={{ marginBottom: '6px' }}>Category</label>
                                    <input type="text" list="admin-categories" className="form-control" value={productForm.category || ''} onChange={e => setProductForm({ ...productForm, category: e.target.value })} placeholder="Select or type new..." />
                                    <datalist id="admin-categories">
                                        {categories.map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </datalist>
                                </div>
                                <div className="form-group" style={{ flex: 1 }}>
                                    <label style={{ marginBottom: '6px' }}>Brand</label>
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
                            {/* ── Product Gallery (Direct Gallery Upload — Stored in Neon DB) ── */}
                            <div style={{ backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '16px', padding: '20px', marginBottom: '24px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
                                    <div>
                                        <label style={{ margin: 0, fontWeight: '800', color: '#111827', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <i className="bi bi-images" style={{ color: 'var(--cta)', fontSize: '1.2rem' }} />
                                            Product Gallery (Direct Gallery Upload)
                                        </label>
                                        <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: '#6B7280' }}>
                                            Upload photos directly from your device gallery. Auto-optimized & stored in Neon DB.
                                        </p>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                        <span style={{ fontSize: '0.8rem', fontWeight: '700', backgroundColor: '#EFF6FF', color: '#1D4ED8', padding: '4px 12px', borderRadius: '20px' }}>
                                            {[productForm.image_url, productForm.image2, productForm.image3, productForm.image4, productForm.image5, productForm.image6].filter(Boolean).length} / 6 Images
                                        </span>
                                        {/* Bulk Upload Button */}
                                        <input 
                                            type="file" 
                                            id="admin-bulk-file-input" 
                                            accept="image/*" 
                                            multiple 
                                            style={{ display: 'none' }} 
                                            onChange={handleBulkImageUpload} 
                                        />
                                        <button
                                            type="button"
                                            className="btn btn-primary"
                                            onClick={() => document.getElementById('admin-bulk-file-input').click()}
                                            disabled={uploadingSlot === 'bulk'}
                                            style={{
                                                padding: '6px 14px',
                                                fontSize: '0.825rem',
                                                fontWeight: '700',
                                                borderRadius: '8px',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '6px'
                                            }}
                                        >
                                            <i className={`bi ${uploadingSlot === 'bulk' ? 'bi-arrow-repeat bi-spin' : 'bi-cloud-upload-fill'}`} />
                                            {uploadingSlot === 'bulk' ? (bulkProgress || 'Uploading...') : 'Bulk Upload from Gallery'}
                                        </button>
                                    </div>
                                </div>

                                {/* Slots Grid: Slot 1 is Primary Cover, Slots 2-6 are Extra Angles */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '14px' }}>
                                    {[
                                        { num: 1, key: 'image_url', label: '1. Primary Cover', required: true, isCover: true },
                                        { num: 2, key: 'image2', label: '2. Angle / Detail 2' },
                                        { num: 3, key: 'image3', label: '3. Angle / Detail 3' },
                                        { num: 4, key: 'image4', label: '4. Angle / Detail 4' },
                                        { num: 5, key: 'image5', label: '5. Angle / Detail 5' },
                                        { num: 6, key: 'image6', label: '6. Angle / Detail 6' },
                                    ].map(slot => {
                                        const val = productForm[slot.key];
                                        const hasVal = Boolean(val && String(val).trim());
                                        const isDataUrl = hasVal && String(val).startsWith('data:image/');
                                        const isUploading = uploadingSlot === slot.key;

                                        return (
                                            <div 
                                                key={slot.key} 
                                                style={{
                                                    backgroundColor: '#FFFFFF',
                                                    border: slot.isCover ? '2px solid var(--cta)' : '1px solid #E5E7EB',
                                                    borderRadius: '12px',
                                                    padding: '12px',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    gap: '8px',
                                                    position: 'relative'
                                                }}
                                            >
                                                {/* Slot Header */}
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <span style={{ fontSize: '0.8rem', fontWeight: '700', color: slot.isCover ? 'var(--cta-dark)' : '#374151' }}>
                                                        {slot.label} {slot.required && <span style={{ color: '#DC2626' }}>*</span>}
                                                    </span>
                                                    {slot.isCover && (
                                                        <span style={{ fontSize: '0.65rem', fontWeight: '800', backgroundColor: 'var(--cta)', color: '#FFF', padding: '1px 6px', borderRadius: '6px', textTransform: 'uppercase' }}>
                                                            Cover
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Hidden Native File Input */}
                                                <input 
                                                    type="file" 
                                                    id={`file-input-${slot.key}`} 
                                                    accept="image/*" 
                                                    style={{ display: 'none' }} 
                                                    onChange={e => handleSingleImageUpload(slot.key, e)} 
                                                />

                                                {/* If Image Exists */}
                                                {hasVal ? (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                        <div style={{
                                                            width: '100%',
                                                            height: '120px',
                                                            borderRadius: '8px',
                                                            overflow: 'hidden',
                                                            border: '1px solid #E5E7EB',
                                                            backgroundColor: '#F9FAFB',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            position: 'relative'
                                                        }}>
                                                            <img 
                                                                src={val} 
                                                                alt={slot.label} 
                                                                style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
                                                                onError={e => e.currentTarget.style.display = 'none'}
                                                            />
                                                            {isDataUrl && (
                                                                <span style={{
                                                                    position: 'absolute',
                                                                    bottom: '4px',
                                                                    right: '4px',
                                                                    backgroundColor: 'rgba(0,0,0,0.65)',
                                                                    color: '#FFF',
                                                                    fontSize: '0.65rem',
                                                                    padding: '1px 5px',
                                                                    borderRadius: '4px'
                                                                }}>
                                                                    {formatFileSize(getDataUrlSize(val))}
                                                                </span>
                                                            )}
                                                        </div>

                                                        {/* Action Buttons */}
                                                        <div style={{ display: 'flex', gap: '6px' }}>
                                                            <button
                                                                type="button"
                                                                onClick={() => document.getElementById(`file-input-${slot.key}`).click()}
                                                                className="btn btn-outline-primary"
                                                                style={{ flex: 1, padding: '4px 8px', fontSize: '0.75rem', borderRadius: '6px', justifyContent: 'center' }}
                                                                title="Choose another image from your gallery"
                                                            >
                                                                <i className="bi bi-camera" /> Change
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRemoveSlotImage(slot.key)}
                                                                style={{
                                                                    padding: '4px 10px',
                                                                    fontSize: '0.75rem',
                                                                    borderRadius: '6px',
                                                                    backgroundColor: '#FEE2E2',
                                                                    color: '#DC2626',
                                                                    border: '1px solid #FCA5A5',
                                                                    cursor: 'pointer'
                                                                }}
                                                                title="Remove this image"
                                                            >
                                                                <i className="bi bi-trash" />
                                                            </button>
                                                        </div>

                                                        {/* Small URL Toggle */}
                                                        <div style={{ marginTop: '2px' }}>
                                                            <button
                                                                type="button"
                                                                onClick={() => toggleUrlInput(slot.key)}
                                                                style={{ background: 'none', border: 'none', padding: 0, fontSize: '0.7rem', color: '#6B7280', textDecoration: 'underline', cursor: 'pointer' }}
                                                            >
                                                                {showUrlInputs[slot.key] ? 'Hide URL details' : 'View/Edit URL'}
                                                            </button>
                                                            {showUrlInputs[slot.key] && (
                                                                <input 
                                                                    type="text" 
                                                                    className="form-control" 
                                                                    style={{ fontSize: '0.75rem', marginTop: '4px', padding: '4px 8px' }} 
                                                                    value={val} 
                                                                    onChange={e => setProductForm({ ...productForm, [slot.key]: e.target.value })} 
                                                                />
                                                            )}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    /* Empty Slot: Upload from Gallery Drop Area */
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                        <div 
                                                            onClick={() => document.getElementById(`file-input-${slot.key}`).click()}
                                                            style={{
                                                                border: '2px dashed #D1D5DB',
                                                                borderRadius: '8px',
                                                                padding: '16px 8px',
                                                                textAlign: 'center',
                                                                cursor: 'pointer',
                                                                backgroundColor: '#FAFAFA',
                                                                minHeight: '120px',
                                                                display: 'flex',
                                                                flexDirection: 'column',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                gap: '6px',
                                                                transition: 'all 0.2s'
                                                            }}
                                                            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--cta)'}
                                                            onMouseLeave={e => e.currentTarget.style.borderColor = '#D1D5DB'}
                                                        >
                                                            {isUploading ? (
                                                                <>
                                                                    <div className="spinner-border spinner-border-sm text-primary" role="status" />
                                                                    <span style={{ fontSize: '0.75rem', color: 'var(--cta)', fontWeight: '600' }}>Compressing...</span>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <i className="bi bi-image" style={{ fontSize: '1.6rem', color: 'var(--cta)' }} />
                                                                    <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#374151' }}>
                                                                        Upload from Gallery
                                                                    </span>
                                                                    <span style={{ fontSize: '0.68rem', color: '#9CA3AF' }}>
                                                                        Click to pick photo
                                                                    </span>
                                                                </>
                                                            )}
                                                        </div>

                                                        {/* Or paste URL toggle */}
                                                        <div style={{ textAlign: 'center' }}>
                                                            <button
                                                                type="button"
                                                                onClick={() => toggleUrlInput(slot.key)}
                                                                style={{ background: 'none', border: 'none', padding: 0, fontSize: '0.72rem', color: 'var(--cta-dark)', cursor: 'pointer', textDecoration: 'underline' }}
                                                            >
                                                                {showUrlInputs[slot.key] ? 'Close URL box' : 'Or paste URL'}
                                                            </button>
                                                            {showUrlInputs[slot.key] && (
                                                                <input 
                                                                    type="url" 
                                                                    className="form-control" 
                                                                    placeholder="https://..." 
                                                                    style={{ fontSize: '0.75rem', marginTop: '6px', padding: '4px 8px' }} 
                                                                    value={productForm[slot.key] || ''} 
                                                                    onChange={e => setProductForm({ ...productForm, [slot.key]: e.target.value })} 
                                                                />
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="form-group mb-3">
                                <label>Description (HTML allowed)</label>
                                <textarea className="form-control" rows="5" placeholder="Detailed product description..." value={productForm.description || ''} onChange={e => setProductForm({ ...productForm, description: e.target.value })} />
                            </div>
                            
                            <h5 style={{marginBottom: 15, display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                                Dynamic Content
                                <div className="form-check form-switch" style={{ fontSize: '1rem', fontWeight: 'normal' }}>
                                    <input 
                                        className="form-check-input" 
                                        type="checkbox" 
                                        id="hasOfferToggle" 
                                        checked={productForm.hasOffer !== false} 
                                        onChange={e => setProductForm({ ...productForm, hasOffer: e.target.checked })} 
                                    />
                                    <label className="form-check-label" htmlFor="hasOfferToggle">Enable Offer (Timer & Bundles)</label>
                                </div>
                            </h5>


                            <div className="form-row mb-3" style={{ display: 'flex', gap: 15 }}>
                                <div className="form-group" style={{ flex: 1 }}>
                                    <label>Key Features (1 per line)</label>
                                    <textarea className="form-control" rows="4" placeholder="Eco-friendly & Energy Efficient..." value={productForm.highlights || ''} onChange={e => setProductForm({ ...productForm, highlights: e.target.value })} />
                                </div>
                                <div className="form-group" style={{ flex: 1 }}>
                                    <label>Why Choose Us (1 per line)</label>
                                    <textarea className="form-control" rows="4" placeholder="100% Satisfaction Guarantee..." value={productForm.whyChooseUs || ''} onChange={e => setProductForm({ ...productForm, whyChooseUs: e.target.value })} />
                                </div>
                            </div>

                            <div className="form-group mb-3">
                                <label>Specifications (Key: Value per line)</label>
                                <textarea className="form-control" rows="4" placeholder="Water Tank Capacity: 1000ml&#10;Weight: 800g" style={{ fontFamily: 'monospace' }} value={productForm.specifications || ''} onChange={e => setProductForm({ ...productForm, specifications: e.target.value })} />
                            </div>

                            <div className="form-row mb-3" style={{ display: 'flex', gap: 15, backgroundColor: '#f8fafc', padding: '15px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                                    <label style={{ color: 'var(--cta)' }}><strong>Buy 2 Discount (%)</strong></label>
                                    <input type="number" className="form-control" placeholder="e.g. 10" value={productForm.buy2Discount || ''} onChange={e => setProductForm({ ...productForm, buy2Discount: Number(e.target.value) })} />
                                </div>
                                <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                                    <label style={{ color: 'var(--cta)' }}><strong>Buy 3 Discount (%)</strong></label>
                                    <input type="number" className="form-control" placeholder="e.g. 15" value={productForm.buy3Discount || ''} onChange={e => setProductForm({ ...productForm, buy3Discount: Number(e.target.value) })} />
                                </div>
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
                                            <p style={{ margin: '0 0 5px 0' }}><strong>Customer:</strong> {selectedOrder.shipping_address?.firstName} {selectedOrder.shipping_address?.lastName} ({selectedOrder.shipping_address?.phone || 'No Phone'})</p>
                                            <p style={{ margin: '0 0 5px 0' }}><strong>Payment:</strong> {selectedOrder.payment_method?.toUpperCase()}
                                                <span className={`badge badge-${selectedOrder.payment_status === 'paid' ? 'success' : 'warning'}`} style={{ marginLeft: 6 }}>
                                                    {selectedOrder.payment_status}
                                                </span>
                                            </p>
                                            <p style={{ margin: '0 0 5px 0' }}><strong>UTR/Transaction ID:</strong> <code>{selectedOrder.payment_id || selectedOrder.razorpay_id || 'N/A'}</code></p>
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
                                                <p style={{ margin: 0, fontWeight: 600 }}>
                                                    {item.name} 
                                                    {item.color ? <span style={{ color: '#666', fontWeight: 400, marginLeft: 6 }}>({item.color})</span> : null}
                                                </p>
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
