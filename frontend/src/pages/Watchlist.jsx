import { Link } from 'react-router-dom'
import { FiBookmark, FiTrash2, FiColumns, FiExternalLink, FiPackage, FiX, FiArrowRight } from 'react-icons/fi'
import { formatPrice, getLowestPrice, getBestVendor, getSavings, CATEGORIES } from '../services/api'
import { useWatchlist } from '../hooks/useWatchlist'
import './Watchlist.css'

export default function Watchlist() {
    const { items, count, remove, clear } = useWatchlist()
    const compareIds = items.slice(0, 4).map(i => i.id).join(',')

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
                            {count >= 2 && (
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
                    <section className="wl-grid">
                        {items.map(item => {
                            const low = getLowestPrice(item)
                            const savings = getSavings(item)
                            const best = getBestVendor(item)
                            const vendorCount = (item.prices || []).length
                            return (
                                <article key={item.id} className="wl-card">
                                    <button className="wl-card__remove" onClick={() => remove(item.id)} title="Remove from watchlist">
                                        <FiX size={14} />
                                    </button>
                                    <div className="wl-card__img">
                                        {item.image_url ? <img src={item.image_url} alt={item.name} /> : <FiPackage size={28} />}
                                    </div>
                                    <span className="wl-card__badge">
                                        {CATEGORIES[item.category?.slug]?.name || item.category?.name || 'Part'}
                                    </span>
                                    <h3 className="wl-card__name">{item.name}</h3>
                                    {item.brand && <span className="wl-card__brand">{item.brand}</span>}

                                    <div className="wl-card__price">
                                        <span className="wl-card__amount">{low ? formatPrice(low) : 'No price'}</span>
                                        {savings > 0 && <span className="wl-card__save">Save {formatPrice(savings)}</span>}
                                    </div>
                                    {best && (
                                        <span className="wl-card__store">
                                            {vendorCount > 1 ? `${vendorCount} retailers` : (best.vendor?.name || best.vendor_name || 'Store')}
                                        </span>
                                    )}

                                    <div className="wl-card__actions">
                                        {best?.url
                                            ? <a href={best.url} target="_blank" rel="noreferrer" className="btn btn-sm btn-primary">
                                                <FiExternalLink size={12} /> Buy
                                              </a>
                                            : <span className="btn btn-sm" style={{ opacity: 0.4, cursor: 'default' }}>No link</span>}
                                        <button className="btn btn-sm" onClick={() => remove(item.id)}>Remove</button>
                                    </div>
                                </article>
                            )
                        })}
                    </section>
                )}
            </div>
        </main>
    )
}
