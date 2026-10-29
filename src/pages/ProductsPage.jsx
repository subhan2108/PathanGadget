import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { useProducts, useFilterMeta, useCategories } from '../hooks/useProducts'
import { formatPrice } from '../lib/productsService'
import { ProductCard } from '@/components/ui/product-card-2'
import './ProductsPage.css'

/* ─── Constants ────────────────────────────────── */
const CATEGORY_ICONS = {
    watches: 'bi-smartwatch',
    airpods: 'bi-earbuds',
    headphones: 'bi-headphones',
    smartphones: 'bi-phone',
}

const getCategoryIcon = (id = '', name = '') => {
    if (CATEGORY_ICONS[id]) return CATEGORY_ICONS[id]
    const key = `${id} ${name}`.toLowerCase()
    if (key.includes('watch')) return 'bi-smartwatch'
    if (key.includes('airpod') || key.includes('earbud')) return 'bi-earbuds'
    if (key.includes('headphone') || key.includes('audio')) return 'bi-headphones'
    if (key.includes('phone') || key.includes('mobile')) return 'bi-phone'
    if (key.includes('remote') || key.includes('key')) return 'bi-key'
    if (key.includes('shell')) return 'bi-shield-check'
    if (key.includes('electronic')) return 'bi-cpu'
    if (key.includes('cable') || key.includes('charger')) return 'bi-lightning-charge'
    if (key.includes('camera')) return 'bi-camera'
    if (key.includes('tool') || key.includes('device')) return 'bi-tools'
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

// Colors/Brands/Price bounds are now fetched live from Supabase via useFilterMeta()

/* ─── Price Range Slider ────────────────────────── */
function PriceRangeSlider({ min, max, value, onChange }) {
    const [dragging, setDragging] = useState(null)
    const trackRef = useRef(null)

    const getPercent = (val) => ((val - min) / (max - min)) * 100

    const handleTrackClick = useCallback((e) => {
        const rect = trackRef.current.getBoundingClientRect()
        const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
        const val = Math.round(min + pct * (max - min))
        const diffLow = Math.abs(val - value[0])
        const diffHigh = Math.abs(val - value[1])
        if (diffLow < diffHigh) onChange([Math.min(val, value[1] - 1000), value[1]])
        else onChange([value[0], Math.max(val, value[0] + 1000)])
    }, [min, max, value, onChange])

    const startDrag = (e, thumb) => {
        e.preventDefault()
        setDragging(thumb)
    }

    useEffect(() => {
        if (!dragging) return
        const onMove = (e) => {
            const rect = trackRef.current?.getBoundingClientRect()
            if (!rect) return
            const clientX = e.touches ? e.touches[0].clientX : e.clientX
            const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
            const val = Math.round(min + pct * (max - min))
            if (dragging === 'low') onChange([Math.min(val, value[1] - 1000), value[1]])
            else onChange([value[0], Math.max(val, value[0] + 1000)])
        }
        const stopDrag = () => setDragging(null)
        window.addEventListener('mousemove', onMove)
        window.addEventListener('mouseup', stopDrag)
        window.addEventListener('touchmove', onMove)
        window.addEventListener('touchend', stopDrag)
        return () => {
            window.removeEventListener('mousemove', onMove)
            window.removeEventListener('mouseup', stopDrag)
            window.removeEventListener('touchmove', onMove)
            window.removeEventListener('touchend', stopDrag)
        }
    }, [dragging, min, max, value, onChange])

    const lowPct = getPercent(value[0])
    const highPct = getPercent(value[1])

    return (
        <div className="price-slider">
            <div className="price-slider__track" ref={trackRef} onClick={handleTrackClick}>
                <div
                    className="price-slider__fill"
                    style={{ left: `${lowPct}%`, width: `${highPct - lowPct}%` }}
                />
                <button
                    className={`price-slider__thumb ${dragging === 'low' ? 'dragging' : ''}`}
                    style={{ left: `${lowPct}%` }}
                    onMouseDown={(e) => startDrag(e, 'low')}
                    onTouchStart={(e) => startDrag(e, 'low')}
                    aria-label="Minimum price"
                />
                <button
                    className={`price-slider__thumb ${dragging === 'high' ? 'dragging' : ''}`}
                    style={{ left: `${highPct}%` }}
                    onMouseDown={(e) => startDrag(e, 'high')}
                    onTouchStart={(e) => startDrag(e, 'high')}
                    aria-label="Maximum price"
                />
            </div>
            <div className="price-slider__labels">
                <span>{formatPrice(value[0])}</span>
                <span>{formatPrice(value[1])}</span>
            </div>
        </div>
    )
}

/* ─── Main Page ─────────────────────────────────── */
export default function ProductsPage() {
    const navigate = useNavigate()
    const [searchParams, setSearchParams] = useSearchParams()

    // Filters state
    const [search, setSearch] = useState(searchParams.get('q') || '')
    const [searchInput, setSearchInput] = useState(searchParams.get('q') || '')
    const [activeCategory, setActiveCategory] = useState(searchParams.get('category') || 'all')
    const [selectedColors, setSelectedColors] = useState([])
    const [selectedBrands, setSelectedBrands] = useState([])
    const [sortBy, setSortBy] = useState('featured')
    const [viewMode, setViewMode] = useState('grid')
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [minRating, setMinRating] = useState(0)
    const [inStockOnly, setInStockOnly] = useState(false)
    const searchInputRef = useRef(null)

    // ── Live data from Supabase ──
    const { meta, loading: metaLoading } = useFilterMeta()
    const { categories, loading: catsLoading } = useCategories()

    // Price range initialises once filter metadata arrives, but we don't WAIT for it to show products
    const [priceRange, setPriceRange] = useState([0, 200000])
    const [priceInit, setPriceInit] = useState(false)
    useEffect(() => {
        if (!metaLoading && meta.maxPrice > 0 && !priceInit) {
            setPriceRange([meta.minPrice, meta.maxPrice])
            setPriceInit(true)
        }
    }, [metaLoading, meta.minPrice, meta.maxPrice, priceInit])

    const MIN_PRICE = meta.minPrice || 0
    const MAX_PRICE = meta.maxPrice || 200000
    const ALL_COLORS = meta.colors || []
    const ALL_BRANDS = meta.brands || []

    // Build filter object passed to the hook
    const filters = {
        search,
        category: activeCategory !== 'all' ? activeCategory : undefined,
        colors: selectedColors.length ? selectedColors : undefined,
        brands: selectedBrands.length ? selectedBrands : undefined,
        // Only apply price filter IF meta has finally loaded, otherwise show all
        priceRange: priceInit ? priceRange : undefined,
        minRating,
        inStockOnly,
    }

    const { products: filtered, loading: productsLoading, error: productsError } = useProducts(filters, sortBy)

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

    /* helpers */
    const toggleColor = (c) => setSelectedColors(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])
    const toggleBrand = (b) => setSelectedBrands(prev => prev.includes(b) ? prev.filter(x => x !== b) : [...prev, b])
    const resetFilters = () => {
        setSearch(''); setSearchInput('')
        setActiveCategory('all')
        setSelectedColors([]); setSelectedBrands([])
        setPriceRange([MIN_PRICE, MAX_PRICE])
        setMinRating(0); setInStockOnly(false); setSortBy('featured')
    }

    const activeFilterCount = selectedColors.length + selectedBrands.length +
        (priceRange[0] > MIN_PRICE || priceRange[1] < MAX_PRICE ? 1 : 0) +
        (minRating > 0 ? 1 : 0) + (inStockOnly ? 1 : 0)

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

    /* ── Sidebar Panel ── */
    const FilterSidebar = () => (
        <aside className={`plp-sidebar ${sidebarOpen ? 'open' : ''}`} id="plp-sidebar">
            {/* Mobile overlay */}
            <div className="plp-sidebar__backdrop" onClick={() => setSidebarOpen(false)} />

            <div className="plp-sidebar__panel">
                <div className="plp-sidebar__header">
                    <h3><i className="bi bi-funnel-fill" /> Filters</h3>
                    <div className="sidebar-header-actions">
                        {activeFilterCount > 0 && (
                            <button className="clear-btn" onClick={resetFilters}>
                                <i className="bi bi-x-circle" /> Clear All ({activeFilterCount})
                            </button>
                        )}
                        <button className="sidebar-close-btn" onClick={() => setSidebarOpen(false)}>
                            <i className="bi bi-x-lg" />
                        </button>
                    </div>
                </div>

                {/* Price Range */}
                <div className="filter-section">
                    <h4 className="filter-section__title">
                        <i className="bi bi-currency-rupee" /> Price Range
                    </h4>
                    <PriceRangeSlider
                        min={MIN_PRICE}
                        max={MAX_PRICE}
                        value={priceRange}
                        onChange={setPriceRange}
                    />
                </div>

                {/* Colors */}
                <div className="filter-section">
                    <h4 className="filter-section__title">
                        <i className="bi bi-palette" /> Color
                    </h4>
                    <div className="color-filter-grid">
                        {ALL_COLORS.map(color => (
                            <button
                                key={color}
                                id={`cf-${color.replace(/\s+/g, '-').toLowerCase()}`}
                                className={`color-filter-item ${selectedColors.includes(color) ? 'active' : ''}`}
                                onClick={() => toggleColor(color)}
                                title={color}
                            >
                                <span className="cf-swatch" style={{ background: COLOR_MAP[color] || '#888' }} />
                                <span className="cf-label">{color}</span>
                                {selectedColors.includes(color) && <i className="bi bi-check cf-check" />}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Brands */}
                <div className="filter-section">
                    <h4 className="filter-section__title">
                        <i className="bi bi-building" /> Brand
                    </h4>
                    <div className="brand-filter-list">
                        {ALL_BRANDS.map(brand => (
                            <label key={brand} className={`brand-filter-item ${selectedBrands.includes(brand) ? 'active' : ''}`} id={`bf-${brand.toLowerCase()}`}>
                                <input
                                    type="checkbox"
                                    checked={selectedBrands.includes(brand)}
                                    onChange={() => toggleBrand(brand)}
                                />
                                <span className="bf-box" />
                                <span className="bf-label">{brand}</span>
                                <span className="bf-count">
                                    {filtered.filter(p => p.brand === brand).length}
                                </span>
                            </label>
                        ))}
                    </div>
                </div>

                {/* Min Rating */}
                <div className="filter-section">
                    <h4 className="filter-section__title">
                        <i className="bi bi-star-fill" /> Minimum Rating
                    </h4>
                    <div className="rating-filter-list">
                        {[4.5, 4, 3.5, 3, 0].map(r => (
                            <button
                                key={r}
                                id={`rf-${r}`}
                                className={`rating-filter-btn ${minRating === r ? 'active' : ''}`}
                                onClick={() => setMinRating(r)}
                            >
                                {r === 0
                                    ? <><i className="bi bi-grid" /> All Ratings</>
                                    : <><i className="bi bi-star-fill" /> {r}+ Stars</>
                                }
                            </button>
                        ))}
                    </div>
                </div>

                {/* Availability */}
                <div className="filter-section">
                    <h4 className="filter-section__title">
                        <i className="bi bi-check-circle" /> Availability
                    </h4>
                    <label className="toggle-filter" id="in-stock-toggle">
                        <input
                            type="checkbox"
                            checked={inStockOnly}
                            onChange={e => setInStockOnly(e.target.checked)}
                        />
                        <span className="toggle-switch" />
                        <span>In Stock Only</span>
                    </label>
                </div>
            </div>
        </aside>
    )

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

                    {/* ── Category Tabs ── */}
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
                                    }}
                                >
                                    <i className={`bi ${cat.icon}`} />
                                    <span>{cat.name || 'All'}</span>
                                    <span className={`plp-cat-count ${activeCategory === cat.id ? 'active' : ''}`}>
                                        {categoryCountMap[cat.id] ?? 0}
                                    </span>
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
                        {/* Filter toggle */}
                        <button
                            id="plp-filter-toggle"
                            className={`plp-filter-toggle-btn ${activeFilterCount > 0 ? 'has-filters' : ''}`}
                            onClick={() => setSidebarOpen(o => !o)}
                        >
                            <i className="bi bi-funnel" />
                            Filters
                            {activeFilterCount > 0 && <span className="filter-badge">{activeFilterCount}</span>}
                        </button>

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
                                <button onClick={() => toggleColor(c)}><i className="bi bi-x" /></button>
                            </span>
                        ))}
                        {selectedBrands.map(b => (
                            <span key={b} className="filter-chip">
                                <i className="bi bi-building" /> {b}
                                <button onClick={() => toggleBrand(b)}><i className="bi bi-x" /></button>
                            </span>
                        ))}
                        {(priceRange[0] > MIN_PRICE || priceRange[1] < MAX_PRICE) && (
                            <span className="filter-chip">
                                <i className="bi bi-currency-rupee" />
                                {formatPrice(priceRange[0])} – {formatPrice(priceRange[1])}
                                <button onClick={() => setPriceRange([MIN_PRICE, MAX_PRICE])}><i className="bi bi-x" /></button>
                            </span>
                        )}
                        {minRating > 0 && (
                            <span className="filter-chip">
                                <i className="bi bi-star-fill" /> {minRating}+ Stars
                                <button onClick={() => setMinRating(0)}><i className="bi bi-x" /></button>
                            </span>
                        )}
                        {inStockOnly && (
                            <span className="filter-chip">
                                <i className="bi bi-check-circle-fill" /> In Stock
                                <button onClick={() => setInStockOnly(false)}><i className="bi bi-x" /></button>
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

                    {/* Sidebar */}
                    <FilterSidebar />

                    {/* Main Content */}
                    <main className="plp-main" id="plp-main">
                        {/* Results bar */}
                        <div className="plp-results-bar" id="plp-results-bar">
                            <div className="plp-results-count">
                                {productsLoading
                                    ? <span className="plp-loading-text"><span className="spinner-border spinner-border-sm me-2" role="status" /> Searching for excellence...</span>
                                    : filtered.length === 0
                                        ? <span>No products found</span>
                                        : <span><strong>{filtered.length}</strong> {filtered.length === 1 ? 'product' : 'products'} found</span>
                                }
                                {search && <span className="plp-search-term"> for "<em>{search}</em>"</span>}
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
                        {productsLoading ? (
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
                            <div className={`plp-grid ${viewMode === 'list' ? 'plp-grid--list' : ''}`} id="plp-grid">
                                {filtered.map(p => <ProductCard key={p.id} id={`product-card-${p.id}`} product={p} />)}
                            </div>
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
                    </main>
                </div>
            </div>
        </div>
    )
}
