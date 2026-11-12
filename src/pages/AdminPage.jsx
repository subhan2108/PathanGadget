import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import {
    adminGetProducts,
    adminCreateProduct,
    adminUpdateProduct,
    adminDeleteProduct,
    adminRenameCategory,
    adminRenameSubcategory,
    adminBulkUpdateSubcategory,
    adminGetOrders,
    adminGetOrderDetails,
    adminUpdateOrderStatus,
    adminAddTrackingStep
} from '../lib/adminService'
const ADMIN_PASSWORD = (import.meta.env.VITE_ADMIN_PASSWORD || 'admin123').trim()
import { useCategories } from '../hooks/useProducts'
import { syncMockDataToNeon } from '../lib/syncService'
import { compressImageFile, formatFileSize, getDataUrlSize } from '../lib/imageUtils'
import { formatImageUrl } from '../lib/productsService'
import './AdminPage.css'

export default function AdminPage() {
    // Password-only protection state (stored in env via VITE_ADMIN_PASSWORD)
    const [isAuthenticated, setIsAuthenticated] = useState(() => {
        try {
            return sessionStorage.getItem('smn_admin_auth') === 'true'
        } catch {
            return false
        }
    })
    const [passwordInput, setPasswordInput] = useState('')
    const [passwordError, setPasswordError] = useState('')
    const [showPassword, setShowPassword] = useState(false)

    const handlePasswordSubmit = (e) => {
        if (e) e.preventDefault()
        if (!passwordInput) {
            setPasswordError('Please enter the admin password.')
            return
        }
        if (passwordInput.trim() === ADMIN_PASSWORD) {
            try {
                sessionStorage.setItem('smn_admin_auth', 'true')
            } catch {}
            setIsAuthenticated(true)
            setPasswordError('')
        } else {
            setPasswordError('Incorrect admin password. Please try again.')
        }
    }

    const handleLockAdmin = () => {
        try {
            sessionStorage.removeItem('smn_admin_auth')
        } catch {}
        setIsAuthenticated(false)
        setPasswordInput('')
        setPasswordError('')
    }
    const { categories } = useCategories()
    const [tab, setTab] = useState('products')
    const [loading, setLoading] = useState(false)
    const [syncing, setSyncing] = useState(false)

    // Data states
    const [products, setProducts] = useState([])
    const [orders, setOrders] = useState([])
    const [adminSearch, setAdminSearch] = useState('')

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

    const availableSubcategories = React.useMemo(() => {
        const catKey = (productForm?.category || '').toLowerCase().trim();
        const subs = new Set();
        products.forEach(p => {
            if (p.subcategory && (!catKey || (p.category && p.category.toLowerCase().trim() === catKey))) {
                subs.add(p.subcategory);
            }
        });
        if (subs.size === 0) {
            products.forEach(p => { if (p.subcategory) subs.add(p.subcategory); });
        }
        return Array.from(subs).sort();
    }, [products, productForm?.category]);

    const filteredAdminProducts = React.useMemo(() => {
        if (!adminSearch.trim()) return products;
        const term = adminSearch.toLowerCase().trim();
        return products.filter(p =>
            (p.name && p.name.toLowerCase().includes(term)) ||
            (p.category && p.category.toLowerCase().includes(term)) ||
            (p.subcategory && p.subcategory.toLowerCase().includes(term)) ||
            (p.sku && p.sku.toLowerCase().includes(term)) ||
            (p.brand && p.brand.toLowerCase().includes(term))
        );
    }, [products, adminSearch]);

    // Collections Section State
    const [selectedCollectionCategory, setSelectedCollectionCategory] = useState(null)
    const [selectedCollectionSubcategory, setSelectedCollectionSubcategory] = useState(null)
    const [collectionSearch, setCollectionSearch] = useState('')
    const [collectionProductSearch, setCollectionProductSearch] = useState('')
    const [openCategoryDropdown, setOpenCategoryDropdown] = useState({})
    const [quickCategorySelect, setQuickCategorySelect] = useState('')
    const [quickSubcategorySelect, setQuickSubcategorySelect] = useState('')

    const toggleCategoryDropdown = (catName) => {
        setOpenCategoryDropdown(prev => ({
            ...prev,
            [catName]: !prev[catName]
        }))
    }

    // Collections Tree: Organizes products into Categories -> Subcategories with product counts
    const collectionsTree = React.useMemo(() => {
        const catMap = {};
        products.forEach(p => {
            const cat = (p.category || 'Uncategorized').trim();
            const subcat = (p.subcategory || 'General').trim();
            if (!catMap[cat]) {
                catMap[cat] = {
                    category: cat,
                    count: 0,
                    subcategories: {},
                    sampleImage: p.image_url || null
                };
            }
            catMap[cat].count += 1;
            if (!catMap[cat].sampleImage && p.image_url) {
                catMap[cat].sampleImage = p.image_url;
            }
            if (!catMap[cat].subcategories[subcat]) {
                catMap[cat].subcategories[subcat] = 0;
            }
            catMap[cat].subcategories[subcat] += 1;
        });

        return Object.values(catMap).sort((a, b) => b.count - a.count).map(c => ({
            ...c,
            subcategoriesList: Object.entries(c.subcategories)
                .map(([name, count]) => ({ name, count }))
                .sort((a, b) => b.count - a.count)
        }));
    }, [products]);

    // Summary statistics for Collections header
    const collectionsStats = React.useMemo(() => {
        const totalCats = collectionsTree.length;
        let totalSubcats = 0;
        collectionsTree.forEach(c => {
            totalSubcats += c.subcategoriesList.length;
        });
        return { totalCats, totalSubcats, totalProducts: products.length };
    }, [collectionsTree, products.length]);

    // Filtered categories for the overview search
    const filteredCollectionsTree = React.useMemo(() => {
        if (!collectionSearch.trim()) return collectionsTree;
        const q = collectionSearch.toLowerCase().trim();
        return collectionsTree.filter(c => {
            if (c.category.toLowerCase().includes(q)) return true;
            return c.subcategoriesList.some(s => s.name.toLowerCase().includes(q));
        });
    }, [collectionsTree, collectionSearch]);

    // Products filtered by selected Category & Subcategory
    const collectionFilteredProducts = React.useMemo(() => {
        if (!selectedCollectionCategory && !selectedCollectionSubcategory) return [];
        return products.filter(p => {
            const pCat = (p.category || '').toLowerCase().trim();
            const pSub = (p.subcategory || '').toLowerCase().trim();
            const selCat = (selectedCollectionCategory || '').toLowerCase().trim();
            const selSub = (selectedCollectionSubcategory || '').toLowerCase().trim();

            if (selCat && pCat !== selCat) return false;
            if (selSub && selSub !== 'all' && pSub !== selSub) return false;

            if (!collectionProductSearch.trim()) return true;
            const q = collectionProductSearch.toLowerCase().trim();
            return (p.name && p.name.toLowerCase().includes(q)) ||
                   (p.sku && p.sku.toLowerCase().includes(q)) ||
                   (p.brand && p.brand.toLowerCase().includes(q));
        });
    }, [products, selectedCollectionCategory, selectedCollectionSubcategory, collectionProductSearch]);

    // Subcategories available for currently selected Category in product view
    const currentCategorySubcategories = React.useMemo(() => {
        if (!selectedCollectionCategory) return [];
        const found = collectionsTree.find(c => c.category.toLowerCase() === selectedCollectionCategory.toLowerCase());
        return found ? found.subcategoriesList : [];
    }, [collectionsTree, selectedCollectionCategory]);

    // All unique subcategories across entire product catalog for autocomplete
    const allUniqueSubcategories = React.useMemo(() => {
        const subs = new Set();
        products.forEach(p => {
            if (p.subcategory && p.subcategory.trim()) subs.add(p.subcategory.trim());
        });
        return Array.from(subs).sort();
    }, [products]);

    // Rename Category / Subcategory Modal State
    const [renameModal, setRenameModal] = useState({
        open: false,
        type: 'category', // 'category' or 'subcategory'
        category: '',     // parent category if type === 'subcategory'
        oldName: '',      // current name
        newName: '',      // target name
        count: 0          // affected products count
    });

    const handleRenameSubmit = async (e) => {
        if (e) e.preventDefault();
        const { type, category, oldName, newName } = renameModal;
        const trimmedNew = (newName || '').trim();
        if (!trimmedNew) {
            alert('Please enter a valid name.');
            return;
        }
        if (trimmedNew === oldName.trim()) {
            setRenameModal({ open: false, type: 'category', category: '', oldName: '', newName: '', count: 0 });
            return;
        }

        try {
            setLoading(true);
            if (type === 'category') {
                const res = await adminRenameCategory(oldName, trimmedNew);
                alert(`Successfully renamed category "${oldName}" to "${trimmedNew}" across ${res.count} products!`);
                if (selectedCollectionCategory === oldName) {
                    setSelectedCollectionCategory(trimmedNew);
                }
            } else {
                const res = await adminRenameSubcategory(category, oldName, trimmedNew);
                alert(`Successfully renamed subcategory "${oldName}" to "${trimmedNew}" across ${res.count} products!`);
                if (selectedCollectionSubcategory === oldName) {
                    setSelectedCollectionSubcategory(trimmedNew);
                }
            }
            setRenameModal({ open: false, type: 'category', category: '', oldName: '', newName: '', count: 0 });
            await loadProducts();
        } catch (err) {
            alert('Failed to rename: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    // Bulk selection state for assigning subcategories to multiple products
    const [selectedProductIds, setSelectedProductIds] = useState(new Set());
    const [bulkFilterCategory, setBulkFilterCategory] = useState('');
    const [bulkFilterSubcategory, setBulkFilterSubcategory] = useState('');
    const [bulkFilterSearch, setBulkFilterSearch] = useState('');

    const bulkFilteredProducts = React.useMemo(() => {
        return products.filter(p => {
            if (bulkFilterCategory && (p.category || '').toLowerCase().trim() !== bulkFilterCategory.toLowerCase().trim()) {
                return false;
            }
            if (bulkFilterSubcategory && (p.subcategory || '').toLowerCase().trim() !== bulkFilterSubcategory.toLowerCase().trim()) {
                return false;
            }
            if (bulkFilterSearch.trim()) {
                const q = bulkFilterSearch.toLowerCase().trim();
                const matchName = p.name && p.name.toLowerCase().includes(q);
                const matchSku = p.sku && p.sku.toLowerCase().includes(q);
                const matchBrand = p.brand && p.brand.toLowerCase().includes(q);
                if (!matchName && !matchSku && !matchBrand) return false;
            }
            return true;
        });
    }, [products, bulkFilterCategory, bulkFilterSubcategory, bulkFilterSearch]);
    const [bulkSubcategoryInput, setBulkSubcategoryInput] = useState('');
    const [bulkLoading, setBulkLoading] = useState(false);

    const toggleSelectProduct = (id) => {
        setSelectedProductIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleSelectAllProducts = (productsList) => {
        const visibleIds = productsList.map(p => p.id);
        const allAlreadySelected = visibleIds.length > 0 && visibleIds.every(id => selectedProductIds.has(id));
        setSelectedProductIds(prev => {
            const next = new Set(prev);
            if (allAlreadySelected) {
                visibleIds.forEach(id => next.delete(id));
            } else {
                visibleIds.forEach(id => next.add(id));
            }
            return next;
        });
    };

    const handleApplyBulkSubcategory = async () => {
        if (selectedProductIds.size === 0) return;
        const targetSub = bulkSubcategoryInput.trim();
        if (!targetSub) {
            alert('Please select or enter a subcategory name to assign.');
            return;
        }
        if (!window.confirm(`Are you sure you want to assign subcategory "${targetSub}" to all ${selectedProductIds.size} selected products?`)) return;

        try {
            setBulkLoading(true);
            const res = await adminBulkUpdateSubcategory(Array.from(selectedProductIds), targetSub);
            alert(`Successfully updated subcategory to "${targetSub}" for ${res.count} products!`);
            setSelectedProductIds(new Set());
            setBulkSubcategoryInput('');
            await loadProducts();
        } catch (err) {
            alert('Failed to update products: ' + err.message);
        } finally {
            setBulkLoading(false);
        }
    };

    // Lock background scroll when modal is open so it stays locked to current viewport
    useEffect(() => {
        if (showProductModal || showOrderModal || renameModal.open) {
            const originalOverflow = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
            return () => {
                document.body.style.overflow = originalOverflow;
            };
        }
    }, [showProductModal, showOrderModal, renameModal.open]);

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

    // Robust image error recovery handler (auto fallback to wsrv.nl CDN proxy, then placeholder)
    const handleAdminImgError = (e) => {
        const target = e.currentTarget;
        const currentSrc = target.src || '';
        if (currentSrc && !currentSrc.includes('wsrv.nl') && !currentSrc.includes('placeholder-key.svg')) {
            const rawUrl = currentSrc.replace(/^https?:\/\/i[0-9]\.wp\.com\//, 'https://');
            target.src = `https://wsrv.nl/?url=${encodeURIComponent(rawUrl)}&w=120&h=120&fit=contain`;
        } else {
            target.onerror = null;
            target.src = '/placeholder-key.svg';
        }
    };

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
        if (!isAuthenticated) return
        if (tab === 'products' || tab === 'collections' || tab === 'bulk') loadProducts()
        if (tab === 'orders') loadOrders()
    }, [tab, isAuthenticated])

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

    const openProductModal = (prod = null, defaultCategory = '', defaultSubcategory = '') => {
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
            subcategory: prod.subcategory || detailsObj.subcategory || defaultSubcategory || '',
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
            name: '', sku: '', price: 0, original_price: 0, 
            category: defaultCategory || 'Key Cover', 
            subcategory: defaultSubcategory || '', 
            brand: '',
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

    if (!isAuthenticated) {
        return (
            <div className="admin-container page-enter" style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 16px' }}>
                <div style={{
                    width: '100%',
                    maxWidth: '440px',
                    background: '#FFFFFF',
                    borderRadius: '20px',
                    border: '1px solid #E5E7EB',
                    boxShadow: '0 20px 40px -15px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.02)',
                    padding: '36px 32px',
                    textAlign: 'center'
                }}>
                    <div style={{
                        width: '68px',
                        height: '68px',
                        borderRadius: '18px',
                        background: 'linear-gradient(135deg, #FFF7ED 0%, #FFEDD5 100%)',
                        border: '1px solid #FDBA74',
                        color: 'var(--cta, #D97706)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.9rem',
                        margin: '0 auto 20px auto',
                        boxShadow: '0 8px 16px -4px rgba(217, 119, 6, 0.15)'
                    }}>
                        <i className="bi bi-shield-lock-fill" />
                    </div>

                    <h2 style={{ fontSize: '1.45rem', fontWeight: '800', color: '#111827', margin: '0 0 6px 0' }}>
                        Admin Portal Access
                    </h2>
                    <p style={{ fontSize: '0.88rem', color: '#6B7280', margin: '0 0 24px 0', lineHeight: '1.4' }}>
                        Enter your administrative master password to access product management and orders.
                    </p>

                    <form onSubmit={handlePasswordSubmit}>
                        <div style={{ position: 'relative', marginBottom: '14px', textAlign: 'left' }}>
                            <label style={{ fontSize: '0.78rem', fontWeight: '700', color: '#4B5563', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', display: 'block' }}>
                                Master Password
                            </label>
                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                <i className="bi bi-key" style={{ position: 'absolute', left: '14px', color: '#9CA3AF', fontSize: '1.1rem', pointerEvents: 'none' }} />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={passwordInput}
                                    onChange={(e) => {
                                        setPasswordInput(e.target.value)
                                        if (passwordError) setPasswordError('')
                                    }}
                                    placeholder="Enter admin password..."
                                    autoFocus
                                    style={{
                                        width: '100%',
                                        height: '46px',
                                        padding: '0 44px 0 42px',
                                        borderRadius: '12px',
                                        border: passwordError ? '1.5px solid #EF4444' : '1px solid #D1D5DB',
                                        fontSize: '0.95rem',
                                        outline: 'none',
                                        background: '#F9FAFB',
                                        transition: 'all 0.2s ease'
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    tabIndex={-1}
                                    style={{
                                        position: 'absolute',
                                        right: '12px',
                                        background: 'none',
                                        border: 'none',
                                        color: '#9CA3AF',
                                        cursor: 'pointer',
                                        fontSize: '1rem',
                                        padding: '4px'
                                    }}
                                >
                                    <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`} />
                                </button>
                            </div>
                        </div>

                        {passwordError && (
                            <div style={{
                                padding: '10px 14px',
                                borderRadius: '10px',
                                background: '#FEF2F2',
                                border: '1px solid #FCA5A5',
                                color: '#B91C1C',
                                fontSize: '0.84rem',
                                fontWeight: '600',
                                marginBottom: '16px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                textAlign: 'left'
                            }}>
                                <i className="bi bi-exclamation-circle-fill" />
                                {passwordError}
                            </div>
                        )}

                        <button
                            type="submit"
                            style={{
                                width: '100%',
                                height: '48px',
                                background: 'var(--cta, #B88424)',
                                color: '#FFFFFF',
                                border: 'none',
                                borderRadius: '12px',
                                fontSize: '0.95rem',
                                fontWeight: '700',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                cursor: 'pointer',
                                boxShadow: '0 4px 12px rgba(184, 132, 36, 0.25)',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            <i className="bi bi-unlock-fill" /> Unlock Admin Panel
                        </button>
                    </form>

                    <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #F3F4F6' }}>
                        <Link to="/" style={{ color: '#6B7280', fontSize: '0.85rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <i className="bi bi-arrow-left" /> Back to Store
                        </Link>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="admin-container">
            <header className="admin-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                    <h1><i className="bi bi-shield-lock" /> Smiley N Traders Admin Panel</h1>
                    <p>Manage products, orders, and real-time shipment updates.</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <button 
                        className="btn btn-outline-danger"
                        onClick={handleLockAdmin}
                        title="Lock and sign out of admin panel"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: '10px', fontWeight: '700', fontSize: '0.9rem' }}
                    >
                        <i className="bi bi-lock-fill" />
                        Lock Admin
                    </button>
                    <button 
                        className="btn btn-outline-primary"
                        onClick={handleSyncMockData}
                        disabled={syncing}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 18px', borderRadius: '10px', fontWeight: '700', fontSize: '0.9rem' }}
                    >
                        <i className={`bi ${syncing ? 'bi-arrow-repeat bi-spin' : 'bi-database-fill-gear'}`} />
                        {syncing ? 'Syncing to Neon DB...' : 'Sync Mock Data to Database'}
                    </button>
                </div>
            </header>

            <div className="admin-tabs">
                <button className={`admin-tab ${tab === 'products' ? 'active' : ''}`} onClick={() => setTab('products')}>
                    <i className="bi bi-box" /> Products
                </button>
                <button className={`admin-tab ${tab === 'collections' ? 'active' : ''}`} onClick={() => setTab('collections')}>
                    <i className="bi bi-grid-3x3-gap-fill" /> Collections
                </button>
                <button className={`admin-tab ${tab === 'bulk' ? 'active' : ''}`} onClick={() => setTab('bulk')}>
                    <i className="bi bi-check2-square" /> Bulk Subcategory Editor
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
                                <div className="admin-panel__header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                                    <div>
                                        <h2 style={{ margin: 0 }}>Product Database</h2>
                                        <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#6B7280' }}>
                                            Showing {filteredAdminProducts.length} of {products.length} products
                                        </p>
                                    </div>
                                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                        <div style={{ position: 'relative' }}>
                                            <input
                                                type="text"
                                                className="form-control form-control-sm"
                                                placeholder="Search name, subcategory, SKU..."
                                                value={adminSearch}
                                                onChange={e => setAdminSearch(e.target.value)}
                                                style={{ width: '260px', paddingLeft: '28px', fontSize: '0.85rem' }}
                                            />
                                            <i className="bi bi-search" style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', fontSize: '0.8rem' }} />
                                            {adminSearch && (
                                                <button onClick={() => setAdminSearch('')} style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', color: '#9CA3AF', cursor: 'pointer', padding: 0 }}>
                                                    <i className="bi bi-x" />
                                                </button>
                                            )}


                                        </div>
                                        <button className="btn btn-primary btn-sm" onClick={() => openProductModal(null)}>
                                            <i className="bi bi-plus" /> Add Product
                                        </button>
                                    </div>
                                </div>

                                {/* Bulk Subcategory Assignment Bar for Products Tab */}
                                <div className="bulk-actions-bar" style={{
                                    background: selectedProductIds.size > 0 ? '#1E293B' : '#FFFFFF',
                                    border: selectedProductIds.size > 0 ? '1.5px solid var(--primary-color)' : '1px solid var(--border-color)',
                                    color: selectedProductIds.size > 0 ? '#FFFFFF' : 'var(--text-color)',
                                    boxShadow: selectedProductIds.size > 0 ? '0 8px 24px rgba(0, 0, 0, 0.22)' : '0 6px 20px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.04)',
                                    transition: 'all 0.2s ease',
                                    marginBottom: '16px'
                                }}>
                                    <div className="bulk-actions-info">
                                        <span className={selectedProductIds.size > 0 ? "bulk-selected-pill" : "badge badge-light"} style={selectedProductIds.size === 0 ? { border: '1px solid #D1D5DB', padding: '5px 10px', fontSize: '0.8rem', fontWeight: 600 } : {}}>
                                            <i className="bi bi-check2-square" style={{ marginRight: '6px' }} />
                                            {selectedProductIds.size > 0 ? `${selectedProductIds.size} Selected` : 'Bulk Selection (0 Selected)'}
                                        </span>
                                        <button
                                            type="button"
                                            className={`btn btn-sm ${selectedProductIds.size > 0 ? 'btn-outline-light' : 'btn-outline-primary'}`}
                                            style={{ fontSize: '0.8rem', padding: '3px 10px' }}
                                            onClick={() => handleSelectAllProducts(filteredAdminProducts)}
                                        >
                                            <i className="bi bi-check-all" /> {filteredAdminProducts.length > 0 && filteredAdminProducts.every(p => selectedProductIds.has(p.id)) ? 'Deselect All' : `Select All Visible (${filteredAdminProducts.length})`}
                                        </button>
                                        {selectedProductIds.size === 0 && (
                                            <span style={{ fontSize: '0.82rem', color: '#6B7280' }}>
                                                Check product boxes below to reassign subcategories in bulk.
                                            </span>
                                        )}
                                    </div>

                                    {selectedProductIds.size > 0 && (
                                        <div className="bulk-actions-controls">
                                            <span style={{ fontSize: '0.85rem', color: '#CBD5E1' }}>Change Subcategory to:</span>
                                            <input
                                                type="text"
                                                list="bulk-subcategories-list-main"
                                                className="bulk-subcat-input"
                                                placeholder="Choose or enter new subcategory..."
                                                value={bulkSubcategoryInput}
                                                onChange={e => setBulkSubcategoryInput(e.target.value)}
                                            />
                                            <datalist id="bulk-subcategories-list-main">
                                                {allUniqueSubcategories.map(sub => (
                                                    <option key={sub} value={sub} />
                                                ))}
                                            </datalist>

                                            <button
                                                type="button"
                                                className="btn btn-primary btn-sm"
                                                disabled={bulkLoading || !bulkSubcategoryInput.trim()}
                                                onClick={handleApplyBulkSubcategory}
                                                style={{ fontWeight: 700 }}
                                            >
                                                <i className="bi bi-check2-circle" /> {bulkLoading ? 'Updating...' : `Apply to ${selectedProductIds.size} Products`}
                                            </button>
                                            <button
                                                type="button"
                                                className="btn btn-outline-light btn-sm"
                                                onClick={() => setSelectedProductIds(new Set())}
                                            >
                                                Clear
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <div className="table-responsive">
                                    <table className="admin-table">
                                        <thead>
                                            <tr>
                                                <th style={{ width: '40px' }}>
                                                    <input 
                                                        type="checkbox" 
                                                        className="admin-checkbox"
                                                        checked={filteredAdminProducts.length > 0 && filteredAdminProducts.every(p => selectedProductIds.has(p.id))}
                                                        onChange={() => handleSelectAllProducts(filteredAdminProducts)}
                                                        title="Select all products"
                                                    />
                                                </th>
                                                <th>ID</th>
                                                <th>Image</th>
                                                <th>Name</th>
                                                <th>Price</th>
                                                <th>Category</th>
                                                <th>Subcategory</th>
                                                <th>Stock</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredAdminProducts.map(p => (
                                                <tr key={p.id} style={{ background: selectedProductIds.has(p.id) ? 'rgba(184, 132, 36, 0.08)' : undefined }}>
                                                    <td>
                                                        <input 
                                                            type="checkbox" 
                                                            className="admin-checkbox"
                                                            checked={selectedProductIds.has(p.id)}
                                                            onChange={() => toggleSelectProduct(p.id)}
                                                        />
                                                    </td>
                                                    <td>{p.id}</td>
                                                    <td>
                                                        <img 
                                                            src={formatImageUrl(p.image_url)} 
                                                            alt="" 
                                                            width="40" 
                                                            height="40" 
                                                            loading="lazy"
                                                            decoding="async"
                                                            referrerPolicy="no-referrer"
                                                            onError={handleAdminImgError} 
                                                            style={{ objectFit: 'contain', borderRadius: '4px', border: '1px solid #E5E7EB', backgroundColor: '#F9FAFB' }} 
                                                        />
                                                    </td>
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
                                                    <td>{p.subcategory ? <span className="badge badge-light" style={{ border: '1px solid #D1D5DB', fontSize: '0.75rem', fontWeight: 600 }}>{p.subcategory}</span> : <span style={{ color: '#9CA3AF' }}>-</span>}</td>
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

                        {/* ── COLLECTIONS TAB ── */}
                        {tab === 'collections' && (
                            <div className="admin-panel">
                                {!selectedCollectionSubcategory ? (
                                    /* VIEW 1: CATEGORIES & SUBCATEGORIES OVERVIEW */
                                    <div className="collections-overview">
                                        <div className="admin-panel__header" style={{ marginBottom: '8px' }}>
                                            <div>
                                                <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <i className="bi bi-folder2-open" style={{ color: 'var(--primary-color)' }} />
                                                    Collections & Subcategories
                                                </h2>
                                                <p style={{ margin: '4px 0 0 0', fontSize: '0.88rem', color: '#6B7280' }}>
                                                    Browse products organized by Category. Open any category's dropdown to see subcategories, rename categories/subcategories across all products, or click to view its products.
                                                </p>
                                            </div>
                                        </div>

                                        {/* Stats Bar */}
                                        <div className="collections-stats-bar">
                                            <div className="collections-stat-item">
                                                <div className="collections-stat-icon">
                                                    <i className="bi bi-tags-fill" />
                                                </div>
                                                <div className="collections-stat-info">
                                                    <div className="num">{collectionsStats.totalCats}</div>
                                                    <div className="lbl">Categories</div>
                                                </div>
                                            </div>
                                            <div className="collections-stat-item">
                                                <div className="collections-stat-icon">
                                                    <i className="bi bi-diagram-3-fill" />
                                                </div>
                                                <div className="collections-stat-info">
                                                    <div className="num">{collectionsStats.totalSubcats}</div>
                                                    <div className="lbl">Subcategories</div>
                                                </div>
                                            </div>
                                            <div className="collections-stat-item">
                                                <div className="collections-stat-icon">
                                                    <i className="bi bi-box-seam-fill" />
                                                </div>
                                                <div className="collections-stat-info">
                                                    <div className="num">{collectionsStats.totalProducts}</div>
                                                    <div className="lbl">Catalog Products</div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Quick Dropdown Jump Bar */}
                                        <div className="collections-jump-bar">
                                            <div className="collections-jump-label">
                                                <i className="bi bi-lightning-charge-fill" style={{ color: 'var(--primary-color)' }} />
                                                Quick Jump:
                                            </div>
                                            <select 
                                                className="form-control" 
                                                style={{ width: '220px', padding: '8px 12px', fontSize: '0.88rem' }}
                                                value={quickCategorySelect}
                                                onChange={(e) => {
                                                    setQuickCategorySelect(e.target.value);
                                                    setQuickSubcategorySelect('');
                                                }}
                                            >
                                                <option value="">Select Category...</option>
                                                {collectionsTree.map(c => (
                                                    <option key={c.category} value={c.category}>
                                                        {c.category} ({c.count})
                                                    </option>
                                                ))}
                                            </select>

                                            <select 
                                                className="form-control" 
                                                style={{ width: '240px', padding: '8px 12px', fontSize: '0.88rem' }}
                                                value={quickSubcategorySelect}
                                                disabled={!quickCategorySelect}
                                                onChange={(e) => {
                                                    const sub = e.target.value;
                                                    setQuickSubcategorySelect(sub);
                                                    if (sub) {
                                                        setSelectedCollectionCategory(quickCategorySelect);
                                                        setSelectedCollectionSubcategory(sub);
                                                    }
                                                }}
                                            >
                                                <option value="">Select Subcategory...</option>
                                                {quickCategorySelect && (
                                                    <option value="all">View All in {quickCategorySelect}</option>
                                                )}
                                                {quickCategorySelect && (
                                                    collectionsTree
                                                        .find(c => c.category === quickCategorySelect)
                                                        ?.subcategoriesList.map(s => (
                                                            <option key={s.name} value={s.name}>
                                                                {s.name} ({s.count})
                                                            </option>
                                                        ))
                                                )}
                                            </select>

                                            <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
                                                <input
                                                    type="text"
                                                    className="form-control"
                                                    placeholder="Filter categories or subcategories..."
                                                    value={collectionSearch}
                                                    onChange={e => setCollectionSearch(e.target.value)}
                                                    style={{ padding: '8px 12px 8px 32px', fontSize: '0.88rem' }}
                                                />
                                                <i className="bi bi-search" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', fontSize: '0.8rem' }} />
                                                {collectionSearch && (
                                                    <button onClick={() => setCollectionSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', color: '#9CA3AF', cursor: 'pointer', padding: 0 }}>
                                                        <i className="bi bi-x-circle-fill" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Category Cards Grid with Dropdowns and Rename */}
                                        <div className="collections-grid">
                                            {filteredCollectionsTree.map(cat => {
                                                const isOpen = !!openCategoryDropdown[cat.category];
                                                return (
                                                    <div key={cat.category} className="collection-card">
                                                        <div className="collection-card__head">
                                                            <h3 className="collection-card__title">
                                                                <i className="bi bi-folder-fill" style={{ color: 'var(--primary-color)' }} />
                                                                {cat.category}
                                                            </h3>
                                                            <div className="collection-card__meta" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-outline-secondary btn-sm"
                                                                    style={{ padding: '2px 8px', fontSize: '0.75rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                                                    title={`Rename Category "${cat.category}" across all products`}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setRenameModal({
                                                                            open: true,
                                                                            type: 'category',
                                                                            category: cat.category,
                                                                            oldName: cat.category,
                                                                            newName: cat.category,
                                                                            count: cat.count
                                                                        });
                                                                    }}
                                                                >
                                                                    <i className="bi bi-pencil" /> Rename
                                                                </button>
                                                                <span className="collection-badge-count">{cat.count} items</span>
                                                            </div>
                                                        </div>
                                                        <div className="collection-card__body">
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem', color: '#6B7280', marginBottom: '4px' }}>
                                                                <span>Subcategories ({cat.subcategoriesList.length})</span>
                                                                <button 
                                                                    type="button"
                                                                    className="btn btn-link" 
                                                                    style={{ padding: 0, fontSize: '0.82rem', color: 'var(--primary-color)', textDecoration: 'none', fontWeight: 600 }}
                                                                    onClick={() => {
                                                                        setSelectedCollectionCategory(cat.category);
                                                                        setSelectedCollectionSubcategory('all');
                                                                    }}
                                                                >
                                                                    View All ({cat.count})
                                                                </button>
                                                            </div>

                                                            {/* Dropdown toggle button */}
                                                            <button
                                                                type="button"
                                                                className={`collection-dropdown-trigger ${isOpen ? 'open' : ''}`}
                                                                onClick={() => toggleCategoryDropdown(cat.category)}
                                                            >
                                                                <span>
                                                                    <i className="bi bi-diagram-3" style={{ marginRight: '6px' }} />
                                                                    {isOpen ? 'Hide Subcategories' : `Browse Subcategories (${cat.subcategoriesList.length})`}
                                                                </span>
                                                                <i className={`bi ${isOpen ? 'bi-chevron-up' : 'bi-chevron-down'}`} />
                                                            </button>

                                                            {/* Subcategories dropdown list with Rename icons */}
                                                            {isOpen && (
                                                                <div className="collection-subcats-list">
                                                                    {cat.subcategoriesList.map(sub => (
                                                                        <div key={sub.name} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                            <button
                                                                                type="button"
                                                                                className="collection-subcat-item"
                                                                                style={{ flex: 1 }}
                                                                                onClick={() => {
                                                                                    setSelectedCollectionCategory(cat.category);
                                                                                    setSelectedCollectionSubcategory(sub.name);
                                                                                }}
                                                                            >
                                                                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                                    <i className="bi bi-arrow-return-right" style={{ color: '#9CA3AF', fontSize: '0.8rem' }} />
                                                                                    <strong>{sub.name}</strong>
                                                                                </span>
                                                                                <span className="count-badge">
                                                                                    {sub.count} products
                                                                                    <i className="bi bi-chevron-right" style={{ marginLeft: 4, fontSize: '0.75rem' }} />
                                                                                </span>
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                className="btn btn-sm"
                                                                                style={{ border: '1px solid #E2E8F0', background: '#FFFFFF', borderRadius: '8px', padding: '6px 9px', color: '#64748B', cursor: 'pointer' }}
                                                                                title={`Rename subcategory "${sub.name}" across all products`}
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    setRenameModal({
                                                                                        open: true,
                                                                                        type: 'subcategory',
                                                                                        category: cat.category,
                                                                                        oldName: sub.name,
                                                                                        newName: sub.name,
                                                                                        count: sub.count
                                                                                    });
                                                                                }}
                                                                            >
                                                                                <i className="bi bi-pencil" />
                                                                            </button>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ) : (
                                    /* VIEW 2: PRODUCTS FOR SELECTED SUBCATEGORY */
                                    <div className="collection-products-view">
                                        {/* Breadcrumb Navigation & Back Button */}
                                        <div className="collection-breadcrumbs-bar">
                                            <div className="collection-breadcrumbs">
                                                <button 
                                                    type="button" 
                                                    className="crumb-link" 
                                                    onClick={() => {
                                                        setSelectedCollectionSubcategory(null);
                                                        setCollectionProductSearch('');
                                                    }}
                                                >
                                                    <i className="bi bi-arrow-left" style={{ marginRight: 4 }} />
                                                    All Collections
                                                </button>
                                                <span className="separator">/</span>
                                                <span style={{ fontWeight: 600, color: '#4B5563' }}>{selectedCollectionCategory}</span>
                                                <span className="separator">/</span>
                                                <span className="active-crumb">
                                                    {selectedCollectionSubcategory === 'all' ? 'All Products' : selectedCollectionSubcategory}
                                                </span>
                                            </div>

                                            <button 
                                                type="button"
                                                className="btn btn-outline-secondary btn-sm"
                                                onClick={() => {
                                                    setSelectedCollectionSubcategory(null);
                                                    setCollectionProductSearch('');
                                                }}
                                                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                            >
                                                <i className="bi bi-grid" /> View All Categories
                                            </button>
                                        </div>

                                        {/* Subcategory Toolbar: Switchers, Search, and Add Product */}
                                        <div className="collection-products-toolbar">
                                            <div className="collection-switchers">
                                                {/* Switch Category */}
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#6B7280' }}>Category:</span>
                                                    <select 
                                                        className="form-control form-control-sm"
                                                        style={{ width: '180px', fontWeight: 600 }}
                                                        value={selectedCollectionCategory || ''}
                                                        onChange={(e) => {
                                                            const newCat = e.target.value;
                                                            setSelectedCollectionCategory(newCat);
                                                            setSelectedCollectionSubcategory('all');
                                                        }}
                                                    >
                                                        {collectionsTree.map(c => (
                                                            <option key={c.category} value={c.category}>{c.category}</option>
                                                        ))}
                                                    </select>
                                                </div>

                                                {/* Switch Subcategory */}
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#6B7280' }}>Subcategory:</span>
                                                    <select 
                                                        className="form-control form-control-sm"
                                                        style={{ width: '210px', fontWeight: 600 }}
                                                        value={selectedCollectionSubcategory || ''}
                                                        onChange={(e) => setSelectedCollectionSubcategory(e.target.value)}
                                                    >
                                                        <option value="all">All Subcategories</option>
                                                        {currentCategorySubcategories.map(s => (
                                                            <option key={s.name} value={s.name}>
                                                                {s.name} ({s.count})
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>

                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                                {/* Search inside subcategory */}
                                                <div style={{ position: 'relative', width: '240px' }}>
                                                    <input
                                                        type="text"
                                                        className="form-control form-control-sm"
                                                        placeholder="Search in this subcategory..."
                                                        value={collectionProductSearch}
                                                        onChange={e => setCollectionProductSearch(e.target.value)}
                                                        style={{ paddingLeft: '28px' }}
                                                    />
                                                    <i className="bi bi-search" style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', fontSize: '0.78rem' }} />
                                                    {collectionProductSearch && (
                                                        <button onClick={() => setCollectionProductSearch('')} style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', color: '#9CA3AF', cursor: 'pointer', padding: 0 }}>
                                                            <i className="bi bi-x-circle-fill" />
                                                        </button>
                                                    )}
                                                </div>

                                                {/* Add Product prefilled */}
                                                <button 
                                                    className="btn btn-primary btn-sm"
                                                    onClick={() => openProductModal(null, selectedCollectionCategory, selectedCollectionSubcategory === 'all' ? '' : selectedCollectionSubcategory)}
                                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                                >
                                                    <i className="bi bi-plus" /> Add Product
                                                </button>
                                            </div>
                                        </div>

                                        {/* Subcategory Summary Banner & Rename Button */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', background: '#FAFAFA', borderRadius: '10px', border: '1px solid #F1F5F9', flexWrap: 'wrap', gap: '10px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                                                <strong style={{ fontSize: '1.1rem', color: '#111827' }}>
                                                    {selectedCollectionSubcategory === 'all' ? `All ${selectedCollectionCategory} Products` : selectedCollectionSubcategory}
                                                </strong>
                                                <span style={{ fontSize: '0.85rem', color: '#6B7280' }}>
                                                    Category: <span className="badge badge-secondary">{selectedCollectionCategory}</span>
                                                </span>
                                                {selectedCollectionSubcategory !== 'all' && (
                                                    <button 
                                                        type="button"
                                                        className="btn btn-sm btn-outline-secondary"
                                                        style={{ fontSize: '0.78rem', padding: '2px 8px', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}
                                                        onClick={() => {
                                                            const count = collectionFilteredProducts.length;
                                                            setRenameModal({
                                                                open: true,
                                                                type: 'subcategory',
                                                                category: selectedCollectionCategory,
                                                                oldName: selectedCollectionSubcategory,
                                                                newName: selectedCollectionSubcategory,
                                                                count
                                                            });
                                                        }}
                                                    >
                                                        <i className="bi bi-pencil" /> Rename Subcategory
                                                    </button>
                                                )}
                                            </div>
                                            <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--primary-color)' }}>
                                                {collectionFilteredProducts.length} {collectionFilteredProducts.length === 1 ? 'Product' : 'Products'} found
                                            </span>
                                        </div>

                                        {/* Bulk Subcategory Assignment Bar for Collections View */}
                                        <div className="bulk-actions-bar" style={{
                                            background: selectedProductIds.size > 0 ? '#1E293B' : '#FFFFFF',
                                            border: selectedProductIds.size > 0 ? '1.5px solid var(--primary-color)' : '1px solid var(--border-color)',
                                            color: selectedProductIds.size > 0 ? '#FFFFFF' : 'var(--text-color)',
                                            boxShadow: selectedProductIds.size > 0 ? '0 8px 24px rgba(0, 0, 0, 0.22)' : '0 6px 20px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.04)',
                                            transition: 'all 0.2s ease',
                                            marginBottom: '16px'
                                        }}>
                                            <div className="bulk-actions-info">
                                                <span className={selectedProductIds.size > 0 ? "bulk-selected-pill" : "badge badge-light"} style={selectedProductIds.size === 0 ? { border: '1px solid #D1D5DB', padding: '5px 10px', fontSize: '0.8rem', fontWeight: 600 } : {}}>
                                                    <i className="bi bi-check2-square" style={{ marginRight: '6px' }} />
                                                    {selectedProductIds.size > 0 ? `${selectedProductIds.size} Selected` : 'Bulk Selection (0 Selected)'}
                                                </span>
                                                <button
                                                    type="button"
                                                    className={`btn btn-sm ${selectedProductIds.size > 0 ? 'btn-outline-light' : 'btn-outline-primary'}`}
                                                    style={{ fontSize: '0.8rem', padding: '3px 10px' }}
                                                    onClick={() => handleSelectAllProducts(collectionFilteredProducts)}
                                                >
                                                    <i className="bi bi-check-all" /> {collectionFilteredProducts.length > 0 && collectionFilteredProducts.every(p => selectedProductIds.has(p.id)) ? 'Deselect All' : `Select All (${collectionFilteredProducts.length})`}
                                                </button>
                                                {selectedProductIds.size === 0 && (
                                                    <span style={{ fontSize: '0.82rem', color: '#6B7280' }}>
                                                        Check product boxes below to reassign subcategories.
                                                    </span>
                                                )}
                                            </div>

                                            {selectedProductIds.size > 0 && (
                                                <div className="bulk-actions-controls">
                                                    <span style={{ fontSize: '0.85rem', color: '#CBD5E1' }}>Change Subcategory to:</span>
                                                    <input
                                                        type="text"
                                                        list="bulk-subcategories-list-coll"
                                                        className="bulk-subcat-input"
                                                        placeholder="Choose or enter new subcategory..."
                                                        value={bulkSubcategoryInput}
                                                        onChange={e => setBulkSubcategoryInput(e.target.value)}
                                                    />
                                                    <datalist id="bulk-subcategories-list-coll">
                                                        {allUniqueSubcategories.map(sub => (
                                                            <option key={sub} value={sub} />
                                                        ))}
                                                    </datalist>

                                                    <button
                                                        type="button"
                                                        className="btn btn-primary btn-sm"
                                                        disabled={bulkLoading || !bulkSubcategoryInput.trim()}
                                                        onClick={handleApplyBulkSubcategory}
                                                        style={{ fontWeight: 700 }}
                                                    >
                                                        <i className="bi bi-check2-circle" /> {bulkLoading ? 'Updating...' : `Apply to ${selectedProductIds.size} Products`}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="btn btn-outline-light btn-sm"
                                                        onClick={() => setSelectedProductIds(new Set())}
                                                    >
                                                        Clear
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {/* Table of products in this subcategory */}
                                        <div className="table-responsive">
                                            <table className="admin-table">
                                                <thead>
                                                    <tr>
                                                        <th style={{ width: '40px' }}>
                                                            <input 
                                                                type="checkbox" 
                                                                className="admin-checkbox"
                                                                checked={collectionFilteredProducts.length > 0 && collectionFilteredProducts.every(p => selectedProductIds.has(p.id))}
                                                                onChange={() => handleSelectAllProducts(collectionFilteredProducts)}
                                                                title="Select all"
                                                            />
                                                        </th>
                                                        <th>ID</th>
                                                        <th>Image</th>
                                                        <th>Name</th>
                                                        <th>Price</th>
                                                        <th>Brand</th>
                                                        <th>Subcategory</th>
                                                        <th>Stock</th>
                                                        <th>Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {collectionFilteredProducts.length === 0 ? (
                                                        <tr>
                                                            <td colSpan="9" style={{ textAlign: 'center', padding: '40px 20px', color: '#6B7280' }}>
                                                                <i className="bi bi-inbox" style={{ fontSize: '2rem', display: 'block', marginBottom: '8px', color: '#D1D5DB' }} />
                                                                No products found in this subcategory.
                                                            </td>
                                                        </tr>
                                                    ) : (
                                                        collectionFilteredProducts.map(p => (
                                                            <tr key={p.id} style={{ background: selectedProductIds.has(p.id) ? 'rgba(184, 132, 36, 0.08)' : undefined }}>
                                                                <td>
                                                                    <input 
                                                                        type="checkbox" 
                                                                        className="admin-checkbox"
                                                                        checked={selectedProductIds.has(p.id)}
                                                                        onChange={() => toggleSelectProduct(p.id)}
                                                                    />
                                                                </td>
                                                                <td>{p.id}</td>
                                                                <td>
                                                                    <img 
                                                                        src={formatImageUrl(p.image_url)} 
                                                                        alt="" 
                                                                        width="40" 
                                                                        height="40" 
                                                                        loading="lazy"
                                                                        decoding="async"
                                                                        referrerPolicy="no-referrer"
                                                                        onError={handleAdminImgError} 
                                                                        style={{ objectFit: 'contain', borderRadius: '4px', border: '1px solid #E5E7EB', backgroundColor: '#F9FAFB' }} 
                                                                    />
                                                                </td>
                                                                <td>
                                                                    <strong>{p.name}</strong>
                                                                    {p.sku && (
                                                                        <div style={{ fontSize: '0.75rem', color: '#6B7280', fontFamily: 'monospace', marginTop: '2px' }}>
                                                                            SKU: {p.sku}
                                                                        </div>
                                                                    )}
                                                                </td>
                                                                <td>₹{p.price}</td>
                                                                <td>{p.brand || '-'}</td>
                                                                <td>
                                                                    <span className="badge badge-light" style={{ border: '1px solid #D1D5DB', fontSize: '0.75rem', fontWeight: 600 }}>
                                                                        {p.subcategory || selectedCollectionSubcategory}
                                                                    </span>
                                                                </td>
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
                                                        ))
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── BULK SUBCATEGORY EDITOR TAB ── */}
                        {tab === 'bulk' && (
                            <div className="admin-panel">
                                <div className="admin-panel__header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                                    <div>
                                        <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
                                            <i className="bi bi-check2-square" style={{ color: 'var(--primary-color)' }} />
                                            Bulk Subcategory Editor
                                        </h2>
                                        <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#6B7280' }}>
                                            Select multiple products across any category and reassign their subcategory in a single click.
                                        </p>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                        <span className="badge badge-secondary" style={{ fontSize: '0.85rem', padding: '6px 12px' }}>
                                            Total Catalog: {products.length} Products
                                        </span>
                                    </div>
                                </div>

                                {/* Filter Controls */}
                                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', background: '#F8FAFC', padding: '16px 20px', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '16px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Category:</span>
                                        <select 
                                            className="form-control form-control-sm"
                                            style={{ width: '190px', fontWeight: 600 }}
                                            value={bulkFilterCategory}
                                            onChange={e => {
                                                setBulkFilterCategory(e.target.value);
                                                setBulkFilterSubcategory('');
                                            }}
                                        >
                                            <option value="">All Categories ({products.length})</option>
                                            {collectionsTree.map(c => (
                                                <option key={c.category} value={c.category}>{c.category} ({c.count})</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Subcategory:</span>
                                        <select 
                                            className="form-control form-control-sm"
                                            style={{ width: '220px', fontWeight: 600 }}
                                            value={bulkFilterSubcategory}
                                            onChange={e => setBulkFilterSubcategory(e.target.value)}
                                        >
                                            <option value="">All Subcategories</option>
                                            {allUniqueSubcategories.map(sub => (
                                                <option key={sub} value={sub}>{sub}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
                                        <input
                                            type="text"
                                            className="form-control form-control-sm"
                                            placeholder="Search by name, SKU, or brand..."
                                            value={bulkFilterSearch}
                                            onChange={e => setBulkFilterSearch(e.target.value)}
                                            style={{ paddingLeft: '28px' }}
                                        />
                                        <i className="bi bi-search" style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', fontSize: '0.78rem' }} />
                                        {bulkFilterSearch && (
                                            <button onClick={() => setBulkFilterSearch('')} style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', color: '#9CA3AF', cursor: 'pointer', padding: 0 }}>
                                                <i className="bi bi-x-circle-fill" />
                                            </button>
                                        )}
                                    </div>

                                    {(bulkFilterCategory || bulkFilterSubcategory || bulkFilterSearch) && (
                                        <button
                                            type="button"
                                            className="btn btn-outline-secondary btn-sm"
                                            onClick={() => {
                                                setBulkFilterCategory('');
                                                setBulkFilterSubcategory('');
                                                setBulkFilterSearch('');
                                            }}
                                        >
                                            Reset Filters
                                        </button>
                                    )}
                                </div>

                                {/* Bulk Action Bar */}
                                <div className="bulk-actions-bar" style={{
                                    background: selectedProductIds.size > 0 ? '#1E293B' : '#FFFFFF',
                                    border: selectedProductIds.size > 0 ? '1.5px solid var(--primary-color)' : '1px solid var(--border-color)',
                                    color: selectedProductIds.size > 0 ? '#FFFFFF' : 'var(--text-color)',
                                    boxShadow: selectedProductIds.size > 0 ? '0 8px 24px rgba(0, 0, 0, 0.22)' : '0 6px 20px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.04)',
                                    transition: 'all 0.2s ease',
                                    marginBottom: '20px'
                                }}>
                                    <div className="bulk-actions-info">
                                        <span className={selectedProductIds.size > 0 ? "bulk-selected-pill" : "badge badge-light"} style={selectedProductIds.size === 0 ? { border: '1px solid #D1D5DB', padding: '5px 10px', fontSize: '0.8rem', fontWeight: 600 } : {}}>
                                            <i className="bi bi-check2-square" style={{ marginRight: '6px' }} />
                                            {selectedProductIds.size > 0 ? `${selectedProductIds.size} Products Selected` : '0 Products Selected'}
                                        </span>
                                        <button
                                            type="button"
                                            className={`btn btn-sm ${selectedProductIds.size > 0 ? 'btn-outline-light' : 'btn-outline-primary'}`}
                                            style={{ fontSize: '0.8rem', padding: '3px 10px' }}
                                            onClick={() => handleSelectAllProducts(bulkFilteredProducts)}
                                        >
                                            <i className="bi bi-check-all" /> {bulkFilteredProducts.length > 0 && bulkFilteredProducts.every(p => selectedProductIds.has(p.id)) ? 'Deselect All' : `Select All Matching (${bulkFilteredProducts.length})`}
                                        </button>
                                    </div>

                                    <div className="bulk-actions-controls">
                                        <span style={{ fontSize: '0.85rem', color: selectedProductIds.size > 0 ? '#CBD5E1' : '#475569', fontWeight: 600 }}>
                                            Target Subcategory:
                                        </span>
                                        <input
                                            type="text"
                                            list="bulk-tab-subcats"
                                            className="bulk-subcat-input"
                                            placeholder="Choose or enter new subcategory..."
                                            value={bulkSubcategoryInput}
                                            onChange={e => setBulkSubcategoryInput(e.target.value)}
                                            style={selectedProductIds.size === 0 ? { background: '#F8FAFC', color: '#1E293B', border: '1px solid #CBD5E1' } : {}}
                                        />
                                        <datalist id="bulk-tab-subcats">
                                            {allUniqueSubcategories.map(sub => (
                                                <option key={sub} value={sub} />
                                            ))}
                                        </datalist>

                                        <button
                                            type="button"
                                            className="btn btn-primary btn-sm"
                                            disabled={bulkLoading || selectedProductIds.size === 0 || !bulkSubcategoryInput.trim()}
                                            onClick={handleApplyBulkSubcategory}
                                            style={{ fontWeight: 700 }}
                                        >
                                            <i className="bi bi-arrow-repeat" /> {bulkLoading ? 'Updating...' : `Assign to ${selectedProductIds.size} Selected`}
                                        </button>

                                        {selectedProductIds.size > 0 && (
                                            <button
                                                type="button"
                                                className="btn btn-outline-light btn-sm"
                                                onClick={() => setSelectedProductIds(new Set())}
                                            >
                                                Clear
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Filtered Products Table */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                    <span style={{ fontSize: '0.85rem', color: '#64748B' }}>
                                        Showing <strong>{bulkFilteredProducts.length}</strong> products matching filters
                                    </span>
                                </div>

                                <div className="table-responsive">
                                    <table className="admin-table">
                                        <thead>
                                            <tr>
                                                <th style={{ width: '65px', textAlign: 'center' }}>
                                                    <input 
                                                        type="checkbox" 
                                                        className="admin-checkbox"
                                                        checked={bulkFilteredProducts.length > 0 && bulkFilteredProducts.every(p => selectedProductIds.has(p.id))}
                                                        onChange={() => handleSelectAllProducts(bulkFilteredProducts)}
                                                        title="Select all"
                                                    />
                                                    <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#6B7280', marginTop: '2px', fontWeight: 700 }}>SELECT</div>
                                                </th>
                                                <th>ID</th>
                                                <th>Image</th>
                                                <th>Product Name</th>
                                                <th>Current Category</th>
                                                <th>Current Subcategory</th>
                                                <th>Price</th>
                                                <th>Brand</th>
                                                <th>Stock</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {bulkFilteredProducts.length === 0 ? (
                                                <tr>
                                                    <td colSpan="10" style={{ textAlign: 'center', padding: '40px 20px', color: '#6B7280' }}>
                                                        <i className="bi bi-inbox" style={{ fontSize: '2rem', display: 'block', marginBottom: '8px', color: '#D1D5DB' }} />
                                                        No products match the selected filters.
                                                    </td>
                                                </tr>
                                            ) : (
                                                bulkFilteredProducts.map(p => (
                                                    <tr key={p.id} style={{ background: selectedProductIds.has(p.id) ? 'rgba(184, 132, 36, 0.08)' : undefined }}>
                                                        <td style={{ textAlign: 'center' }}>
                                                            <input 
                                                                type="checkbox" 
                                                                className="admin-checkbox"
                                                                checked={selectedProductIds.has(p.id)}
                                                                onChange={() => toggleSelectProduct(p.id)}
                                                            />
                                                        </td>
                                                        <td>{p.id}</td>
                                                        <td>
                                                            <img 
                                                                src={formatImageUrl(p.image_url)} 
                                                                alt="" 
                                                                width="40" 
                                                                height="40" 
                                                                loading="lazy"
                                                                decoding="async"
                                                                referrerPolicy="no-referrer"
                                                                onError={handleAdminImgError} 
                                                                style={{ objectFit: 'contain', borderRadius: '4px', border: '1px solid #E5E7EB', backgroundColor: '#F9FAFB' }} 
                                                            />
                                                        </td>
                                                        <td>
                                                            <strong>{p.name}</strong>
                                                            {p.sku && (
                                                                <div style={{ fontSize: '0.75rem', color: '#6B7280', fontFamily: 'monospace', marginTop: '2px' }}>
                                                                    SKU: {p.sku}
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td><span className="badge badge-secondary">{p.category}</span></td>
                                                        <td>
                                                            {p.subcategory ? (
                                                                <span className="badge badge-light" style={{ border: '1px solid #D1D5DB', fontSize: '0.75rem', fontWeight: 600 }}>
                                                                    {p.subcategory}
                                                                </span>
                                                            ) : (
                                                                <span style={{ color: '#9CA3AF' }}>Unassigned</span>
                                                            )}
                                                        </td>
                                                        <td>₹{p.price}</td>
                                                        <td>{p.brand || '-'}</td>
                                                        <td>{p.in_stock ? <span className="text-success">In Stock</span> : <span className="text-danger">Out</span>}</td>
                                                        <td>
                                                            <button className="btn btn-sm btn-outline-primary" onClick={() => openProductModal(p)} style={{ marginRight: 8 }}>
                                                                <i className="bi bi-pencil" /> Edit
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
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
            {showProductModal && createPortal(
                <div 
                    className="admin-modal-overlay" 
                    onClick={(e) => { if (e.target === e.currentTarget) setShowProductModal(false) }}
                >
                    <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
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
                                    <label style={{ marginBottom: '6px' }}>Subcategory</label>
                                    <input 
                                        type="text" 
                                        list="admin-subcategories" 
                                        className="form-control" 
                                        value={productForm.subcategory || ''} 
                                        onChange={e => setProductForm({ ...productForm, subcategory: e.target.value })} 
                                        placeholder="Select or enter subcategory..." 
                                    />
                                    <datalist id="admin-subcategories">
                                        {availableSubcategories.map((sub, i) => (
                                            <option key={i} value={sub} />
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
                                                                src={formatImageUrl(val)} 
                                                                alt={slot.label} 
                                                                loading="lazy"
                                                                referrerPolicy="no-referrer"
                                                                style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
                                                                onError={handleAdminImgError}
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
                </div>,
                document.body
            )}

            {/* ── ORDER MANAGE MODAL ── */}
            {showOrderModal && selectedOrder && createPortal(
                <div 
                    className="admin-modal-overlay" 
                    onClick={(e) => { if (e.target === e.currentTarget) setShowOrderModal(false) }}
                >
                    <div className="admin-modal" style={{ maxWidth: 800 }} onClick={(e) => e.stopPropagation()}>
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
                                            <img 
                                                src={formatImageUrl(item.image_url)} 
                                                alt={item.name} 
                                                width={50} 
                                                height={50} 
                                                loading="lazy"
                                                decoding="async"
                                                referrerPolicy="no-referrer"
                                                onError={handleAdminImgError} 
                                                style={{ objectFit: 'contain', borderRadius: 4, border: '1px solid #eee', backgroundColor: '#F9FAFB' }} 
                                            />
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
                </div>,
                document.body
            )}

            {/* ── RENAME MODAL ── */}
            {renameModal.open && createPortal(
                <div 
                    className="admin-modal-overlay" 
                    onClick={(e) => { 
                        if (e.target === e.currentTarget) setRenameModal({ open: false, type: 'category', category: '', oldName: '', newName: '', count: 0 }) 
                    }}
                >
                    <div className="admin-modal" style={{ maxWidth: '520px' }} onClick={(e) => e.stopPropagation()}>
                        <div className="admin-modal__head">
                            <h3>
                                <i className="bi bi-pencil-square" style={{ color: 'var(--primary-color)', marginRight: '8px' }} />
                                Rename {renameModal.type === 'category' ? 'Category' : 'Subcategory'}
                            </h3>
                            <button 
                                className="close-btn" 
                                onClick={() => setRenameModal({ open: false, type: 'category', category: '', oldName: '', newName: '', count: 0 })}
                            >
                                <i className="bi bi-x-lg" />
                            </button>
                        </div>
                        <form className="admin-modal__body" onSubmit={handleRenameSubmit}>
                            <div style={{ marginBottom: '16px', padding: '12px 14px', background: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0', fontSize: '0.88rem' }}>
                                <div style={{ marginBottom: '6px' }}>
                                    <span style={{ color: '#64748B' }}>Current Name: </span>
                                    <strong>{renameModal.oldName}</strong>
                                    {renameModal.type === 'subcategory' && (
                                        <span style={{ marginLeft: '8px', color: '#64748B' }}>
                                            (Category: <strong>{renameModal.category}</strong>)
                                        </span>
                                    )}
                                </div>
                                <div style={{ color: 'var(--primary-color)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <i className="bi bi-info-circle-fill" />
                                    This will automatically update all {renameModal.count} associated products in the database.
                                </div>
                            </div>

                            <div className="form-group mb-3">
                                <label style={{ fontWeight: 600 }}>New {renameModal.type === 'category' ? 'Category' : 'Subcategory'} Name</label>
                                <input 
                                    type="text" 
                                    className="form-control" 
                                    value={renameModal.newName} 
                                    onChange={e => setRenameModal({ ...renameModal, newName: e.target.value })} 
                                    required 
                                    autoFocus 
                                    placeholder={`Enter new ${renameModal.type} name...`}
                                />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                                <button 
                                    type="button" 
                                    className="btn btn-outline-secondary" 
                                    onClick={() => setRenameModal({ open: false, type: 'category', category: '', oldName: '', newName: '', count: 0 })}
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    className="btn btn-primary"
                                    disabled={loading || !renameModal.newName.trim()}
                                >
                                    {loading ? 'Updating Products...' : 'Save & Update All Products'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}
        </div>
    )
}
