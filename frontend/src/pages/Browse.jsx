import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { API, formatPrice, getLowestPrice, CATEGORIES, formatSpecKey, formatSpecValue } from '../services/api'
import { columnsForCategory, inferColumnType, distinctValues, applySpecFilters, compareValues } from '../services/specColumns'
import { FiSearch, FiX, FiExternalLink, FiCheck, FiBookmark, FiShoppingCart, FiInfo, FiSliders } from 'react-icons/fi'
import toast from 'react-hot-toast'
import PriceGraph from '../components/PriceGraph'
import SpecTable from '../components/SpecTable'
import SearchableSelect from '../components/SearchableSelect'
import PriceRange from '../components/PriceRange'
import { useWatchlist } from '../hooks/useWatchlist'
import './Browse.css'

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
    const [sort] = useState('price-low')   // API fetch order; column headers do the real sorting
    const [detail, setDetail] = useState(null)
    const [pageSize, setPageSize] = useState(10)
    const [page, setPage] = useState(1)
    const [tableSort, setTableSort] = useState({ key: '__price', dir: 'asc' })
    const [infCount, setInfCount] = useState(50)   // for "All" mode: rows shown so far
    const sentinelRef = useRef(null)

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

    // Get unique brands from loaded components
    const availableBrands = useMemo(() => {
        const brands = new Set(components.map(c => c.brand).filter(Boolean))
        return Array.from(brands).sort()
    }, [components])

    // Per-spec filters apply when a specific category is chosen, for spec columns
    // that actually have data in the loaded components.
    const specCols = category
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

    // Sort the WHOLE filtered list (so sorting spans every page, not just the
    // visible one) by the active column, then paginate.
    const sortedComponents = useMemo(() => {
        const { key, dir } = tableSort
        const mul = dir === 'asc' ? 1 : -1
        const list = [...filteredComponents]
        list.sort((a, b) => {
            let cmp
            if (key === '__price') cmp = (getLowestPrice(a) ?? Infinity) - (getLowestPrice(b) ?? Infinity)
            else if (key === '__name') cmp = String(a.name).localeCompare(String(b.name))
            else if (key === '__brand') cmp = String(a.brand || '').localeCompare(String(b.brand || ''))
            else cmp = compareValues(a.specs?.[key], b.specs?.[key], specColTypes[key])
            return cmp * mul
        })
        return list
    }, [filteredComponents, tableSort, specColTypes])

    // pageSize 0 = "All": render progressively (infinite scroll, 50 more at a time).
    const allMode = pageSize === 0
    const totalPages = allMode ? 1 : Math.max(1, Math.ceil(sortedComponents.length / pageSize))
    const pagedComponents = useMemo(() => {
        if (allMode) return sortedComponents.slice(0, infCount)
        return sortedComponents.slice((page - 1) * pageSize, page * pageSize)
    }, [sortedComponents, page, pageSize, allMode, infCount])

    // Reset paging when the result set, page size, or sort changes.
    useEffect(() => { setPage(1); setInfCount(50) }, [category, search, brandFilter, priceRange, inStockOnly, specFilters, pageSize, tableSort])
    // Per-spec filters are category-specific; drop them when the category changes.
    useEffect(() => { setSpecFilters({}) }, [category])

    // Infinite scroll for "All": grow the visible count as the sentinel nears view.
    useEffect(() => {
        if (!allMode) return
        const el = sentinelRef.current
        if (!el) return
        const obs = new IntersectionObserver(
            (entries) => { if (entries[0].isIntersecting) setInfCount(c => Math.min(c + 50, sortedComponents.length)) },
            { rootMargin: '400px' },
        )
        obs.observe(el)
        return () => obs.disconnect()
    }, [allMode, sortedComponents.length])

    const toggleSort = useCallback((key) =>
        setTableSort(s => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' })), [])

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
                            <label className="br-pagesize">
                                <input
                                    type="number" min="0" step="5" list="br-page-sizes"
                                    value={pageSize}
                                    onChange={e => setPageSize(Math.max(0, Number(e.target.value) || 0))}
                                    title="Rows per page (0 = show all, infinite scroll)"
                                    aria-label="Rows per page"
                                />
                                <span>/ page{pageSize === 0 ? ' (all)' : ''}</span>
                                <datalist id="br-page-sizes">
                                    <option value="10" /><option value="25" /><option value="50" /><option value="100" /><option value="0" />
                                </datalist>
                            </label>
                        </div>
                    </div>
                </section>

                {/* ===== FILTER BAR: common filters on row 1, spec filters from row 2 ===== */}
                {showFilters && (
                    <div className="br-filter-bar">
                        <div className="br-filter-row br-filter-row--common">
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
                            <div className="br-filter-bar__actions">
                                <button className="btn btn-sm br-clear-filters" onClick={clearAllFilters}>Clear all</button>
                            </div>
                        </div>

                        {specCols.length > 0 ? (
                            <div className="br-filter-row br-filter-row--specs">
                                <span className="br-filter-row__title">{CATEGORIES[category]?.name} specs</span>
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
                            </div>
                        ) : (
                            <p className="br-filter-hint">Pick a category to filter by its specs.</p>
                        )}
                    </div>
                )}

                <div className="br-results">
                {loading ? (
                    <div className="br-loading"><div className="spinner" /></div>
                ) : filteredComponents.length === 0 ? (
                    <EmptyState error={error} />
                ) : (
                    <SpecTable
                        items={pagedComponents}
                        category={category}
                        sort={tableSort}
                        onSort={toggleSort}
                        onOpen={item => setDetail(item)}
                        hasWatch={id => watchIds.has(id)}
                        toggleWatch={handleToggleWatch}
                    />
                )}

                {/* ===== PAGINATION / infinite-scroll sentinel ===== */}
                {!loading && filteredComponents.length > 0 && (
                    allMode ? (
                        <div className="br-pagination">
                            <span className="br-pagination__info">
                                Showing {Math.min(infCount, sortedComponents.length)} of {sortedComponents.length}
                            </span>
                            {infCount < sortedComponents.length && <div ref={sentinelRef} className="br-infinite-sentinel" />}
                        </div>
                    ) : (
                        <div className="br-pagination">
                            <span className="br-pagination__info">
                                Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, sortedComponents.length)} of {sortedComponents.length}
                            </span>
                            {totalPages > 1 && (
                                <div className="br-pagination__controls">
                                    <button className="btn btn-sm" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Prev</button>
                                    <span className="br-pagination__page">Page {page} of {totalPages}</span>
                                    <button className="btn btn-sm" disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>Next</button>
                                </div>
                            )}
                        </div>
                    )
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
