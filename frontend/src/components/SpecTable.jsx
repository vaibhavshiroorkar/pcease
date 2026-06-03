import { useState, useMemo } from 'react'
import { formatPrice, formatSpecKey, getLowestPrice, getSavings, getBestVendor, CATEGORIES } from '../services/api'
import { columnsForCategory, parseSpecNum, inferColumnType, distinctValues, compareValues } from '../services/specColumns'
import { FiBookmark, FiCheck, FiExternalLink, FiChevronUp, FiChevronDown, FiFilter, FiX } from 'react-icons/fi'
import './SpecTable.css'

const specOf = (item, key) => {
    const v = item.specs?.[key]
    return v === undefined ? null : v
}
const lowOf = getLowestPrice
const saveOf = getSavings

/**
 * Connected, category-aware spec table for Browse Advanced mode.
 * - `items`   : already filtered + paged components from Browse
 * - `category`: '' for All (base columns only), else a category slug
 * - `onOpen`  : open the shared Browse detail modal
 * - `hasWatch`/`toggleWatch`: watchlist state + toggle
 */
export default function SpecTable({ items, category, onOpen, hasWatch, toggleWatch }) {
    const specKeys = columnsForCategory(category)
    const [sort, setSort] = useState({ key: '__price', dir: 'asc' })
    const [filters, setFilters] = useState({})       // key -> {min,max} | string[]
    const [openFilter, setOpenFilter] = useState(null)

    // Infer each spec column's type once over the current items.
    const colTypes = useMemo(() => {
        const t = {}
        for (const k of specKeys) t[k] = inferColumnType(items.map(i => specOf(i, k)))
        return t
    }, [items, specKeys])

    const setColFilter = (key, val) => setFilters(f => ({ ...f, [key]: val }))
    const clearFilters = () => { setFilters({}); setOpenFilter(null) }
    const hasFilters = Object.keys(filters).length > 0

    const toggleSort = (key) =>
        setSort(s => s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' })

    // Apply per-column filters.
    const filtered = useMemo(() => {
        return items.filter(item => {
            for (const [key, f] of Object.entries(filters)) {
                if (!f) continue
                const raw = specOf(item, key)
                if (colTypes[key] === 'numeric') {
                    const n = parseSpecNum(raw)
                    if (f.min !== '' && f.min != null && (n === null || n < parseFloat(f.min))) return false
                    if (f.max !== '' && f.max != null && (n === null || n > parseFloat(f.max))) return false
                } else if (Array.isArray(f) && f.length > 0) {
                    if (!f.includes(String(raw))) return false
                }
            }
            return true
        })
    }, [items, filters, colTypes])

    // Apply sort.
    const rows = useMemo(() => {
        const list = [...filtered]
        const { key, dir } = sort
        const mul = dir === 'asc' ? 1 : -1
        list.sort((a, b) => {
            let cmp
            if (key === '__price') cmp = (lowOf(a) ?? Infinity) - (lowOf(b) ?? Infinity)
            else if (key === '__savings') cmp = saveOf(a) - saveOf(b)
            else if (key === '__name') cmp = String(a.name).localeCompare(String(b.name))
            else if (key === '__brand') cmp = String(a.brand || '').localeCompare(String(b.brand || ''))
            else cmp = compareValues(specOf(a, key), specOf(b, key), colTypes[key])
            return cmp * mul
        })
        return list
    }, [filtered, sort, colTypes])

    const SortHead = ({ label, k }) => (
        <th className="st-th">
            <span className="st-th__wrap">
                <button className="st-th__sort" onClick={() => toggleSort(k)}>
                    {label}
                    {sort.key === k && (sort.dir === 'asc' ? <FiChevronUp size={12} /> : <FiChevronDown size={12} />)}
                </button>
            </span>
        </th>
    )

    const FilterBtn = ({ k }) => {
        const active = !!filters[k] && (Array.isArray(filters[k]) ? filters[k].length : (filters[k].min || filters[k].max))
        return (
            <button
                className={`st-filter-btn${active ? ' is-active' : ''}`}
                onClick={() => setOpenFilter(openFilter === k ? null : k)}
                title="Filter"
            >
                <FiFilter size={11} />
            </button>
        )
    }

    const FilterPopover = ({ k }) => {
        if (openFilter !== k) return null
        if (colTypes[k] === 'numeric') {
            const f = filters[k] || { min: '', max: '' }
            return (
                <div className="st-popover" onClick={e => e.stopPropagation()}>
                    <div className="st-popover__row">
                        <input type="number" placeholder="Min" value={f.min}
                            onChange={e => setColFilter(k, { ...f, min: e.target.value })} />
                        <span>-</span>
                        <input type="number" placeholder="Max" value={f.max}
                            onChange={e => setColFilter(k, { ...f, max: e.target.value })} />
                    </div>
                </div>
            )
        }
        const opts = distinctValues(items.map(i => specOf(i, k)))
        const selected = filters[k] || []
        const toggle = (v) => {
            const next = selected.includes(v) ? selected.filter(x => x !== v) : [...selected, v]
            setColFilter(k, next)
        }
        return (
            <div className="st-popover" onClick={e => e.stopPropagation()}>
                {opts.length === 0 && <p className="st-popover__empty">No values</p>}
                {opts.map(v => (
                    <label key={v} className="st-popover__opt">
                        <input type="checkbox" checked={selected.includes(v)} onChange={() => toggle(v)} />
                        <span>{v}</span>
                    </label>
                ))}
            </div>
        )
    }

    return (
        <div className="st-wrap" onClick={() => setOpenFilter(null)}>
            {!category && (
                <p className="st-hint">Pick a category to compare specs.</p>
            )}
            {hasFilters && (
                <button className="btn btn-sm st-clear" onClick={clearFilters}>
                    <FiX size={12} /> Clear table filters
                </button>
            )}
            <table className="st-table">
                <thead>
                    <tr>
                        <th className="st-th st-th--corner" />
                        <SortHead label="Name" k="__name" />
                        {!category && <th className="st-th">Category</th>}
                        <SortHead label="Brand" k="__brand" />
                        {specKeys.map(k => (
                            <th key={k} className="st-th st-th--spec">
                                <span className="st-th__wrap">
                                    <button className="st-th__sort" onClick={() => toggleSort(k)}>
                                        {formatSpecKey(k)}
                                        {sort.key === k && (sort.dir === 'asc' ? <FiChevronUp size={12} /> : <FiChevronDown size={12} />)}
                                    </button>
                                    <FilterBtn k={k} />
                                    <FilterPopover k={k} />
                                </span>
                            </th>
                        ))}
                        <SortHead label="Price" k="__price" />
                        <SortHead label="Savings" k="__savings" />
                        <th className="st-th">Vendor</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map(item => {
                        const saved = hasWatch(item.id)
                        const best = getBestVendor(item)
                        const low = lowOf(item)
                        const sav = saveOf(item)
                        const catName = CATEGORIES[item.category?.slug]?.name || item.category?.name || '-'
                        return (
                            <tr key={item.id} className="st-row" onClick={() => onOpen(item)}>
                                <td className="st-td st-td--corner">
                                    <button
                                        className={`st-watch${saved ? ' is-active' : ''}`}
                                        onClick={e => { e.stopPropagation(); toggleWatch(item) }}
                                        title={saved ? 'In your watchlist' : 'Save to watchlist'}
                                    >
                                        {saved ? <FiCheck size={13} /> : <FiBookmark size={13} />}
                                    </button>
                                </td>
                                <td className="st-td st-td--name">{item.name}</td>
                                {!category && <td className="st-td st-td--muted">{catName}</td>}
                                <td className="st-td">{item.brand || '-'}</td>
                                {specKeys.map(k => {
                                    const v = specOf(item, k)
                                    return <td key={k} className={`st-td st-td--spec${v === null ? ' st-td--na' : ''}`}>{v === null ? '-' : String(v)}</td>
                                })}
                                <td className="st-td st-td--price">{low ? formatPrice(low) : 'N/A'}</td>
                                <td className="st-td st-td--save">{sav > 0 ? formatPrice(sav) : '-'}</td>
                                <td className="st-td st-td--vendor" onClick={e => e.stopPropagation()}>
                                    {best?.url
                                        ? <a href={best.url} target="_blank" rel="noreferrer" className="btn btn-sm btn-primary"><FiExternalLink size={11} /> Buy</a>
                                        : <span className="st-td--muted">{best?.vendor?.name || best?.vendor_name || '-'}</span>}
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
            {rows.length === 0 && <p className="st-empty">No components match the table filters.</p>}
        </div>
    )
}
