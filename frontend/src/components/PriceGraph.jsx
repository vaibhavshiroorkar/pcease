import { useEffect, useRef, useState } from 'react'
import { API, formatPrice } from '../services/api'
import './PriceGraph.css'

/**
 * Price-over-time chart. Fetches historical lowest-price points from the
 * backend (/components/:id/price-history) for the selected range.
 */
const RANGES = [
    { id: 'day', label: 'Day' },
    { id: 'week', label: 'Week' },
    { id: 'month', label: 'Month' },
]

function fmtTick(iso, range) {
    const d = new Date(iso)
    if (range === 'day') return d.toLocaleTimeString('en-IN', { hour: 'numeric' })
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

function fmtFull(iso, range) {
    const d = new Date(iso)
    if (range === 'day') return d.toLocaleString('en-IN', { hour: 'numeric', minute: '2-digit' })
    return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
}

export default function PriceGraph({ componentId }) {
    const [range, setRange] = useState('week')
    const [points, setPoints] = useState(null) // null = loading
    const [failed, setFailed] = useState(false)
    const [hover, setHover] = useState(null)
    const chartRef = useRef(null)

    useEffect(() => {
        if (!componentId) return
        let alive = true
        setPoints(null)
        setFailed(false)
        setHover(null)
        API.getPriceHistory(componentId, range)
            .then((d) => { if (alive) setPoints(d.points || []) })
            .catch(() => { if (alive) { setFailed(true); setPoints([]) } })
        return () => { alive = false }
    }, [componentId, range])

    const series = (points || []).map((p) => p.price)
    const n = series.length

    const onMove = (e) => {
        if (!chartRef.current || n === 0) return
        const rect = chartRef.current.getBoundingClientRect()
        const frac = (e.clientX - rect.left) / rect.width
        setHover(Math.max(0, Math.min(n - 1, Math.round(frac * (n - 1)))))
    }

    let body = null
    let axis = null
    if (points === null) {
        body = <div className="pg__state">Loading price history…</div>
    } else if (failed || n === 0) {
        body = <div className="pg__state">No price history available.</div>
    } else {
        const W = 600, H = 150, pad = 12
        const min = Math.min(...series)
        const max = Math.max(...series)
        const span = max - min || 1
        const x = (i) => (i / (n - 1 || 1)) * W
        const y = (v) => H - pad - ((v - min) / span) * (H - pad * 2)
        const line = series.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
        const area = `${line} L${W},${H} L0,${H} Z`
        const cur = series[n - 1]
        const hx = hover != null ? (hover / (n - 1 || 1)) * 100 : 0

        body = (
            <div className="pg__chart" ref={chartRef} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
                <span className="pg__y pg__y--max">{formatPrice(max)}</span>
                <span className="pg__y pg__y--min">{formatPrice(min)}</span>
                <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="pg__svg">
                    <defs>
                        <linearGradient id="pgFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--volt)" stopOpacity="0.22" />
                            <stop offset="100%" stopColor="var(--volt)" stopOpacity="0" />
                        </linearGradient>
                    </defs>
                    <path d={area} fill="url(#pgFill)" />
                    <path d={line} fill="none" stroke="var(--volt)" strokeWidth="2"
                        vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
                    {hover != null ? (
                        <>
                            <line x1={x(hover)} x2={x(hover)} y1="0" y2={H} stroke="var(--border-hover)"
                                strokeWidth="1" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
                            <circle cx={x(hover)} cy={y(series[hover])} r="4.5" fill="var(--volt)"
                                stroke="var(--bg)" strokeWidth="2" />
                        </>
                    ) : (
                        <circle cx={x(n - 1)} cy={y(cur)} r="4" fill="var(--volt)" />
                    )}
                </svg>
                {hover != null && (
                    <div className="pg__tip" style={{ left: `${hx}%` }}>
                        <strong>{formatPrice(series[hover])}</strong>
                        <span>{fmtFull(points[hover].t, range)}</span>
                    </div>
                )}
            </div>
        )

        const ticks = [...new Set([0, Math.round((n - 1) / 3), Math.round((2 * (n - 1)) / 3), n - 1])]
        axis = (
            <div className="pg__axis">
                {ticks.map((i) => <span key={i}>{fmtTick(points[i].t, range)}</span>)}
            </div>
        )
    }

    const first = series[0]
    const cur = series[n - 1]
    const deltaPct = first ? ((cur - first) / first) * 100 : 0
    const up = deltaPct > 0.05
    const down = deltaPct < -0.05

    return (
        <div className="pg">
            <div className="pg__head">
                <div className="pg__title">
                    <h4>Price history</h4>
                    {n > 0 && (
                        <span className={`pg__delta ${up ? 'pg__delta--up' : down ? 'pg__delta--down' : ''}`}>
                            {up ? '▲' : down ? '▼' : '–'} {Math.abs(deltaPct).toFixed(1)}% this {range}
                        </span>
                    )}
                </div>
                <div className="pg__ranges" role="tablist" aria-label="Price range">
                    {RANGES.map((r) => (
                        <button
                            key={r.id}
                            role="tab"
                            aria-selected={range === r.id}
                            className={`pg__range ${range === r.id ? 'active' : ''}`}
                            onClick={() => setRange(r.id)}
                        >
                            {r.label}
                        </button>
                    ))}
                </div>
            </div>
            {body}
            {axis}
        </div>
    )
}
