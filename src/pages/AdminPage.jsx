import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import QRCode from 'react-qr-code'
import {
    adminGetProducts,
    adminCreateProduct,
    adminUpdateProduct,
    adminDeleteProduct,
    adminRenameCategory,
    adminRenameSubcategory,
    adminBulkUpdateSubcategory,
    adminBulkUpdateCategory,
    adminBulkUpdateCategoryAndSubcategory,
    adminGetOrders,
    adminGetOrderDetails,
    adminUpdateOrderStatus,
    adminAddTrackingStep,
    adminApprovePayment,
    adminDispatchOrder,
    adminMarkDelivered,
    adminExportToVyapar
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

    // Courier Dispatch & Vyapar States
    const [dispatchModalOrder, setDispatchModalOrder] = useState(null)
    const [dispatchForm, setDispatchForm] = useState({ courier_name: 'DTDC', tracking_number: '' })
    const [orderFilter, setOrderFilter] = useState('all')
    const [orderSearchQuery, setOrderSearchQuery] = useState('')
    const [exportingVyapar, setExportingVyapar] = useState(false)
    const [printLabelOrder, setPrintLabelOrder] = useState(null)

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
    const [bulkCategoryInput, setBulkCategoryInput] = useState('');
    const [bulkSubcategoryInput, setBulkSubcategoryInput] = useState('');
    const [bulkLoading, setBulkLoading] = useState(false);

    // All unique categories across entire product catalog for autocomplete
    const allUniqueCategories = React.useMemo(() => {
        const cats = new Set();
        products.forEach(p => {
            if (p.category && p.category.trim()) cats.add(p.category.trim());
        });
        return Array.from(cats).sort();
    }, [products]);

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

    const handleApplyBulkChanges = async () => {
        if (selectedProductIds.size === 0) return;
        const targetCat = bulkCategoryInput.trim();
        const targetSub = bulkSubcategoryInput.trim();

        if (!targetCat && !targetSub) {
            alert('Please select or enter a Category or Subcategory to assign.');
            return;
        }

        const changesList = [];
        if (targetCat) changesList.push(`Category -> "${targetCat}"`);
        if (targetSub) changesList.push(`Subcategory -> "${targetSub}"`);
        const confirmMsg = `Are you sure you want to assign ${changesList.join(' and ')} to all ${selectedProductIds.size} selected products?`;
        
        if (!window.confirm(confirmMsg)) return;

        try {
            setBulkLoading(true);
            const res = await adminBulkUpdateCategoryAndSubcategory(Array.from(selectedProductIds), {
                category: targetCat || undefined,
                subcategory: targetSub || undefined
            });
            alert(`Successfully updated ${res.count} products!`);
            setSelectedProductIds(new Set());
            setBulkCategoryInput('');
            setBulkSubcategoryInput('');
            await loadProducts();
        } catch (err) {
            alert('Failed to update products: ' + err.message);
        } finally {
            setBulkLoading(false);
        }
    };
    const handleApplyBulkSubcategory = handleApplyBulkChanges;

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
            in_stock: prod.in_stock !== false,
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

            const inStockVal = restForm.in_stock !== false;

            const formattedForm = {
                ...restForm,
                sku: finalSku,
                stock_quantity: inStockVal ? 9999 : 0,
                in_stock: inStockVal,
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

    const handleApprovePayment = async (orderId) => {
        try {
            await adminApprovePayment(orderId)
            alert('✅ Payment Approved! Order moved to Processing & Packing.')
            loadOrders()
            if (selectedOrder && selectedOrder.id === orderId) {
                const refreshed = await adminGetOrderDetails(orderId)
                setSelectedOrder(refreshed)
            }
        } catch (err) {
            alert('Failed to approve payment: ' + err.message)
        }
    }

    const openPrintLabelModal = async (order) => {
        try {
            if (!order.order_items || order.order_items.length === 0) {
                const full = await adminGetOrderDetails(order.id)
                setPrintLabelOrder(full || order)
            } else {
                setPrintLabelOrder(order)
            }
        } catch {
            setPrintLabelOrder(order)
        }
    }

    const handlePrintShippingLabel = () => {
        const labelElem = document.getElementById('printable-shipping-label');
        if (!labelElem) {
            window.print();
            return;
        }

        // Print via an isolated hidden iframe so ONLY the label document is sent to the printer (strictly 1 page)
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);

        const doc = iframe.contentWindow.document;
        doc.open();
        doc.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8" />
                <title>Shipping_Label_${printLabelOrder?.order_number || 'Parcel'}</title>
                <style>
                    @page {
                        size: auto;
                        margin: 6mm;
                    }
                    * {
                        box-sizing: border-box;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    html, body {
                        margin: 0;
                        padding: 0;
                        background: #FFFFFF;
                        font-family: Arial, sans-serif;
                    }
                    .shipping-label-printable {
                        width: 100% !important;
                        max-width: 440px !important;
                        margin: 0 auto !important;
                        box-shadow: none !important;
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                    }
                </style>
            </head>
            <body>
                ${labelElem.outerHTML}
            </body>
            </html>
        `);
        doc.close();

        setTimeout(() => {
            try {
                iframe.contentWindow.focus();
                iframe.contentWindow.print();
            } catch (err) {
                console.error('Iframe print error:', err);
                window.print();
            } finally {
                setTimeout(() => {
                    if (document.body.contains(iframe)) {
                        document.body.removeChild(iframe);
                    }
                }, 1000);
            }
        }, 200);
    }

    const openDispatchModal = (order) => {
        setDispatchModalOrder(order)
        setDispatchForm({
            courier_name: order.courier_name || 'DTDC',
            tracking_number: order.tracking_number || ''
        })
    }

    const handleSaveDispatch = async (e) => {
        if (e) e.preventDefault()
        if (!dispatchModalOrder) return
        if (!dispatchForm.tracking_number.trim()) {
            alert('Please enter a tracking / consignment number.')
            return
        }
        try {
            await adminDispatchOrder(dispatchModalOrder.id, dispatchForm)
            alert(`✅ Order #${dispatchModalOrder.order_number} marked as Dispatched via ${dispatchForm.courier_name}! Tracking number saved.`)
            setDispatchModalOrder(null)
            loadOrders()
            if (selectedOrder && selectedOrder.id === dispatchModalOrder.id) {
                const refreshed = await adminGetOrderDetails(dispatchModalOrder.id)
                setSelectedOrder(refreshed)
            }
        } catch (err) {
            alert('Failed to dispatch order: ' + err.message)
        }
    }

    const handleMarkDelivered = async (orderId) => {
        if (!window.confirm('Mark this order as Delivered?')) return
        try {
            await adminMarkDelivered(orderId)
            alert('✅ Order marked as Delivered!')
            loadOrders()
            if (selectedOrder && selectedOrder.id === orderId) {
                const refreshed = await adminGetOrderDetails(orderId)
                setSelectedOrder(refreshed)
            }
        } catch (err) {
            alert('Failed to mark delivered: ' + err.message)
        }
    }

    const handleExportToVyapar = async (targetOrderIds = null) => {
        setExportingVyapar(true)
        try {
            const res = await adminExportToVyapar(targetOrderIds)
            if (!res || res.count === 0) {
                alert('No orders found to export.')
                return
            }
            const blob = new Blob([res.csvContent], { type: 'text/csv;charset=utf-8;' })
            const url = URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = url
            link.download = `vyapar_sales_invoices_${new Date().toISOString().slice(0, 10)}.csv`
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            URL.revokeObjectURL(url)

            alert(`✅ Successfully generated Vyapar CSV with ${res.count} orders (${res.rows.length} line items)!\nAll exported orders have been marked as exported in the system.`)
            loadOrders()
        } catch (err) {
            alert('Failed to export to Vyapar: ' + err.message)
        } finally {
            setExportingVyapar(false)
        }
    }

    const handleWhatsAppOrder = (order) => {
        const ship = typeof order.shipping_address === 'string' ? JSON.parse(order.shipping_address) : (order.shipping_address || {})
        const rawPhone = order.customer_phone || ship.phone || ''
        const cleanPhone = rawPhone.replace(/\D/g, '').slice(-10)
        if (!cleanPhone) {
            alert('No valid phone number found for this customer.')
            return
        }
        const customerName = order.customer_shop_name || ship.shopName || ship.name || `${ship.firstName || ''} ${ship.lastName || ''}`.trim() || 'Customer'
        const orderNo = order.order_number
        const total = order.total
        const trackingLink = `${window.location.origin}/track/${orderNo}`

        let text = ''
        if (order.status === 'pending_verification') {
            text = `Hello ${customerName}! Thank you for placing Order #${orderNo} (Amount: ₹${total}) on Smiley N Traders. We have received your order details and are verifying your payment. We will notify you once dispatched!`
        } else if (order.status === 'dispatched') {
            text = `Hello ${customerName}! Good news! Your order #${orderNo} has been dispatched via ${order.courier_name || 'Courier'}.\n\n📦 *Tracking / Consignment No:* ${order.tracking_number}\n🔗 *Live Tracking Link:* ${trackingLink}\n\nThank you for choosing Smiley N Traders!`
        } else if (order.status === 'delivered') {
            text = `Hello ${customerName}! Your order #${orderNo} has been delivered. Thank you for your business! Let us know if you need any additional keys or tools.`
        } else {
            text = `Hello ${customerName}! Your order #${orderNo} is confirmed and currently being packed for dispatch. Track here: ${trackingLink}`
        }

        window.open(`https://wa.me/91${cleanPhone}?text=${encodeURIComponent(text)}`, '_blank')
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
                    <i className="bi bi-check2-square" /> Bulk Category & Subcategory Editor
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
                                                Check product boxes below to reassign categories or subcategories in bulk.
                                            </span>
                                        )}
                                    </div>

                                    {selectedProductIds.size > 0 && (
                                        <div className="bulk-actions-controls">
                                            <span style={{ fontSize: '0.85rem', color: '#CBD5E1', fontWeight: 600 }}>Category:</span>
                                            <input
                                                type="text"
                                                list="bulk-categories-list-main"
                                                className="bulk-subcat-input"
                                                placeholder="Assign Category..."
                                                value={bulkCategoryInput}
                                                onChange={e => setBulkCategoryInput(e.target.value)}
                                            />
                                            <datalist id="bulk-categories-list-main">
                                                {allUniqueCategories.map(cat => (
                                                    <option key={cat} value={cat} />
                                                ))}
                                            </datalist>

                                            <span style={{ fontSize: '0.85rem', color: '#CBD5E1', fontWeight: 600 }}>Subcategory:</span>
                                            <input
                                                type="text"
                                                list="bulk-subcategories-list-main"
                                                className="bulk-subcat-input"
                                                placeholder="Assign Subcategory..."
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
                                                disabled={bulkLoading || (!bulkCategoryInput.trim() && !bulkSubcategoryInput.trim())}
                                                onClick={handleApplyBulkChanges}
                                                style={{ fontWeight: 700 }}
                                            >
                                                <i className="bi bi-check2-circle" /> {bulkLoading ? 'Updating...' : `Apply to ${selectedProductIds.size} Products`}
                                            </button>
                                            <button
                                                type="button"
                                                className="btn btn-outline-light btn-sm"
                                                onClick={() => {
                                                    setSelectedProductIds(new Set());
                                                    setBulkCategoryInput('');
                                                    setBulkSubcategoryInput('');
                                                }}
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
                                                    <td>
                                                        {p.in_stock !== false ? (
                                                            <span className="badge" style={{ backgroundColor: '#D1FAE5', color: '#065F46', border: '1px solid #A7F3D0', fontSize: '0.75rem', fontWeight: 700, padding: '4px 8px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                                <i className="bi bi-check-circle-fill" /> In Stock
                                                            </span>
                                                        ) : (
                                                            <span className="badge" style={{ backgroundColor: '#FEE2E2', color: '#991B1B', border: '1px solid #FECACA', fontSize: '0.75rem', fontWeight: 700, padding: '4px 8px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                                <i className="bi bi-x-circle-fill" /> Out of Stock
                                                            </span>
                                                        )}
                                                    </td>
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
                                                        Check product boxes below to reassign categories or subcategories in bulk.
                                                    </span>
                                                )}
                                            </div>

                                            {selectedProductIds.size > 0 && (
                                                <div className="bulk-actions-controls">
                                                    <span style={{ fontSize: '0.85rem', color: '#CBD5E1', fontWeight: 600 }}>Category:</span>
                                                    <input
                                                        type="text"
                                                        list="bulk-categories-list-coll"
                                                        className="bulk-subcat-input"
                                                        placeholder="Assign Category..."
                                                        value={bulkCategoryInput}
                                                        onChange={e => setBulkCategoryInput(e.target.value)}
                                                    />
                                                    <datalist id="bulk-categories-list-coll">
                                                        {allUniqueCategories.map(cat => (
                                                            <option key={cat} value={cat} />
                                                        ))}
                                                    </datalist>

                                                    <span style={{ fontSize: '0.85rem', color: '#CBD5E1', fontWeight: 600 }}>Subcategory:</span>
                                                    <input
                                                        type="text"
                                                        list="bulk-subcategories-list-coll"
                                                        className="bulk-subcat-input"
                                                        placeholder="Assign Subcategory..."
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
                                                        disabled={bulkLoading || (!bulkCategoryInput.trim() && !bulkSubcategoryInput.trim())}
                                                        onClick={handleApplyBulkChanges}
                                                        style={{ fontWeight: 700 }}
                                                    >
                                                        <i className="bi bi-check2-circle" /> {bulkLoading ? 'Updating...' : `Apply to ${selectedProductIds.size} Products`}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="btn btn-outline-light btn-sm"
                                                        onClick={() => {
                                                            setSelectedProductIds(new Set());
                                                            setBulkCategoryInput('');
                                                            setBulkSubcategoryInput('');
                                                        }}
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
                                                                <td>
                                                                    {p.in_stock !== false ? (
                                                                        <span className="badge" style={{ backgroundColor: '#D1FAE5', color: '#065F46', border: '1px solid #A7F3D0', fontSize: '0.75rem', fontWeight: 700, padding: '4px 8px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                                            <i className="bi bi-check-circle-fill" /> In Stock
                                                                        </span>
                                                                    ) : (
                                                                        <span className="badge" style={{ backgroundColor: '#FEE2E2', color: '#991B1B', border: '1px solid #FECACA', fontSize: '0.75rem', fontWeight: 700, padding: '4px 8px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                                            <i className="bi bi-x-circle-fill" /> Out of Stock
                                                                        </span>
                                                                    )}
                                                                </td>
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

                        {/* ── BULK CATEGORY & SUBCATEGORY EDITOR TAB ── */}
                        {tab === 'bulk' && (
                            <div className="admin-panel">
                                <div className="admin-panel__header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                                    <div>
                                        <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
                                            <i className="bi bi-check2-square" style={{ color: 'var(--primary-color)' }} />
                                            Bulk Category & Subcategory Editor
                                        </h2>
                                        <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#6B7280' }}>
                                            Select multiple products across any category and reassign their Category and/or Subcategory in a single click.
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
                                            Category:
                                        </span>
                                        <input
                                            type="text"
                                            list="bulk-tab-cats"
                                            className="bulk-subcat-input"
                                            placeholder="Assign Category..."
                                            value={bulkCategoryInput}
                                            onChange={e => setBulkCategoryInput(e.target.value)}
                                            style={selectedProductIds.size === 0 ? { background: '#F8FAFC', color: '#1E293B', border: '1px solid #CBD5E1' } : {}}
                                        />
                                        <datalist id="bulk-tab-cats">
                                            {allUniqueCategories.map(cat => (
                                                <option key={cat} value={cat} />
                                            ))}
                                        </datalist>

                                        <span style={{ fontSize: '0.85rem', color: selectedProductIds.size > 0 ? '#CBD5E1' : '#475569', fontWeight: 600 }}>
                                            Subcategory:
                                        </span>
                                        <input
                                            type="text"
                                            list="bulk-tab-subcats"
                                            className="bulk-subcat-input"
                                            placeholder="Assign Subcategory..."
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
                                            disabled={bulkLoading || selectedProductIds.size === 0 || (!bulkCategoryInput.trim() && !bulkSubcategoryInput.trim())}
                                            onClick={handleApplyBulkChanges}
                                            style={{ fontWeight: 700 }}
                                        >
                                            <i className="bi bi-arrow-repeat" /> {bulkLoading ? 'Updating...' : `Assign to ${selectedProductIds.size} Selected`}
                                        </button>

                                        {selectedProductIds.size > 0 && (
                                            <button
                                                type="button"
                                                className="btn btn-outline-light btn-sm"
                                                onClick={() => {
                                                    setSelectedProductIds(new Set());
                                                    setBulkCategoryInput('');
                                                    setBulkSubcategoryInput('');
                                                }}
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
                                                        <td>
                                                            {p.in_stock !== false ? (
                                                                <span className="badge" style={{ backgroundColor: '#D1FAE5', color: '#065F46', border: '1px solid #A7F3D0', fontSize: '0.75rem', fontWeight: 700, padding: '4px 8px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                                    <i className="bi bi-check-circle-fill" /> In Stock
                                                                </span>
                                                            ) : (
                                                                <span className="badge" style={{ backgroundColor: '#FEE2E2', color: '#991B1B', border: '1px solid #FECACA', fontSize: '0.75rem', fontWeight: 700, padding: '4px 8px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                                    <i className="bi bi-x-circle-fill" /> Out of Stock
                                                                </span>
                                                            )}
                                                        </td>
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
                        {tab === 'orders' && (() => {
                            const unexportedOrders = orders.filter(o => !o.is_exported_to_vyapar);
                            const pendingOrders = orders.filter(o => o.status === 'pending_verification' || o.status === 'pending');
                            const readyOrders = orders.filter(o => o.status === 'processing' || o.status === 'confirmed');
                            const dispatchedOrders = orders.filter(o => o.status === 'dispatched');

                            const displayedOrders = orders.filter(o => {
                                if (orderFilter === 'pending' && o.status !== 'pending_verification' && o.status !== 'pending') return false;
                                if (orderFilter === 'ready' && o.status !== 'processing' && o.status !== 'confirmed') return false;
                                if (orderFilter === 'dispatched' && o.status !== 'dispatched') return false;
                                if (orderFilter === 'delivered' && o.status !== 'delivered') return false;
                                if (orderFilter === 'unexported' && o.is_exported_to_vyapar) return false;

                                if (orderSearchQuery.trim()) {
                                    const q = orderSearchQuery.toLowerCase().trim();
                                    const ship = typeof o.shipping_address === 'string' ? JSON.parse(o.shipping_address) : (o.shipping_address || {});
                                    const str = `${o.order_number || ''} ${o.customer_phone || ''} ${ship.phone || ''} ${o.customer_shop_name || ''} ${ship.shopName || ''} ${ship.firstName || ''} ${ship.lastName || ''} ${o.tracking_number || ''} ${o.utr_number || ''}`.toLowerCase();
                                    if (!str.includes(q)) return false;
                                }
                                return true;
                            });

                            return (
                                <div className="admin-panel" id="admin-orders-panel">
                                    {/* Panel Header & Vyapar Export Toolbar */}
                                    <div className="admin-panel__header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', marginBottom: '20px' }}>
                                        <div>
                                            <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <i className="bi bi-box-seam-fill" style={{ color: '#D97706' }} />
                                                Customer Orders ({orders.length})
                                            </h2>
                                            <p style={{ margin: '4px 0 0', color: '#6B7280', fontSize: '0.875rem' }}>
                                                Manage verification, DTDC / Shree Maruti shipping labels, and 1-click Vyapar app export.
                                            </p>
                                        </div>

                                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                                            <button 
                                                type="button" 
                                                className="btn btn-outline-secondary btn-sm"
                                                onClick={loadOrders}
                                                disabled={loading}
                                                title="Refresh orders from database"
                                            >
                                                <i className="bi bi-arrow-clockwise" /> Refresh
                                            </button>

                                            <button 
                                                type="button" 
                                                className="btn btn-sm"
                                                style={{ background: '#059669', color: '#FFFFFF', fontWeight: 700, padding: '8px 16px', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                                                onClick={() => handleExportToVyapar()}
                                                disabled={exportingVyapar || unexportedOrders.length === 0}
                                                title="Generate Excel/CSV file formatted specifically for Vyapar Sales Invoice import"
                                            >
                                                {exportingVyapar ? (
                                                    <>
                                                        <span className="spinner-border spinner-border-sm" />
                                                        Exporting...
                                                    </>
                                                ) : (
                                                    <>
                                                        <i className="bi bi-file-earmark-spreadsheet-fill" />
                                                        Export to Vyapar ({unexportedOrders.length} New)
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Search & Filter Bar */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', background: '#F9FAFB', padding: '14px', borderRadius: '10px', border: '1px solid #E5E7EB', marginBottom: '18px' }}>
                                        {/* Status Filter Pills */}
                                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                            {[
                                                { id: 'all', label: `All (${orders.length})` },
                                                { id: 'pending', label: `⏳ Pending Payment (${pendingOrders.length})` },
                                                { id: 'ready', label: `⚙️ Ready to Dispatch (${readyOrders.length})` },
                                                { id: 'dispatched', label: `🚚 Dispatched (${dispatchedOrders.length})` },
                                                { id: 'unexported', label: `📥 Vyapar Unexported (${unexportedOrders.length})` }
                                            ].map(filter => (
                                                <button
                                                    key={filter.id}
                                                    type="button"
                                                    onClick={() => setOrderFilter(filter.id)}
                                                    style={{
                                                        padding: '5px 12px',
                                                        borderRadius: '999px',
                                                        border: orderFilter === filter.id ? '2px solid #D97706' : '1px solid #D1D5DB',
                                                        background: orderFilter === filter.id ? '#FEF3C7' : '#FFFFFF',
                                                        color: orderFilter === filter.id ? '#92400E' : '#374151',
                                                        fontWeight: orderFilter === filter.id ? 800 : 500,
                                                        fontSize: '0.8125rem',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    {filter.label}
                                                </button>
                                            ))}
                                        </div>

                                        {/* Search Input */}
                                        <div style={{ minWidth: '260px' }}>
                                            <input 
                                                type="text"
                                                className="form-control form-control-sm"
                                                placeholder="Search Order #, phone, shop, UTR..."
                                                value={orderSearchQuery}
                                                onChange={(e) => setOrderSearchQuery(e.target.value)}
                                                style={{ borderRadius: '6px' }}
                                            />
                                        </div>
                                    </div>

                                    {/* Orders Table */}
                                    <div className="table-responsive">
                                        <table className="admin-table">
                                            <thead>
                                                <tr>
                                                    <th>Order Number</th>
                                                    <th>Customer & Phone</th>
                                                    <th>Total</th>
                                                    <th>Payment & UTR</th>
                                                    <th>Shipping & Courier</th>
                                                    <th>Vyapar Sync</th>
                                                    <th>Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {displayedOrders.length === 0 ? (
                                                    <tr>
                                                        <td colSpan="7" style={{ textAlign: 'center', padding: '36px', color: '#9CA3AF' }}>
                                                            <i className="bi bi-inbox" style={{ fontSize: '2rem', display: 'block', marginBottom: '8px' }} />
                                                            No orders found matching the filter.
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    displayedOrders.map(o => {
                                                        const shipping = typeof o.shipping_address === 'string' ? JSON.parse(o.shipping_address) : (o.shipping_address || {});
                                                        const customerName = o.customer_shop_name || shipping.shopName || shipping.name || `${shipping.firstName || ''} ${shipping.lastName || ''}`.trim() || 'Guest';
                                                        const customerPhone = o.customer_phone || shipping.phone || '';
                                                        const customerCity = o.customer_city || shipping.city || '';

                                                        return (
                                                            <tr key={o.id}>
                                                                {/* Order Number & Date */}
                                                                <td>
                                                                    <strong style={{ fontFamily: 'monospace', color: '#111827', fontSize: '0.9375rem' }}>
                                                                        {o.order_number}
                                                                    </strong>
                                                                    <div style={{ fontSize: '0.75rem', color: '#9CA3AF', marginTop: '2px' }}>
                                                                        {new Date(o.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                                    </div>
                                                                </td>

                                                                {/* Customer Details */}
                                                                <td>
                                                                    <div style={{ fontWeight: 700, color: '#1F2937' }}>
                                                                        {customerName}
                                                                    </div>
                                                                    {customerPhone && (
                                                                        <div style={{ fontSize: '0.8125rem', color: '#4B5563' }}>
                                                                            <i className="bi bi-telephone-fill" style={{ fontSize: '0.75rem', marginRight: '4px', color: '#D97706' }} />
                                                                            +91 {customerPhone}
                                                                        </div>
                                                                    )}
                                                                    {customerCity && (
                                                                        <div style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>
                                                                            {customerCity}
                                                                        </div>
                                                                    )}
                                                                </td>

                                                                {/* Total */}
                                                                <td>
                                                                    <strong style={{ color: '#B45309', fontSize: '0.95rem' }}>
                                                                        ₹{o.total}
                                                                    </strong>
                                                                    <div style={{ fontSize: '0.75rem', color: '#6B7280' }}>
                                                                        {o.payment_method || 'UPI'}
                                                                    </div>
                                                                </td>

                                                                {/* Payment & Status */}
                                                                <td>
                                                                    {(o.status === 'pending_verification' || o.status === 'pending') ? (
                                                                        <div>
                                                                            <span style={{ background: '#FEF3C7', color: '#92400E', fontSize: '0.75rem', fontWeight: 800, padding: '2px 8px', borderRadius: '4px', display: 'inline-block', marginBottom: '4px' }}>
                                                                                ⏳ Pending Verification
                                                                            </span>
                                                                            {o.utr_number && (
                                                                                <div style={{ fontSize: '0.75rem', color: '#1F2937' }}>
                                                                                    UTR: <code>{o.utr_number}</code>
                                                                                </div>
                                                                            )}
                                                                            <button 
                                                                                type="button" 
                                                                                className="btn btn-sm"
                                                                                style={{ background: '#059669', color: '#FFFFFF', padding: '3px 8px', fontSize: '0.75rem', fontWeight: 700, borderRadius: '4px', marginTop: '4px', display: 'block' }}
                                                                                onClick={() => handleApprovePayment(o.id)}
                                                                            >
                                                                                <i className="bi bi-check-lg" /> Approve
                                                                            </button>
                                                                        </div>
                                                                    ) : (
                                                                        <div>
                                                                            <span style={{ background: '#E0F2FE', color: '#0369A1', fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', display: 'inline-block' }}>
                                                                                ✓ {o.status?.toUpperCase()}
                                                                            </span>
                                                                            {o.utr_number && (
                                                                                <div style={{ fontSize: '0.72rem', color: '#6B7280', marginTop: '2px' }}>
                                                                                    UTR: {o.utr_number}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </td>

                                                                {/* Shipping & Courier */}
                                                                <td>
                                                                    {o.tracking_number ? (
                                                                        <div>
                                                                            <span style={{ background: '#FFFBEB', border: '1px solid #FCD34D', color: '#78350F', fontSize: '0.75rem', fontWeight: 800, padding: '2px 6px', borderRadius: '4px' }}>
                                                                                {o.courier_name || 'Courier'}
                                                                            </span>
                                                                            <div style={{ fontSize: '0.8125rem', fontFamily: 'monospace', fontWeight: 700, color: '#111827', marginTop: '3px' }}>
                                                                                {o.tracking_number}
                                                                            </div>
                                                                            {o.status === 'dispatched' && (
                                                                                <button 
                                                                                    type="button"
                                                                                    className="btn btn-link btn-sm"
                                                                                    style={{ padding: 0, fontSize: '0.75rem', color: '#059669', fontWeight: 700, textDecoration: 'none', display: 'block', marginTop: '2px' }}
                                                                                    onClick={() => handleMarkDelivered(o.id)}
                                                                                >
                                                                                    ✓ Mark Delivered
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    ) : (
                                                                        <button 
                                                                            type="button" 
                                                                            className="btn btn-sm btn-outline-warning"
                                                                            style={{ padding: '3px 8px', fontSize: '0.75rem', fontWeight: 700 }}
                                                                            onClick={() => openDispatchModal(o)}
                                                                        >
                                                                            <i className="bi bi-truck" /> Dispatch
                                                                        </button>
                                                                    )}
                                                                </td>

                                                                {/* Vyapar Sync */}
                                                                <td>
                                                                    {o.is_exported_to_vyapar ? (
                                                                        <span style={{ background: '#D1FAE5', color: '#065F46', fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', borderRadius: '4px' }}>
                                                                            ✓ Exported
                                                                        </span>
                                                                    ) : (
                                                                        <span style={{ background: '#F3F4F6', color: '#6B7280', fontSize: '0.75rem', fontWeight: 600, padding: '2px 8px', borderRadius: '4px' }}>
                                                                            Unexported
                                                                        </span>
                                                                    )}
                                                                </td>

                                                                {/* Actions */}
                                                                <td>
                                                                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                                                        <button 
                                                                            type="button"
                                                                            className="btn btn-sm"
                                                                            style={{ background: '#25D366', color: '#FFFFFF', padding: '4px 8px', fontSize: '0.8125rem', borderRadius: '4px' }}
                                                                            onClick={() => handleWhatsAppOrder(o)}
                                                                            title="Send WhatsApp update to customer"
                                                                        >
                                                                            <i className="bi bi-whatsapp" />
                                                                        </button>
                                                                        <button 
                                                                            type="button"
                                                                            className="btn btn-sm btn-outline-dark" 
                                                                            onClick={() => openPrintLabelModal(o)}
                                                                            style={{ padding: '4px 8px', fontSize: '0.8125rem' }}
                                                                            title="Print Courier Shipping Label (TO & FROM)"
                                                                        >
                                                                            <i className="bi bi-printer" /> Label
                                                                        </button>
                                                                        <button 
                                                                            type="button"
                                                                            className="btn btn-sm btn-primary" 
                                                                            onClick={() => openOrderModal(o.id)}
                                                                            style={{ padding: '4px 8px', fontSize: '0.8125rem' }}
                                                                        >
                                                                            <i className="bi bi-gear" /> Manage
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            );
                        })()}


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
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F8FAFC', padding: '16px 20px', borderRadius: '10px', border: '1px solid #E2E8F0', marginBottom: 20 }}>
                                <div>
                                    <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1E293B', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <i className="bi bi-box-seam" style={{ color: 'var(--cta)', fontSize: '1.1rem' }} /> Availability Status
                                    </span>
                                    <span style={{ fontSize: '0.8rem', color: '#64748B', marginTop: '2px', display: 'block' }}>
                                        Toggle whether this item is currently available for purchase
                                    </span>
                                </div>
                                <div className="form-check form-switch" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <input 
                                        type="checkbox" 
                                        id="stockCheck" 
                                        className="form-check-input" 
                                        role="switch"
                                        checked={Boolean(productForm.in_stock)} 
                                        onChange={e => {
                                            const checked = e.target.checked;
                                            setProductForm({ 
                                                ...productForm, 
                                                in_stock: checked,
                                                stock_quantity: checked ? 9999 : 0
                                            });
                                        }} 
                                        style={{ width: '40px', height: '22px', cursor: 'pointer' }}
                                    />
                                    <label htmlFor="stockCheck" className="form-check-label" style={{ fontWeight: 800, fontSize: '0.95rem', cursor: 'pointer', color: productForm.in_stock ? '#059669' : '#DC2626' }}>
                                        {productForm.in_stock ? 'In Stock' : 'Out of Stock'}
                                    </label>
                                </div>
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

                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 15, flexWrap: 'wrap', gap: '10px' }}>
                                        <div>
                                            {(() => {
                                                const ship = typeof selectedOrder.shipping_address === 'string' ? JSON.parse(selectedOrder.shipping_address) : (selectedOrder.shipping_address || {});
                                                const custName = selectedOrder.customer_shop_name || ship.shopName || ship.name || `${ship.firstName || ''} ${ship.lastName || ''}`.trim();
                                                const custPhone = selectedOrder.customer_phone || ship.phone || '';
                                                return (
                                                    <>
                                                        <p style={{ margin: '0 0 5px 0' }}><strong>Customer:</strong> {custName} {custPhone ? `(+91 ${custPhone})` : ''}</p>
                                                        <p style={{ margin: '0 0 5px 0' }}><strong>Payment:</strong> {selectedOrder.payment_method?.toUpperCase()}
                                                            <span style={{ 
                                                                marginLeft: 6, 
                                                                background: selectedOrder.status === 'pending_verification' ? '#FEF3C7' : '#DCFCE7',
                                                                color: selectedOrder.status === 'pending_verification' ? '#92400E' : '#15803D',
                                                                padding: '2px 8px',
                                                                borderRadius: '4px',
                                                                fontSize: '0.75rem',
                                                                fontWeight: 700
                                                            }}>
                                                                {selectedOrder.status === 'pending_verification' ? 'Pending Verification' : 'Verified / Confirmed'}
                                                            </span>
                                                        </p>
                                                        <p style={{ margin: '0 0 5px 0' }}><strong>UTR / Ref Number:</strong> <code>{selectedOrder.utr_number || selectedOrder.payment_id || 'N/A'}</code></p>
                                                        {selectedOrder.tracking_number && (
                                                            <p style={{ margin: '0 0 5px 0' }}>
                                                                <strong>Courier:</strong> <span style={{ color: '#92400E', fontWeight: 700 }}>{selectedOrder.courier_name || 'Courier'}</span> ({selectedOrder.tracking_number})
                                                            </p>
                                                        )}
                                                        <p style={{ margin: 0 }}><strong>Date:</strong> {new Date(selectedOrder.created_at).toLocaleString()}</p>
                                                    </>
                                                );
                                            })()}
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <p style={{ margin: '0 0 5px 0' }}>Subtotal: ₹{selectedOrder.subtotal}</p>
                                            {selectedOrder.discount > 0 && <p style={{ margin: '0 0 5px 0', color: 'green' }}>Discount: -₹{selectedOrder.discount}</p>}
                                            <p style={{ margin: '0 0 5px 0' }}>Delivery: {selectedOrder.delivery_fee ? `₹${selectedOrder.delivery_fee}` : 'Free'}</p>
                                            <p style={{ margin: 0, fontWeight: 'bold', fontSize: '1.2rem', color: '#B45309' }}>Total: ₹{selectedOrder.total}</p>
                                        </div>
                                    </div>

                                    {/* Action Shortcuts */}
                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', paddingTop: '10px', borderTop: '1px solid #E2E8F0', marginTop: '10px' }}>
                                        {selectedOrder.status === 'pending_verification' && (
                                            <button 
                                                type="button" 
                                                className="btn btn-sm"
                                                style={{ background: '#059669', color: '#FFFFFF', fontWeight: 700 }}
                                                onClick={() => handleApprovePayment(selectedOrder.id)}
                                            >
                                                <i className="bi bi-check-lg" /> Approve Payment
                                            </button>
                                        )}

                                        <button 
                                            type="button" 
                                            className="btn btn-sm btn-outline-warning"
                                            style={{ fontWeight: 700 }}
                                            onClick={() => openDispatchModal(selectedOrder)}
                                        >
                                            <i className="bi bi-truck" /> {selectedOrder.tracking_number ? 'Update Courier Tracking' : 'Dispatch via Courier'}
                                        </button>

                                        <button 
                                            type="button" 
                                            className="btn btn-sm"
                                            style={{ background: '#25D366', color: '#FFFFFF', fontWeight: 700 }}
                                            onClick={() => handleWhatsAppOrder(selectedOrder)}
                                        >
                                            <i className="bi bi-whatsapp" /> WhatsApp Customer
                                        </button>

                                        <button 
                                            type="button" 
                                            className="btn btn-sm btn-outline-dark"
                                            style={{ fontWeight: 700 }}
                                            onClick={() => openPrintLabelModal(selectedOrder)}
                                        >
                                            <i className="bi bi-printer-fill" /> Print Shipping Label
                                        </button>

                                        <a 
                                            href={`/track/${selectedOrder.order_number}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="btn btn-sm btn-outline-secondary"
                                        >
                                            <i className="bi bi-box-arrow-up-right" /> Customer Tracking Page
                                        </a>
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

            {/* ── QUICK COURIER DISPATCH MODAL ── */}
            {dispatchModalOrder && createPortal(
                <div 
                    className="admin-modal-overlay" 
                    onClick={(e) => { if (e.target === e.currentTarget) setDispatchModalOrder(null) }}
                >
                    <div className="admin-modal" style={{ maxWidth: '520px' }} onClick={(e) => e.stopPropagation()}>
                        <div className="admin-modal__head">
                            <h3>
                                <i className="bi bi-truck" style={{ color: '#D97706', marginRight: '8px' }} />
                                Dispatch: {dispatchModalOrder.order_number}
                            </h3>
                            <button className="close-btn" onClick={() => setDispatchModalOrder(null)}>
                                <i className="bi bi-x-lg" />
                            </button>
                        </div>
                        <form className="admin-modal__body" onSubmit={handleSaveDispatch}>
                            {(() => {
                                const ship = typeof dispatchModalOrder.shipping_address === 'string' ? JSON.parse(dispatchModalOrder.shipping_address) : (dispatchModalOrder.shipping_address || {});
                                const name = dispatchModalOrder.customer_shop_name || ship.shopName || ship.name || `${ship.firstName || ''} ${ship.lastName || ''}`.trim();
                                const phone = dispatchModalOrder.customer_phone || ship.phone || '';
                                const addr = `${dispatchModalOrder.customer_address || ship.address || ''}, ${dispatchModalOrder.customer_city || ship.city || ''} (${dispatchModalOrder.customer_pincode || ship.pincode || ''})`.trim();
                                return (
                                    <div style={{ background: '#FFFBEB', padding: '14px', borderRadius: '8px', border: '1px solid #FCD34D', marginBottom: '16px' }}>
                                        <div style={{ fontWeight: 700, color: '#92400E' }}>
                                            Customer: {name} {phone ? `(+91 ${phone})` : ''}
                                        </div>
                                        <div style={{ fontSize: '0.85rem', color: '#78350F', marginTop: '4px' }}>
                                            Deliver to: {addr}
                                        </div>
                                    </div>
                                );
                            })()}

                            <div className="form-group mb-3">
                                <label style={{ fontWeight: 700 }}>Select Courier Partner *</label>
                                <select 
                                    className="form-control"
                                    value={dispatchForm.courier_name}
                                    onChange={(e) => setDispatchForm({ ...dispatchForm, courier_name: e.target.value })}
                                    required
                                >
                                    <option value="DTDC">DTDC Courier</option>
                                    <option value="Shree Maruti">Shree Maruti Courier</option>
                                    <option value="Delhivery">Delhivery</option>
                                    <option value="Other">Other Courier</option>
                                </select>
                            </div>

                            <div className="form-group mb-3">
                                <label style={{ fontWeight: 700 }}>Consignment / Tracking Number *</label>
                                <input 
                                    type="text" 
                                    className="form-control"
                                    placeholder="e.g. D12345678 or SMC98765432"
                                    value={dispatchForm.tracking_number}
                                    onChange={(e) => setDispatchForm({ ...dispatchForm, tracking_number: e.target.value })}
                                    required
                                    autoFocus
                                    style={{ fontSize: '1.05rem', fontWeight: 700, letterSpacing: '0.5px' }}
                                />
                                <small className="form-text text-muted" style={{ display: 'block', marginTop: '4px' }}>
                                    This tracking number will automatically generate live tracking deep-links on your website.
                                </small>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                                <button 
                                    type="button" 
                                    className="btn btn-outline-secondary"
                                    onClick={() => setDispatchModalOrder(null)}
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    className="btn btn-primary"
                                    style={{ background: '#D97706', borderColor: '#D97706', fontWeight: 700 }}
                                >
                                    <i className="bi bi-check2-circle" /> Save & Mark Dispatched
                                </button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}

            {/* ── COURIER SHIPPING LABEL (TO & FROM) PRINT MODAL ── */}
            {printLabelOrder && createPortal(
                <div 
                    className="admin-modal-overlay" 
                    style={{ overflowY: 'auto', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    onClick={(e) => { if (e.target === e.currentTarget) setPrintLabelOrder(null) }}
                >
                    <div 
                        className="admin-modal" 
                        style={{ 
                            maxWidth: '560px', 
                            width: '100%',
                            maxHeight: '90vh', 
                            display: 'flex', 
                            flexDirection: 'column', 
                            borderRadius: '16px',
                            overflow: 'hidden',
                            boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
                            margin: 'auto'
                        }} 
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Pinned Modal Header */}
                        <div className="admin-modal__head no-print" style={{ flexShrink: 0, padding: '14px 20px', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <i className="bi bi-printer-fill" style={{ color: '#D97706' }} />
                                Courier Shipping Label (TO & FROM)
                            </h3>
                            <button className="close-btn" onClick={() => setPrintLabelOrder(null)}>
                                <i className="bi bi-x-lg" />
                            </button>
                        </div>

                        {/* Scrollable Modal Body */}
                        <div className="admin-modal__body" style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', padding: '16px 20px', background: '#F8FAFC' }}>
                            {/* Printable Label Box */}
                            <div className="shipping-label-printable" id="printable-shipping-label" style={{
                                background: '#FFFFFF',
                                border: '2px solid #111827',
                                borderRadius: '8px',
                                padding: '16px',
                                color: '#111827',
                                fontFamily: 'Arial, sans-serif',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.06)'
                            }}>
                                {/* Header */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #111827', paddingBottom: '10px', marginBottom: '12px' }}>
                                    <div>
                                        <div style={{ fontSize: '1.25rem', fontWeight: 900, letterSpacing: '0.5px' }}>
                                            SMILEY N TRADERS
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: '#4B5563', textTransform: 'uppercase', fontWeight: 700 }}>
                                            Automotive Key Blanks, Flip Keys & Remotes
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ background: '#111827', color: '#FFFFFF', padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 800 }}>
                                            {printLabelOrder.courier_name ? printLabelOrder.courier_name.toUpperCase() : 'PREPAID PARCEL'}
                                        </div>
                                        <div style={{ fontSize: '0.8125rem', fontWeight: 700, fontFamily: 'monospace', marginTop: '4px' }}>
                                            {printLabelOrder.order_number}
                                        </div>
                                    </div>
                                </div>

                                {/* Consignment Barcode / Tracking Number if present */}
                                {printLabelOrder.tracking_number && (
                                    <div style={{ background: '#F3F4F6', padding: '6px 10px', borderRadius: '6px', marginBottom: '12px', border: '1px dashed #9CA3AF', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase' }}>
                                            {printLabelOrder.courier_name || 'Courier'} AWB / Consignment No:
                                        </span>
                                        <code style={{ fontSize: '1.1rem', fontWeight: 900, color: '#111827' }}>
                                            {printLabelOrder.tracking_number}
                                        </code>
                                    </div>
                                )}

                                {/* TO SECTION (Large, High Contrast) */}
                                {(() => {
                                    const ship = typeof printLabelOrder.shipping_address === 'string' ? JSON.parse(printLabelOrder.shipping_address) : (printLabelOrder.shipping_address || {});
                                    const recipientName = printLabelOrder.customer_shop_name || ship.shopName || ship.name || `${ship.firstName || ''} ${ship.lastName || ''}`.trim() || 'Customer';
                                    const contactPerson = ship.firstName ? `${ship.firstName} ${ship.lastName || ''}`.trim() : '';
                                    const phone = printLabelOrder.customer_phone || ship.phone || '';
                                    const address = printLabelOrder.customer_address || ship.address || '';
                                    const city = printLabelOrder.customer_city || ship.city || '';
                                    const state = printLabelOrder.customer_state || ship.state || '';
                                    const pincode = printLabelOrder.customer_pincode || ship.pincode || '';

                                    return (
                                        <>
                                            <div style={{ border: '2px solid #111827', borderRadius: '6px', padding: '12px', marginBottom: '12px' }}>
                                                <div style={{ fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#4B5563', borderBottom: '1px solid #E5E7EB', paddingBottom: '4px', marginBottom: '8px' }}>
                                                    DELIVER TO (Consignee):
                                                </div>
                                                <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#000000' }}>
                                                    {recipientName}
                                                </div>
                                                {contactPerson && contactPerson !== recipientName && (
                                                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginTop: '2px' }}>
                                                        Attn: {contactPerson}
                                                    </div>
                                                )}
                                                <div style={{ fontSize: '1rem', lineHeight: '1.4', marginTop: '6px', fontWeight: 600, color: '#111827' }}>
                                                    {address}
                                                </div>
                                                <div style={{ fontSize: '1.15rem', fontWeight: 900, marginTop: '4px', color: '#000000' }}>
                                                    {city ? `${city}, ` : ''}{state ? `${state} ` : ''}- {pincode}
                                                </div>
                                                <div style={{ marginTop: '8px', paddingTop: '6px', borderTop: '1px dashed #D1D5DB', fontSize: '1.15rem', fontWeight: 900, color: '#000000' }}>
                                                    📞 PHONE: +91 {phone}
                                                </div>
                                            </div>

                                            {/* FROM SECTION */}
                                            <div style={{ border: '1px solid #6B7280', borderRadius: '6px', padding: '8px 10px', marginBottom: '12px', background: '#FAFAFA' }}>
                                                <div style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: '#4B5563', marginBottom: '4px' }}>
                                                    IF UNDELIVERED, RETURN TO (Consignor / Sender):
                                                </div>
                                                <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#111827' }}>
                                                    SMILEY N TRADERS
                                                </div>
                                                <div style={{ fontSize: '0.8125rem', color: '#374151', lineHeight: '1.3' }}>
                                                    Automotive Spare Parts & Key Blank Hub, India
                                                </div>
                                                <div style={{ fontSize: '0.875rem', fontWeight: 800, marginTop: '4px', color: '#111827' }}>
                                                    📞 PHONE: +91 81787 68308
                                                </div>
                                            </div>
                                        </>
                                    );
                                })()}

                                {/* Footer Info & Tracking QR */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #111827', paddingTop: '8px' }}>
                                    <div style={{ fontSize: '0.78rem', color: '#374151', lineHeight: 1.4 }}>
                                        <div><strong>Total Items:</strong> {printLabelOrder.order_items?.length || 1} item(s)</div>
                                        <div><strong>Payment Mode:</strong> {printLabelOrder.payment_method || 'Prepaid'} (₹{printLabelOrder.total})</div>
                                        <div><strong>Date:</strong> {new Date(printLabelOrder.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                                    </div>

                                    <div style={{ textAlign: 'center' }}>
                                        <QRCode 
                                            value={`${window.location.origin}/track/${printLabelOrder.order_number}`}
                                            size={54}
                                            style={{ height: '54px', width: '54px' }}
                                            viewBox="0 0 54 54"
                                        />
                                        <div style={{ fontSize: '0.625rem', color: '#6B7280', marginTop: '2px', fontWeight: 700 }}>
                                            SCAN TO TRACK
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Pinned Action Footer */}
                        <div className="no-print" style={{ flexShrink: 0, padding: '12px 20px', background: '#FFFFFF', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                            <button 
                                type="button" 
                                className="btn btn-outline-secondary" 
                                onClick={() => setPrintLabelOrder(null)}
                            >
                                Close
                            </button>
                            <button 
                                type="button" 
                                className="btn btn-primary"
                                style={{ background: '#111827', borderColor: '#111827', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                                onClick={handlePrintShippingLabel}
                            >
                                <i className="bi bi-printer-fill" /> Print / Save as PDF
                            </button>
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
