import { useEffect, useState } from 'react'
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

export default function PriceGraph({ componentId }) {
    const [range, setRange] = useState('week')
    const [points, setPoints] = useState(null) // null = loading
    const [failed, setFailed] = useState(false)

    useEffect(() => {
        if (!componentId) return
        let alive = true
        setPoints(null)
        setFailed(false)
        API.getPriceHistory(componentId, range)
            .then((d) => { if (alive) setPoints(d.points || []) })
            .catch(() => { if (alive) { setFailed(true); setPoints([]) } })
        return () => { alive = false }
    }, [componentId, range])

    const series = (points || []).map((p) => p.price)

    let body
    if (points === null) {
        body = <div className="pg__state">Loading price history…</div>
    } else if (failed || series.length === 0) {
        body = <div className="pg__state">No price history available.</div>
    } else {
        const W = 600
        const H = 150
        const pad = 10
        const min = Math.min(...series)
        const max = Math.max(...series)
        const span = max - min || 1
        const x = (i) => (i / (series.length - 1 || 1)) * W
        const y = (v) => H - pad - ((v - min) / span) * (H - pad * 2)
        const line = series.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
        const area = `${line} L${W},${H} L0,${H} Z`
        const cur = series[series.length - 1]

        body = (
            <div className="pg__chart">
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
                    <circle cx={x(series.length - 1)} cy={y(cur)} r="4" fill="var(--volt)" />
                </svg>
            </div>
        )
    }

    const first = series[0]
    const cur = series[series.length - 1]
    const deltaPct = first ? ((cur - first) / first) * 100 : 0
    const up = deltaPct > 0.05
    const down = deltaPct < -0.05

    return (
        <div className="pg">
            <div className="pg__head">
                <div className="pg__title">
                    <h4>Price history</h4>
                    {series.length > 0 && (
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
        </div>
    )
}
