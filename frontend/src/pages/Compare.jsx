import { useState, useEffect, useRef } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { API, formatPrice, getLowestPrice, getBestVendor, getSavings } from '../services/api'
import toast from 'react-hot-toast'
import {
    FiPlus, FiX, FiSearch, FiAward, FiPackage, FiColumns,
    FiArrowRight, FiTrendingDown, FiLoader, FiShoppingCart,
    FiChevronDown, FiChevronUp, FiGrid, FiList, FiTrash2
} from 'react-icons/fi'
import './Compare.css'

const LOWER_IS_BETTER = new Set(['tdp', 'wattage', 'power', 'cas_latency', 'latency', 'noise_level'])

function getSpecsObj(item) {
    const s = item?.specs || item?.specifications
    if (!s) return {}
    if (typeof s === 'string') { try { return JSON.parse(s) } catch { return {} } }
    return s
}

function parseNum(v) {
    if (v === null || v === undefined) return null
    const n = parseFloat(String(v).replace(/[^0-9.-]/g, ''))
    return isNaN(n) ? null : n
}

/* ========== Specs Comparison Table ========== */
function SpecsComparisonTable({ components }) {
    if (!components || components.length < 2) return null
    const allSpecs = components.map(getSpecsObj)
    const allKeys = [...new Set(allSpecs.flatMap(s => Object.keys(s)))]
    if (!allKeys.length) return null

    return (
        <section className="cp-specs-table">
            <div className="cp-section-head">
                <FiColumns size={18} />
                <div>
                    <h2>Spec-by-Spec Comparison</h2>
                    <p>Side-by-side specifications — green highlights the best value</p>
                </div>
            </div>
            <div className="cp-specs-table__wrap">
                <table className="cp-specs-tbl">
                    <thead>
                        <tr>
                            <th className="cp-specs-tbl__label-col">Specification</th>
                            {components.map((c, i) => (
                                <th key={i} className="cp-specs-tbl__comp-col">
                                    <span className="cp-specs-tbl__comp-name">{c.name}</span>
                                    <span className="cp-specs-tbl__comp-brand">{c.brand}</span>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {/* Price row */}
                        <tr className="cp-specs-tbl__price-row">
                            <td className="cp-specs-tbl__key">Lowest Price</td>
                            {components.map((c, i) => {
                                const price = getLowestPrice(c)
                                const allPrices = components.map(getLowestPrice).filter(Boolean)
                                const isBest = price && price <= Math.min(...allPrices)
                                return (
                                    <td key={i} className={`cp-specs-tbl__val${isBest ? ' cp-specs-tbl__val--best' : ''}`}>
                                        {price ? formatPrice(price) : '—'}
                                    </td>
                                )
                            })}
                        </tr>
                        {allKeys.map(key => {
                            const vals = allSpecs.map(s => s[key] !== undefined ? s[key] : null)
                            const nums = vals.map(parseNum)
                            const allNum = nums.every(n => n !== null)
                            let bestIdx = -1
                            if (allNum && new Set(nums).size > 1) {
                                bestIdx = LOWER_IS_BETTER.has(key)
                                    ? nums.indexOf(Math.min(...nums))
                                    : nums.indexOf(Math.max(...nums))
                            }
                            return (
                                <tr key={key}>
                                    <td className="cp-specs-tbl__key">{key.replace(/_/g, ' ')}</td>
                                    {vals.map((v, i) => (
                                        <td key={i} className={`cp-specs-tbl__val${i === bestIdx ? ' cp-specs-tbl__val--best' : ''}${v === null ? ' cp-specs-tbl__val--na' : ''}`}>
                                            {v !== null ? String(v) : '—'}
                                        </td>
                                    ))}
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </section>
    )
}

/* ========== Summary Bar ========== */
function SummaryBar({ components }) {
    if (!components || components.length < 2) return null
    const prices = components.map(c => ({ name: c.name, price: getLowestPrice(c) || 0 }))
    const sorted = [...prices].sort((a, b) => a.price - b.price)
    const cheapest = sorted[0]
    const priceDiff = sorted.length >= 2 ? sorted[sorted.length - 1].price - sorted[0].price : 0

    return (
        <div className="cp-summary">
            <div className="cp-summary__item">
                <span className="cp-summary__label">Comparing</span>
                <span className="cp-summary__value">{components.length} components</span>
            </div>
            <div className="cp-summary__divider" />
            <div className="cp-summary__item">
                <span className="cp-summary__label">Best Price</span>
                <span className="cp-summary__value cp-summary__value--accent">{formatPrice(cheapest.price)}</span>
            </div>
            {priceDiff > 0 && (
                <>
                    <div className="cp-summary__divider" />
                    <div className="cp-summary__item">
                        <span className="cp-summary__label">Price Spread</span>
                        <span className="cp-summary__value">{formatPrice(priceDiff)}</span>
                    </div>
                </>
            )}
        </div>
    )
}

const MAX_SLOTS = 4

export default function Compare() {
    const [searchParams] = useSearchParams()
    const [slots, setSlots] = useState([null, null, null, null])
    const [loading, setLoading] = useState(true)
    const [activeSlot, setActiveSlot] = useState(null)
    const [query, setQuery] = useState('')
    const [searchResults, setSearchResults] = useState([])
    const [searching, setSearching] = useState(false)
    const [categories, setCategories] = useState([])
    const [selectedCategory, setSelectedCategory] = useState('')
    const [view, setView] = useState('cards') // 'cards' or 'table'
    const [expandedSpecs, setExpandedSpecs] = useState({})
    const searchRef = useRef(null)
    const inputRef = useRef(null)

    useEffect(() => {
        const ids = searchParams.get('ids')?.split(',').map(Number).filter(Boolean) || []
        if (!ids.length) { setLoading(false); return }
        API.compareComponents(ids)
            .then(data => {
                const components = data.components || data
                setSlots(prev => {
                    const next = [...prev]
                    components.forEach((c, i) => { if (i < MAX_SLOTS) next[i] = c })
                    return next
                })
            })
            .catch(e => toast.error('Failed to load comparison: ' + e.message))
            .finally(() => setLoading(false))
    }, [])

    useEffect(() => {
        API.getCategories()
            .then(data => setCategories(data || []))
            .catch(() => {})
    }, [])

    useEffect(() => {
        if (!query.trim() && !selectedCategory) { setSearchResults([]); return }
        const t = setTimeout(() => {
            setSearching(true)
            const params = { limit: 50 }
            if (query.trim()) params.search = query
            if (selectedCategory) params.category = selectedCategory
            API.getComponents(params)
                .then(data => {
                    const list = data.components || data || []
                    const used = new Set(slots.filter(Boolean).map(s => s.id))
                    setSearchResults(list.filter(c => !used.has(c.id)).slice(0, 12))
                })
                .catch(() => setSearchResults([]))
                .finally(() => setSearching(false))
        }, 300)
        return () => clearTimeout(t)
    }, [query, selectedCategory, slots])

    useEffect(() => {
        const handler = (e) => {
            if (searchRef.current && !searchRef.current.contains(e.target)) closeSearch()
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    const openSearch = (slotIdx) => {
        setActiveSlot(slotIdx)
        setQuery('')
        setSelectedCategory('')
        setSearchResults([])
        setTimeout(() => inputRef.current?.focus(), 50)
    }

    const closeSearch = () => {
        setActiveSlot(null)
        setQuery('')
        setSelectedCategory('')
        setSearchResults([])
    }

    const addComponent = (component) => {
        if (activeSlot === null) return
        setSlots(prev => {
            const next = [...prev]
            next[activeSlot] = component
            return next
        })
        closeSearch()
    }

    const removeComponent = (slotIdx) => {
        setSlots(prev => {
            const next = [...prev]
            next[slotIdx] = null
            const filled = next.filter(Boolean)
            return [...filled, ...Array(MAX_SLOTS - filled.length).fill(null)]
        })
    }

    const clearAll = () => {
        setSlots([null, null, null, null])
    }

    const toggleSpecs = (idx) => {
        setExpandedSpecs(prev => ({ ...prev, [idx]: !prev[idx] }))
    }

    const filledSlots = slots.filter(Boolean)

    const getSpecs = (item) => {
        if (typeof item.specifications === 'string') {
            try { return JSON.parse(item.specifications) } catch { return {} }
        }
        return item.specifications || {}
    }

    const getPricesSorted = (item) =>
        (item.prices || []).slice().sort((a, b) => a.price - b.price)

    const bestSlotIdx = filledSlots.length > 0
        ? filledSlots.reduce((bestIdx, cur, idx) => {
            const curLow = getLowestPrice(cur)
            const bestLow = getLowestPrice(filledSlots[bestIdx])
            return curLow < bestLow ? idx : bestIdx
        }, 0)
        : 0

    if (loading) {
        return (
            <main className="page">
                <div className="container">
                    <div className="cp-loading">
                        <FiLoader size={28} className="cp-spin" />
                        <p>Loading comparison...</p>
                    </div>
                </div>
            </main>
        )
    }

    return (
        <main className="page">
            <div className="container">

                {/* ===== Header ===== */}
                <header className="cp-header">
                    <div className="cp-header__left">
                        <h1><FiColumns style={{ verticalAlign: 'middle' }} /> Compare</h1>
                        <p className="cp-header__sub">
                            Compare prices across Indian retailers — up to {MAX_SLOTS} components side by side
                        </p>
                    </div>
                    <div className="cp-header__actions">
                        {filledSlots.length > 0 && (
                            <>
                                <div className="cp-view-toggle">
                                    <button
                                        className={`cp-view-btn ${view === 'cards' ? 'active' : ''}`}
                                        onClick={() => setView('cards')}
                                        title="Card view"
                                    >
                                        <FiGrid size={14} />
                                    </button>
                                    <button
                                        className={`cp-view-btn ${view === 'table' ? 'active' : ''}`}
                                        onClick={() => setView('table')}
                                        title="Table view"
                                    >
                                        <FiList size={14} />
                                    </button>
                                </div>
                                <button className="btn btn-secondary btn-sm cp-clear-btn" onClick={clearAll}>
                                    <FiTrash2 size={12} /> Clear All
                                </button>
                            </>
                        )}
                        <Link to="/browse" className="btn btn-secondary btn-sm">Browse All</Link>
                    </div>
                </header>

                {/* ===== Summary Bar ===== */}
                <SummaryBar components={filledSlots} />

                {/* ===== Card View ===== */}
                {view === 'cards' && (
                    <div className={`cp-slots cp-slots--${Math.max(filledSlots.length + (filledSlots.length < MAX_SLOTS ? 1 : 0), 2)}`}>
                        {slots.map((slot, idx) => {
                            const prevFilled = idx === 0 || slots[idx - 1] !== null
                            const showSlot = slot !== null || (prevFilled && idx < MAX_SLOTS)
                            if (!showSlot) return null

                            const prices = slot ? getPricesSorted(slot) : []
                            const low = slot ? getLowestPrice(slot) : 0
                            const maxP = slot ? Math.max(...prices.map(p => p.price), 1) : 1
                            const isBest = slot && filledSlots.indexOf(slot) === bestSlotIdx && filledSlots.length > 1
                            const specsObj = slot ? getSpecs(slot) : {}
                            const specsKeys = Object.keys(specsObj)
                            const isExpanded = expandedSpecs[idx]

                            return (
                                <div
                                    key={idx}
                                    className={`cp-card${slot ? ' cp-card--filled' : ' cp-card--empty'}${isBest ? ' cp-card--best' : ''}`}
                                >
                                    {slot ? (
                                        <>
                                            {isBest && (
                                                <span className="cp-card__badge">
                                                    <FiTrendingDown size={11} /> Best Price
                                                </span>
                                            )}
                                            <button className="cp-card__remove" onClick={() => removeComponent(idx)} title="Remove">
                                                <FiX size={14} />
                                            </button>
                                            <div className="cp-card__img">
                                                {slot.image_url
                                                    ? <img src={slot.image_url} alt={slot.name} />
                                                    : <FiPackage size={32} />}
                                            </div>
                                            <div className="cp-card__info">
                                                <span className="cp-card__category">
                                                    {slot.category?.name || slot.category_name || 'Component'}
                                                </span>
                                                <h3 className="cp-card__name">{slot.name}</h3>
                                                {slot.brand && <p className="cp-card__brand">{slot.brand}</p>}
                                            </div>
                                            <div className="cp-card__price-hero">
                                                <div className="cp-card__price-main">
                                                    <span className="cp-card__price-label">From</span>
                                                    <span className="cp-card__price-value">{formatPrice(low)}</span>
                                                </div>
                                                <span className="cp-card__price-vendor">
                                                    {getBestVendor(slot)?.vendor?.name || getBestVendor(slot)?.vendor_name || ''}
                                                </span>
                                            </div>
                                            <div className="cp-card__vendors">
                                                <div className="cp-card__vendors-head">
                                                    <span>{prices.length} retailer{prices.length !== 1 ? 's' : ''}</span>
                                                    {getSavings(slot) > 0 && (
                                                        <span className="cp-card__savings">Save {formatPrice(getSavings(slot))}</span>
                                                    )}
                                                </div>
                                                {prices.map((p, j) => {
                                                    const pct = Math.round((p.price / maxP) * 100)
                                                    const isLowest = j === 0
                                                    return (
                                                        <div key={j} className={`cp-vendor-row${isLowest ? ' cp-vendor-row--best' : ''}`}>
                                                            <div className="cp-vendor-row__meta">
                                                                <span className="cp-vendor-row__name">
                                                                    {p.vendor?.name || p.vendor_name || 'Store'}
                                                                </span>
                                                                <span className="cp-vendor-row__price">
                                                                    {formatPrice(p.price)}
                                                                </span>
                                                                {p.url && (
                                                                    <a href={p.url} target="_blank" rel="noopener noreferrer" className="cp-vendor-row__link cp-vendor-row__link--buy" title="Buy now">
                                                                        <FiShoppingCart size={10} />
                                                                    </a>
                                                                )}
                                                            </div>
                                                            <div className="cp-vendor-row__bar-track">
                                                                <div className="cp-vendor-row__bar-fill" style={{ width: `${pct}%` }} />
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                            {specsKeys.length > 0 && (
                                                <div className="cp-card__specs">
                                                    <button className="cp-card__specs-toggle" onClick={() => toggleSpecs(idx)}>
                                                        <span>Specifications ({specsKeys.length})</span>
                                                        {isExpanded ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />}
                                                    </button>
                                                    {isExpanded && (
                                                        <div className="cp-card__specs-grid">
                                                            {Object.entries(specsObj).map(([k, v]) => (
                                                                <div key={k} className="cp-spec-row">
                                                                    <span className="cp-spec-row__key">{k.replace(/_/g, ' ')}</span>
                                                                    <span className="cp-spec-row__val">{String(v)}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <button className="cp-card__add-btn" onClick={() => openSearch(idx)}>
                                            <div className="cp-card__add-icon"><FiPlus size={24} /></div>
                                            <span>Add Component</span>
                                            <span className="cp-card__add-hint">Search from 500+ parts</span>
                                        </button>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}

                {/* ===== Table View ===== */}
                {view === 'table' && filledSlots.length > 0 && (
                    <div className="cp-table-view">
                        <div className="cp-table-view__wrap">
                            <table className="cp-table-view__tbl">
                                <thead>
                                    <tr>
                                        <th className="cp-table-view__label-col" />
                                        {filledSlots.map((slot, i) => {
                                            const isBest = i === bestSlotIdx && filledSlots.length > 1
                                            return (
                                                <th key={i} className={`cp-table-view__comp-col${isBest ? ' cp-table-view__comp-col--best' : ''}`}>
                                                    <div className="cp-table-view__comp-header">
                                                        {isBest && <span className="cp-table-view__best-tag"><FiTrendingDown size={10} /> Best</span>}
                                                        <span className="cp-table-view__comp-name">{slot.name}</span>
                                                        <span className="cp-table-view__comp-brand">{slot.brand}</span>
                                                        <button className="cp-table-view__remove" onClick={() => removeComponent(slots.indexOf(slot))}>
                                                            <FiX size={12} />
                                                        </button>
                                                    </div>
                                                </th>
                                            )
                                        })}
                                        {filledSlots.length < MAX_SLOTS && (
                                            <th className="cp-table-view__add-col">
                                                <button className="cp-table-view__add-btn" onClick={() => openSearch(filledSlots.length)}>
                                                    <FiPlus size={16} /> Add
                                                </button>
                                            </th>
                                        )}
                                    </tr>
                                </thead>
                                <tbody>
                                    {/* Image row */}
                                    <tr>
                                        <td className="cp-table-view__key">Image</td>
                                        {filledSlots.map((slot, i) => (
                                            <td key={i} className="cp-table-view__val">
                                                <div className="cp-table-view__img">
                                                    {slot.image_url ? <img src={slot.image_url} alt={slot.name} /> : <FiPackage size={24} />}
                                                </div>
                                            </td>
                                        ))}
                                        {filledSlots.length < MAX_SLOTS && <td />}
                                    </tr>
                                    {/* Category */}
                                    <tr>
                                        <td className="cp-table-view__key">Category</td>
                                        {filledSlots.map((slot, i) => (
                                            <td key={i} className="cp-table-view__val">
                                                {slot.category?.name || slot.category_name || '—'}
                                            </td>
                                        ))}
                                        {filledSlots.length < MAX_SLOTS && <td />}
                                    </tr>
                                    {/* Price */}
                                    <tr className="cp-table-view__price-row">
                                        <td className="cp-table-view__key">Best Price</td>
                                        {filledSlots.map((slot, i) => {
                                            const price = getLowestPrice(slot)
                                            const isBest = i === bestSlotIdx && filledSlots.length > 1
                                            return (
                                                <td key={i} className={`cp-table-view__val cp-table-view__val--price${isBest ? ' cp-table-view__val--best-price' : ''}`}>
                                                    {price ? formatPrice(price) : '—'}
                                                </td>
                                            )
                                        })}
                                        {filledSlots.length < MAX_SLOTS && <td />}
                                    </tr>
                                    {/* Vendor */}
                                    <tr>
                                        <td className="cp-table-view__key">Best From</td>
                                        {filledSlots.map((slot, i) => (
                                            <td key={i} className="cp-table-view__val">
                                                {getBestVendor(slot)?.vendor?.name || getBestVendor(slot)?.vendor_name || '—'}
                                            </td>
                                        ))}
                                        {filledSlots.length < MAX_SLOTS && <td />}
                                    </tr>
                                    {/* Retailers count */}
                                    <tr>
                                        <td className="cp-table-view__key">Retailers</td>
                                        {filledSlots.map((slot, i) => (
                                            <td key={i} className="cp-table-view__val">
                                                {(slot.prices || []).length}
                                            </td>
                                        ))}
                                        {filledSlots.length < MAX_SLOTS && <td />}
                                    </tr>
                                    {/* Dynamic spec rows */}
                                    {(() => {
                                        const allSpecs = filledSlots.map(getSpecsObj)
                                        const allKeys = [...new Set(allSpecs.flatMap(s => Object.keys(s)))]
                                        return allKeys.map(key => {
                                            const vals = allSpecs.map(s => s[key] !== undefined ? s[key] : null)
                                            const nums = vals.map(parseNum)
                                            const allNum = nums.every(n => n !== null)
                                            let best = -1
                                            if (allNum && new Set(nums).size > 1) {
                                                best = LOWER_IS_BETTER.has(key)
                                                    ? nums.indexOf(Math.min(...nums))
                                                    : nums.indexOf(Math.max(...nums))
                                            }
                                            return (
                                                <tr key={key}>
                                                    <td className="cp-table-view__key">{key.replace(/_/g, ' ')}</td>
                                                    {vals.map((v, i) => (
                                                        <td key={i} className={`cp-table-view__val${i === best ? ' cp-table-view__val--highlight' : ''}${v === null ? ' cp-table-view__val--na' : ''}`}>
                                                            {v !== null ? String(v) : '—'}
                                                        </td>
                                                    ))}
                                                    {filledSlots.length < MAX_SLOTS && <td />}
                                                </tr>
                                            )
                                        })
                                    })()}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* ===== Search Modal ===== */}
                {activeSlot !== null && (
                    <div className="cp-overlay" onClick={e => { if (e.target === e.currentTarget) closeSearch() }}>
                        <div className="cp-search-panel" ref={searchRef}>
                            <div className="cp-search-panel__header">
                                <div>
                                    <h3>Add Component</h3>
                                    <p className="cp-search-panel__header-sub">Slot {activeSlot + 1} of {MAX_SLOTS}</p>
                                </div>
                                <button className="cp-search-panel__close" onClick={closeSearch}>
                                    <FiX size={18} />
                                </button>
                            </div>
                            <div className="cp-search-panel__input-wrap">
                                <FiSearch size={16} className="cp-search-panel__icon" />
                                <input
                                    ref={inputRef}
                                    className="cp-search-panel__input"
                                    placeholder="Search by name, brand, or category..."
                                    value={query}
                                    onChange={e => setQuery(e.target.value)}
                                />
                                {searching && <FiLoader size={14} className="cp-spin cp-search-panel__spinner" />}
                            </div>
                            <div className="cp-search-panel__filters">
                                <button
                                    className={`cp-filter-chip${!selectedCategory ? ' active' : ''}`}
                                    onClick={() => setSelectedCategory('')}
                                >All</button>
                                {categories.map(cat => (
                                    <button
                                        key={cat.id}
                                        className={`cp-filter-chip${selectedCategory === cat.slug ? ' active' : ''}`}
                                        onClick={() => setSelectedCategory(cat.slug)}
                                    >{cat.name}</button>
                                ))}
                            </div>
                            <div className="cp-search-panel__results">
                                {!query.trim() && !selectedCategory && (
                                    <div className="cp-search-panel__hint">
                                        <FiSearch size={24} />
                                        <p>Search or select a category to find components</p>
                                    </div>
                                )}
                                {(query.trim() || selectedCategory) && !searching && searchResults.length === 0 && (
                                    <div className="cp-search-panel__hint">
                                        <p>No components found. Try a different search.</p>
                                    </div>
                                )}
                                {searchResults.map(c => {
                                    const low = getLowestPrice(c)
                                    return (
                                        <button key={c.id} className="cp-search-result" onClick={() => addComponent(c)}>
                                            <div className="cp-search-result__img">
                                                {c.image_url ? <img src={c.image_url} alt={c.name} /> : <FiPackage size={20} />}
                                            </div>
                                            <div className="cp-search-result__info">
                                                <span className="cp-search-result__cat">
                                                    {c.category?.name || c.category_name}
                                                </span>
                                                <span className="cp-search-result__name">{c.name}</span>
                                                {c.brand && <span className="cp-search-result__brand">{c.brand}</span>}
                                            </div>
                                            <span className="cp-search-result__price">
                                                {low ? formatPrice(low) : '—'}
                                            </span>
                                            <FiPlus size={14} className="cp-search-result__add" />
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {/* ===== Specs Table (Card view only) ===== */}
                {view === 'cards' && <SpecsComparisonTable components={filledSlots} />}

                {/* ===== Verdict ===== */}
                {filledSlots.length >= 2 && (
                    <section className="cp-verdict">
                        <div className="cp-verdict__icon-wrap"><FiAward size={22} /></div>
                        <h3>Quick Verdict</h3>
                        <p>
                            <strong>{filledSlots[bestSlotIdx]?.name}</strong> offers the best value at{' '}
                            <strong className="cp-verdict__price">
                                {formatPrice(getLowestPrice(filledSlots[bestSlotIdx]))}
                            </strong>
                            {getSavings(filledSlots[bestSlotIdx]) > 0 && (
                                <> — save up to <strong className="cp-verdict__savings">
                                    {formatPrice(getSavings(filledSlots[bestSlotIdx]))}
                                </strong> by choosing the right retailer</>
                            )}.
                        </p>
                        <Link to="/builder" className="btn btn-primary">
                            Add to Builder <FiArrowRight size={16} />
                        </Link>
                    </section>
                )}

                {/* ===== Empty State ===== */}
                {filledSlots.length === 0 && (
                    <div className="cp-empty">
                        <div className="cp-empty__icon"><FiColumns size={36} /></div>
                        <h2>Nothing to compare yet</h2>
                        <p>Add components using the slots above, or browse our catalog to get started.</p>
                        <div className="cp-empty__actions">
                            <button className="btn btn-primary" onClick={() => openSearch(0)}>
                                <FiPlus size={16} /> Add Component
                            </button>
                            <Link to="/browse" className="btn btn-secondary">
                                Browse Catalog <FiArrowRight size={16} />
                            </Link>
                        </div>
                    </div>
                )}

            </div>
        </main>
    )
}
