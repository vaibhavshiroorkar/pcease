import './PriceRange.css'

/**
 * Dual-thumb price range with typeable number inputs at both ends.
 * value: { min: string, max: string }  ('' means the bound)
 * onChange: (next) => void
 * min/max/step: numeric bounds of the slider
 */
export default function PriceRange({ value, onChange, min = 0, max = 200000, step = 500 }) {
    const lo = value.min === '' || value.min == null ? min : Math.max(min, Number(value.min))
    const hi = value.max === '' || value.max == null ? max : Math.min(max, Number(value.max))
    const pct = (v) => ((v - min) / (max - min)) * 100

    const setLo = (n) => onChange({ ...value, min: String(Math.min(n, hi)) })
    const setHi = (n) => onChange({ ...value, max: String(Math.max(n, lo)) })

    return (
        <div className="pr">
            <div className="pr__inputs">
                <input
                    type="number" inputMode="numeric" placeholder={`₹${min}`} value={value.min}
                    min={min} max={max}
                    onChange={e => onChange({ ...value, min: e.target.value })}
                />
                <span className="pr__dash">to</span>
                <input
                    type="number" inputMode="numeric" placeholder={`₹${max}`} value={value.max}
                    min={min} max={max}
                    onChange={e => onChange({ ...value, max: e.target.value })}
                />
            </div>
            <div className="pr__slider">
                <div className="pr__track" />
                <div className="pr__fill" style={{ left: `${pct(lo)}%`, right: `${100 - pct(hi)}%` }} />
                <input
                    className="pr__range pr__range--lo" type="range" min={min} max={max} step={step}
                    value={lo} onChange={e => setLo(Number(e.target.value))} aria-label="Minimum price"
                />
                <input
                    className="pr__range pr__range--hi" type="range" min={min} max={max} step={step}
                    value={hi} onChange={e => setHi(Number(e.target.value))} aria-label="Maximum price"
                />
            </div>
        </div>
    )
}
