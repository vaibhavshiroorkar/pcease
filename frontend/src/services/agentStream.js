const API_BASE = import.meta.env.VITE_API_URL || '/api'

// Parse one SSE frame ("event: x\ndata: y"). Returns {event, data} or null.
export function parseFrame(frame) {
    let event = 'message'
    let data = ''
    for (const line of frame.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim()
        else if (line.startsWith('data:')) data += line.slice(5).trim()
    }
    if (!data) return null
    try {
        return { event, data: JSON.parse(data) }
    } catch {
        return { event, data }
    }
}

// Async generator yielding {event, data} from POST /agent/chat.
export async function* streamAgent({ messages, buildContext, signal }) {
    const token = localStorage.getItem('pcease_token')
    const headers = { 'Content-Type': 'application/json' }
    if (token) headers.Authorization = `Bearer ${token}`

    const res = await fetch(`${API_BASE}/agent/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ messages, build_context: buildContext }),
        signal,
    })
    if (!res.ok || !res.body) throw new Error(`Agent error ${res.status}`)

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        let idx
        while ((idx = buffer.indexOf('\n\n')) !== -1) {
            const frame = buffer.slice(0, idx)
            buffer = buffer.slice(idx + 2)
            const ev = parseFrame(frame)
            if (ev) yield ev
        }
    }
}
