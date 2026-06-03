import { describe, it, expect } from 'vitest'
import {
    columnsForCategory,
    parseSpecNum,
    inferColumnType,
    distinctValues,
    compareValues,
    applySpecFilters,
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

describe('applySpecFilters', () => {
    const items = [
        { id: 1, specs: { tdp: '65W', socket: 'AM5' } },
        { id: 2, specs: { tdp: '120W', socket: 'LGA1700' } },
        { id: 3, specs: { tdp: '95W', socket: 'AM5' } },
    ]
    const colTypes = { tdp: 'numeric', socket: 'categorical' }
    it('returns all items when no filters are active', () => {
        expect(applySpecFilters(items, {}, colTypes)).toHaveLength(3)
        expect(applySpecFilters(items, { tdp: { min: '', max: '' } }, colTypes)).toHaveLength(3)
    })
    it('filters by numeric range', () => {
        expect(applySpecFilters(items, { tdp: { min: '90', max: '' } }, colTypes).map(i => i.id)).toEqual([2, 3])
    })
    it('filters by categorical multi-select', () => {
        expect(applySpecFilters(items, { socket: ['AM5'] }, colTypes).map(i => i.id)).toEqual([1, 3])
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
