# Browse Advanced Table, Softer Theme, Compare Alignment - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Simple/Advanced toggle to Browse with a connected, category-aware, sortable/filterable spec table; soften the dark theme (with a backup); and fix Compare card-view spec alignment.

**Architecture:** Frontend-only. A new pure helpers module (`specColumns.js`) holds all testable table logic (column config, numeric parsing, type inference, comparison) and is unit-tested under node-env vitest. `PartCard` is refactored to share the column config. A new presentational `SpecTable` component consumes Browse's already-filtered/paged items. Browse gains a `mode` state. The theme is retuned via `:root` tokens only, with the old palette snapshotted to a never-imported backup file. Compare's card-view specs become a single aligned region.

**Tech Stack:** React 18, Vite, vitest (node env, `*.test.js`), react-icons, plain CSS with design tokens.

---

## File Structure

- `frontend/src/styles/global.dark-backup.css` - **create**: verbatim snapshot of current `global.css` (never imported).
- `frontend/src/styles/global.css` - **modify**: retune `:root` tokens only.
- `frontend/src/services/specColumns.js` - **create**: pure helpers (column config + sort/filter logic).
- `frontend/src/services/specColumns.test.js` - **create**: node-env unit tests.
- `frontend/src/components/PartCard.jsx` - **modify**: import shared `SPEC_PRIORITY`/`columnsForCategory`.
- `frontend/src/components/SpecTable.jsx` - **create**: the Advanced connected table.
- `frontend/src/components/SpecTable.css` - **create**: table styles.
- `frontend/src/pages/Browse.jsx` - **modify**: `mode` state + toggle + render `SpecTable` in advanced.
- `frontend/src/pages/Browse.css` - **modify**: styles for the mode toggle.
- `frontend/src/pages/Compare.jsx` - **modify**: connected/aligned card-view specs.
- `frontend/src/pages/Compare.css` - **modify**: alignment styles.
- `pcease/HANDOFF.md`, `pcease/DEVELOPMENT.md` - **modify**: document changes + backup file.

**Convention reminders:** No em dashes anywhere (use commas, colons, spaced hyphens). Mirror component spec UI across Browse and Builder. Update HANDOFF.md/DEVELOPMENT.md in the same commit as the change.

---

## Task 1: Back up and soften the theme

**Files:**
- Create: `frontend/src/styles/global.dark-backup.css`
- Modify: `frontend/src/styles/global.css` (`:root`, lines ~8-44)

- [ ] **Step 1: Snapshot the current theme**

Copy the current file verbatim to the backup (PowerShell):

```powershell
Copy-Item frontend/src/styles/global.css frontend/src/styles/global.dark-backup.css
```

Add a one-line comment banner at the very top of the new backup file so its purpose is unmistakable:

```css
/* SNAPSHOT of the original near-black "Performance Instrument" theme (2026-06-03).
   NOT imported anywhere. To restore: copy this back over global.css. */
```

- [ ] **Step 2: Retune the `:root` tokens in `global.css`**

In `frontend/src/styles/global.css`, replace these specific token values (leave every other line, including the comment headers, untouched):

```css
    /* --- Base surfaces (softened charcoal, cool) --- */
    --bg: #15171c;
    --bg-secondary: #1a1d23;
    --surface: #1f232b;
    --surface-hover: #262b34;
    --surface-active: #2e343f;

    /* --- Text --- */
    --text: #e9ebef;
    --text-secondary: #c2c8d2;
    --text-muted: #939aa6;
```

And the structure lines:

```css
    --border: rgba(255,255,255,.09);
    --border-hover: rgba(255,255,255,.16);
    --grid-line: rgba(255,255,255,.028);
```

Leave accent blue, green/support signals, shadows, radii, type, and the `body::before`/`body::after` atmosphere unchanged.

- [ ] **Step 3: Verify the build is clean**

Run: `cd frontend; npm run build`
Expected: build completes with no errors.

- [ ] **Step 4: Manual eyeball**

Run: `cd frontend; npm run dev` and load `/`, `/browse`, `/builder`, `/compare`, `/builds`.
Expected: backgrounds are charcoal (not near-black), text is off-white, cards/borders still clearly separate from the background, accent blue unchanged. Nothing looks broken from the old near-black assumption.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/styles/global.css frontend/src/styles/global.dark-backup.css
git commit -m "feat(theme): soften dark palette to charcoal, snapshot old theme as backup"
```

---

## Task 2: Pure spec-table helpers (TDD)

**Files:**
- Create: `frontend/src/services/specColumns.js`
- Test: `frontend/src/services/specColumns.test.js`

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/services/specColumns.test.js`:

```js
import { describe, it, expect } from 'vitest'
import {
    columnsForCategory,
    parseSpecNum,
    inferColumnType,
    distinctValues,
    compareValues,
} from './specColumns'

describe('columnsForCategory', () => {
    it('returns the priority spec keys for a known category', () => {
        expect(columnsForCategory('cpu')).toEqual(['cores', 'threads', 'boost_clock', 'socket', 'tdp'])
    })
    it('returns an empty array for unknown or empty category', () => {
        expect(columnsForCategory('')).toEqual([])
        expect(columnsForCategory('nope')).toEqual([])
    })
})

describe('parseSpecNum', () => {
    it('pulls the leading number out of unit-suffixed strings', () => {
        expect(parseSpecNum('4.7 GHz')).toBe(4.7)
        expect(parseSpecNum('65W')).toBe(65)
        expect(parseSpecNum('16GB')).toBe(16)
    })
    it('returns null for non-numeric or missing values', () => {
        expect(parseSpecNum('AM5')).toBeNull()
        expect(parseSpecNum(null)).toBeNull()
        expect(parseSpecNum(undefined)).toBeNull()
    })
})

describe('inferColumnType', () => {
    it('is numeric when >= 70% of non-empty values parse as numbers', () => {
        expect(inferColumnType(['4.7 GHz', '5.0 GHz', '3.8 GHz'])).toBe('numeric')
        expect(inferColumnType(['4.7 GHz', '5.0 GHz', 'N/A'])).toBe('numeric')
    })
    it('is categorical for discrete text', () => {
        expect(inferColumnType(['AM5', 'LGA1700', 'AM4'])).toBe('categorical')
    })
    it('defaults to categorical when there are no values', () => {
        expect(inferColumnType([null, undefined, ''])).toBe('categorical')
    })
})

describe('distinctValues', () => {
    it('returns sorted unique non-empty strings', () => {
        expect(distinctValues(['AM5', 'AM4', 'AM5', null, ''])).toEqual(['AM4', 'AM5'])
    })
})

describe('compareValues', () => {
    it('orders numbers numerically, missing values last', () => {
        expect(compareValues('65W', '120W', 'numeric')).toBeLessThan(0)
        expect(compareValues(null, '120W', 'numeric')).toBeGreaterThan(0)
    })
    it('orders text case-insensitively', () => {
        expect(compareValues('amd', 'Intel', 'categorical')).toBeLessThan(0)
    })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd frontend; npx vitest run src/services/specColumns.test.js`
Expected: FAIL (cannot resolve `./specColumns`).

- [ ] **Step 3: Implement the helpers**

Create `frontend/src/services/specColumns.js`:

```js
/**
 * Shared spec-table logic for Browse (Advanced) and PartCard. Pure functions
 * only, so they are unit-testable under node-env vitest.
 */

// Which specs matter, per category. Single source of truth for the card key-specs
// and the Advanced table columns so the two never drift.
export const SPEC_PRIORITY = {
    cpu: ['cores', 'threads', 'boost_clock', 'socket', 'tdp'],
    gpu: ['memory', 'boost_clock', 'tdp', 'cuda_cores'],
    motherboard: ['socket', 'chipset', 'form_factor', 'ram_slots'],
    ram: ['capacity', 'speed', 'type', 'cas_latency'],
    storage: ['capacity', 'type', 'interface', 'read_speed'],
    psu: ['wattage', 'efficiency', 'modular'],
    case: ['form_factor', 'max_gpu_length', 'expansion_slots'],
    cooler: ['type', 'tdp_rating', 'fan_size'],
    monitor: ['resolution', 'refresh_rate', 'panel_type', 'size'],
    fans: ['size', 'quantity', 'airflow', 'rpm'],
}

export function columnsForCategory(slug) {
    return SPEC_PRIORITY[slug] || []
}

export function parseSpecNum(v) {
    if (v === null || v === undefined) return null
    const n = parseFloat(String(v).replace(/[^0-9.-]/g, ''))
    return Number.isNaN(n) ? null : n
}

export function inferColumnType(values) {
    const nonEmpty = values.filter(v => v !== null && v !== undefined && v !== '')
    if (nonEmpty.length === 0) return 'categorical'
    const numeric = nonEmpty.filter(v => parseSpecNum(v) !== null)
    return numeric.length / nonEmpty.length >= 0.7 ? 'numeric' : 'categorical'
}

export function distinctValues(values) {
    const set = new Set(
        values.filter(v => v !== null && v !== undefined && v !== '').map(String)
    )
    return [...set].sort()
}

export function compareValues(a, b, type) {
    if (type === 'numeric') {
        const na = parseSpecNum(a)
        const nb = parseSpecNum(b)
        if (na === null && nb === null) return 0
        if (na === null) return 1  // missing sorts last
        if (nb === null) return -1
        return na - nb
    }
    const sa = a === null || a === undefined ? '' : String(a).toLowerCase()
    const sb = b === null || b === undefined ? '' : String(b).toLowerCase()
    return sa.localeCompare(sb)
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd frontend; npx vitest run src/services/specColumns.test.js`
Expected: PASS (all suites green).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/services/specColumns.js frontend/src/services/specColumns.test.js
git commit -m "feat: shared spec-column helpers with unit tests"
```

---

## Task 3: Refactor PartCard onto the shared column config

**Files:**
- Modify: `frontend/src/components/PartCard.jsx:15-37`

This removes the duplicate `SPEC_PRIORITY` in PartCard so cards and the table share one source (mirror-UI convention). No behavior change.

- [ ] **Step 1: Import the shared config and delete the local copy**

In `frontend/src/components/PartCard.jsx`, replace the local `const SPEC_PRIORITY = {...}` block (lines ~15-26) by importing it. Update the top imports:

```js
import { formatPrice, getLowestPrice, getSavings, getBestVendor, CATEGORIES } from '../services/api'
import { SPEC_PRIORITY } from '../services/specColumns'
import './PartCard.css'
```

Delete the entire local `const SPEC_PRIORITY = { ... }` declaration. Leave `getKeySpecs` as-is; it already reads `SPEC_PRIORITY[item.category?.slug]`, which now resolves to the imported constant.

- [ ] **Step 2: Verify build + existing tests**

Run: `cd frontend; npm run build; npx vitest run`
Expected: build clean; all tests (agentStream + specColumns) pass.

- [ ] **Step 3: Manual check**

Run dev, open `/browse` in Simple mode (grid and list). Spec chips render exactly as before for several categories.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/PartCard.jsx
git commit -m "refactor(PartCard): use shared SPEC_PRIORITY from specColumns"
```

---

## Task 4: SpecTable component

**Files:**
- Create: `frontend/src/components/SpecTable.jsx`
- Create: `frontend/src/components/SpecTable.css`

The component is presentational: it receives already filtered/paged `items`, builds columns from `category`, and owns only local sort + per-column filter UI state. It uses the Task 2 helpers and the existing api helpers.

- [ ] **Step 1: Create `SpecTable.jsx`**

```jsx
import { useState, useMemo } from 'react'
import { formatPrice, formatSpecKey, getLowestPrice, getSavings, getBestVendor, CATEGORIES } from '../services/api'
import { columnsForCategory, parseSpecNum, inferColumnType, distinctValues, compareValues } from '../services/specColumns'
import { FiBookmark, FiCheck, FiExternalLink, FiChevronUp, FiChevronDown, FiFilter, FiX } from 'react-icons/fi'
import './SpecTable.css'

const specOf = (item, key) => {
    const v = item.specs?.[key]
    return v === undefined ? null : v
}
const lowOf = getLowestPrice
const saveOf = getSavings

/**
 * Connected, category-aware spec table for Browse Advanced mode.
 * - `items`   : already filtered + paged components from Browse
 * - `category`: '' for All (base columns only), else a category slug
 * - `onOpen`  : open the shared Browse detail modal
 * - `hasWatch`/`toggleWatch`: watchlist state + toggle
 */
export default function SpecTable({ items, category, onOpen, hasWatch, toggleWatch }) {
    const specKeys = columnsForCategory(category)
    const [sort, setSort] = useState({ key: '__price', dir: 'asc' })
    const [filters, setFilters] = useState({})       // key -> {min,max} | string[]
    const [openFilter, setOpenFilter] = useState(null)

    // Infer each spec column's type once over the current items.
    const colTypes = useMemo(() => {
        const t = {}
        for (const k of specKeys) t[k] = inferColumnType(items.map(i => specOf(i, k)))
        return t
    }, [items, specKeys])

    const setColFilter = (key, val) => setFilters(f => ({ ...f, [key]: val }))
    const clearFilters = () => { setFilters({}); setOpenFilter(null) }
    const hasFilters = Object.keys(filters).length > 0

    const toggleSort = (key) =>
        setSort(s => s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' })

    // Apply per-column filters.
    const filtered = useMemo(() => {
        return items.filter(item => {
            for (const [key, f] of Object.entries(filters)) {
                if (!f) continue
                const raw = specOf(item, key)
                if (colTypes[key] === 'numeric') {
                    const n = parseSpecNum(raw)
                    if (f.min !== '' && f.min != null && (n === null || n < parseFloat(f.min))) return false
                    if (f.max !== '' && f.max != null && (n === null || n > parseFloat(f.max))) return false
                } else if (Array.isArray(f) && f.length > 0) {
                    if (!f.includes(String(raw))) return false
                }
            }
            return true
        })
    }, [items, filters, colTypes])

    // Apply sort.
    const rows = useMemo(() => {
        const list = [...filtered]
        const { key, dir } = sort
        const mul = dir === 'asc' ? 1 : -1
        list.sort((a, b) => {
            let cmp
            if (key === '__price') cmp = (lowOf(a) ?? Infinity) - (lowOf(b) ?? Infinity)
            else if (key === '__savings') cmp = saveOf(a) - saveOf(b)
            else if (key === '__name') cmp = String(a.name).localeCompare(String(b.name))
            else if (key === '__brand') cmp = String(a.brand || '').localeCompare(String(b.brand || ''))
            else cmp = compareValues(specOf(a, key), specOf(b, key), colTypes[key])
            return cmp * mul
        })
        return list
    }, [filtered, sort, colTypes])

    const SortHead = ({ label, k, extra }) => (
        <th className="st-th">
            <span className="st-th__wrap">
                <button className="st-th__sort" onClick={() => toggleSort(k)}>
                    {label}
                    {sort.key === k && (sort.dir === 'asc' ? <FiChevronUp size={12} /> : <FiChevronDown size={12} />)}
                </button>
                {extra}
            </span>
        </th>
    )

    const FilterBtn = ({ k }) => {
        const active = !!filters[k] && (Array.isArray(filters[k]) ? filters[k].length : (filters[k].min || filters[k].max))
        return (
            <button
                className={`st-filter-btn${active ? ' is-active' : ''}`}
                onClick={() => setOpenFilter(openFilter === k ? null : k)}
                title="Filter"
            >
                <FiFilter size={11} />
            </button>
        )
    }

    const FilterPopover = ({ k }) => {
        if (openFilter !== k) return null
        if (colTypes[k] === 'numeric') {
            const f = filters[k] || { min: '', max: '' }
            return (
                <div className="st-popover" onClick={e => e.stopPropagation()}>
                    <div className="st-popover__row">
                        <input type="number" placeholder="Min" value={f.min}
                            onChange={e => setColFilter(k, { ...f, min: e.target.value })} />
                        <span>-</span>
                        <input type="number" placeholder="Max" value={f.max}
                            onChange={e => setColFilter(k, { ...f, max: e.target.value })} />
                    </div>
                </div>
            )
        }
        const opts = distinctValues(items.map(i => specOf(i, k)))
        const selected = filters[k] || []
        const toggle = (v) => {
            const next = selected.includes(v) ? selected.filter(x => x !== v) : [...selected, v]
            setColFilter(k, next)
        }
        return (
            <div className="st-popover" onClick={e => e.stopPropagation()}>
                {opts.length === 0 && <p className="st-popover__empty">No values</p>}
                {opts.map(v => (
                    <label key={v} className="st-popover__opt">
                        <input type="checkbox" checked={selected.includes(v)} onChange={() => toggle(v)} />
                        <span>{v}</span>
                    </label>
                ))}
            </div>
        )
    }

    return (
        <div className="st-wrap" onClick={() => setOpenFilter(null)}>
            {!category && (
                <p className="st-hint">Pick a category to compare specs.</p>
            )}
            {hasFilters && (
                <button className="btn btn-sm st-clear" onClick={clearFilters}>
                    <FiX size={12} /> Clear table filters
                </button>
            )}
            <table className="st-table">
                <thead>
                    <tr>
                        <th className="st-th st-th--corner" />
                        <SortHead label="Name" k="__name" />
                        {!category && <th className="st-th">Category</th>}
                        <SortHead label="Brand" k="__brand" />
                        {specKeys.map(k => (
                            <th key={k} className="st-th st-th--spec">
                                <span className="st-th__wrap">
                                    <button className="st-th__sort" onClick={() => toggleSort(k)}>
                                        {formatSpecKey(k)}
                                        {sort.key === k && (sort.dir === 'asc' ? <FiChevronUp size={12} /> : <FiChevronDown size={12} />)}
                                    </button>
                                    <FilterBtn k={k} />
                                    <FilterPopover k={k} />
                                </span>
                            </th>
                        ))}
                        <SortHead label="Price" k="__price" />
                        <SortHead label="Savings" k="__savings" />
                        <th className="st-th">Vendor</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map(item => {
                        const saved = hasWatch(item.id)
                        const best = getBestVendor(item)
                        const low = lowOf(item)
                        const sav = saveOf(item)
                        const catName = CATEGORIES[item.category?.slug]?.name || item.category?.name || '-'
                        return (
                            <tr key={item.id} className="st-row" onClick={() => onOpen(item)}>
                                <td className="st-td st-td--corner">
                                    <button
                                        className={`st-watch${saved ? ' is-active' : ''}`}
                                        onClick={e => { e.stopPropagation(); toggleWatch(item) }}
                                        title={saved ? 'In your watchlist' : 'Save to watchlist'}
                                    >
                                        {saved ? <FiCheck size={13} /> : <FiBookmark size={13} />}
                                    </button>
                                </td>
                                <td className="st-td st-td--name">{item.name}</td>
                                {!category && <td className="st-td st-td--muted">{catName}</td>}
                                <td className="st-td">{item.brand || '-'}</td>
                                {specKeys.map(k => {
                                    const v = specOf(item, k)
                                    return <td key={k} className={`st-td st-td--spec${v === null ? ' st-td--na' : ''}`}>{v === null ? '-' : String(v)}</td>
                                })}
                                <td className="st-td st-td--price">{low ? formatPrice(low) : 'N/A'}</td>
                                <td className="st-td st-td--save">{sav > 0 ? formatPrice(sav) : '-'}</td>
                                <td className="st-td st-td--vendor" onClick={e => e.stopPropagation()}>
                                    {best?.url
                                        ? <a href={best.url} target="_blank" rel="noreferrer" className="btn btn-sm btn-primary"><FiExternalLink size={11} /> Buy</a>
                                        : <span className="st-td--muted">{best?.vendor?.name || best?.vendor_name || '-'}</span>}
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
            {rows.length === 0 && <p className="st-empty">No components match the table filters.</p>}
        </div>
    )
}
```

- [ ] **Step 2: Create `SpecTable.css`**

```css
/* Connected spec table for Browse Advanced mode */
.st-wrap { position: relative; overflow-x: auto; border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--surface); }
.st-hint { padding: 10px 14px; color: var(--text-muted); font-size: .8rem; border-bottom: 1px solid var(--border); }
.st-clear { margin: 10px 14px; }
.st-table { width: 100%; border-collapse: collapse; font-size: .82rem; min-width: 640px; }
.st-th { position: sticky; top: 0; z-index: 2; background: var(--bg-secondary); text-align: left; padding: 9px 12px; border-bottom: 1px solid var(--border-hover); white-space: nowrap; font-weight: 600; }
.st-th--corner { width: 38px; }
.st-th__wrap { position: relative; display: inline-flex; align-items: center; gap: 4px; }
.st-th__sort { display: inline-flex; align-items: center; gap: 3px; background: none; border: none; color: var(--text); cursor: pointer; font: inherit; font-weight: 600; padding: 0; }
.st-th__sort:hover { color: var(--accent); }
.st-th--spec .st-th__sort { font-family: var(--font-mono); font-size: .7rem; text-transform: uppercase; letter-spacing: .04em; }
.st-filter-btn { display: inline-flex; background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 2px; border-radius: var(--radius-sm); }
.st-filter-btn:hover { color: var(--text); background: var(--surface-hover); }
.st-filter-btn.is-active { color: var(--accent); }
.st-popover { position: absolute; top: 100%; left: 0; margin-top: 6px; z-index: 5; background: var(--surface-active); border: 1px solid var(--border-hover); border-radius: var(--radius-md); box-shadow: var(--shadow-md); padding: 10px; min-width: 180px; max-height: 240px; overflow-y: auto; }
.st-popover__row { display: flex; align-items: center; gap: 6px; }
.st-popover__row input { width: 70px; padding: 5px 7px; background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text); }
.st-popover__opt { display: flex; align-items: center; gap: 7px; padding: 4px 2px; cursor: pointer; }
.st-popover__empty { color: var(--text-muted); font-size: .78rem; }
.st-row { cursor: pointer; transition: background var(--transition); }
.st-row:hover { background: var(--surface-hover); }
.st-td { padding: 9px 12px; border-bottom: 1px solid var(--border); white-space: nowrap; }
.st-td--name { font-weight: 600; color: var(--text); white-space: normal; min-width: 180px; }
.st-td--spec { font-family: var(--font-mono); font-size: .76rem; color: var(--text-secondary); }
.st-td--na, .st-td--muted { color: var(--text-muted); }
.st-td--price { font-weight: 700; color: var(--text); }
.st-td--save { color: var(--green); }
.st-td--corner { text-align: center; }
.st-watch { display: inline-flex; background: none; border: 1px solid var(--border); color: var(--text-muted); border-radius: var(--radius-sm); padding: 4px; cursor: pointer; }
.st-watch:hover { color: var(--accent); border-color: var(--accent-border); }
.st-watch.is-active { color: var(--accent); border-color: var(--accent-border); background: var(--accent-subtle); }
.st-empty { padding: 24px; text-align: center; color: var(--text-muted); }
```

- [ ] **Step 3: Verify build**

Run: `cd frontend; npm run build`
Expected: build clean (component compiles even though not yet wired in).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/SpecTable.jsx frontend/src/components/SpecTable.css
git commit -m "feat: SpecTable component for Browse Advanced mode"
```

---

## Task 5: Wire Simple/Advanced toggle into Browse

**Files:**
- Modify: `frontend/src/pages/Browse.jsx`
- Modify: `frontend/src/pages/Browse.css`

- [ ] **Step 1: Add the import and `mode` state**

In `frontend/src/pages/Browse.jsx`, add the SpecTable import near the other component imports (after the `PartCard` import on line 7):

```js
import SpecTable from '../components/SpecTable'
```

Add `FiColumns` to the existing `react-icons/fi` import (line 4) so the toggle has an icon:

```js
import { FiSearch, FiX, FiExternalLink, FiCheck, FiBookmark, FiGrid, FiList, FiShoppingCart, FiInfo, FiChevronRight, FiSliders, FiColumns } from 'react-icons/fi'
```

Add the `mode` state next to `viewMode` (after line 55), initialized from localStorage:

```js
    const [mode, setMode] = useState(() => localStorage.getItem('pcease_browse_mode') || 'simple')
    useEffect(() => { localStorage.setItem('pcease_browse_mode', mode) }, [mode])
```

- [ ] **Step 2: Add the Simple/Advanced toggle and gate the grid/list toggle**

In the `br-meta__right` block (lines ~224-240), put a Simple/Advanced segmented control before the sort dropdown, and only render the grid/list view toggle in Simple mode. Replace the contents of `<div className="br-meta__right"> ... </div>` with:

```jsx
                        <div className="br-meta__right">
                            <div className="br-mode-toggle">
                                <button className={mode === 'simple' ? 'active' : ''} onClick={() => setMode('simple')}>Simple</button>
                                <button className={mode === 'advanced' ? 'active' : ''} onClick={() => setMode('advanced')}>
                                    <FiColumns size={13} /> Advanced
                                </button>
                            </div>
                            <select className="br-pagesize" value={pageSize} onChange={e => setPageSize(Number(e.target.value))} aria-label="Results per page" title="Results per page">
                                <option value={15}>15 / page</option>
                                <option value={30}>30 / page</option>
                                <option value={60}>60 / page</option>
                                <option value={120}>120 / page</option>
                            </select>
                            <select value={sort} onChange={e => setSort(e.target.value)}>
                                <option value="price-low">Price: Low to High</option>
                                <option value="price-high">Price: High to Low</option>
                                <option value="name">Name: A-Z</option>
                            </select>
                            {mode === 'simple' && (
                                <div className="br-view-toggle">
                                    <button className={viewMode === 'grid' ? 'active' : ''} onClick={() => setViewMode('grid')} title="Grid view"><FiGrid size={15} /></button>
                                    <button className={viewMode === 'list' ? 'active' : ''} onClick={() => setViewMode('list')} title="List view"><FiList size={15} /></button>
                                </div>
                            )}
                        </div>
```

- [ ] **Step 3: Render SpecTable in advanced mode**

Replace the results `<section>` block (the non-loading, non-empty branch, lines ~253-287) so advanced mode renders the table. Change the final `else` branch of the results render to:

```jsx
                ) : mode === 'advanced' ? (
                    <SpecTable
                        items={pagedComponents}
                        category={category}
                        onOpen={item => setDetail(item)}
                        hasWatch={id => watchIds.has(id)}
                        toggleWatch={handleToggleWatch}
                    />
                ) : (
                    <section className={viewMode === 'grid' ? 'pc-grid' : 'pc-list'}>
                        {pagedComponents.map(item => {
                            const isSaved = watchIds.has(item.id)
                            const bestVendor = getBestVendor(item)
                            const corner = (
                                <button
                                    className={`pc-corner${isSaved ? ' is-active' : ''}`}
                                    onClick={e => { e.stopPropagation(); handleToggleWatch(item) }}
                                    title={isSaved ? 'In your watchlist' : 'Save to watchlist'}
                                >
                                    {isSaved ? <FiCheck size={13} /> : <FiBookmark size={13} />}
                                </button>
                            )
                            const actions = viewMode === 'grid'
                                ? <span className="pc-view-details">View Details <FiChevronRight size={13} /></span>
                                : bestVendor?.url
                                    ? <a href={bestVendor.url} target="_blank" rel="noreferrer" className="btn btn-sm btn-primary" onClick={e => e.stopPropagation()}>
                                        <FiExternalLink size={12} /> Buy
                                      </a>
                                    : <button className="btn btn-sm" onClick={() => setDetail(item)}>View</button>
                            return (
                                <PartCard
                                    key={item.id}
                                    item={item}
                                    variant={viewMode === 'grid' ? 'grid' : 'list'}
                                    highlighted={isSaved}
                                    onOpen={() => setDetail(item)}
                                    corner={corner}
                                    actions={actions}
                                />
                            )
                        })}
                    </section>
                )}
```

(The loading branch and `EmptyState` branch above it are unchanged. The loading skeleton can stay card-based; advanced mode simply shows it briefly before the table.)

- [ ] **Step 4: Add toggle styles**

Append to `frontend/src/pages/Browse.css`:

```css
/* Simple / Advanced mode toggle */
.br-mode-toggle { display: inline-flex; border: 1px solid var(--border); border-radius: var(--radius-md); overflow: hidden; }
.br-mode-toggle button { display: inline-flex; align-items: center; gap: 5px; padding: 6px 12px; background: var(--surface); color: var(--text-secondary); border: none; cursor: pointer; font: inherit; font-size: .82rem; font-weight: 600; }
.br-mode-toggle button + button { border-left: 1px solid var(--border); }
.br-mode-toggle button:hover { color: var(--text); background: var(--surface-hover); }
.br-mode-toggle button.active { background: var(--accent-subtle); color: var(--accent); }
```

- [ ] **Step 5: Verify build + tests**

Run: `cd frontend; npm run build; npx vitest run`
Expected: build clean; all tests pass.

- [ ] **Step 6: Manual check**

Run dev, open `/browse`:
- Defaults to Simple (grid/list visible, cards render).
- Click Advanced: grid/list hides, connected table appears.
- Select Processor: spec columns (Cores, Threads, Boost Clock, Socket, TDP) appear; "All" shows base columns + the hint and a Category column.
- Click a header to sort (asc/desc caret); numeric vs text sort behaves.
- Open a spec column filter: numeric shows min/max, categorical shows checkboxes; rows filter; "Clear table filters" resets.
- Click a row: the existing detail modal opens. Watchlist toggle and Buy do not open the modal.
- Reload: mode persists.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/Browse.jsx frontend/src/pages/Browse.css
git commit -m "feat(browse): Simple/Advanced toggle with connected spec table"
```

---

## Task 6: Fix Compare card-view spec alignment

**Files:**
- Modify: `frontend/src/pages/Compare.jsx`
- Modify: `frontend/src/pages/Compare.css`

**Problem:** In card view each `cp-card` renders its own collapsible spec list, so the same spec is at different vertical positions across cards and does not line up. The connected `SpecsComparisonTable` already exists (lines 27-97) and renders an aligned table. The fix: in card view, stop rendering per-card spec lists and always show the connected `SpecsComparisonTable` so specs read straight across, directly under the cards.

- [ ] **Step 1: Remove the per-card collapsible specs from card view**

In `frontend/src/pages/Compare.jsx`, delete the per-card specs block inside the card map (lines ~419-436, the `{specsKeys.length > 0 && ( ... )}` block that renders `cp-card__specs`). Also remove the now-unused `specsKeys`, `isExpanded`, and `specsObj` locals computed for that block (lines ~347-349) and the `toggleSpecs`/`expandedSpecs` state (lines 144, 255-257) if no longer referenced. Verify with a search that `expandedSpecs` and `toggleSpecs` have no remaining usages before deleting them.

- [ ] **Step 2: Always show the connected table under the cards in card view**

The `SpecsComparisonTable` is already rendered for card view at line ~663:

```jsx
{view === 'cards' && <SpecsComparisonTable components={filledSlots} />}
```

Keep this. To make it clearly the aligned spec region tied to the cards, move it to render immediately after the `cp-slots` grid (right after the card-view block closes, around line 449) instead of below the search modal, so it sits directly under the cards. Cut the line from ~663 and paste it immediately after the `{view === 'cards' && ( ...cp-slots... )}` block.

- [ ] **Step 3: Align the spec table columns with the cards**

In `frontend/src/pages/Compare.css`, ensure the `cp-specs-tbl` column widths match the card grid so each component column lines up under its card. Append:

```css
/* Connect the spec table under the comparison cards: equal component columns */
.cp-specs-table { margin-top: 14px; }
.cp-specs-tbl { table-layout: fixed; width: 100%; }
.cp-specs-tbl__label-col { width: 180px; }
.cp-specs-tbl__comp-col { width: auto; }
.cp-specs-tbl__val, .cp-specs-tbl__key { vertical-align: middle; }
```

If `cp-slots` uses a fixed label gutter that differs from 180px, match `cp-specs-tbl__label-col` to it after reading `Compare.css`.

- [ ] **Step 4: Verify build**

Run: `cd frontend; npm run build`
Expected: build clean, no unused-var or undefined references.

- [ ] **Step 5: Manual check**

Run dev, open `/compare`, add 2-4 components of the same category (e.g. via Browse "Compare" path or the add-slot search):
- Card view: each card shows hero/price/vendors; below the cards, one connected spec table where every spec row reads straight across and each value sits under its component column.
- No per-card collapsible "Specifications (n)" toggles remain.
- Table view still works and is aligned as before.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/Compare.jsx frontend/src/pages/Compare.css
git commit -m "fix(compare): connect and align card-view specs across components"
```

---

## Task 7: Docs + final verification

**Files:**
- Modify: `pcease/HANDOFF.md`
- Modify: `pcease/DEVELOPMENT.md`

- [ ] **Step 1: Update HANDOFF.md**

Add a new "Latest session (2026-06-03)" entry at the top of the session list summarizing: softer charcoal theme with `global.dark-backup.css` snapshot; Browse Simple/Advanced toggle with the connected `SpecTable` (category-aware columns, sort, smart per-column filters); shared `specColumns.js`; Compare card-view spec alignment fix. Note the follow-up spec (Reddit-style discussions + anonymize-on-delete) is not yet started.

- [ ] **Step 2: Update DEVELOPMENT.md**

Document: the theme backup file and how to restore it (copy `global.dark-backup.css` over `global.css`); the `pcease_browse_mode` localStorage key; that `specColumns.js` is the single source of truth for category spec columns shared by `PartCard` and `SpecTable` (extends the mirror-UI convention). No em dashes.

- [ ] **Step 3: Full verification**

Run:
```bash
cd frontend; npm run build; npx vitest run
cd ../backend; .venv/Scripts/python.exe -m pytest -q
```
Expected: frontend build clean; vitest all pass; backend tests still pass (unchanged: was 38).

- [ ] **Step 4: Commit**

```bash
git add pcease/HANDOFF.md pcease/DEVELOPMENT.md
git commit -m "docs: record Browse Advanced table, softer theme, Compare alignment"
```

---

## Self-Review

**Spec coverage:**
- Softer theme + backup -> Task 1. (spec section 1)
- Browse Simple/Advanced toggle, default Simple, localStorage, grid/list gated to Simple, "All" base columns + hint -> Task 5 (+ SpecTable Task 4). (spec section 2)
- SpecTable component, props, shared detail modal -> Task 4. (spec section 3)
- Column config single source of truth, PartCard refactor -> Tasks 2 + 3. (spec section 4)
- Per-column sort + smart numeric/categorical filters + clear -> Tasks 2 (logic) + 4 (UI). (spec section 5)
- Compare card-view alignment -> Task 6. (spec section 6)
- Testing (build, vitest helper tests, backend green) -> Tasks 2, 7. (spec testing)
- Conventions (no em dashes, mirror UI, docs in same flow) -> Task 3 (shared config), Task 7 (docs).

**Placeholder scan:** No TBD/TODO; all code steps show full code. The two spec-deferred items are explicitly out of scope.

**Type consistency:** `columnsForCategory`, `parseSpecNum`, `inferColumnType`, `distinctValues`, `compareValues` defined in Task 2 and consumed with matching signatures in Task 4. `SPEC_PRIORITY` exported in Task 2, imported in Task 3 and Task 4. SpecTable props (`items`, `category`, `onOpen`, `hasWatch`, `toggleWatch`) defined in Task 4 and passed identically in Task 5. localStorage key `pcease_browse_mode` consistent across Task 5 steps.

Note for executor: line numbers are approximate (the files evolve as tasks land); locate by the quoted surrounding code, not the line number.
