import { useState, useRef, useEffect, useMemo } from 'react'
import { FiChevronDown, FiSearch, FiCheck, FiX } from 'react-icons/fi'
import './SearchableSelect.css'

/**
 * A dropdown you can also type in to filter the options. Supports single-select
 * (value is a string) and multi-select (value is an array of strings).
 *
 * Props:
 *  - value: string | string[]
 *  - onChange: (next) => void   // string for single, string[] for multi
 *  - options: Array<string | { value, label }>
 *  - multiple: bool
 *  - placeholder: string
 *  - allLabel: string           // single-select only: the "clear" / no-filter row label
 */
export default function SearchableSelect({ value, onChange, options = [], multiple = false, placeholder = 'Select...', allLabel }) {
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState('')
    const ref = useRef(null)
    const inputRef = useRef(null)

    const opts = useMemo(
        () => options.map(o => (typeof o === 'string' ? { value: o, label: o } : o)),
        [options],
    )
    const selected = multiple ? (Array.isArray(value) ? value : []) : value

    useEffect(() => {
        if (!open) return
        const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
        document.addEventListener('mousedown', onDoc)
        return () => document.removeEventListener('mousedown', onDoc)
    }, [open])

    useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 30); else setQuery('') }, [open])

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase()
        return q ? opts.filter(o => o.label.toLowerCase().includes(q)) : opts
    }, [opts, query])

    const pick = (val) => {
        if (multiple) {
            onChange(selected.includes(val) ? selected.filter(v => v !== val) : [...selected, val])
        } else {
            onChange(val)
            setOpen(false)
        }
    }

    const label = multiple
        ? (selected.length ? `${selected.length} selected` : placeholder)
        : (opts.find(o => o.value === selected)?.label || allLabel || placeholder)

    const hasValue = multiple ? selected.length > 0 : (selected !== '' && selected != null)

    return (
        <div className={`ss${open ? ' ss--open' : ''}`} ref={ref}>
            <button type="button" className={`ss__control${hasValue ? ' ss--has-value' : ''}`} onClick={() => setOpen(o => !o)}>
                <span className="ss__label">{label}</span>
                {hasValue && (
                    <span
                        className="ss__clear"
                        role="button"
                        tabIndex={-1}
                        onClick={e => { e.stopPropagation(); onChange(multiple ? [] : ''); }}
                        title="Clear"
                    ><FiX size={13} /></span>
                )}
                <FiChevronDown size={14} className="ss__caret" />
            </button>
            {open && (
                <div className="ss__menu">
                    <div className="ss__search">
                        <FiSearch size={13} />
                        <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)} placeholder="Type to search..." />
                    </div>
                    <div className="ss__options">
                        {!multiple && allLabel && (
                            <button type="button" className={`ss__opt${!hasValue ? ' is-active' : ''}`} onClick={() => pick('')}>
                                {allLabel}
                            </button>
                        )}
                        {filtered.length === 0 && <p className="ss__empty">No matches</p>}
                        {filtered.map(o => {
                            const isSel = multiple ? selected.includes(o.value) : selected === o.value
                            return (
                                <button type="button" key={o.value} className={`ss__opt${isSel ? ' is-active' : ''}`} onClick={() => pick(o.value)}>
                                    {multiple && <span className="ss__check">{isSel && <FiCheck size={12} />}</span>}
                                    <span>{o.label}</span>
                                </button>
                            )
                        })}
                    </div>
                </div>
            )}
        </div>
    )
}
