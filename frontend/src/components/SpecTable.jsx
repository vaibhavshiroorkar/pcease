import { useState, useMemo } from 'react'
import { formatPrice, formatSpecKey, getLowestPrice, getBestVendor, CATEGORIES } from '../services/api'
import { columnsForCategory, inferColumnType, compareValues } from '../services/specColumns'
import { FiBookmark, FiCheck, FiExternalLink, FiChevronUp, FiChevronDown } from 'react-icons/fi'
import './SpecTable.css'

const specOf = (item, key) => {
    const v = item.specs?.[key]
    return v === undefined ? null : v
}
const lowOf = getLowestPrice

/**
 * Connected, category-aware spec table for Browse Advanced mode. Presentation +
 * column sorting only. Filtering is owned by Browse's filter sidebar, so `items`
 * arrives already filtered.
 * - `items`   : already filtered + paged components from Browse
 * - `category`: '' for All (base columns only), else a category slug
 * - `onOpen`  : open the shared Browse detail modal
 * - `hasWatch`/`toggleWatch`: watchlist state + toggle
 */
export default function SpecTable({ items, category, onOpen, hasWatch, toggleWatch }) {
    const specKeys = columnsForCategory(category)
    const [sort, setSort] = useState({ key: '__price', dir: 'asc' })

    // Infer each spec column's type once over the current items (for numeric vs text sort).
    const colTypes = useMemo(() => {
        const t = {}
        for (const k of specKeys) t[k] = inferColumnType(items.map(i => specOf(i, k)))
        return t
    }, [items, specKeys])

    const toggleSort = (key) =>
        setSort(s => s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' })

    const rows = useMemo(() => {
        const list = [...items]
        const { key, dir } = sort
        const mul = dir === 'asc' ? 1 : -1
        list.sort((a, b) => {
            let cmp
            if (key === '__price') cmp = (lowOf(a) ?? Infinity) - (lowOf(b) ?? Infinity)
            else if (key === '__name') cmp = String(a.name).localeCompare(String(b.name))
            else if (key === '__brand') cmp = String(a.brand || '').localeCompare(String(b.brand || ''))
            else cmp = compareValues(specOf(a, key), specOf(b, key), colTypes[key])
            return cmp * mul
        })
        return list
    }, [items, sort, colTypes])

    const SortHead = ({ label, k, mono }) => (
        <th className={`st-th${mono ? ' st-th--spec' : ''}`}>
            <button className="st-th__sort" onClick={() => toggleSort(k)}>
                {label}
                {sort.key === k && (sort.dir === 'asc' ? <FiChevronUp size={12} /> : <FiChevronDown size={12} />)}
            </button>
        </th>
    )

    return (
        <div className="st-wrap">
            <table className="st-table">
                <thead>
                    <tr>
                        <th className="st-th st-th--corner" />
                        <SortHead label="Name" k="__name" />
                        {!category && <th className="st-th">Category</th>}
                        <SortHead label="Brand" k="__brand" />
                        {specKeys.map(k => (
                            <SortHead key={k} label={formatSpecKey(k)} k={k} mono />
                        ))}
                        <SortHead label="Price" k="__price" />
                        <th className="st-th">Vendor</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map(item => {
                        const saved = hasWatch(item.id)
                        const best = getBestVendor(item)
                        const low = lowOf(item)
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
            {rows.length === 0 && <p className="st-empty">No components match the filters.</p>}
        </div>
    )
}
