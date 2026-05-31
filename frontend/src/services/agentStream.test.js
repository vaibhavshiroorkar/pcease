import { describe, it, expect } from 'vitest'
import { parseFrame } from './agentStream'

describe('parseFrame', () => {
    it('parses an event with JSON data', () => {
        const out = parseFrame('event: tool_start\ndata: {"name":"search_components"}')
        expect(out).toEqual({ event: 'tool_start', data: { name: 'search_components' } })
    })

    it('parses a token frame', () => {
        const out = parseFrame('event: token\ndata: "Hello"')
        expect(out).toEqual({ event: 'token', data: 'Hello' })
    })

    it('returns null for a frame with no data', () => {
        expect(parseFrame('event: done')).toBeNull()
    })
})
