import { Link } from 'react-router-dom'
import {
    FiArrowRight, FiDollarSign, FiCpu, FiLayers,
    FiSearch, FiZap, FiShield, FiTrendingDown,
    FiMessageSquare, FiColumns, FiChevronDown
} from 'react-icons/fi'
import './Home.css'

export default function Home() {
    return (
        <main className="home">

            {/* ===== Hero ===== */}
            <section className="hero">
                <div className="hero__bg" />
                <div className="container hero__grid">
                    {/* Left — message */}
                    <div className="hero__lead">
                        <div className="hero__kicker">
                            <span className="hero__kicker-dot" />
                            <span className="mono-label">PCease Agent — grounded in live Indian prices</span>
                        </div>
                        <h1>
                            Tell it your budget.<br />
                            Get a <span className="text-accent">real build.</span>
                        </h1>
                        <p className="hero__sub">
                            Not another chatbot that hallucinates parts. PCease runs an AI agent that
                            searches the actual catalog across 9 Indian retailers, checks compatibility
                            and wattage, and assembles a build with prices you can buy at today.
                        </p>
                        <div className="hero__cta">
                            <Link to="/advisor" className="btn btn-primary btn-lg">
                                Ask the agent <FiArrowRight size={15} />
                            </Link>
                            <Link to="/browse" className="btn btn-lg">
                                Browse components
                            </Link>
                        </div>
                        <div className="hero__stats">
                            <div className="hero__stat">
                                <span className="hero__stat-num">500+</span>
                                <span className="hero__stat-label">Components</span>
                            </div>
                            <div className="hero__stat-divider" />
                            <div className="hero__stat">
                                <span className="hero__stat-num">9</span>
                                <span className="hero__stat-label">Retailers</span>
                            </div>
                            <div className="hero__stat-divider" />
                            <div className="hero__stat">
                                <span className="hero__stat-num">₹0</span>
                                <span className="hero__stat-label">Always Free</span>
                            </div>
                        </div>
                    </div>

                    {/* Right — live agent console */}
                    <div className="agent-console" aria-hidden="true">
                        <div className="agent-console__bar">
                            <span className="agent-console__live" />
                            <span className="agent-console__title">pcease-agent</span>
                            <span className="agent-console__meta">claude · streaming</span>
                        </div>
                        <div className="agent-console__body">
                            <div className="acl acl--user">› build me a ₹60,000 gaming PC</div>
                            <div className="acl acl--tool" style={{ '--d': '.5s' }}>
                                <span className="acl__tk">search_components</span>(gpu, ≤ ₹26k) <span className="acl__ok">✓ 8 found</span>
                            </div>
                            <div className="acl acl--tool" style={{ '--d': '1.1s' }}>
                                <span className="acl__tk">search_components</span>(cpu, ≤ ₹18k) <span className="acl__ok">✓ 11 found</span>
                            </div>
                            <div className="acl acl--tool" style={{ '--d': '1.7s' }}>
                                <span className="acl__tk">check_compatibility</span>() <span className="acl__ok">✓ AM5 ok</span>
                            </div>
                            <div className="acl acl--tool" style={{ '--d': '2.3s' }}>
                                <span className="acl__tk">estimate_wattage</span>() <span className="acl__ok">✓ 550W</span>
                            </div>
                            <div className="acl acl--card" style={{ '--d': '3s' }}>
                                <div className="acl-card__head">
                                    <span>Budget Gaming Build</span>
                                    <span className="acl-card__total">₹59,400</span>
                                </div>
                                <div className="acl-card__row"><i>GPU</i> RTX 4060 <b>₹29,000</b></div>
                                <div className="acl-card__row"><i>CPU</i> Ryzen 5 7600 <b>₹21,000</b></div>
                                <div className="acl-card__row acl-card__row--more">+ 5 more parts · MDComputers, PrimeABGB…</div>
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
                                catalog — searching parts, checking compatibility and wattage, and
                                bottleneck-testing — then streams back a grounded build you can open in
                                the Builder. No invented prices, ever.
                            </p>
                            <Link to="/advisor" className="feat-card__link">Ask the agent <FiArrowRight size={13} /></Link>
                        </div>
                        <div className="feat-card">
                            <div className="feat-card__icon"><FiTrendingDown size={20} /></div>
                            <h3>Price Comparison</h3>
                            <p>Real-time prices from Amazon, Flipkart, MD Computers, Vedant, PCStudio and more — price bars, savings, and direct buy links on one page.</p>
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
                            <h3>Side-by-Side Compare</h3>
                            <p>Compare up to 4 components with spec highlights and per-retailer pricing in card or table view.</p>
                            <Link to="/compare" className="feat-card__link">Compare now <FiArrowRight size={13} /></Link>
                        </div>
                        <div className="feat-card">
                            <div className="feat-card__icon"><FiMessageSquare size={20} /></div>
                            <h3>Community Forum</h3>
                            <p>Ask questions, share builds, and get advice from fellow PC enthusiasts in India.</p>
                            <Link to="/forum" className="feat-card__link">Visit Forum <FiArrowRight size={13} /></Link>
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
                        <Link to="/forum" className="btn btn-lg">
                            Need help? Ask the community
                        </Link>
                    </div>
                </div>
            </section>

        </main>
    )
}
