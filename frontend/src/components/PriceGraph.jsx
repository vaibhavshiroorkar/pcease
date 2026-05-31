import { useMemo, useState } from 'react'
import { formatPrice } from '../services/api'
import './PriceGraph.css'

/**
 * Lightweight price-over-time chart (pure SVG, no chart library).
 *
 * Real price history isn't stored yet, so the series is a DETERMINISTIC
 * synthetic walk that ends exactly at the current `price` — stable per
 * component + range. Swap `buildSeries` for a real `/price-history` fetch
 * when historical data exists.
 */
const RANGES = [
    { id: 'day', label: 'Day', points: 24, amp: 0.02 },
    { id: 'week', label: 'Week', points: 7, amp: 0.05 },
    { id: 'month', label: 'Month', points: 30, amp: 0.10 },
]

function mulberry32(a) {
    return function () {
        a |= 0
        a = (a + 0x6d2b79f5) | 0
        let t = Math.imul(a ^ (a >>> 15), 1 | a)
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}

function buildSeries(price, seed, n, amp) {
    const rng = mulberry32((Math.abs(seed | 0) * 2654435761 + n * 101 + 7) >>> 0)
    const walk = []
    let v = 0
    for (let i = 0; i < n; i++) {
        v += rng() - 0.5
        walk.push(v)
    }
    const last = walk[n - 1]
    const rel = walk.map((w) => w - last) // 0 at the end
    const maxAbs = Math.max(1e-6, ...rel.map(Math.abs))
    // Anchor the final point to the real current price; vary the rest within ±amp.
    return rel.map((r) => Math.max(1, Math.round(price * (1 + (r / maxAbs) * amp))))
}

export default function PriceGraph({ price, seed = 1 }) {
    const [range, setRange] = useState('week')
    const cfg = RANGES.find((r) => r.id === range)

    const series = useMemo(
        () => buildSeries(price, seed, cfg.points, cfg.amp),
        [price, seed, cfg.points, cfg.amp]
    )

    if (!price || price <= 0) return null

    const W = 600
    const H = 150
    const pad = 10
    const min = Math.min(...series)
    const max = Math.max(...series)
    const span = max - min || 1
    const x = (i) => (i / (series.length - 1)) * W
    const y = (v) => H - pad - ((v - min) / span) * (H - pad * 2)

    const line = series.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
    const area = `${line} L${W},${H} L0,${H} Z`

    const first = series[0]
    const cur = series[series.length - 1]
    const deltaPct = ((cur - first) / first) * 100
    const up = deltaPct > 0.05
    const down = deltaPct < -0.05

    return (
        <div className="pg">
            <div className="pg__head">
                <div className="pg__title">
                    <h4>Price history</h4>
                    <span className={`pg__delta ${up ? 'pg__delta--up' : down ? 'pg__delta--down' : ''}`}>
                        {up ? '▲' : down ? '▼' : '–'} {Math.abs(deltaPct).toFixed(1)}% this {range}
                    </span>
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
            <p className="pg__note">Illustrative trend · current best {formatPrice(cur)}</p>
        </div>
    )
}
