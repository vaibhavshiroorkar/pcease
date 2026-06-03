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
    if (typeof v === 'number') return Number.isNaN(v) ? null : v
    // Only a leading number counts, so unit-suffixed values ("4.7 GHz", "65W")
    // parse, but alphanumeric codes ("AM5", "LGA1700") stay categorical.
    const m = String(v).trim().match(/^-?\d+(\.\d+)?/)
    return m ? parseFloat(m[0]) : null
}

// Values we treat as "no data": blanks and common not-available sentinels. They
// should not skew type inference or show up as filter options.
const NA_VALUES = new Set(['', 'n/a', 'na', '-', 'none', 'null'])
function isBlank(v) {
    return v === null || v === undefined || NA_VALUES.has(String(v).trim().toLowerCase())
}

export function inferColumnType(values) {
    const nonEmpty = values.filter(v => !isBlank(v))
    if (nonEmpty.length === 0) return 'categorical'
    const numeric = nonEmpty.filter(v => parseSpecNum(v) !== null)
    return numeric.length / nonEmpty.length >= 0.7 ? 'numeric' : 'categorical'
}

export function distinctValues(values) {
    const set = new Set(values.filter(v => !isBlank(v)).map(String))
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
