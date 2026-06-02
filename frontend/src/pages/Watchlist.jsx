import { useMemo, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { FiBookmark, FiTrash2, FiColumns, FiExternalLink, FiX, FiArrowRight, FiSearch, FiSliders, FiGrid, FiList } from 'react-icons/fi'
import { getLowestPrice, getBestVendor, CATEGORIES } from '../services/api'
import { useWatchlist } from '../hooks/useWatchlist'
import PartCard from '../components/PartCard'
import './Browse.css'
import './Watchlist.css'

export default function Watchlist() {
    const { items, count, remove, clear } = useWatchlist()

    // Mirror Browse: box/rectangular toggle (default rectangular) + advanced filters
    const [viewMode, setViewMode] = useState('list')
    const [search, setSearch] = useState('')
    const [category, setCategory] = useState('')
    const [sort, setSort] = useState('price-low')
    const [showFilters, setShowFilters] = useState(false)
    const [brandFilter, setBrandFilter] = useState('')
    const [priceRange, setPriceRange] = useState({ min: '', max: '' })
    const [inStockOnly, setInStockOnly] = useState(false)

    const availableBrands = useMemo(
        () => Array.from(new Set(items.map(i => i.brand).filter(Boolean))).sort(),
        [items],
    )

    // Categories actually present in the watchlist (so the chips aren't all empty)
    const presentCategories = useMemo(() => {
        const slugs = new Set(items.map(i => i.category?.slug).filter(Boolean))
        return Object.entries(CATEGORIES).filter(([key]) => slugs.has(key))
    }, [items])

    const filteredItems = useMemo(() => {
        let list = items
        if (category) list = list.filter(i => i.category?.slug === category)
        if (search.trim()) {
            const q = search.toLowerCase()
            list = list.filter(i => i.name?.toLowerCase().includes(q) || i.brand?.toLowerCase().includes(q))
        }
        if (brandFilter) list = list.filter(i => i.brand === brandFilter)
        if (priceRange.min || priceRange.max) {
            list = list.filter(i => {
                const price = getLowestPrice(i)
                if (!price) return false
                if (priceRange.min && price < parseFloat(priceRange.min)) return false
                if (priceRange.max && price > parseFloat(priceRange.max)) return false
                return true
            })
        }
        if (inStockOnly) list = list.filter(i => (i.prices || []).length > 0)

        const sorted = [...list].sort((a, b) => {
            const pa = getLowestPrice(a) || 0
            const pb = getLowestPrice(b) || 0
            if (sort === 'price-low') return pa - pb
            if (sort === 'price-high') return pb - pa
            if (sort === 'name') return (a.name || '').localeCompare(b.name || '')
            return 0
        })
        return sorted
    }, [items, category, search, brandFilter, priceRange, inStockOnly, sort])

    const clearAllFilters = useCallback(() => {
        setBrandFilter('')
        setPriceRange({ min: '', max: '' })
        setInStockOnly(false)
    }, [])

    const compareIds = filteredItems.slice(0, 4).map(i => i.id).join(',')

    return (
        <main className="page">
            <div className="container">
                <header className="wl-header">
                    <div className="wl-header__left">
                        <h1><FiBookmark size={20} /> Watchlist</h1>
                        <p className="wl-header__sub">
                            Parts you've saved to keep an eye on. Saved in your browser, and synced to
                            your account when you sign in.
                        </p>
                    </div>
                    {count > 0 && (
                        <div className="wl-header__actions">
                            {filteredItems.length >= 2 && (
                                <Link to={`/compare?ids=${compareIds}`} className="btn btn-primary btn-sm">
                                    <FiColumns size={13} /> Compare side by side
                                </Link>
                            )}
                            <button className="btn btn-secondary btn-sm" onClick={clear}>
                                <FiTrash2 size={13} /> Clear all
                            </button>
                        </div>
                    )}
                </header>

                {count === 0 ? (
                    <div className="wl-empty">
                        <div className="wl-empty__icon"><FiBookmark size={34} /></div>
                        <h2>Your watchlist is empty</h2>
                        <p>Save components from Browse or the Builder and they'll show up here.</p>
                        <Link to="/browse" className="btn btn-primary">
                            Browse components <FiArrowRight size={14} />
                        </Link>
                    </div>
                ) : (
                    <>
                        {/* ===== Filters (mirrors Browse) ===== */}
                        <section className="br-filters">
                            <div className="br-search-row">
                                <div className="br-search">
                                    <FiSearch className="br-search__icon" />
                                    <input type="search" placeholder="Search your watchlist..." value={search} onChange={e => setSearch(e.target.value)} />
                                </div>
                                <button
                                    className={`btn br-filter-toggle${showFilters ? ' active' : ''}`}
                                    onClick={() => setShowFilters(!showFilters)}
                                >
                                    <FiSliders size={14} /> Filters {(brandFilter || priceRange.min || priceRange.max || inStockOnly) && <span className="br-filter-badge">!</span>}
                                </button>
                            </div>

                            {showFilters && (
                                <div className="br-advanced-filters">
                                    <div className="br-filter-group">
                                        <label>Brand</label>
                                        <select value={brandFilter} onChange={e => setBrandFilter(e.target.value)}>
                                            <option value="">All Brands ({availableBrands.length})</option>
                                            {availableBrands.map(b => <option key={b} value={b}>{b}</option>)}
                                        </select>
                                    </div>
                                    <div className="br-filter-group br-filter-group--price">
                                        <label>Price Range (₹)</label>
                                        <div className="br-price-inputs">
                                            <input type="number" placeholder="Min" value={priceRange.min} onChange={e => setPriceRange(p => ({ ...p, min: e.target.value }))} />
                                            <span>–</span>
                                            <input type="number" placeholder="Max" value={priceRange.max} onChange={e => setPriceRange(p => ({ ...p, max: e.target.value }))} />
                                        </div>
                                    </div>
                                    <div className="br-filter-group br-filter-group--checkbox">
                                        <label className="br-checkbox">
                                            <input type="checkbox" checked={inStockOnly} onChange={e => setInStockOnly(e.target.checked)} />
                                            <span>In Stock Only</span>
                                        </label>
                                    </div>
                                    <button className="btn btn-sm br-clear-filters" onClick={clearAllFilters}>Clear All</button>
                                </div>
                            )}

                            {presentCategories.length > 0 && (
                                <div className="br-chips">
                                    <button className={`chip ${!category ? 'active' : ''}`} onClick={() => setCategory('')}>All</button>
                                    {presentCategories.map(([key, cat]) => (
                                        <button key={key} className={`chip ${category === key ? 'active' : ''}`} onClick={() => setCategory(key)}>{cat.name}</button>
                                    ))}
                                </div>
                            )}

                            <div className="br-meta">
                                <span className="br-meta__count">
                                    {filteredItems.length !== count ? `${filteredItems.length} of ${count} saved` : `${count} saved`}
                                </span>
                                <div className="br-meta__right">
                                    <select value={sort} onChange={e => setSort(e.target.value)}>
                                        <option value="price-low">Price: Low to High</option>
                                        <option value="price-high">Price: High to Low</option>
                                        <option value="name">Name: A-Z</option>
                                    </select>
                                    <div className="br-view-toggle">
                                        <button className={viewMode === 'grid' ? 'active' : ''} onClick={() => setViewMode('grid')} title="Grid view"><FiGrid size={15} /></button>
                                        <button className={viewMode === 'list' ? 'active' : ''} onClick={() => setViewMode('list')} title="List view"><FiList size={15} /></button>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* ===== Results (shared PartCard) ===== */}
                        {filteredItems.length === 0 ? (
                            <div className="wl-empty">
                                <div className="wl-empty__icon"><FiSearch size={30} /></div>
                                <h2>No saved parts match</h2>
                                <p>Try adjusting your search or filters.</p>
                            </div>
                        ) : (
                            <section className={viewMode === 'grid' ? 'pc-grid' : 'pc-list'}>
                                {filteredItems.map(item => {
                                    const best = getBestVendor(item)
                                    const corner = (
                                        <button className="pc-corner" onClick={() => remove(item.id)} title="Remove from watchlist">
                                            <FiX size={14} />
                                        </button>
                                    )
                                    const actions = best?.url
                                        ? <a href={best.url} target="_blank" rel="noreferrer" className="btn btn-sm btn-primary"><FiExternalLink size={12} /> Buy</a>
                                        : <button className="btn btn-sm" disabled style={{ opacity: 0.5 }}>No link</button>
                                    return (
                                        <PartCard
                                            key={item.id}
                                            item={item}
                                            variant={viewMode === 'grid' ? 'grid' : 'list'}
                                            corner={corner}
                                            actions={actions}
                                        />
                                    )
                                })}
                            </section>
                        )}
                    </>
                )}
            </div>
        </main>
    )
}
