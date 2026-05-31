import { useState, useRef, useCallback } from 'react'
import { streamAgent } from '../services/agentStream'

// Message shape:
// { role: 'user' | 'assistant', content: string, tools: [{name,label,summary,done}], build: {…}|null }

export function useAgentChat() {
    const [messages, setMessages] = useState([])
    const [isStreaming, setIsStreaming] = useState(false)
    const abortRef = useRef(null)

    const send = useCallback(async (text, buildContext) => {
        if (!text.trim() || isStreaming) return
        const history = [...messages, { role: 'user', content: text }]
        setMessages([...history,
            { role: 'assistant', content: '', tools: [], build: null }])
        setIsStreaming(true)
        abortRef.current = new AbortController()

        // Patch the last (assistant) message immutably.
        const patch = (fn) => setMessages(prev => {
            if (prev.length === 0) return prev
            const next = [...prev]
            next[next.length - 1] = fn(next[next.length - 1])
            return next
        })

        try {
            const wire = history.map(m => ({ role: m.role, content: m.content }))
            for await (const { event, data } of streamAgent({
                messages: wire, buildContext, signal: abortRef.current.signal,
            })) {
                if (event === 'token') {
                    patch(m => ({ ...m, content: m.content + data }))
                } else if (event === 'tool_start') {
                    patch(m => ({ ...m, tools: [...m.tools,
                        { name: data.name, label: data.label, summary: '', done: false }] }))
                } else if (event === 'tool_end') {
                    patch(m => {
                        const tools = [...m.tools]
                        for (let i = tools.length - 1; i >= 0; i--) {
                            if (tools[i].name === data.name && !tools[i].done) {
                                tools[i] = { ...tools[i], summary: data.summary, done: true }
                                break
                            }
                        }
                        return { ...m, tools }
                    })
                } else if (event === 'build') {
                    patch(m => ({ ...m, build: data }))
                } else if (event === 'error') {
                    patch(m => ({ ...m, content: m.content + `\n\n⚠ ${data.message}` }))
                }
            }
        } catch (e) {
            patch(m => ({ ...m, content: m.content || `⚠ ${e.message}` }))
        } finally {
            setIsStreaming(false)
        }
    }, [messages, isStreaming])

    const reset = useCallback(() => {
        abortRef.current?.abort()
        setMessages([])
        setIsStreaming(false)
    }, [])

    return { messages, isStreaming, send, reset }
}
