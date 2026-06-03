import { formatPrice, getLowestPrice, getSavings, getBestVendor, CATEGORIES } from '../services/api'
import { SPEC_PRIORITY } from '../services/specColumns'
import './PartCard.css'

/**
 * Shared component card used by Browse and Watchlist so the two views stay
 * visually identical. Renders either a "grid" (box) or "list" (rectangular)
 * variant from the same building blocks, so switching between them is seamless.
 *
 * Pages pass the interactive bits as nodes:
 *   - `corner`  : top-right button (bookmark on Browse, remove on Watchlist)
 *   - `actions` : primary buttons (Buy / View / Remove)
 *   - `onOpen`  : optional click handler for the card body (opens detail)
 */

export function getKeySpecs(item, maxCount = 4) {
    if (!item.specs || !Object.keys(item.specs).length) return []
    const priority = SPEC_PRIORITY[item.category?.slug] || []
    const allKeys = Object.keys(item.specs)
    const ordered = [...priority.filter(k => k in item.specs), ...allKeys.filter(k => !priority.includes(k))]
    return ordered.slice(0, maxCount).map(k => ({
        key: k.replace(/_/g, ' '),
        val: String(item.specs[k]),
    }))
}

export default function PartCard({ item, variant = 'list', highlighted = false, onOpen, corner, actions }) {
    const low = getLowestPrice(item)
    const savings = getSavings(item)
    const best = getBestVendor(item)
    const vendorCount = (item.prices || []).length
    const cat = CATEGORIES[item.category?.slug]?.name || item.category?.name || 'Part'
    const specs = getKeySpecs(item, variant === 'grid' ? 3 : 4)
    const storeName = best ? (best.vendor?.name || best.vendor_name || 'Store') : null

    const meta = (
        <div className="pc-meta">
            <span className="pc-badge">{cat}</span>
            {item.brand && <span className="pc-brand">{item.brand}</span>}
        </div>
    )
    const specChips = specs.length > 0 && (
        <div className="pc-specs">
            {specs.map(s => (
                <span key={s.key} className="pc-spec-chip">
                    <span className="pc-spec-chip__k">{s.key}</span>{s.val}
                </span>
            ))}
        </div>
    )
    const priceBlock = (
        <div className="pc-price-row">
            <span className="pc-price">{low ? formatPrice(low) : 'N/A'}</span>
            {savings > 0 && <span className="pc-save">Save {formatPrice(savings)}</span>}
        </div>
    )
    const store = best && (
        <span className="pc-store">{storeName}{vendorCount > 1 ? ` +${vendorCount - 1} more` : ''}</span>
    )

    if (variant === 'grid') {
        return (
            <article
                className={`pc-card pc-card--grid${highlighted ? ' is-highlighted' : ''}${onOpen ? ' is-clickable' : ''}`}
                onClick={onOpen}
            >
                <div className="pc-card__top">
                    {meta}
                    {corner}
                </div>
                <h3 className="pc-name">{item.name}</h3>
                {specChips}
                <div className="pc-card__spacer" />
                {priceBlock}
                {store}
                {actions && <div className="pc-card__footer">{actions}</div>}
            </article>
        )
    }

    return (
        <article className={`pc-card pc-card--list${highlighted ? ' is-highlighted' : ''}`}>
            <div className={`pc-card__body${onOpen ? ' is-clickable' : ''}`} onClick={onOpen}>
                <div className="pc-card__left">
                    {meta}
                    <h3 className="pc-name">{item.name}</h3>
                    {specChips}
                </div>
                <div className="pc-card__price-col">
                    {priceBlock}
                    {store}
                </div>
            </div>
            {(actions || corner) && (
                <div className="pc-card__actions">
                    {actions}
                    {corner}
                </div>
            )}
        </article>
    )
}
