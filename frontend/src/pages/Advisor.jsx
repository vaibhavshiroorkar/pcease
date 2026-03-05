import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { API, formatPrice } from '../services/api'
import { FiCpu, FiSend, FiArrowRight, FiSliders, FiMessageSquare, FiPackage, FiZap, FiMonitor, FiCode, FiRadio } from 'react-icons/fi'
import toast from 'react-hot-toast'
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
    { id: 'manual', label: 'Manual', icon: <FiSliders size={14} />, desc: 'Configure & find best via ML' },
    { id: 'ai', label: 'AI Chat', icon: <FiMessageSquare size={14} />, desc: 'Ask anything about PC building' },
    { id: 'presets', label: 'Presets', icon: <FiPackage size={14} />, desc: 'Ready-made build configs' },
]

export default function Advisor() {
    const navigate = useNavigate()
    const chatEndRef = useRef(null)
    const [tab, setTab] = useState('manual')

    // Manual tab state
    const [budget, setBudget] = useState(60000)
    const [useCase, setUseCase] = useState('gaming')
    const [priority, setPriority] = useState('balanced')
    const [brandPref, setBrandPref] = useState('any')
    const [wifiNeeded, setWifiNeeded] = useState(false)
    const [rgbPref, setRgbPref] = useState(false)
    const [loading, setLoading] = useState(false)
    const [recommendation, setRecommendation] = useState(null)

    // AI tab state
    const [question, setQuestion] = useState('')
    const [chatHistory, setChatHistory] = useState([])
    const [asking, setAsking] = useState(false)

    // Presets tab state
    const [presets, setPresets] = useState(null)
    const [presetFilter, setPresetFilter] = useState('all')

    useEffect(() => { API.getTemplates().then(setPresets).catch(() => {}) }, [])
    useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [chatHistory, asking])

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
        } catch (e) {
            toast.error('Failed: ' + e.message)
        } finally {
            setLoading(false)
        }
    }

    const askQuestion = async (e) => {
        e.preventDefault()
        if (!question.trim()) return
        setAsking(true)
        const q = question
        setChatHistory(p => [...p, { role: 'user', content: q }])
        setQuestion('')
        try {
            const d = await API.askAI(q)
            setChatHistory(p => [...p, { role: 'ai', content: d.answer, source: d.source }])
        } catch {
            setChatHistory(p => [...p, { role: 'ai', content: 'Sorry, could not process your question. Please try again.', source: 'error' }])
        } finally {
            setAsking(false)
        }
    }

    const totalPrice = recommendation?.components?.reduce((s, c) => s + (c.price || c.est_price || 0), 0) || 0

    const filteredPresets = presets
        ? Object.entries(presets).filter(([key]) => presetFilter === 'all' || key.includes(presetFilter))
        : null

    const budgetLabel = budget < 40000 ? 'Entry' : budget < 80000 ? 'Mid-Range' : budget < 150000 ? 'High-End' : 'Enthusiast'

    return (
        <main className="page">
            <div className="container">
                <header className="ad-header">
                    <h1>Build Advisor</h1>
                    <p className="ad-header__sub">Find your perfect PC build — manually configure, chat with AI, or pick a preset.</p>
                </header>

                {/* Tab Bar */}
                <div className="ad-tabs">
                    {tabs.map(t => (
                        <button
                            key={t.id}
                            className={`ad-tab ${tab === t.id ? 'active' : ''}`}
                            onClick={() => setTab(t.id)}
                        >
                            {t.icon}
                            <span className="ad-tab__label">{t.label}</span>
                        </button>
                    ))}
                </div>

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

                        <div className={`ad-layout${recommendation ? '' : ' ad-layout--single'}`}>
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
                            </section>

                            {recommendation && (
                                <section className="ad-result">
                                    <div className="ad-result__head">
                                        <h2>{recommendation.title || recommendation.name}</h2>
                                        <span className={`ad-result__src ad-result__src--${recommendation.source}`}>
                                            {recommendation.source === 'smart' ? '✨ ML Optimized' : recommendation.source === 'template' ? 'Template' : '🤖 AI'}
                                        </span>
                                    </div>
                                    <p className="ad-result__desc">{recommendation.description}</p>
                                    {recommendation.within_budget !== undefined && (
                                        <div className={`ad-budget-status ${recommendation.within_budget ? 'ad-budget-status--ok' : 'ad-budget-status--over'}`}>
                                            {recommendation.within_budget
                                                ? `✓ Within budget — ₹${recommendation.savings?.toLocaleString('en-IN')} remaining`
                                                : `⚠ Over budget by ₹${(recommendation.total - recommendation.budget).toLocaleString('en-IN')}`
                                            }
                                        </div>
                                    )}
                                    <ul className="ad-rec-list">
                                        {(recommendation.components || []).map((comp, i) => (
                                            <li key={i}>
                                                <span className="ad-rec-cat">{comp.category}</span>
                                                <div className="ad-rec-main">
                                                    <span className="ad-rec-name">{comp.name || comp.suggestion}</span>
                                                    {comp.vendor && <span className="ad-rec-vendor">{comp.vendor}</span>}
                                                </div>
                                                <span className="ad-rec-price">{formatPrice(comp.price || comp.est_price)}</span>
                                                {comp.reason && <p className="ad-rec-reason">{comp.reason}</p>}
                                            </li>
                                        ))}
                                    </ul>
                                    <div className="ad-rec-total">
                                        <span>Total</span>
                                        <span className="ad-rec-total__val">{formatPrice(recommendation.total || totalPrice)}</span>
                                    </div>
                                    {recommendation.tips && (
                                        <div className="ad-tips">
                                            <h4>💡 Tips</h4>
                                            <ul>{recommendation.tips.map((t, i) => <li key={i}>{t}</li>)}</ul>
                                        </div>
                                    )}
                                    {recommendation.performance_notes && (
                                        <p className="ad-perf"><strong>Performance:</strong> {recommendation.performance_notes}</p>
                                    )}
                                    <button
                                        className="btn btn-primary"
                                        onClick={() => navigate('/builder', { state: { recommendation } })}
                                    >
                                        Open in Builder <FiArrowRight size={14} />
                                    </button>
                                </section>
                            )}
                        </div>
                    </div>
                )}

                {/* ==================== AI TAB ==================== */}
                {tab === 'ai' && (
                    <div className="ad-ai">
                        <div className="ad-chat">
                            <div className="ad-chat__msgs">
                                {chatHistory.length === 0 ? (
                                    <div className="ad-chat__empty">
                                        <div className="ad-chat__icon"><FiMessageSquare size={36} /></div>
                                        <h3>PCease AI Assistant</h3>
                                        <p>Ask any PC building question — component advice, comparisons, build help, and more.</p>
                                        <div className="ad-chat__sugg">
                                            {[
                                                'Best GPU under ₹30,000?',
                                                'Is DDR5 worth it in 2026?',
                                                'Ryzen 5 vs i5-14400F?',
                                                'Best ₹60K gaming PC?',
                                                'Should I go 1440p or 4K?',
                                                'How much PSU wattage do I need?',
                                            ].map((s, i) => (
                                                <button key={i} className="ad-sugg-chip" onClick={() => setQuestion(s)}>{s}</button>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    chatHistory.map((msg, i) => (
                                        <div key={i} className={`ad-msg ad-msg--${msg.role}`}>
                                            <div className="ad-msg__avatar">
                                                {msg.role === 'user' ? '👤' : '🤖'}
                                            </div>
                                            <div className="ad-msg__bubble">
                                                <pre>{msg.content}</pre>
                                            </div>
                                        </div>
                                    ))
                                )}
                                {asking && (
                                    <div className="ad-msg ad-msg--ai">
                                        <div className="ad-msg__avatar">🤖</div>
                                        <div className="ad-msg__bubble ad-msg--typing">
                                            <span /><span /><span />
                                        </div>
                                    </div>
                                )}
                                <div ref={chatEndRef} />
                            </div>
                            <form className="ad-chat__input" onSubmit={askQuestion}>
                                <input
                                    type="text"
                                    value={question}
                                    onChange={e => setQuestion(e.target.value)}
                                    placeholder="Ask about components, builds, comparisons..."
                                    disabled={asking}
                                />
                                <button type="submit" className="btn btn-primary" disabled={asking || !question.trim()}>
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
                                <p>Curated builds for common use cases. Pick one and customize it in the Builder.</p>
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
                                            <div>
                                                <h3>{tmpl.name || tmpl.title}</h3>
                                                <span className="ad-tmpl__tag">{key.includes('budget') ? 'Budget' : key.includes('mid') ? 'Mid-Range' : key.includes('high') ? 'High-End' : tmpl.source === 'smart' ? 'Optimized' : ''}</span>
                                            </div>
                                            <span className="ad-tmpl__budget">{formatPrice(tmpl.total || tmpl.budget)}</span>
                                        </div>
                                        <p className="ad-tmpl__desc">{tmpl.description}</p>
                                        <ul className="ad-tmpl__parts">
                                            {tmpl.components?.map((c, i) => (
                                                <li key={i}>
                                                    <span>{c.category}</span>
                                                    <span>{c.name || c.suggestion}</span>
                                                    <span>{formatPrice(c.price || c.est_price)}</span>
                                                </li>
                                            ))}
                                        </ul>
                                        <button
                                            className="btn btn-primary btn-sm"
                                            onClick={() => navigate('/builder', { state: { recommendation: tmpl } })}
                                        >
                                            Use This Build <FiArrowRight size={12} />
                                        </button>
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
        </main>
    )
}
