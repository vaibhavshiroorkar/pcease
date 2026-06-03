import { useState, useEffect, useRef } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { API, formatPrice, formatSpecKey, formatSpecValue, getLowestPrice, getBestVendor, getSavings } from '../services/api'
import toast from 'react-hot-toast'
import {
    FiPlus, FiX, FiSearch, FiAward, FiPackage, FiColumns,
    FiArrowRight, FiTrendingDown, FiLoader, FiTrash2, FiCheck, FiExternalLink
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
    const [sortOrder, setSortOrder] = useState('price-low')
    const [summary, setSummary] = useState('')
    const [summaryLoading, setSummaryLoading] = useState(false)
    const searchRef = useRef(null)
    const inputRef = useRef(null)

    // Once the first part is chosen, the comparison locks to that part's category:
    // you can only compare like with like (GPU vs GPU, not GPU vs CPU).
    const firstFilled = slots.find(Boolean)
    const lockedCategory = firstFilled ? (firstFilled.category?.slug || firstFilled.category_slug || null) : null
    const lockedCategoryName = firstFilled ? (firstFilled.category?.name || firstFilled.category_name || '') : ''
    const catSlug = (c) => c?.category?.slug || c?.category_slug || null

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
            if (sortOrder) params.sort = sortOrder
            API.getComponents(params)
                .then(data => {
                    const list = data.components || data || []
                    const used = new Set(slots.filter(Boolean).map(s => s.id))
                    setSearchResults(
                        list
                            .filter(c => !used.has(c.id) && (!lockedCategory || catSlug(c) === lockedCategory))
                            .slice(0, 12)
                    )
                })
                .catch(() => setSearchResults([]))
                .finally(() => setSearching(false))
        }, 300)
        return () => clearTimeout(t)
    }, [query, selectedCategory, sortOrder, slots])

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
        // Lock the category filter to the first chosen part's category (if any)
        setSelectedCategory(lockedCategory || '')
        setSortOrder('price-low')
        setSearchResults([])
        setTimeout(() => inputRef.current?.focus(), 50)
    }

    const closeSearch = () => {
        setActiveSlot(null)
        setQuery('')
        setSelectedCategory('')
        setSortOrder('price-low')
        setSearchResults([])
    }

    const addComponent = (component) => {
        if (activeSlot === null) return
        if (lockedCategory && catSlug(component) !== lockedCategory) {
            toast.error(`You can only compare ${lockedCategoryName || 'the same'} parts together`)
            return
        }
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

    const filledSlots = slots.filter(Boolean)

    const bestSlotIdx = filledSlots.length > 0
        ? filledSlots.reduce((bestIdx, cur, idx) => {
            const curLow = getLowestPrice(cur)
            const bestLow = getLowestPrice(filledSlots[bestIdx])
            return curLow < bestLow ? idx : bestIdx
        }, 0)
        : 0

    // A non-AI, genuinely comparative summary (the fallback / instant view).
    const fallbackSummary = () => {
        if (filledSlots.length < 2) return ''
        const cat = filledSlots[0].category?.name || filledSlots[0].category_name || 'components'
        const priced = filledSlots.map(s => ({ name: s.name, low: getLowestPrice(s) })).filter(p => p.low)
        const sorted = [...priced].sort((a, b) => a.low - b.low)
        const cheapest = sorted[0]
        const dearest = sorted[sorted.length - 1]
        const parts = [`Comparing ${filledSlots.length} ${cat.toLowerCase()}.`]
        if (cheapest) parts.push(`${cheapest.name} is the cheapest at ${formatPrice(cheapest.low)}.`)
        if (dearest && dearest.name !== cheapest?.name) {
            parts.push(`${dearest.name} is the priciest at ${formatPrice(dearest.low)} (a ${formatPrice(dearest.low - cheapest.low)} spread).`)
        }
        parts.push('Pick on the specs that matter for your use, not price alone.')
        return parts.join(' ')
    }

    // AI comparison summary, fetched when the set of compared parts changes.
    // Falls back to the comparative message above if AI is unavailable.
    const compareKey = filledSlots.map(s => s.id).join(',')
    useEffect(() => {
        if (filledSlots.length < 2) { setSummary(''); return }
        let cancelled = false
        const prompt = `Compare these PC ${filledSlots[0].category?.name || 'components'} for an Indian buyer in 2-3 sentences. ` +
            `Be specific about trade-offs (price vs performance) and end with who each suits. Parts:\n` +
            filledSlots.map(s => {
                const specs = getSpecsObj(s)
                const key = Object.entries(specs).slice(0, 4).map(([k, v]) => `${k}: ${v}`).join(', ')
                return `- ${s.name} (₹${getLowestPrice(s) || '?'})${key ? ` [${key}]` : ''}`
            }).join('\n')
        setSummaryLoading(true)
        API.askAI(prompt)
            .then(r => { if (!cancelled) setSummary(r?.source === 'ai' && r.answer ? r.answer : '') })
            .catch(() => { if (!cancelled) setSummary('') })
            .finally(() => { if (!cancelled) setSummaryLoading(false) })
        return () => { cancelled = true }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [compareKey])

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
                        <h1>Compare</h1>
                        <p className="cp-header__sub">
                            Compare prices across Indian retailers - up to {MAX_SLOTS} components side by side
                        </p>
                    </div>
                    <div className="cp-header__actions">
                        {filledSlots.length > 0 && (
                            <button className="btn btn-secondary btn-sm cp-clear-btn" onClick={clearAll}>
                                <FiTrash2 size={12} /> Clear All
                            </button>
                        )}
                        <button
                            className="btn btn-primary btn-sm"
                            onClick={() => openSearch(filledSlots.length)}
                            disabled={filledSlots.length >= MAX_SLOTS}
                            title={filledSlots.length >= MAX_SLOTS ? `Up to ${MAX_SLOTS} components` : 'Add a component to compare'}
                        >
                            <FiPlus size={12} /> Add Component
                        </button>
                    </div>
                </header>

                {/* ===== Summary Bar ===== */}
                <SummaryBar components={filledSlots} />

                {/* ===== Unified Comparison Table ===== */}
                {filledSlots.length > 0 && (
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
                                    {/* Price (headline differentiator) */}
                                    <tr className="cp-table-view__price-row">
                                        <td className="cp-table-view__key">Best Price</td>
                                        {filledSlots.map((slot, i) => {
                                            const price = getLowestPrice(slot)
                                            const isBest = i === bestSlotIdx && filledSlots.length > 1
                                            return (
                                                <td key={i} className={`cp-table-view__val cp-table-view__val--price${isBest ? ' cp-table-view__val--best-price' : ''}`}>
                                                    {price ? formatPrice(price) : '-'}
                                                    {isBest && <span className="cp-table-view__cheapest">Cheapest</span>}
                                                </td>
                                            )
                                        })}
                                        {filledSlots.length < MAX_SLOTS && <td />}
                                    </tr>
                                    {/* Savings */}
                                    <tr>
                                        <td className="cp-table-view__key">Max Saving</td>
                                        {filledSlots.map((slot, i) => {
                                            const sav = getSavings(slot)
                                            return (
                                                <td key={i} className={`cp-table-view__val${sav > 0 ? ' cp-table-view__val--save' : ''}`}>
                                                    {sav > 0 ? formatPrice(sav) : '-'}
                                                </td>
                                            )
                                        })}
                                        {filledSlots.length < MAX_SLOTS && <td />}
                                    </tr>
                                    {/* Vendor */}
                                    <tr>
                                        <td className="cp-table-view__key">Best From</td>
                                        {filledSlots.map((slot, i) => {
                                            const best = getBestVendor(slot)
                                            const name = best?.vendor?.name || best?.vendor_name || '-'
                                            return (
                                                <td key={i} className="cp-table-view__val">
                                                    {best?.url
                                                        ? <a href={best.url} target="_blank" rel="noreferrer" className="cp-table-view__buy">{name} <FiExternalLink size={11} /></a>
                                                        : name}
                                                </td>
                                            )
                                        })}
                                        {filledSlots.length < MAX_SLOTS && <td />}
                                    </tr>
                                    {/* Retailers count */}
                                    <tr>
                                        <td className="cp-table-view__key">Retailers</td>
                                        {filledSlots.map((slot, i) => (
                                            <td key={i} className="cp-table-view__val">{(slot.prices || []).length}</td>
                                        ))}
                                        {filledSlots.length < MAX_SLOTS && <td />}
                                    </tr>
                                    {/* Spec section divider */}
                                    <tr className="cp-table-view__section">
                                        <td className="cp-table-view__key">Specifications</td>
                                        {filledSlots.map((_, i) => <td key={i} />)}
                                        {filledSlots.length < MAX_SLOTS && <td />}
                                    </tr>
                                    {/* Dynamic spec rows */}
                                    {(() => {
                                        const allSpecs = filledSlots.map(getSpecsObj)
                                        const allKeys = [...new Set(allSpecs.flatMap(s => Object.keys(s)))]
                                        return allKeys.map(key => {
                                            const vals = allSpecs.map(s => s[key] !== undefined ? s[key] : null)
                                            const nums = vals.map(parseNum)
                                            const present = vals.filter(v => v !== null)
                                            const allSame = present.length === filledSlots.length && new Set(present.map(String)).size === 1
                                            const allNum = nums.every(n => n !== null)
                                            let best = -1
                                            if (allNum && new Set(nums).size > 1) {
                                                best = LOWER_IS_BETTER.has(key)
                                                    ? nums.indexOf(Math.min(...nums))
                                                    : nums.indexOf(Math.max(...nums))
                                            }
                                            return (
                                                <tr key={key} className={allSame ? 'cp-table-view__row--same' : ''}>
                                                    <td className="cp-table-view__key">{formatSpecKey(key)}</td>
                                                    {vals.map((v, i) => (
                                                        <td key={i} className={`cp-table-view__val${i === best ? ' cp-table-view__val--highlight' : ''}${v === null ? ' cp-table-view__val--na' : ''}`}>
                                                            {v !== null ? formatSpecValue(v) : '-'}
                                                            {i === best && <FiCheck size={11} className="cp-table-view__best-ico" />}
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
                            {lockedCategory ? (
                                <div className="cp-search-panel__locked">
                                    <FiColumns size={13} />
                                    <span>Comparing <strong>{lockedCategoryName}</strong> only - clear all to compare a different part type</span>
                                </div>
                            ) : (
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
                            )}
                            <div className="cp-search-panel__sort">
                                <select value={sortOrder} onChange={e => setSortOrder(e.target.value)}>
                                    <option value="price-low">Price: Low to High</option>
                                    <option value="price-high">Price: High to Low</option>
                                    <option value="name">Name: A-Z</option>
                                </select>
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
                                                {low ? formatPrice(low) : '-'}
                                            </span>
                                            <FiPlus size={14} className="cp-search-result__add" />
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {/* ===== Verdict (AI summary, comparative fallback) ===== */}
                {filledSlots.length >= 2 && (
                    <section className="cp-verdict">
                        <div className="cp-verdict__icon-wrap"><FiAward size={22} /></div>
                        <h3>{summary ? 'AI Verdict' : 'Quick Verdict'} {summaryLoading && <FiLoader size={14} className="cp-spin" />}</h3>
                        <p className="cp-verdict__summary">{summary || fallbackSummary()}</p>
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
                        <p>Add two or more components of the same type to compare specs and prices side by side.</p>
                        <div className="cp-empty__actions">
                            <button className="btn btn-primary" onClick={() => openSearch(0)}>
                                <FiPlus size={14} /> Add Component
                            </button>
                            <Link to="/browse" className="btn">Browse the catalog</Link>
                        </div>
                    </div>
                )}

            </div>
        </main>
    )
}
