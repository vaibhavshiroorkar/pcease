import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
    FiArrowRight, FiDollarSign, FiCpu, FiLayers,
    FiSearch, FiZap, FiShield, FiTrendingDown,
    FiMessageSquare, FiColumns, FiChevronDown, FiX, FiExternalLink
} from 'react-icons/fi'
import { API } from '../services/api'
import './Home.css'

export default function Home() {
    const [vendors, setVendors] = useState([])
    const [showRetailers, setShowRetailers] = useState(false)
    const [stats, setStats] = useState(null)

    // Full-page section snapping, scoped to the home route only
    useEffect(() => {
        document.documentElement.classList.add('home-snap')
        return () => document.documentElement.classList.remove('home-snap')
    }, [])

    // Live data for the hero stats and the retailers modal
    useEffect(() => {
        API.getVendors().then(setVendors).catch(() => {})
        API.getStats().then(setStats).catch(() => {})
    }, [])

    return (
        <main className="home">

            {/* ===== Hero ===== */}
            <section className="hero">
                <div className="hero__bg" />
                <div className="container hero__grid">
                    {/* Left: message */}
                    <div className="hero__lead">
                        <h1>
                            Tell it your budget.<br />
                            Get a <span className="text-accent">real build.</span>
                        </h1>
                        <p className="hero__sub">
                            An AI agent that searches real Indian retailer prices, checks
                            compatibility, and assembles a build you can actually buy today.
                        </p>
                        <div className="hero__cta">
                            <Link to="/advisor" className="btn btn-primary btn-lg">
                                Ask the agent <FiArrowRight size={15} />
                            </Link>
                            <Link to="/builder" className="btn btn-lg">
                                Build your PC
                            </Link>
                            <Link to="/browse" className="btn btn-lg">
                                Browse parts
                            </Link>
                        </div>
                        <div className="hero__stats">
                            <Link to="/browse" className="hero__stat hero__stat--link">
                                <span className="hero__stat-num">500+</span>
                                <span className="hero__stat-label">Components</span>
                            </Link>
                            <div className="hero__stat-divider" />
                            <button type="button" className="hero__stat hero__stat--link" onClick={() => setShowRetailers(true)}>
                                <span className="hero__stat-num">{vendors.length || 9}</span>
                                <span className="hero__stat-label">Retailers</span>
                            </button>
                            <div className="hero__stat-divider" />
                            <Link to="/builds?tab=discussions" className="hero__stat hero__stat--link">
                                <span className="hero__stat-num">{stats?.forum_threads ?? 0}</span>
                                <span className="hero__stat-label">Community</span>
                            </Link>
                        </div>
                    </div>

                    {/* Right: live agent console */}
                    <div className="agent-console" aria-hidden="true">
                        <div className="agent-console__bar">
                            <span className="agent-console__dots"><i /><i /><i /></span>
                            <span className="agent-console__title">agent</span>
                            <span className="agent-console__model">
                                <span className="agent-console__live" />
                            </span>
                        </div>
                        <div className="agent-console__body">
                            <div className="acl acl--user" style={{ '--d': '.15s' }}>
                                <span className="acl__chev">›</span> build me a ₹60,000 gaming PC
                            </div>

                            <div className="acl acl--step" style={{ '--d': '.7s' }}>
                                <span className="acl__dot" />
                                <span className="acl__tk">search_components</span>
                                <span className="acl__ok">8 matches</span>
                            </div>
                            <div className="acl acl--step" style={{ '--d': '1.3s' }}>
                                <span className="acl__dot" />
                                <span className="acl__tk">check_compatibility</span>
                                <span className="acl__ok">AM5 ✓</span>
                            </div>
                            <div className="acl acl--step" style={{ '--d': '1.9s' }}>
                                <span className="acl__dot" />
                                <span className="acl__tk">estimate_wattage</span>
                                <span className="acl__ok">550W</span>
                            </div>

                            <div className="acl acl--reply" style={{ '--d': '2.5s' }}>
                                Balanced pick, no bottleneck.<span className="acl__caret" />
                            </div>

                            <div className="acl acl--card" style={{ '--d': '2.9s' }}>
                                <div className="acl-card__head">
                                    <span>Budget Gaming Build</span>
                                    <span className="acl-card__total">₹59,400</span>
                                </div>
                                <div className="acl-card__row"><i>GPU</i><span>RTX 4060</span><b>₹29,000</b></div>
                                <div className="acl-card__row"><i>CPU</i><span>Ryzen 5 7600</span><b>₹21,000</b></div>
                                <div className="acl-card__more">+ 5 more parts</div>
                                <div className="acl-card__cta">Open in Builder <FiArrowRight size={12} /></div>
                            </div>
                        </div>
                    </div>
                </div>
                <button className="hero__scroll" onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}>
                    <FiChevronDown size={20} />
                </button>
            </section>

            {/* ===== How It Works ===== */}
            <section className="home-section" id="how-it-works">
                <div className="container">
                    <div className="section-header">
                        <span className="section-tag">How It Works</span>
                        <h2>Three steps to your perfect build</h2>
                        <p>No sign-up required. Jump straight in.</p>
                    </div>
                    <div className="steps">
                        <div className="step">
                            <div className="step__number">1</div>
                            <div className="step__content">
                                <h3>Pick your components</h3>
                                <p>Browse 500+ parts from CPUs to cases. Filter by category, brand, or price range.</p>
                            </div>
                        </div>
                        <div className="step__connector" />
                        <div className="step">
                            <div className="step__number">2</div>
                            <div className="step__content">
                                <h3>Compare prices instantly</h3>
                                <p>See real prices from 9 Indian retailers side by side. Find the best deal every time.</p>
                            </div>
                        </div>
                        <div className="step__connector" />
                        <div className="step">
                            <div className="step__number">3</div>
                            <div className="step__content">
                                <h3>Build & share</h3>
                                <p>Assemble your build in the Builder, check wattage, and share it with anyone via a link.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ===== Features ===== */}
            <section className="home-section home-section--alt">
                <div className="container">
                    <div className="section-header">
                        <span className="section-tag">Features</span>
                        <h2>Everything you need to build a PC</h2>
                    </div>
                    <div className="features-grid">
                        <div className="feat-card feat-card--large feat-card--agent">
                            <div className="feat-card__icon feat-card__icon--volt"><FiCpu size={22} /></div>
                            <h3>The AI Agent</h3>
                            <p>
                                Give it a budget and a use case. It runs a real tool loop over the live
                                catalog - searching parts, checking compatibility and wattage, and
                                bottleneck-testing - then streams back a grounded build you can open in
                                the Builder. No invented prices, ever.
                            </p>
                            <Link to="/advisor" className="feat-card__link">Ask the agent <FiArrowRight size={13} /></Link>
                        </div>
                        <div className="feat-card">
                            <div className="feat-card__icon"><FiTrendingDown size={20} /></div>
                            <h3>Price Comparison</h3>
                            <p>Real-time prices from Amazon, Flipkart, MD Computers, Vedant, PCStudio and more - price bars, savings, and direct buy links on one page.</p>
                            <Link to="/browse" className="feat-card__link">Browse prices <FiArrowRight size={13} /></Link>
                        </div>
                        <div className="feat-card">
                            <div className="feat-card__icon"><FiLayers size={20} /></div>
                            <h3>PC Builder</h3>
                            <p>Slot-based builder with a live budget counter, wattage calculator, bottleneck checker, and shareable build links.</p>
                            <Link to="/builder" className="feat-card__link">Open Builder <FiArrowRight size={13} /></Link>
                        </div>
                        <div className="feat-card">
                            <div className="feat-card__icon"><FiColumns size={20} /></div>
                            <h3>Watchlist</h3>
                            <p>Save parts you're eyeing to a watchlist, track their prices, and compare them side by side when you're ready.</p>
                            <Link to="/watchlist" className="feat-card__link">Open watchlist <FiArrowRight size={13} /></Link>
                        </div>
                        <div className="feat-card">
                            <div className="feat-card__icon"><FiMessageSquare size={20} /></div>
                            <h3>Community</h3>
                            <p>Share your builds, browse other builders, and get advice in the discussions from fellow PC enthusiasts in India.</p>
                            <Link to="/builds" className="feat-card__link">Visit Community <FiArrowRight size={13} /></Link>
                        </div>
                    </div>
                </div>
            </section>

            {/* ===== Why PCease ===== */}
            <section className="home-section">
                <div className="container">
                    <div className="section-header">
                        <span className="section-tag">Why PCease</span>
                        <h2>Built for Indian PC builders</h2>
                    </div>
                    <div className="why-grid">
                        <div className="why-item">
                            <FiDollarSign size={18} />
                            <div>
                                <h4>Indian Prices Only</h4>
                                <p>All prices are in ₹ from Indian retailers. No USD conversions or guesswork.</p>
                            </div>
                        </div>
                        <div className="why-item">
                            <FiZap size={18} />
                            <div>
                                <h4>Fast & Lightweight</h4>
                                <p>No bloat, no ads. Just the tools you need to find the best parts at the best price.</p>
                            </div>
                        </div>
                        <div className="why-item">
                            <FiShield size={18} />
                            <div>
                                <h4>No Account Required</h4>
                                <p>Browse, compare, and get AI recommendations without creating an account.</p>
                            </div>
                        </div>
                        <div className="why-item">
                            <FiSearch size={18} />
                            <div>
                                <h4>Always Up to Date</h4>
                                <p>Component data is refreshed regularly so you always see current pricing.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ===== Final CTA ===== */}
            <section className="home-section home-section--alt">
                <div className="container home-cta">
                    <h2>Your next build starts here.</h2>
                    <p>No account. No fluff. Just the parts you need at the price you want.</p>
                    <div className="home-cta__actions">
                        <Link to="/advisor" className="btn btn-primary btn-lg">
                            What should I build? <FiArrowRight size={15} />
                        </Link>
                        <Link to="/builder" className="btn btn-lg">
                            Build your PC
                        </Link>
                        <Link to="/browse" className="btn btn-lg">
                            Browse parts
                        </Link>
                    </div>
                </div>
            </section>

            {/* ===== Retailers modal ===== */}
            {showRetailers && (
                <div className="modal-overlay" onClick={() => setShowRetailers(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Retailers we track</h2>
                            <button className="modal-close" onClick={() => setShowRetailers(false)} aria-label="Close">
                                <FiX />
                            </button>
                        </div>
                        <div className="modal-body">
                            <p className="home-retailers__sub">
                                We compare live prices across these Indian stores so you always see the best deal.
                            </p>
                            <ul className="home-retailers">
                                {vendors.map(v => (
                                    <li key={v.id} className="home-retailer">
                                        <span className="home-retailer__name">{v.name}</span>
                                        {v.url && v.url !== '#' && (
                                            <a href={v.url} target="_blank" rel="noopener noreferrer" className="home-retailer__link">
                                                Visit <FiExternalLink size={12} />
                                            </a>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            )}

        </main>
    )
}
