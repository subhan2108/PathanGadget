import React, { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { useProducts, useFilterMeta, useCategories } from '../hooks/useProducts'
import { formatPrice } from '../lib/productsService'
import { ProductCard } from '@/components/ui/product-card-2'
import './ProductsPage.css'

/* ─── Constants ────────────────────────────────── */
const CATEGORY_ICONS = {
    'Xhorse Smart Key': 'bi-key-fill',
    'xhorse smart key': 'bi-key-fill',
    'Xhorse Wireless Remote': 'bi-broadcast',
    'xhorse wireless remote': 'bi-broadcast',
    'Xhorse Wire Remote': 'bi-key',
    'xhorse wire remote': 'bi-key',
    'Xhorse Super Remote': 'bi-cpu-fill',
    'xhorse super remote': 'bi-cpu-fill',
    'xhorse-super-remote': 'bi-cpu-fill',
    'Car Remote': 'bi-car-front-fill',
    'car remote': 'bi-car-front-fill',
    'car-remote': 'bi-car-front-fill',
    'Transponder Shell': 'bi-key-fill',
    'transponder shell': 'bi-key-fill',
    'transponder-shell': 'bi-key-fill',
    'ID Chip': 'bi-cpu-fill',
    'id chip': 'bi-cpu-fill',
    'id-chip': 'bi-cpu-fill',
    'KEYDIY UNIVERSAL REMOTE': 'bi-cpu',
    'Remote Shell': 'bi-shield-check',
    'Key Cover': 'bi-shield-shaded',
    'key cover': 'bi-shield-shaded',
    'key-cover': 'bi-shield-shaded',
    'Domestic Keys': 'bi-house-lock',
    'domestic keys': 'bi-house-lock',
    'domestic-keys': 'bi-house-lock',
    'Remote Batteries': 'bi-battery-charging',
    'remote batteries': 'bi-battery-charging',
    'remote-batteries': 'bi-battery-charging',
    'Flip Blades': 'bi-slash-square',
    'flip blades': 'bi-slash-square',
    'flip-blades': 'bi-slash-square',
    'Keypads': 'bi-grid-3x3',
    'keypads': 'bi-grid-3x3',
    'key-pads': 'bi-grid-3x3',
    '2-Wheeler Keys': 'bi-bicycle',
    'Automotive Key Blanks': 'bi-key',
    'Car Accessories': 'bi-car-front',
    'Car Lighting': 'bi-lightbulb-fill',
    'Xhorse Products': 'bi-broadcast',
    'Keychains': 'bi-link-45deg',
    'Car Fragrance': 'bi-droplet-fill',
    'Locksmith Tools': 'bi-tools',
    'Car Electronics': 'bi-camera-video',
    'Smart Keys': 'bi-key-fill',
    'KeyDIY Products': 'bi-cpu',
    'Transponder Chips': 'bi-memory',
    'Car Care & Accessories': 'bi-stars',
    Remote: 'bi-key',
}

const getCategoryIcon = (id = '', name = '') => {
    if (CATEGORY_ICONS[id]) return CATEGORY_ICONS[id]
    const key = `${id} ${name}`.toLowerCase()
    if (key.includes('pad')) return 'bi-grid-3x3'
    if (key.includes('blade')) return 'bi-slash-square'
    if (key.includes('batter')) return 'bi-battery-charging'
    if (key.includes('domestic') || key.includes('house')) return 'bi-house-lock'
    if (key.includes('cover')) return 'bi-shield-shaded'
    if (key.includes('bike') || key.includes('wheeler')) return 'bi-bicycle'
    if (key.includes('light') || key.includes('led') || key.includes('lamp')) return 'bi-lightbulb-fill'
    if (key.includes('fragrance') || key.includes('perfume')) return 'bi-droplet-fill'
    if (key.includes('chain')) return 'bi-link-45deg'
    if (key.includes('tool')) return 'bi-tools'
    if (key.includes('camera') || key.includes('electronic')) return 'bi-camera-video'
    if (key.includes('watch')) return 'bi-smartwatch'
    if (key.includes('airpod') || key.includes('earbud')) return 'bi-earbuds'
    if (key.includes('headphone') || key.includes('audio')) return 'bi-headphones'
    if (key.includes('phone') || key.includes('mobile')) return 'bi-phone'
    if (key.includes('remote') || key.includes('key')) return 'bi-key'
    if (key.includes('shell')) return 'bi-shield-check'
    if (key.includes('chip') || key.includes('transponder')) return 'bi-memory'
    if (key.includes('cable') || key.includes('charger')) return 'bi-lightning-charge'
    return 'bi-tag'
}

const COLOR_MAP = {
    Black: '#1a1a2e',
    White: '#f5f5f5',
    Silver: '#c0c0c0',
    Blue: '#2EA8FF',
    'Rose Gold': '#b76e79',
    Green: '#10B981',
    Red: '#EF4444',
    Pink: '#F472B6',
}

const SORT_OPTIONS = [
    { value: 'featured', label: 'Featured' },
    { value: 'price-asc', label: 'Price: Low to High' },
    { value: 'price-desc', label: 'Price: High to Low' },
    { value: 'rating', label: 'Top Rated' },
    { value: 'reviews', label: 'Most Reviewed' },
    { value: 'discount', label: 'Best Discount' },
]

// Colors/Brands bounds are now fetched live from Supabase via useFilterMeta()

/* ─── Main Page ─────────────────────────────────── */
/* ── Reusable, stable Filter Sidebar Content (Defined outside to preserve scroll position on mobile) ── */
function FilterSidebarContent({
    isDropdown = false,
    activeFilterCount,
    resetFilters,
    setSidebarOpen,
    ALL_COLORS,
    selectedColors,
    onToggleColor,
    ALL_BRANDS,
    selectedBrands,
    onToggleBrand,
    ALL_SUBCATEGORIES = [],
    selectedSubcategories = [],
    onToggleSubcategory,
    inStockOnly,
    onInStockOnly,
    filteredCount,
    COLOR_MAP,
}) {
    const [brandSearch, setBrandSearch] = useState('')
    const [subcatSearch, setSubcatSearch] = useState('')

    const visibleBrands = React.useMemo(() => {
        if (!brandSearch.trim()) return ALL_BRANDS
        const term = brandSearch.toLowerCase()
        return ALL_BRANDS.filter(b => b.toLowerCase().includes(term))
    }, [ALL_BRANDS, brandSearch])

    const visibleSubcategories = React.useMemo(() => {
        if (!subcatSearch.trim()) return ALL_SUBCATEGORIES
        const term = subcatSearch.toLowerCase()
        return ALL_SUBCATEGORIES.filter(s => s.toLowerCase().includes(term))
    }, [ALL_SUBCATEGORIES, subcatSearch])

    return (
        <div className={`plp-filter-content ${isDropdown ? 'plp-filter-dropdown-content' : 'plp-sidebar__panel'}`}>
            <div className="plp-sidebar__header">
                <h3><i className="bi bi-funnel-fill" /> Filters</h3>
                <div className="sidebar-header-actions">
                    {activeFilterCount > 0 && (
                        <button className="clear-btn" onClick={resetFilters}>
                            <i className="bi bi-x-circle" /> Clear All ({activeFilterCount})
                        </button>
                    )}
                    {isDropdown && (
                        <button className="sidebar-close-btn" onClick={() => setSidebarOpen(false)} aria-label="Close filters">
                            <i className="bi bi-x-lg" />
                        </button>
                    )}
                </div>
            </div>

            <div className={isDropdown ? "plp-dropdown-scrollable" : "plp-sidebar-body"}>
                {/* Colors */}
                {ALL_COLORS && ALL_COLORS.length > 0 && (
                    <div className="filter-section">
                        <h4 className="filter-section__title">
                            <i className="bi bi-palette" /> Color
                        </h4>
                        <div className="color-filter-grid">
                            {ALL_COLORS.map(color => (
                                <button
                                    key={color}
                                    type="button"
                                    id={`cf-${color.replace(/\s+/g, '-').toLowerCase()}`}
                                    className={`color-filter-item ${selectedColors.includes(color) ? 'active' : ''}`}
                                    onClick={() => onToggleColor(color)}
                                    title={color}
                                >
                                    <span className="cf-swatch" style={{ background: COLOR_MAP[color] || '#888' }} />
                                    <span className="cf-label">{color}</span>
                                    {selectedColors.includes(color) && <i className="bi bi-check cf-check" />}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Brands (alphabetically sorted, searchable) */}
                <div className="filter-section">
                    <div className="filter-section__header-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                        <h4 className="filter-section__title" style={{ margin: 0 }}>
                            <i className="bi bi-building" /> Brand
                        </h4>
                        {selectedBrands.length > 0 && (
                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--cta)', background: 'rgba(184, 132, 36, 0.1)', padding: '2px 8px', borderRadius: 12 }}>
                                {selectedBrands.length} selected
                            </span>
                        )}
                    </div>

                    {ALL_BRANDS.length > 8 && (
                        <div className="brand-search-box" style={{ position: 'relative', marginBottom: 8 }}>
                            <i className="bi bi-search" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: '0.75rem', color: '#888' }} />
                            <input
                                type="text"
                                className="brand-search-input"
                                placeholder="Search brands..."
                                value={brandSearch}
                                onChange={e => setBrandSearch(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '6px 28px 6px 28px',
                                    borderRadius: 6,
                                    border: '1px solid var(--border)',
                                    fontSize: '0.8125rem',
                                    background: 'var(--neutral-bg, #f9fafb)',
                                    outline: 'none'
                                }}
                            />
                            {brandSearch && (
                                <button
                                    type="button"
                                    onClick={() => setBrandSearch('')}
                                    style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: '0.875rem', padding: 0 }}
                                    aria-label="Clear brand search"
                                >
                                    <i className="bi bi-x" />
                                </button>
                            )}
                        </div>
                    )}

                    <div className="brand-filter-list" style={{ maxHeight: '240px', overflowY: 'auto', paddingRight: '4px' }}>
                        {visibleBrands.length === 0 ? (
                            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', padding: '8px 0', textAlign: 'center' }}>
                                No brands match "{brandSearch}"
                            </div>
                        ) : (
                            visibleBrands.map(brand => (
                                <label key={brand} className={`brand-filter-item ${selectedBrands.includes(brand) ? 'active' : ''}`} id={`bf-${brand.toLowerCase()}`}>
                                    <input
                                        type="checkbox"
                                        checked={selectedBrands.includes(brand)}
                                        onChange={() => onToggleBrand(brand)}
                                    />
                                    <span className="bf-box" />
                                    <span className="bf-label">{brand}</span>
                                </label>
                            ))
                        )}
                    </div>
                </div>

                {/* Subcategories (filtered by active category or all, searchable) */}
                {ALL_SUBCATEGORIES.length > 0 && (
                    <div className="filter-section">
                        <div className="filter-section__header-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                            <h4 className="filter-section__title" style={{ margin: 0 }}>
                                <i className="bi bi-diagram-3" /> Subcategory
                            </h4>
                            {selectedSubcategories.length > 0 && (
                                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--cta)', background: 'rgba(184, 132, 36, 0.1)', padding: '2px 8px', borderRadius: 12 }}>
                                    {selectedSubcategories.length} selected
                                </span>
                            )}
                        </div>

                        {ALL_SUBCATEGORIES.length > 5 && (
                            <div className="brand-search-box" style={{ position: 'relative', marginBottom: 8 }}>
                                <i className="bi bi-search" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: '0.75rem', color: '#888' }} />
                                <input
                                    type="text"
                                    className="brand-search-input"
                                    placeholder="Search subcategories..."
                                    value={subcatSearch}
                                    onChange={e => setSubcatSearch(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '6px 28px 6px 28px',
                                        borderRadius: 6,
                                        border: '1px solid var(--border)',
                                        fontSize: '0.8125rem',
                                        background: 'var(--neutral-bg, #f9fafb)',
                                        outline: 'none'
                                    }}
                                />
                                {subcatSearch && (
                                    <button
                                        type="button"
                                        onClick={() => setSubcatSearch('')}
                                        style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: '0.875rem', padding: 0 }}
                                        aria-label="Clear subcategory search"
                                    >
                                        <i className="bi bi-x" />
                                    </button>
                                )}
                            </div>
                        )}

                        <div className="brand-filter-list" style={{ maxHeight: '220px', overflowY: 'auto', paddingRight: '4px' }}>
                            {visibleSubcategories.length === 0 ? (
                                <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', padding: '8px 0', textAlign: 'center' }}>
                                    No subcategories match "{subcatSearch}"
                                </div>
                            ) : (
                                visibleSubcategories.map(sub => (
                                    <label key={sub} className={`brand-filter-item ${selectedSubcategories.includes(sub) ? 'active' : ''}`} id={`scf-${sub.replace(/\s+/g, '-').toLowerCase()}`}>
                                        <input
                                            type="checkbox"
                                            checked={selectedSubcategories.includes(sub)}
                                            onChange={() => onToggleSubcategory(sub)}
                                        />
                                        <span className="bf-box" />
                                        <span className="bf-label">{sub}</span>
                                    </label>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {/* Availability */}
                <div className="filter-section">
                    <h4 className="filter-section__title">
                        <i className="bi bi-check-circle" /> Availability
                    </h4>
                    <label className="toggle-filter" id="in-stock-toggle">
                        <input
                            type="checkbox"
                            checked={inStockOnly}
                            onChange={e => onInStockOnly(e.target.checked)}
                        />
                        <span className="toggle-switch" />
                        <span>In Stock Only</span>
                    </label>
                </div>
            </div>

            {isDropdown && (
                <div className="plp-dropdown-footer">
                    <button
                        type="button"
                        className="btn btn-primary btn-full plp-dropdown-apply-btn"
                        onClick={() => setSidebarOpen(false)}
                    >
                        Apply Filters ({filteredCount} products)
                    </button>
                </div>
            )}
        </div>
    )
}

export default function ProductsPage() {
    const navigate = useNavigate()
    const [searchParams, setSearchParams] = useSearchParams()

    // Filters state
    const [search, setSearch] = useState(searchParams.get('q') || '')
    const [searchInput, setSearchInput] = useState(searchParams.get('q') || '')
    const [activeCategory, setActiveCategory] = useState(searchParams.get('category') || 'all')
    const [selectedColors, setSelectedColors] = useState([])
    const [selectedBrands, setSelectedBrands] = useState([])
    const [selectedSubcategories, setSelectedSubcategories] = useState([])
    const [sortBy, setSortBy] = useState('featured')
    const [viewMode, setViewMode] = useState('grid')
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [minRating, setMinRating] = useState(0)
    const [inStockOnly, setInStockOnly] = useState(false)
    const searchInputRef = useRef(null)

    // Sync state when URL searchParams change
    useEffect(() => {
        const cat = searchParams.get('category')
        if (cat && cat !== activeCategory) {
            setActiveCategory(cat)
            setSelectedBrands([])
            setSelectedSubcategories([])
            setSelectedColors([])
        }
    }, [searchParams])


    // ── Live data from Supabase ──
    const { meta, loading: metaLoading } = useFilterMeta()
    const { categories, loading: catsLoading } = useCategories()

    const ALL_COLORS = meta.colors || []

    // Dynamic brands: filtered by activeCategory when a category is selected, or all brands
    const ALL_BRANDS = React.useMemo(() => {
        if (activeCategory && activeCategory !== 'all' && activeCategory !== 'All') {
            const rawCat = activeCategory.trim()
            const lowerCat = rawCat.toLowerCase()
            const slugCat = lowerCat.replace(/\s+/g, '-')
            const unhyphenCat = lowerCat.replace(/-/g, ' ')
            const singularCat = lowerCat.endsWith('s') ? lowerCat.slice(0, -1) : lowerCat
            const pluralCat = `${lowerCat}s`
            const normCat = lowerCat.replace(/&/g, 'and').replace(/[^a-z0-9]/g, '')

            const list =
                meta.brandsByCategory?.[rawCat] ||
                meta.brandsByCategory?.[lowerCat] ||
                meta.brandsByCategory?.[slugCat] ||
                meta.brandsByCategory?.[unhyphenCat] ||
                meta.brandsByCategory?.[singularCat] ||
                meta.brandsByCategory?.[pluralCat] ||
                meta.brandsByCategory?.[normCat] ||
                []

            if (list.length > 0) {
                return [...list].sort((a, b) => a.localeCompare(b))
            }
            if (!metaLoading && meta.brandsByCategory) {
                return []
            }
        }
        const raw = meta.brands || []
        return raw.filter(b => b && b !== 'All').sort((a, b) => a.localeCompare(b))
    }, [meta.brands, meta.brandsByCategory, activeCategory, metaLoading])

    // Dynamic subcategories: filtered by activeCategory when a category is selected, or all subcategories
    const ALL_SUBCATEGORIES = React.useMemo(() => {
        if (activeCategory && activeCategory !== 'all' && activeCategory !== 'All') {
            const rawCat = activeCategory.trim()
            const lowerCat = rawCat.toLowerCase()
            const slugCat = lowerCat.replace(/\s+/g, '-')
            const unhyphenCat = lowerCat.replace(/-/g, ' ')
            const singularCat = lowerCat.endsWith('s') ? lowerCat.slice(0, -1) : lowerCat
            const pluralCat = `${lowerCat}s`
            const normCat = lowerCat.replace(/&/g, 'and').replace(/[^a-z0-9]/g, '')

            const list =
                meta.subcategoriesByCategory?.[rawCat] ||
                meta.subcategoriesByCategory?.[lowerCat] ||
                meta.subcategoriesByCategory?.[slugCat] ||
                meta.subcategoriesByCategory?.[unhyphenCat] ||
                meta.subcategoriesByCategory?.[singularCat] ||
                meta.subcategoriesByCategory?.[pluralCat] ||
                meta.subcategoriesByCategory?.[normCat] ||
                []

            if (list.length > 0) return [...list].sort((a, b) => a.localeCompare(b))
            if (!metaLoading && meta.subcategoriesByCategory) return []
        }
        return (meta.subcategories || []).filter(Boolean).sort((a, b) => a.localeCompare(b))
    }, [meta.subcategories, meta.subcategoriesByCategory, activeCategory, metaLoading])

    // Automatically prune selected brands/subcategories that do not exist in the active category
    useEffect(() => {
        if (activeCategory && activeCategory !== 'all') {
            if (ALL_BRANDS.length > 0) {
                setSelectedBrands(prev => {
                    if (prev.length === 0) return prev
                    const valid = prev.filter(b => ALL_BRANDS.includes(b))
                    return valid.length === prev.length ? prev : valid
                })
            } else if (!metaLoading && meta.brandsByCategory) {
                setSelectedBrands([])
            }
            if (ALL_SUBCATEGORIES.length > 0) {
                setSelectedSubcategories(prev => {
                    if (prev.length === 0) return prev
                    const valid = prev.filter(s => ALL_SUBCATEGORIES.includes(s))
                    return valid.length === prev.length ? prev : valid
                })
            } else if (!metaLoading && meta.subcategoriesByCategory) {
                setSelectedSubcategories([])
            }
        }
    }, [activeCategory, ALL_BRANDS, ALL_SUBCATEGORIES, metaLoading])

    // Build filter object passed to the hook
    const filters = {
        search,
        category: activeCategory !== 'all' ? activeCategory : undefined,
        subcategories: selectedSubcategories.length ? selectedSubcategories : undefined,
        colors: selectedColors.length ? selectedColors : undefined,
        brands: selectedBrands.length ? selectedBrands : undefined,
        inStockOnly,
    }

    const { products: filtered, loading: productsLoading, error: productsError } = useProducts(filters, sortBy)

    // Map subcategory names to their first product's image
    const subcategoryImageMap = React.useMemo(() => {
        const map = { ...(meta.subcategoryImages || {}) }
        if (filtered && filtered.length > 0) {
            for (const p of filtered) {
                if (p.subcategory && (p.image_url || p.image) && !map[p.subcategory]) {
                    map[p.subcategory] = p.image_url || p.image
                }
            }
        }
        return map
    }, [meta.subcategoryImages, filtered])

    // ── Pagination State ──
    const [currentPage, setCurrentPage] = useState(1)
    const [itemsPerPage, setItemsPerPage] = useState(24)

    // Reset page to 1 whenever filters or sorting change
    useEffect(() => {
        setCurrentPage(1)
    }, [search, activeCategory, selectedSubcategories, selectedColors, selectedBrands, inStockOnly, sortBy])

    const totalProducts = filtered.length
    const totalPages = Math.max(1, Math.ceil(totalProducts / itemsPerPage))
    const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages)
    const startIndex = (safeCurrentPage - 1) * itemsPerPage
    const endIndex = Math.min(startIndex + itemsPerPage, totalProducts)
    const paginatedProducts = filtered.slice(startIndex, endIndex)

    const handlePageChange = (newPage) => {
        if (newPage < 1 || newPage > totalPages || newPage === safeCurrentPage) return
        setCurrentPage(newPage)
        const gridEl = document.getElementById('plp-grid') || document.querySelector('.plp-main')
        if (gridEl) {
            const topOffset = gridEl.getBoundingClientRect().top + window.pageYOffset - 90
            window.scrollTo({ top: Math.max(0, topOffset), behavior: 'smooth' })
        }
    }

    const getPageNumbers = () => {
        const pages = []
        if (totalPages <= 7) {
            for (let i = 1; i <= totalPages; i++) pages.push(i)
        } else {
            if (safeCurrentPage <= 4) {
                pages.push(1, 2, 3, 4, 5, '...', totalPages)
            } else if (safeCurrentPage >= totalPages - 3) {
                pages.push(1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages)
            } else {
                pages.push(1, '...', safeCurrentPage - 1, safeCurrentPage, safeCurrentPage + 1, '...', totalPages)
            }
        }
        return pages
    }

    // Only show "Applying filters..." overlay when the user has actually interacted with a filter on mobile
    const [isUserFiltering, setIsUserFiltering] = useState(false)
    const hasLoadedOnceRef = useRef(false)

    useEffect(() => {
        if (!productsLoading) {
            hasLoadedOnceRef.current = true
            setIsUserFiltering(false)
        }
    }, [productsLoading])

    // Debounce search input → triggers re-fetch via hook
    useEffect(() => {
        const t = setTimeout(() => setSearch(searchInput), 320)
        return () => clearTimeout(t)
    }, [searchInput])

    // Sync URL params
    useEffect(() => {
        const params = {}
        if (search) params.q = search
        if (activeCategory !== 'all') params.category = activeCategory
        setSearchParams(params, { replace: true })
    }, [search, activeCategory])

    /* filter action helpers - flag isUserFiltering for mobile overlay */
    const handleToggleColor = (c) => {
        setIsUserFiltering(true)
        setSelectedColors(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])
    }
    const handleToggleBrand = (b) => {
        setIsUserFiltering(true)
        setSelectedBrands(prev => prev.includes(b) ? prev.filter(x => x !== b) : [...prev, b])
    }
    const handleToggleSubcategory = (sub) => {
        setIsUserFiltering(true)
        setSelectedSubcategories(prev => prev.includes(sub) ? prev.filter(x => x !== sub) : [...prev, sub])
    }
    const handleInStockOnly = (val) => {
        setIsUserFiltering(true)
        setInStockOnly(val)
    }
    const handleResetFilters = () => {
        setIsUserFiltering(true)
        setSearch(''); setSearchInput('')
        // Keep activeCategory intact as requested - do not reset to 'all'
        setSelectedColors([])
        setSelectedBrands([])
        setSelectedSubcategories([])
        setInStockOnly(false)
        setSortBy('featured')
    }
    const resetFilters = handleResetFilters
    const toggleColor = handleToggleColor
    const toggleBrand = handleToggleBrand
    const toggleSubcategory = handleToggleSubcategory

    const activeFilterCount = selectedColors.length + selectedBrands.length + selectedSubcategories.length +
        (inStockOnly ? 1 : 0)

    // Category count map from live data
    const categoryCountMap = { all: filtered.length }
    categories.forEach(c => {
        categoryCountMap[c.id] = c.count
    })

    // ── Horizontal Category Tabs Scrolling ──
    const tabsRef = useRef(null)
    const [canScrollLeft, setCanScrollLeft] = useState(false)
    const [canScrollRight, setCanScrollRight] = useState(false)
    const isDraggingRef = useRef(false)
    const dragStartXRef = useRef(0)
    const dragScrollLeftRef = useRef(0)
    const hasDraggedRef = useRef(false)

    const checkTabsScroll = useCallback(() => {
        const el = tabsRef.current
        if (!el) return
        const { scrollLeft, scrollWidth, clientWidth } = el
        setCanScrollLeft(scrollLeft > 4)
        setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 4)
    }, [])

    const scrollTabs = (direction) => {
        const el = tabsRef.current
        if (!el) return
        const scrollAmount = direction === 'left' ? -280 : 280
        el.scrollBy({ left: scrollAmount, behavior: 'smooth' })
    }

    const handleMouseDownTabs = (e) => {
        if (e.button !== 0) return
        isDraggingRef.current = true
        hasDraggedRef.current = false
        dragStartXRef.current = e.pageX
        dragScrollLeftRef.current = tabsRef.current?.scrollLeft || 0
    }

    const handleMouseMoveTabs = (e) => {
        if (!isDraggingRef.current || !tabsRef.current) return
        const deltaX = e.pageX - dragStartXRef.current
        if (Math.abs(deltaX) > 4) {
            hasDraggedRef.current = true
        }
        tabsRef.current.scrollLeft = dragScrollLeftRef.current - deltaX
        checkTabsScroll()
    }

    const handleMouseUpTabs = () => {
        isDraggingRef.current = false
        setTimeout(() => {
            hasDraggedRef.current = false
        }, 60)
    }

    // Wheel event to translate vertical wheel into horizontal scrolling on tabs
    useEffect(() => {
        const el = tabsRef.current
        if (!el) return

        const handleWheel = (e) => {
            if (el.scrollWidth > el.clientWidth) {
                const canLeft = el.scrollLeft > 0
                const canRight = el.scrollLeft < el.scrollWidth - el.clientWidth - 1

                if ((e.deltaY > 0 && canRight) || (e.deltaY < 0 && canLeft)) {
                    e.preventDefault()
                    el.scrollLeft += e.deltaY
                    checkTabsScroll()
                }
            }
        }

        el.addEventListener('wheel', handleWheel, { passive: false })
        return () => el.removeEventListener('wheel', handleWheel)
    }, [checkTabsScroll])

    // Update scroll indicators on resize, category changes, or scroll
    useEffect(() => {
        checkTabsScroll()
        const el = tabsRef.current
        if (el) {
            el.addEventListener('scroll', checkTabsScroll, { passive: true })
        }
        window.addEventListener('resize', checkTabsScroll)
        return () => {
            if (el) el.removeEventListener('scroll', checkTabsScroll)
            window.removeEventListener('resize', checkTabsScroll)
        }
    }, [categories, checkTabsScroll])

    // Auto-scroll active tab into view when activeCategory changes
    useEffect(() => {
        if (!tabsRef.current) return
        const tabs = Array.from(tabsRef.current.querySelectorAll('.plp-cat-tab'))
        const activeBtn = tabs.find(btn => btn.dataset.categoryId === String(activeCategory))
        if (activeBtn) {
            activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
        }
    }, [activeCategory])

    return (
        <div className="products-page page-enter" id="products-page">

            {/* ── Header ── */}
            <div className="plp-header" id="plp-header">
                <div className="container">
                    {/* Breadcrumb */}
                    <nav className="breadcrumb">
                        <Link to="/"><i className="bi bi-house" /> Home</Link>
                        <span>›</span>
                        <span>All Products</span>
                    </nav>

                    <div className="plp-header__row">
                        <div>
                            <h1 className="plp-header__title">
                                <i className="bi bi-grid-3x3-gap-fill" /> All Products
                            </h1>
                            <p className="plp-header__sub">
                                Explore our curated collection of premium tech accessories
                            </p>
                        </div>
                        <div className="plp-header__stats">
                            <div className="plp-stat-pill"><i className="bi bi-box-seam" /><strong>{productsLoading ? '…' : filtered.length}</strong> Products</div>
                            <div className="plp-stat-pill"><i className="bi bi-tags" /><strong>{categories.length}</strong> Categories</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Category Tabs Bar ── */}
            <div className="plp-category-nav" id="plp-category-nav">
                <div className="container">
                    <div className={`plp-category-tabs-wrapper ${canScrollLeft ? 'can-scroll-left' : ''} ${canScrollRight ? 'can-scroll-right' : ''}`}>
                        {canScrollLeft && (
                            <button
                                type="button"
                                className="plp-cat-arrow plp-cat-arrow--left"
                                onClick={() => scrollTabs('left')}
                                aria-label="Scroll categories left"
                                title="Scroll left"
                            >
                                <i className="bi bi-chevron-left" />
                            </button>
                        )}

                        <div
                            ref={tabsRef}
                            className="plp-category-tabs"
                            id="plp-category-tabs"
                            role="tablist"
                            onMouseDown={handleMouseDownTabs}
                            onMouseMove={handleMouseMoveTabs}
                            onMouseUp={handleMouseUpTabs}
                            onMouseLeave={handleMouseUpTabs}
                        >
                            {[{ id: 'all', name: 'All', icon: 'bi-grid' }, ...categories.map(c => ({ ...c, icon: getCategoryIcon(c.id, c.name) }))].map(cat => (
                                <button
                                    key={cat.id}
                                    id={`plp-cat-${cat.id}`}
                                    data-category-id={cat.id}
                                    role="tab"
                                    aria-selected={activeCategory === cat.id}
                                    className={`plp-cat-tab ${activeCategory === cat.id ? 'active' : ''}`}
                                    onClick={() => {
                                        if (hasDraggedRef.current) return
                                        setActiveCategory(cat.id)
                                        setSelectedBrands([])
                                        setSelectedSubcategories([])
                                        setSelectedColors([])
                                    }}
                                >
                                    <i className={`bi ${cat.icon}`} />
                                    <span>{cat.name || 'All'}</span>
                                </button>
                            ))}
                        </div>

                        {canScrollRight && (
                            <button
                                type="button"
                                className="plp-cat-arrow plp-cat-arrow--right"
                                onClick={() => scrollTabs('right')}
                                aria-label="Scroll categories right"
                                title="Scroll right"
                            >
                                <i className="bi bi-chevron-right" />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Search + Toolbar ── */}
            <div className="plp-toolbar" id="plp-toolbar">
                <div className="container plp-toolbar__inner">
                    {/* Search */}
                    <div className="plp-search-wrap" id="plp-search-wrap">
                        <i className="bi bi-search plp-search-icon" />
                        <input
                            ref={searchInputRef}
                            id="plp-search-input"
                            type="text"
                            className="plp-search-input"
                            placeholder="Search products, brands, categories…"
                            value={searchInput}
                            onChange={e => setSearchInput(e.target.value)}
                        />
                        {searchInput && (
                            <button className="plp-search-clear" onClick={() => { setSearchInput(''); setSearch(''); searchInputRef.current?.focus() }}>
                                <i className="bi bi-x-circle-fill" />
                            </button>
                        )}
                    </div>

                    {/* Toolbar right */}
                    <div className="plp-toolbar__right">
                        {/* Filter toggle with Mobile Dropdown */}
                        <div className="plp-filter-toggle-wrap">
                            <button
                                id="plp-filter-toggle"
                                className={`plp-filter-toggle-btn ${activeFilterCount > 0 ? 'has-filters' : ''} ${sidebarOpen ? 'active' : ''}`}
                                onClick={() => setSidebarOpen(o => !o)}
                                aria-expanded={sidebarOpen}
                            >
                                <i className="bi bi-funnel" />
                                Filters
                                {activeFilterCount > 0 && <span className="filter-badge">{activeFilterCount}</span>}
                            </button>

                            {/* Dropdown directly below Filters button */}
                            {sidebarOpen && (
                                <>
                                    <div className="plp-dropdown-backdrop" onClick={() => setSidebarOpen(false)} />
                                    <div className="plp-filter-dropdown" id="plp-filter-dropdown">
                                        <FilterSidebarContent
                                            isDropdown={true}
                                            activeFilterCount={activeFilterCount}
                                            resetFilters={handleResetFilters}
                                            setSidebarOpen={setSidebarOpen}
                                            ALL_COLORS={ALL_COLORS}
                                            selectedColors={selectedColors}
                                            onToggleColor={handleToggleColor}
                                            ALL_BRANDS={ALL_BRANDS}
                                            selectedBrands={selectedBrands}
                                            onToggleBrand={handleToggleBrand}
                                            ALL_SUBCATEGORIES={ALL_SUBCATEGORIES}
                                            selectedSubcategories={selectedSubcategories}
                                            onToggleSubcategory={handleToggleSubcategory}
                                            inStockOnly={inStockOnly}
                                            onInStockOnly={handleInStockOnly}
                                            filteredCount={filtered.length}
                                            COLOR_MAP={COLOR_MAP}
                                        />
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Sort */}
                        <div className="plp-sort-wrap">
                            <i className="bi bi-sort-down plp-sort-icon" />
                            <select
                                id="plp-sort-select"
                                className="plp-sort-select"
                                value={sortBy}
                                onChange={e => setSortBy(e.target.value)}
                            >
                                {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                        </div>

                        {/* View mode */}
                        <div className="plp-view-toggle" id="plp-view-toggle">
                            <button
                                id="view-grid"
                                className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
                                onClick={() => setViewMode('grid')}
                                title="Grid view"
                            >
                                <i className="bi bi-grid" />
                            </button>
                            <button
                                id="view-list"
                                className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
                                onClick={() => setViewMode('list')}
                                title="List view"
                            >
                                <i className="bi bi-list-ul" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Active Filters Chips ── */}
            {activeFilterCount > 0 && (
                <div className="plp-active-filters" id="plp-active-filters">
                    <div className="container plp-active-filters__inner">
                        <span className="active-filters-label"><i className="bi bi-funnel-fill" /> Active:</span>
                        {selectedColors.map(c => (
                            <span key={c} className="filter-chip">
                                <span className="chip-swatch" style={{ background: COLOR_MAP[c] || '#888' }} />
                                {c}
                                <button onClick={() => handleToggleColor(c)}><i className="bi bi-x" /></button>
                            </span>
                        ))}
                        {selectedBrands.map(b => (
                            <span key={b} className="filter-chip">
                                <i className="bi bi-building" /> {b}
                                <button onClick={() => handleToggleBrand(b)}><i className="bi bi-x" /></button>
                            </span>
                        ))}
                        {selectedSubcategories.map(sub => (
                            <span key={sub} className="filter-chip">
                                <i className="bi bi-diagram-3" /> {sub}
                                <button onClick={() => handleToggleSubcategory(sub)}><i className="bi bi-x" /></button>
                            </span>
                        ))}
                        {inStockOnly && (
                            <span className="filter-chip">
                                <i className="bi bi-check-circle-fill" /> In Stock
                                <button onClick={() => handleInStockOnly(false)}><i className="bi bi-x" /></button>
                            </span>
                        )}
                        <button className="chip-clear-all" onClick={resetFilters}>
                            <i className="bi bi-x-circle" /> Clear All
                        </button>
                    </div>
                </div>
            )}

            {/* ── Body ── */}
            <div className="plp-body" id="plp-body">
                <div className="container plp-body__inner">

                    {/* Desktop Sidebar */}
                    <aside className="plp-sidebar plp-sidebar--desktop" id="plp-sidebar">
                        <FilterSidebarContent
                            isDropdown={false}
                            activeFilterCount={activeFilterCount}
                            resetFilters={handleResetFilters}
                            setSidebarOpen={setSidebarOpen}
                            ALL_COLORS={ALL_COLORS}
                            selectedColors={selectedColors}
                            onToggleColor={handleToggleColor}
                            ALL_BRANDS={ALL_BRANDS}
                            selectedBrands={selectedBrands}
                            onToggleBrand={handleToggleBrand}
                            ALL_SUBCATEGORIES={ALL_SUBCATEGORIES}
                            selectedSubcategories={selectedSubcategories}
                            onToggleSubcategory={handleToggleSubcategory}
                            inStockOnly={inStockOnly}
                            onInStockOnly={handleInStockOnly}
                            filteredCount={filtered.length}
                            COLOR_MAP={COLOR_MAP}
                        />
                    </aside>

                    {/* Main Content */}
                    <main className="plp-main" id="plp-main">
                        {/* White overlay with spinner ONLY on mobile when user actively applies a filter (rendered in Portal to center on viewport regardless of transforms/scroll) */}
                        {isUserFiltering && productsLoading && typeof document !== 'undefined' && createPortal(
                            <div className="plp-loading-screen-overlay" aria-live="polite" role="status">
                                <div className="plp-loading-spinner-box">
                                    <div className="plp-spinner-ring" />
                                    <span>Applying filters…</span>
                                </div>
                            </div>,
                            document.body
                        )}

                        <div className="plp-products-split">
                            {/* Left Subcategory Rail with first product image */}
                            {ALL_SUBCATEGORIES.length > 0 && (
                                <aside className="plp-subcat-rail" id="plp-subcat-rail" aria-label="Subcategories">
                                    <div className="plp-subcat-rail__inner">
                                        <button
                                            type="button"
                                            className={`plp-subcat-rail__item ${selectedSubcategories.length === 0 ? 'active' : ''}`}
                                            onClick={() => {
                                                setIsUserFiltering(true)
                                                setSelectedSubcategories([])
                                            }}
                                        >
                                            <div className="plp-subcat-rail__img-box">
                                                <i className="bi bi-grid-fill plp-subcat-rail__all-icon" />
                                            </div>
                                            <span className="plp-subcat-rail__label">All</span>
                                        </button>

                                        {ALL_SUBCATEGORIES.map(sub => {
                                            const isSelected = selectedSubcategories.includes(sub)
                                            const subImg = subcategoryImageMap[sub] || '/placeholder-key.svg'
                                            return (
                                                <button
                                                    key={sub}
                                                    type="button"
                                                    className={`plp-subcat-rail__item ${isSelected ? 'active' : ''}`}
                                                    onClick={() => {
                                                        setIsUserFiltering(true)
                                                        setSelectedSubcategories(isSelected ? [] : [sub])
                                                    }}
                                                    title={sub}
                                                >
                                                    <div className="plp-subcat-rail__img-box">
                                                        <img
                                                            src={subImg}
                                                            alt={sub}
                                                            loading="lazy"
                                                            onError={(e) => {
                                                                e.currentTarget.onerror = null
                                                                e.currentTarget.src = '/placeholder-key.svg'
                                                            }}
                                                        />
                                                    </div>
                                                    <span className="plp-subcat-rail__label">{sub}</span>
                                                </button>
                                            )
                                        })}
                                    </div>
                                </aside>
                            )}

                            {/* Right Products Column */}
                            <div className="plp-products-col">
                                {/* Top Brand Scroller of that specific category */}
                                {ALL_BRANDS.length > 0 && (
                                    <div className="plp-brands-bar" id="plp-brands-bar">
                                        <div className="plp-brands-scroller" role="tablist">
                                            <button
                                                type="button"
                                                className={`plp-brand-pill ${selectedBrands.length === 0 ? 'active' : ''}`}
                                                onClick={() => {
                                                    setIsUserFiltering(true)
                                                    setSelectedBrands([])
                                                }}
                                            >
                                                <span>All</span>
                                            </button>
                                            {ALL_BRANDS.map(b => {
                                                const isSelected = selectedBrands.includes(b)
                                                return (
                                                    <button
                                                        key={b}
                                                        type="button"
                                                        className={`plp-brand-pill ${isSelected ? 'active' : ''}`}
                                                        onClick={() => {
                                                            setIsUserFiltering(true)
                                                            setSelectedBrands(isSelected ? [] : [b])
                                                        }}
                                                    >
                                                        <i className="bi bi-building shrink-0" />
                                                        <span>{b}</span>
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Results bar */}
                                <div className="plp-results-bar" id="plp-results-bar">
                                    <div className="plp-results-count">
                                        {productsLoading && (
                                            <span className="plp-loading-text"><span className="spinner-border spinner-border-sm me-2" role="status" /> Loading products...</span>
                                        )}
                                        {search && <span className="plp-search-term">Search for "<em>{search}</em>"</span>}
                                    </div>

                                    {/* Desktop filters button */}
                                    <button
                                        className={`plp-filter-toggle-btn desktop-filter-btn ${activeFilterCount > 0 ? 'has-filters' : ''}`}
                                        onClick={() => setSidebarOpen(o => !o)}
                                    >
                                        <i className={`bi bi-layout-sidebar-inset${sidebarOpen ? '-reverse' : ''}`} />
                                        {sidebarOpen ? 'Hide Filters' : 'Show Filters'}
                                        {activeFilterCount > 0 && <span className="filter-badge">{activeFilterCount}</span>}
                                    </button>
                                </div>

                                {/* Product Grid / List */}
                                {(!hasLoadedOnceRef.current && productsLoading) ? (
                                    <div className="plp-loading" id="plp-loading">
                                        {[...Array(6)].map((_, i) => (
                                            <div key={i} className="plp-skeleton" />
                                        ))}
                                    </div>
                                ) : productsError ? (
                                    <div className="plp-empty" id="plp-error">
                                        <div className="plp-empty__icon"><i className="bi bi-wifi-off" /></div>
                                        <h3>Could not load products</h3>
                                        <p>{productsError}</p>
                                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 8 }}>Make sure you ran the SQL schema in Supabase.</p>
                                    </div>
                                ) : filtered.length > 0 ? (
                                    <>
                                        <div className={`plp-grid ${viewMode === 'list' ? 'plp-grid--list' : ''}`} id="plp-grid">
                                            {paginatedProducts.map(p => <ProductCard key={p.id} id={`product-card-${p.id}`} product={p} />)}
                                        </div>

                                        {/* Pagination Controls */}
                                        {totalPages > 1 && (
                                            <div className="plp-pagination" id="plp-pagination">
                                                <div className="plp-pagination__info">
                                                    Showing <strong>{startIndex + 1}</strong> - <strong>{endIndex}</strong> of <strong>{totalProducts.toLocaleString()}</strong> products
                                                </div>

                                                <div className="plp-pagination__controls">
                                                    <button
                                                        type="button"
                                                        className="plp-pagination__btn plp-pagination__btn--nav"
                                                        onClick={() => handlePageChange(safeCurrentPage - 1)}
                                                        disabled={safeCurrentPage === 1}
                                                        aria-label="Previous page"
                                                        title="Previous page"
                                                    >
                                                        <i className="bi bi-chevron-left" />
                                                        <span className="hidden sm:inline">Prev</span>
                                                    </button>

                                                    <div className="plp-pagination__pages">
                                                        {getPageNumbers().map((page, idx) => (
                                                            page === '...' ? (
                                                                <span key={`dots-${idx}`} className="plp-pagination__ellipsis">…</span>
                                                            ) : (
                                                                <button
                                                                    key={page}
                                                                    type="button"
                                                                    className={`plp-pagination__btn plp-pagination__btn--page ${safeCurrentPage === page ? 'active' : ''}`}
                                                                    onClick={() => handlePageChange(page)}
                                                                    aria-current={safeCurrentPage === page ? 'page' : undefined}
                                                                >
                                                                    {page}
                                                                </button>
                                                            )
                                                        ))}
                                                    </div>

                                                    <button
                                                        type="button"
                                                        className="plp-pagination__btn plp-pagination__btn--nav"
                                                        onClick={() => handlePageChange(safeCurrentPage + 1)}
                                                        disabled={safeCurrentPage === totalPages}
                                                        aria-label="Next page"
                                                        title="Next page"
                                                    >
                                                        <span className="hidden sm:inline">Next</span>
                                                        <i className="bi bi-chevron-right" />
                                                    </button>
                                                </div>

                                                <div className="plp-pagination__per-page">
                                                    <label htmlFor="per-page-select">Per page:</label>
                                                    <select
                                                        id="per-page-select"
                                                        className="plp-pagination__select"
                                                        value={itemsPerPage}
                                                        onChange={(e) => {
                                                            setItemsPerPage(Number(e.target.value))
                                                            setCurrentPage(1)
                                                        }}
                                                    >
                                                        <option value={12}>12</option>
                                                        <option value={24}>24</option>
                                                        <option value={48}>48</option>
                                                        <option value={96}>96</option>
                                                    </select>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="plp-empty" id="plp-empty">
                                        <div className="plp-empty__icon">
                                            <i className="bi bi-search" />
                                        </div>
                                        <h3>No products match your filters</h3>
                                        <p>Try adjusting your search or clearing some filters to see more results.</p>
                                        <button className="btn btn-primary btn-lg" onClick={resetFilters}>
                                            <i className="bi bi-arrow-counterclockwise" /> Reset All Filters
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </main>
                </div>
            </div>
        </div>
    )
}
