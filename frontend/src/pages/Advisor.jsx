import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { API, formatPrice } from '../services/api'
import { FiCpu, FiSend, FiArrowRight, FiSliders, FiMessageSquare, FiPackage, FiZap, FiMonitor, FiCode, FiRadio, FiSearch, FiCheck, FiX } from 'react-icons/fi'
import toast from 'react-hot-toast'
import { useAgentChat } from '../hooks/useAgentChat'
import { formatText } from '../utils/formatText'
import './Advisor.css'

const useCases = [
    { id: 'gaming', name: 'Gaming', desc: 'High FPS, ray tracing', icon: <FiZap size={18} /> },
    { id: 'content', name: 'Content Creation', desc: 'Video editing, 3D rendering', icon: <FiMonitor size={18} /> },
    { id: 'streaming', name: 'Streaming', desc: 'Game + broadcast', icon: <FiRadio size={18} /> },
    { id: 'productivity', name: 'Productivity', desc: 'Office, coding, dev', icon: <FiCode size={18} /> },
]

const priorities = [
    { id: 'performance', name: 'Performance', desc: 'Max FPS / speed' },
    { id: 'balanced', name: 'Balanced', desc: 'Best value overall' },
    { id: 'silent', name: 'Silent', desc: 'Low noise build' },
    { id: 'compact', name: 'Compact', desc: 'Small form factor' },
]

const tabs = [
    { id: 'ai', label: 'Agent', icon: <FiMessageSquare size={14} />, desc: 'Ask anything about PC building' },
    { id: 'presets', label: 'Presets', icon: <FiPackage size={14} />, desc: 'Ready-made build configs' },
    { id: 'manual', label: 'Manual', icon: <FiSliders size={14} />, desc: 'Configure & find best via ML' },
]

const presetTag = (key, tmpl) =>
    key.includes('budget') ? 'Budget'
        : key.includes('mid') ? 'Mid-Range'
            : key.includes('high') ? 'High-End'
                : tmpl.source === 'smart' ? 'Optimized' : ''

// Normalize the different build shapes (manual recommendation, agent build, preset
// template) into one display shape, keeping `raw` + `kind` so "Use build" can route
// to the Builder with the format that page already understands.
function normalizeBuild(raw, kind) {
    if (!raw) return null
    if (kind === 'agent') {
        return {
            kind, raw,
            title: raw.title,
            total: raw.total,
            desc: null,
            items: (raw.items || []).map(it => ({ category: it.category || it.slot, name: it.name, vendor: it.vendor, price: it.price })),
        }
    }
    return {
        kind, raw,
        title: raw.title || raw.name,
        total: raw.total || raw.budget,
        desc: raw.description,
        items: (raw.components || []).map(c => ({ category: c.category, name: c.name || c.suggestion, vendor: c.vendor, price: c.price || c.est_price })),
    }
}

// Rough per-category price bands (INR), entry -> flagship. With only price + category
// to go on, where a part's price lands in its band is a defensible proxy for its tier.
const RATING_BANDS = {
    cpu: [8000, 75000], gpu: [12000, 220000], motherboard: [6000, 55000],
    ram: [2500, 28000], storage: [2500, 30000], psu: [3000, 32000],
    case: [3000, 30000], cooler: [1500, 28000], monitor: [8000, 90000], fans: [500, 7000],
}

// 0-5 performance rating (one decimal) from where the price sits in its category band,
// on a log scale since prices span an order of magnitude.
function componentRating(category, price) {
    if (!price || price <= 0) return 0
    const [lo, hi] = RATING_BANDS[String(category || '').toLowerCase()] || [2000, 60000]
    const t = (Math.log(price) - Math.log(lo)) / (Math.log(hi) - Math.log(lo))
    return Math.max(0, Math.min(5, Math.round((0.4 + t * 4.6) * 10) / 10))
}

// Segmented 0-5 meter, styled after the Builder's bottleneck meter but able to show
// decimals by partially filling the active segment.
function RatingMeter({ value }) {
    const tone = value <= 0 ? 'ad-rate--empty' : value >= 4 ? 'ad-rate--good' : value >= 2.5 ? 'ad-rate--mid' : 'ad-rate--low'
    return (
        <div className={`ad-bf-rate ${tone}`}>
            <span className="ad-rate__track" role="meter" aria-valuenow={value} aria-valuemin={0} aria-valuemax={5} aria-label={`Performance ${value} of 5`}>
                {[0, 1, 2, 3, 4].map(i => (
                    <span key={i} className="ad-rate__seg">
                        <span className="ad-rate__fill" style={{ width: `${Math.max(0, Math.min(1, value - i)) * 100}%` }} />
                    </span>
                ))}
            </span>
            <span className="ad-rate__num">{value > 0 ? value.toFixed(1) : '-'}<i>/5</i></span>
        </div>
    )
}

// Core slots shown as ghost rows before any build exists, so the panel has shape
// from the start instead of popping in empty.
const PLACEHOLDER_SLOTS = ['CPU', 'GPU', 'Motherboard', 'RAM', 'Storage', 'PSU', 'Case', 'CPU Cooler']

// Right-hand panel: the selected build with a per-component performance rating.
// Always present - when there's no build yet it shows placeholder slots so the
// page keeps its two-column shape. The centre content is untouched.
function BuildPanel({ build, onUse, onClose }) {
    const isEmpty = !build
    return (
        <aside className={`ad-build-panel${isEmpty ? ' ad-build-panel--empty' : ''}`}>
            <div className="ad-build-panel__head">
                <span className="ad-build-panel__tag"><FiPackage size={13} /> Build</span>
                <span className="ad-build-panel__total">{isEmpty ? '-' : formatPrice(build.total)}</span>
                {!isEmpty && (
                    <button className="ad-build-panel__close" onClick={onClose} aria-label="Dismiss"><FiX size={15} /></button>
                )}
            </div>

            <h2 className="ad-build-panel__title">{isEmpty ? 'No build yet' : build.title}</h2>
            {(isEmpty || build.desc) && (
                <p className="ad-build-panel__desc">
                    {isEmpty
                        ? 'Configure a build, ask the agent, or pick a preset. It appears here part by part, each rated for performance.'
                        : build.desc}
                </p>
            )}

            <ul className={`ad-build-panel__list${isEmpty ? ' ad-build-panel__list--ghost' : ''}`}>
                {isEmpty
                    ? PLACEHOLDER_SLOTS.map(slot => (
                        <li key={slot}>
                            <span className="ad-bf-cat">{slot}</span>
                            <div className="ad-bf-main"><span className="ad-bf-name">Not selected</span></div>
                            <span className="ad-bf-price">-</span>
                            <RatingMeter value={0} />
                        </li>
                    ))
                    : build.items.map((it, i) => (
                        <li key={i}>
                            <span className="ad-bf-cat">{it.category}</span>
                            <div className="ad-bf-main">
                                <span className="ad-bf-name">{it.name}</span>
                                {it.vendor && <span className="ad-bf-vendor">{it.vendor}</span>}
                            </div>
                            <span className="ad-bf-price">{formatPrice(it.price)}</span>
                            <RatingMeter value={componentRating(it.category, it.price)} />
                        </li>
                    ))}
            </ul>

            <div className="ad-build-panel__footer">
                <div className="ad-build-panel__total-row">
                    <span>Total</span>
                    <strong>{isEmpty ? '-' : formatPrice(build.total)}</strong>
                </div>
                <button className="btn btn-primary" onClick={() => onUse(build)} disabled={isEmpty}>
                    Use build <FiArrowRight size={14} />
                </button>
            </div>

            <p className="ad-build-panel__note">
                {isEmpty
                    ? 'Each part gets a 0-5 performance rating once your build loads.'
                    : "Performance rating (0-5) is estimated from each part's price tier in its category: rough guidance, not a benchmark."}
            </p>
        </aside>
    )
}

export default function Advisor() {
    const navigate = useNavigate()
    const chatEndRef = useRef(null)
    const [tab, setTab] = useState('ai')

    // Manual tab state
    const [budget, setBudget] = useState(60000)
    const [useCase, setUseCase] = useState('gaming')
    const [priority, setPriority] = useState('balanced')
    const [brandPref, setBrandPref] = useState('any')
    const [wifiNeeded, setWifiNeeded] = useState(false)
    const [rgbPref, setRgbPref] = useState(false)
    const [loading, setLoading] = useState(false)
    const [recommendation, setRecommendation] = useState(null)

    // AI tab - agentic chat
    const [question, setQuestion] = useState('')
    const { messages, isStreaming, send } = useAgentChat()

    // Presets tab state
    const [presets, setPresets] = useState(null)
    const [presetFilter, setPresetFilter] = useState('all')

    // The build currently shown in the right panel (shared across all tabs).
    const [shownBuild, setShownBuild] = useState(null)

    useEffect(() => { API.getTemplates().then(setPresets).catch(() => {}) }, [])
    useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, isStreaming])

    // Build preferences string from manual selections
    const buildPreferencesString = () => {
        const parts = []
        if (brandPref !== 'any') parts.push(`Prefer ${brandPref}`)
        if (priority === 'silent') parts.push('Prioritize quiet/silent operation')
        if (priority === 'compact') parts.push('Prefer small form factor / mATX / ITX')
        if (priority === 'performance') parts.push('Maximize raw performance')
        if (wifiNeeded) parts.push('Need WiFi on motherboard')
        if (rgbPref) parts.push('RGB lighting preferred')
        return parts.join(', ')
    }

    const getRecommendation = async () => {
        setLoading(true)
        setRecommendation(null)
        try {
            const prefs = buildPreferencesString()
            const result = await API.getRecommendation(budget, useCase, prefs)
            setRecommendation(result)
            setShownBuild(normalizeBuild(result, 'manual'))
        } catch (e) {
            toast.error('Failed: ' + e.message)
        } finally {
            setLoading(false)
        }
    }

    // The agent surfaces its most recent build; mirror it into the right panel.
    const latestBuild = (() => {
        for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i].build) return messages[i].build
        }
        return null
    })()
    useEffect(() => {
        if (latestBuild && !isStreaming) setShownBuild(normalizeBuild(latestBuild, 'agent'))
    }, [latestBuild, isStreaming])

    const useBuild = (build) => {
        if (!build) return
        if (build.kind === 'agent') {
            navigate('/builder', { state: { recommendation: {
                title: build.raw.title,
                components: (build.raw.items || []).map(it => ({
                    category: it.slot || it.category,
                    component_id: it.component_id,
                    name: it.name,
                    price: it.price,
                    vendor: it.vendor,
                })),
            } } })
        } else {
            navigate('/builder', { state: { recommendation: build.raw } })
        }
    }

    const askQuestion = async (e) => {
        e.preventDefault()
        if (!question.trim() || isStreaming) return
        const q = question
        setQuestion('')
        await send(q)
    }

    const filteredPresets = presets
        ? Object.entries(presets).filter(([key]) => presetFilter === 'all' || key.includes(presetFilter))
        : null

    const budgetLabel = budget < 40000 ? 'Entry' : budget < 80000 ? 'Mid-Range' : budget < 150000 ? 'High-End' : 'Enthusiast'

    return (
        <main className="page">
            <div className="container ad-container">
                <header className="ad-header">
                    <h1>Build Advisor</h1>
                    <p className="ad-header__sub">Find your perfect PC build - manually configure, chat with AI, or pick a preset.</p>
                </header>

                {/* Tab Bar */}
                <div className="ad-tabs" role="tablist" aria-label="Advisor modes">
                    {tabs.map(t => (
                        <button
                            key={t.id}
                            role="tab"
                            aria-selected={tab === t.id}
                            className={`ad-tab ${tab === t.id ? 'active' : ''}`}
                            onClick={() => setTab(t.id)}
                        >
                            {t.icon}
                            <span className="ad-tab__label">{t.label}</span>
                        </button>
                    ))}
                </div>

                {/* Main content keeps full width; the build shows in a floating panel. */}
                <div className={`ad-split${shownBuild ? ' ad-split--with-build' : ''}`}>
                    <div className="ad-split__left">{/* consistent-width content for all tabs */}

                        {/* ==================== MANUAL TAB ==================== */}
                        {tab === 'manual' && (
                            <div className="ad-manual">
                                <div className="ad-manual__intro">
                                    <FiSliders size={20} />
                                    <div>
                                        <h3>Manual Configuration</h3>
                                        <p>Set your requirements and our ML engine will find the optimal components from our database.</p>
                                    </div>
                                </div>

                                <section className="ad-form">
                                    {/* Budget */}
                                    <div className="form-group">
                                        <label>Budget <span className="ad-badge">{budgetLabel}</span></label>
                                        <div className="ad-budget">
                                            <input
                                                type="range" min="25000" max="300000" step="5000"
                                                value={budget}
                                                onChange={e => setBudget(Number(e.target.value))}
                                            />
                                            <span className="ad-budget__val">₹{budget.toLocaleString('en-IN')}</span>
                                        </div>
                                        <div className="ad-budget__marks">
                                            <span>₹25K</span><span>₹1L</span><span>₹2L</span><span>₹3L</span>
                                        </div>
                                    </div>

                                    {/* Use Case */}
                                    <div className="form-group">
                                        <label>Use Case</label>
                                        <div className="ad-uc-grid">
                                            {useCases.map(uc => (
                                                <button
                                                    key={uc.id}
                                                    className={`ad-uc ${useCase === uc.id ? 'active' : ''}`}
                                                    onClick={() => setUseCase(uc.id)}
                                                >
                                                    {uc.icon}
                                                    <strong>{uc.name}</strong>
                                                    <span>{uc.desc}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Priority */}
                                    <div className="form-group">
                                        <label>Priority</label>
                                        <div className="ad-priority-grid">
                                            {priorities.map(p => (
                                                <button
                                                    key={p.id}
                                                    className={`ad-priority ${priority === p.id ? 'active' : ''}`}
                                                    onClick={() => setPriority(p.id)}
                                                >
                                                    <strong>{p.name}</strong>
                                                    <span>{p.desc}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Brand Preference */}
                                    <div className="form-group">
                                        <label>Brand Preference</label>
                                        <div className="ad-brand-row">
                                            {['any', 'AMD', 'Intel', 'NVIDIA'].map(b => (
                                                <button
                                                    key={b}
                                                    className={`ad-brand-btn ${brandPref === b ? 'active' : ''}`}
                                                    onClick={() => setBrandPref(b)}
                                                >
                                                    {b === 'any' ? 'No Preference' : b}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Toggles */}
                                    <div className="form-group">
                                        <div className="ad-toggles">
                                            <label className="ad-toggle">
                                                <input type="checkbox" checked={wifiNeeded} onChange={e => setWifiNeeded(e.target.checked)} />
                                                <span className="ad-toggle__slider" />
                                                <span>WiFi Required</span>
                                            </label>
                                            <label className="ad-toggle">
                                                <input type="checkbox" checked={rgbPref} onChange={e => setRgbPref(e.target.checked)} />
                                                <span className="ad-toggle__slider" />
                                                <span>RGB Lighting</span>
                                            </label>
                                        </div>
                                    </div>

                                    <button className="btn btn-primary btn-lg ad-find-btn" onClick={getRecommendation} disabled={loading}>
                                        {loading ? (
                                            <><span className="ad-spinner" /> Analyzing Components...</>
                                        ) : (
                                            <><FiCpu size={16} /> Find Best Build</>
                                        )}
                                    </button>
                                    {recommendation?.within_budget !== undefined && (
                                        <div className={`ad-budget-status ${recommendation.within_budget ? 'ad-budget-status--ok' : 'ad-budget-status--over'}`}>
                                            {recommendation.within_budget
                                                ? `✓ Within budget - ₹${recommendation.savings?.toLocaleString('en-IN')} remaining`
                                                : `⚠ Over budget by ₹${(recommendation.total - recommendation.budget).toLocaleString('en-IN')}`
                                            }
                                        </div>
                                    )}
                                </section>
                            </div>
                        )}

                        {/* ==================== AI TAB (Agentic) ==================== */}
                        {tab === 'ai' && (
                            <div className="ad-ai">
                                <div className="ad-chat">
                                    <div className="ad-chat__msgs">
                                        {messages.length === 0 ? (
                                            <div className="ad-chat__empty">
                                                <div className="ad-chat__icon"><FiMessageSquare size={36} /></div>
                                                <h3>Agent</h3>
                                                <p>Ask for a build or any PC advice. I search the real catalog, check compatibility, and assemble a grounded build.</p>
                                                <div className="ad-chat__sugg">
                                                    {[
                                                        'Build me a ₹60,000 gaming PC',
                                                        'Best GPU under ₹30,000?',
                                                        'Is the Ryzen 5 7600 a good pick?',
                                                        'Build a ₹1.2L streaming rig',
                                                        'What PSU do I need for an RTX 4060 build?',
                                                    ].map((s, i) => (
                                                        <button key={i} className="ad-sugg-chip" onClick={() => setQuestion(s)}>{s}</button>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : (
                                            messages.map((msg, i) => (
                                                <div key={i} className={`ad-msg ad-msg--${msg.role}`}>
                                                    <div className="ad-msg__avatar">{msg.role === 'user' ? '👤' : '🤖'}</div>
                                                    <div className="ad-msg__bubble">
                                                        {msg.tools?.length > 0 && (
                                                            <div className="ad-steps">
                                                                {msg.tools.map((t, ti) => (
                                                                    <span key={ti} className={`ad-step ${t.done ? 'done' : 'running'}`}>
                                                                        {t.done ? <FiCheck size={11} /> : <FiSearch size={11} />}
                                                                        {t.label}{t.done && t.summary ? ` · ${t.summary}` : '…'}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                        {msg.content && <div className="ad-msg__text">{formatText(msg.content)}</div>}
                                                        {msg.build && (
                                                            <button
                                                                type="button"
                                                                className="ad-buildchip"
                                                                onClick={() => setShownBuild(normalizeBuild(msg.build, 'agent'))}
                                                            >
                                                                <FiPackage size={14} />
                                                                <span className="ad-buildchip__title">{msg.build.title}</span>
                                                                <span className="ad-buildchip__total">{formatPrice(msg.build.total)}</span>
                                                                <span className="ad-buildchip__hint">Show →</span>
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                        {isStreaming && messages[messages.length - 1]?.content === '' && !messages[messages.length - 1]?.tools?.length && (
                                            <div className="ad-msg ad-msg--assistant">
                                                <div className="ad-msg__avatar">🤖</div>
                                                <div className="ad-msg__bubble ad-msg--typing"><span /><span /><span /></div>
                                            </div>
                                        )}
                                        <div ref={chatEndRef} />
                                    </div>
                                    <form className="ad-chat__input" onSubmit={askQuestion}>
                                        <input type="text" value={question} onChange={e => setQuestion(e.target.value)}
                                            placeholder="Ask for a build or any PC advice…" disabled={isStreaming} />
                                        <button type="submit" className="btn btn-primary" aria-label="Send message" disabled={isStreaming || !question.trim()}>
                                            <FiSend size={14} />
                                        </button>
                                    </form>
                                </div>
                            </div>
                        )}

                        {/* ==================== PRESETS TAB ==================== */}
                        {tab === 'presets' && (
                            <div className="ad-presets">
                                <div className="ad-presets__intro">
                                    <FiPackage size={20} />
                                    <div>
                                        <h3>Pre-Built Configurations</h3>
                                        <p>Curated builds for common use cases. Show one to inspect it, or use it in the Builder.</p>
                                    </div>
                                </div>

                                <div className="ad-presets__filters">
                                    {[
                                        { id: 'all', label: 'All' },
                                        { id: 'gaming', label: 'Gaming' },
                                        { id: 'content', label: 'Content' },
                                        { id: 'productivity', label: 'Productivity' },
                                        { id: 'streaming', label: 'Streaming' },
                                    ].map(f => (
                                        <button
                                            key={f.id}
                                            className={`ad-filter-btn ${presetFilter === f.id ? 'active' : ''}`}
                                            onClick={() => setPresetFilter(f.id)}
                                        >
                                            {f.label}
                                        </button>
                                    ))}
                                </div>

                                <div className="ad-tmpl-grid">
                                    {filteredPresets ? (
                                        filteredPresets.length > 0 ? filteredPresets.map(([key, tmpl]) => (
                                            <div key={key} className="ad-tmpl">
                                                <div className="ad-tmpl__head">
                                                    <div className="ad-tmpl__head-main">
                                                        <h3 className="ad-tmpl__name">{tmpl.name || tmpl.title}</h3>
                                                        {presetTag(key, tmpl) && <span className="ad-tmpl__tag">{presetTag(key, tmpl)}</span>}
                                                    </div>
                                                    <span className="ad-tmpl__budget">{formatPrice(tmpl.total || tmpl.budget)}</span>
                                                </div>
                                                <p className="ad-tmpl__desc">{tmpl.description}</p>
                                                <span className="ad-tmpl__count">{tmpl.components?.length || 0} parts</span>
                                                <div className="ad-tmpl__actions">
                                                    <button className="btn btn-sm" onClick={() => setShownBuild(normalizeBuild(tmpl, 'preset'))}>
                                                        Show build
                                                    </button>
                                                    <button className="btn btn-sm btn-primary" onClick={() => navigate('/builder', { state: { recommendation: tmpl } })}>
                                                        Use build <FiArrowRight size={12} />
                                                    </button>
                                                </div>
                                            </div>
                                        )) : <p className="text-muted">No presets match this filter.</p>
                                    ) : (
                                        <div className="ad-presets__loading">
                                            <span className="ad-spinner" /> Loading presets...
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                    </div>

                    <BuildPanel build={shownBuild} onUse={useBuild} onClose={() => setShownBuild(null)} />
                </div>
            </div>
        </main>
    )
}
