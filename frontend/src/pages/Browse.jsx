import { useState, useEffect, useMemo, useCallback } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { API, formatPrice, getLowestPrice, getBestVendor, CATEGORIES, formatSpecKey, formatSpecValue } from '../services/api'
import { columnsForCategory, inferColumnType, distinctValues, applySpecFilters } from '../services/specColumns'
import { FiSearch, FiX, FiExternalLink, FiCheck, FiBookmark, FiGrid, FiList, FiShoppingCart, FiInfo, FiChevronRight, FiSliders, FiColumns } from 'react-icons/fi'
import toast from 'react-hot-toast'
import PriceGraph from '../components/PriceGraph'
import PartCard from '../components/PartCard'
import SpecTable from '../components/SpecTable'
import SearchableSelect from '../components/SearchableSelect'
import PriceRange from '../components/PriceRange'
import { useWatchlist } from '../hooks/useWatchlist'
import './Browse.css'

// Extracted skeleton components for reuse
const CardSkeleton = () => (
    <div className="br-card br-card--skeleton">
        <div className="skeleton" style={{ height: 14, width: '35%', marginBottom: 10 }} />
        <div className="skeleton" style={{ height: 16, width: '85%', marginBottom: 6 }} />
        <div className="skeleton" style={{ height: 12, width: '30%', marginBottom: 14 }} />
        <div style={{ display: 'flex', gap: 5, marginBottom: 14 }}>
            <div className="skeleton" style={{ height: 22, width: '30%', borderRadius: 5 }} />
            <div className="skeleton" style={{ height: 22, width: '35%', borderRadius: 5 }} />
        </div>
        <div className="skeleton" style={{ height: 20, width: '40%', marginBottom: 12 }} />
        <div className="skeleton" style={{ height: 34, width: '100%', borderRadius: 8 }} />
    </div>
)

const ListSkeleton = () => (
    <div className="br-list-item br-list-item--skeleton">
        <div style={{ flex: 1 }}><div className="skeleton" style={{ height: 14, width: '40%', marginBottom: 8 }} /><div className="skeleton" style={{ height: 16, width: '75%' }} /></div>
        <div style={{ flex: 1, display: 'flex', gap: 4, flexWrap: 'wrap' }}><div className="skeleton" style={{ height: 22, width: '28%', borderRadius: 5 }} /><div className="skeleton" style={{ height: 22, width: '32%', borderRadius: 5 }} /></div>
        <div style={{ width: 100 }}><div className="skeleton" style={{ height: 20, width: '80%' }} /></div>
        <div style={{ width: 80 }}><div className="skeleton" style={{ height: 30, width: '100%', borderRadius: 7 }} /></div>
    </div>
)

const EmptyState = ({ error }) => (
    <div className="br-empty">
        <FiSearch size={32} />
        <h3>No components found</h3>
        {error
            ? <p style={{ color: '#ef4444', fontFamily: 'monospace', fontSize: '0.8rem' }}>Error: {error}</p>
            : <p>Try adjusting your filters or search term</p>}
    </div>
)

export default function Browse() {
    const [searchParams, setSearchParams] = useSearchParams()
    const { ids: watchIds, has: inWatchlist, toggle: toggleWatch, count: watchCount } = useWatchlist()
    const [components, setComponents] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [search, setSearch] = useState(searchParams.get('search') || '')
    const [category, setCategory] = useState(searchParams.get('category') || '')
    const [sort, setSort] = useState('price-low')
    const [detail, setDetail] = useState(null)
    const [viewMode, setViewMode] = useState('list')
    const [mode, setMode] = useState(() => localStorage.getItem('pcease_browse_mode') || 'simple')
    const [pageSize, setPageSize] = useState(30)
    const [page, setPage] = useState(1)
    
    // Advanced filters
    const [showFilters, setShowFilters] = useState(false)
    const [brandFilter, setBrandFilter] = useState('')
    const [priceRange, setPriceRange] = useState({ min: '', max: '' })
    const [inStockOnly, setInStockOnly] = useState(false)
    const [specFilters, setSpecFilters] = useState({}) // specKey -> {min,max} | string[]

    useEffect(() => {
        setLoading(true)
        setError(null)
        API.getComponents({ category, search, sort })
            .then(data => setComponents(Array.isArray(data) ? data : []))
            .catch(e => { setError(e.message || 'Failed to load'); setComponents([]) })
            .finally(() => setLoading(false))
    }, [category, search, sort])

    useEffect(() => { localStorage.setItem('pcease_browse_mode', mode) }, [mode])

    // Get unique brands from loaded components
    const availableBrands = useMemo(() => {
        const brands = new Set(components.map(c => c.brand).filter(Boolean))
        return Array.from(brands).sort()
    }, [components])

    // Per-spec filters only apply in Advanced mode with a specific category chosen,
    // and only for spec columns that actually have data in the loaded components.
    const specCols = (mode === 'advanced' && category)
        ? columnsForCategory(category).filter(k => components.some(c => c.specs?.[k] != null))
        : []
    const specColTypes = useMemo(() => {
        const t = {}
        for (const k of specCols) t[k] = inferColumnType(components.map(c => c.specs?.[k]))
        return t
    }, [components, specCols.join(',')])

    // Upper bound for the price slider, rounded up from the data.
    const priceMax = useMemo(() => {
        const max = components.reduce((m, c) => Math.max(m, getLowestPrice(c) || 0), 0)
        return Math.max(10000, Math.ceil(max / 1000) * 1000)
    }, [components])

    // Apply client-side filters
    const filteredComponents = useMemo(() => {
        let list = components
        
        // Brand filter
        if (brandFilter) {
            list = list.filter(c => c.brand === brandFilter)
        }
        
        // Price range filter
        if (priceRange.min || priceRange.max) {
            list = list.filter(c => {
                const price = getLowestPrice(c)
                if (!price) return false
                if (priceRange.min && price < parseFloat(priceRange.min)) return false
                if (priceRange.max && price > parseFloat(priceRange.max)) return false
                return true
            })
        }
        
        // In stock filter
        if (inStockOnly) {
            list = list.filter(c => (c.prices || []).length > 0)
        }

        // Per-spec column filters (Advanced + specific category)
        list = applySpecFilters(list, specFilters, specColTypes)

        return list
    }, [components, brandFilter, priceRange, inStockOnly, specFilters, specColTypes])

    // Display pagination: only render the current page's slice
    const totalPages = Math.max(1, Math.ceil(filteredComponents.length / pageSize))
    const pagedComponents = useMemo(
        () => filteredComponents.slice((page - 1) * pageSize, page * pageSize),
        [filteredComponents, page, pageSize],
    )
    // Jump back to page 1 whenever the result set or page size changes
    useEffect(() => { setPage(1) }, [category, search, sort, brandFilter, priceRange, inStockOnly, specFilters, pageSize])
    // Per-spec filters are category-specific; drop them when the category changes.
    useEffect(() => { setSpecFilters({}) }, [category])

    const clearAllFilters = useCallback(() => {
        setBrandFilter('')
        setPriceRange({ min: '', max: '' })
        setInStockOnly(false)
        setSpecFilters({})
    }, [])

    const setSpecFilter = useCallback((key, val) => setSpecFilters(f => ({ ...f, [key]: val })), [])

    const handleCategoryChange = useCallback((cat) => {
        setCategory(cat)
        const params = {}
        if (cat) params.category = cat
        if (search) params.search = search
        setSearchParams(params)
    }, [search, setSearchParams])

    const handleToggleWatch = useCallback((item) => {
        const adding = !inWatchlist(item.id)
        toggleWatch(item)
        toast.success(adding ? 'Saved to watchlist' : 'Removed from watchlist')
    }, [inWatchlist, toggleWatch])

    return (
        <main className="page">
            <div className="container">
                <header className="br-header">
                    <div>
                        <h1>Browse Components</h1>
                        <p className="br-header__sub">Find parts and compare prices across Indian retailers.</p>
                    </div>
                    {watchCount > 0 && (
                        <Link to="/watchlist" className="btn btn-primary">
                            <FiBookmark size={14} /> Watchlist ({watchCount})
                        </Link>
                    )}
                </header>

                <section className="br-filters">
                    <div className="br-search-row">
                        <div className="br-search">
                            <FiSearch className="br-search__icon" />
                            <input type="search" placeholder="Search components..." value={search} onChange={e => setSearch(e.target.value)} />
                        </div>
                        <button
                            className={`btn br-filter-toggle${showFilters ? ' active' : ''}`}
                            onClick={() => setShowFilters(!showFilters)}
                        >
                            <FiSliders size={14} /> Filters {(brandFilter || priceRange.min || priceRange.max || inStockOnly || Object.keys(specFilters).length > 0) && <span className="br-filter-badge">!</span>}
                        </button>
                    </div>

                    <div className="br-chips">
                        <button className={`chip ${!category ? 'active' : ''}`} onClick={() => handleCategoryChange('')}>All</button>
                        {Object.entries(CATEGORIES).map(([key, cat]) => (
                            <button key={key} className={`chip ${category === key ? 'active' : ''}`} onClick={() => handleCategoryChange(key)}>{cat.name}</button>
                        ))}
                    </div>
                    <div className="br-meta">
                        <span className="br-meta__count">
                            {loading ? 'Loading...' : filteredComponents.length !== components.length 
                                ? `${filteredComponents.length} of ${components.length} results` 
                                : `${components.length} results`}
                        </span>
                        <div className="br-meta__right">
                            <div className="br-mode-toggle">
                                <button className={mode === 'simple' ? 'active' : ''} onClick={() => setMode('simple')}>Simple</button>
                                <button className={mode === 'advanced' ? 'active' : ''} onClick={() => setMode('advanced')}>
                                    <FiColumns size={13} /> Advanced
                                </button>
                            </div>
                            <select className="br-pagesize" value={pageSize} onChange={e => setPageSize(Number(e.target.value))} aria-label="Results per page" title="Results per page">
                                <option value={15}>15 / page</option>
                                <option value={30}>30 / page</option>
                                <option value={60}>60 / page</option>
                                <option value={120}>120 / page</option>
                            </select>
                            <select value={sort} onChange={e => setSort(e.target.value)}>
                                <option value="price-low">Price: Low to High</option>
                                <option value="price-high">Price: High to Low</option>
                                <option value="name">Name: A-Z</option>
                            </select>
                            <div className={`br-view-toggle${mode === 'advanced' ? ' is-disabled' : ''}`}>
                                <button className={viewMode === 'grid' ? 'active' : ''} disabled={mode === 'advanced'} onClick={() => setViewMode('grid')} title={mode === 'advanced' ? 'Grid/list applies to Simple view' : 'Grid view'}><FiGrid size={15} /></button>
                                <button className={viewMode === 'list' ? 'active' : ''} disabled={mode === 'advanced'} onClick={() => setViewMode('list')} title={mode === 'advanced' ? 'Grid/list applies to Simple view' : 'List view'}><FiList size={15} /></button>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ===== FILTER BAR (full-width, in flow, never overlaps results) ===== */}
                {showFilters && (
                    <div className="br-filter-bar">
                        <div className="br-filter-field">
                            <label>Brand</label>
                            <SearchableSelect
                                value={brandFilter}
                                onChange={setBrandFilter}
                                options={availableBrands}
                                allLabel={`All brands (${availableBrands.length})`}
                                placeholder="All brands"
                            />
                        </div>
                        <div className="br-filter-field br-filter-field--price">
                            <label>Price (₹)</label>
                            <PriceRange value={priceRange} onChange={setPriceRange} min={0} max={priceMax} />
                        </div>
                        <label className="br-checkbox br-filter-field--check">
                            <input type="checkbox" checked={inStockOnly} onChange={e => setInStockOnly(e.target.checked)} />
                            <span>In stock only</span>
                        </label>
                        {specCols.map(k => {
                            if (specColTypes[k] === 'numeric') {
                                const f = specFilters[k] || { min: '', max: '' }
                                return (
                                    <div key={k} className="br-filter-field br-filter-field--num">
                                        <label>{formatSpecKey(k)}</label>
                                        <div className="br-num-range">
                                            <input type="number" placeholder="Min" value={f.min} onChange={e => setSpecFilter(k, { ...f, min: e.target.value })} />
                                            <span>-</span>
                                            <input type="number" placeholder="Max" value={f.max} onChange={e => setSpecFilter(k, { ...f, max: e.target.value })} />
                                        </div>
                                    </div>
                                )
                            }
                            return (
                                <div key={k} className="br-filter-field">
                                    <label>{formatSpecKey(k)}</label>
                                    <SearchableSelect
                                        multiple
                                        value={specFilters[k] || []}
                                        onChange={(next) => setSpecFilter(k, next)}
                                        options={distinctValues(components.map(c => c.specs?.[k])).map(v => ({ value: v, label: formatSpecValue(v) }))}
                                        placeholder="Any"
                                    />
                                </div>
                            )
                        })}
                        <div className="br-filter-bar__actions">
                            <button className="btn btn-sm br-clear-filters" onClick={clearAllFilters}>Clear all</button>
                        </div>
                        {mode !== 'advanced' && (
                            <p className="br-filter-hint">Switch to Advanced and pick a category for spec filters.</p>
                        )}
                    </div>
                )}

                <div className="br-results">
                {/* ===== RESULTS (box / rectangular share one card component) ===== */}
                {loading ? (
                    <section className={viewMode === 'grid' ? 'pc-grid' : 'pc-list'}>
                        {Array(viewMode === 'grid' ? 12 : 8).fill(0).map((_, i) =>
                            viewMode === 'grid' ? <CardSkeleton key={i} /> : <ListSkeleton key={i} />
                        )}
                    </section>
                ) : filteredComponents.length === 0 ? (
                    <EmptyState error={error} />
                ) : mode === 'advanced' ? (
                    <SpecTable
                        items={pagedComponents}
                        category={category}
                        onOpen={item => setDetail(item)}
                        hasWatch={id => watchIds.has(id)}
                        toggleWatch={handleToggleWatch}
                    />
                ) : (
                    <section className={viewMode === 'grid' ? 'pc-grid' : 'pc-list'}>
                        {pagedComponents.map(item => {
                            const isSaved = watchIds.has(item.id)
                            const bestVendor = getBestVendor(item)
                            const corner = (
                                <button
                                    className={`pc-corner${isSaved ? ' is-active' : ''}`}
                                    onClick={e => { e.stopPropagation(); handleToggleWatch(item) }}
                                    title={isSaved ? 'In your watchlist' : 'Save to watchlist'}
                                >
                                    {isSaved ? <FiCheck size={13} /> : <FiBookmark size={13} />}
                                </button>
                            )
                            const actions = viewMode === 'grid'
                                ? <span className="pc-view-details">View Details <FiChevronRight size={13} /></span>
                                : bestVendor?.url
                                    ? <a href={bestVendor.url} target="_blank" rel="noreferrer" className="btn btn-sm btn-primary" onClick={e => e.stopPropagation()}>
                                        <FiExternalLink size={12} /> Buy
                                      </a>
                                    : <button className="btn btn-sm" onClick={() => setDetail(item)}>View</button>
                            return (
                                <PartCard
                                    key={item.id}
                                    item={item}
                                    variant={viewMode === 'grid' ? 'grid' : 'list'}
                                    highlighted={isSaved}
                                    onOpen={() => setDetail(item)}
                                    corner={corner}
                                    actions={actions}
                                />
                            )
                        })}
                    </section>
                )}

                {/* ===== PAGINATION ===== */}
                {!loading && filteredComponents.length > 0 && (
                    <div className="br-pagination">
                        <span className="br-pagination__info">
                            Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, filteredComponents.length)} of {filteredComponents.length}
                        </span>
                        {totalPages > 1 && (
                            <div className="br-pagination__controls">
                                <button className="btn btn-sm" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Prev</button>
                                <span className="br-pagination__page">Page {page} of {totalPages}</span>
                                <button className="btn btn-sm" disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>Next</button>
                            </div>
                        )}
                    </div>
                )}
                </div>{/* /br-results */}

                {/* ===== DETAIL MODAL ===== */}
                {detail && (
                    <div className="modal-overlay" onClick={() => setDetail(null)}>
                        <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
                            <div className="modal-header">
                                <h2>{detail.name}</h2>
                                <button className="modal-close" onClick={() => setDetail(null)}><FiX /></button>
                            </div>
                            <div className="modal-body">
                                <div className="br-detail-top">
                                    <span className="br-card__badge">{CATEGORIES[detail.category?.slug]?.name || 'Component'}</span>
                                    <span className="br-detail__brand">{detail.brand}</span>
                                </div>

                                {Object.keys(detail.specifications || detail.specs || {}).length > 0 && (
                                    <div className="br-specs">
                                        <h4><FiInfo size={14} /> Specifications</h4>
                                        <div className="br-specs__grid">
                                            {Object.entries(detail.specifications || detail.specs).map(([k, v]) => (
                                                <div key={k} className="br-specs__item">
                                                    <span className="br-specs__key">{formatSpecKey(k)}</span>
                                                    <span className="br-specs__val">{formatSpecValue(v)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {detail.prices?.length > 0 && (
                                    <PriceGraph componentId={detail.id} />
                                )}

                                <div className="br-prices">
                                    <h4><FiShoppingCart size={14} /> Price Comparison - {detail.prices?.length || 0} retailers</h4>
                                    {detail.prices?.length ? (
                                        <div className="br-vendor-list">
                                            {[...detail.prices].sort((a, b) => parseFloat(a.price) - parseFloat(b.price)).map((p, i) => (
                                                <div key={i} className={`br-vendor${i === 0 ? ' br-vendor--best' : ''}`}>
                                                    <div className="br-vendor__info">
                                                        {i === 0 && <span className="br-vendor__label">Best Price</span>}
                                                        <span className="br-vendor__name">{p.vendor?.name || 'Unknown'}</span>
                                                    </div>
                                                    <span className="br-vendor__price">{formatPrice(p.price)}</span>
                                                    {p.url
                                                        ? <a href={p.url} target="_blank" rel="noreferrer" className="btn btn-sm btn-primary" onClick={e => e.stopPropagation()}>
                                                            <FiExternalLink size={12} /> Visit
                                                          </a>
                                                        : <span className="btn btn-sm" style={{ opacity: 0.4, cursor: 'default' }}>No link</span>}
                                                </div>
                                            ))}
                                        </div>
                                    ) : <p className="text-muted">No pricing available</p>}
                                </div>

                                <div className="br-detail__actions">
                                    <button
                                        className={`btn ${watchIds.has(detail.id) ? 'btn-primary' : ''}`}
                                        onClick={() => handleToggleWatch(detail)}
                                    >
                                        {watchIds.has(detail.id)
                                            ? <><FiCheck size={14} /> In Watchlist</>
                                            : <><FiBookmark size={14} /> Save to Watchlist</>}
                                    </button>
                                    {watchCount > 0 && (
                                        <Link to="/watchlist" className="btn">View Watchlist ({watchCount})</Link>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </main>
    )
}
