import { useMemo } from 'react'
import { formatPrice, formatSpecKey, getLowestPrice, CATEGORIES } from '../services/api'
import { columnsForCategory } from '../services/specColumns'
import { FiBookmark, FiCheck, FiChevronUp, FiChevronDown, FiChevronRight } from 'react-icons/fi'
import './SpecTable.css'

const specOf = (item, key) => {
    const v = item.specs?.[key]
    return v === undefined ? null : v
}

/**
 * Connected, category-aware spec table for Browse. Presentation only - sorting is
 * controlled by the parent so it spans the whole result set, not just this page.
 * - `items`    : the current page's rows (already filtered, sorted, paged by Browse)
 * - `category` : '' for All (base columns only), else a category slug
 * - `sort`     : { key, dir } currently active sort (for the header indicator)
 * - `onSort`   : (key) => void   toggle/sort by a column
 * - `onOpen`   : open the shared detail modal
 * - `hasWatch`/`toggleWatch`: watchlist state + toggle
 */
export default function SpecTable({ items, category, sort, onSort, onOpen, hasWatch, toggleWatch }) {
    // Only show spec columns that at least one row on the page actually has.
    const specKeys = useMemo(
        () => columnsForCategory(category).filter(k => items.some(i => specOf(i, k) !== null)),
        [category, items],
    )

    const SortHead = ({ label, k, mono }) => (
        <th className={`st-th${mono ? ' st-th--spec' : ''}`}>
            <button className="st-th__sort" onClick={() => onSort(k)}>
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
                        <th className="st-th">Details</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map(item => {
                        const saved = hasWatch(item.id)
                        const low = getLowestPrice(item)
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
                                <td className="st-td st-td--vendor">
                                    <button className="btn btn-sm btn-primary" onClick={e => { e.stopPropagation(); onOpen(item) }}>
                                        View <FiChevronRight size={12} />
                                    </button>
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
            {items.length === 0 && <p className="st-empty">No components match the filters.</p>}
        </div>
    )
}
