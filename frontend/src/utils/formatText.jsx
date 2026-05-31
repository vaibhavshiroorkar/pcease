// Minimal inline formatter: **bold**, `code`, and lines starting with - or * become bullets.
// No markdown dependency. Returns an array of React nodes.
export function formatText(text) {
    if (!text) return null
    return text.split('\n').map((line, li) => {
        const trimmed = line.trimStart()
        const isBullet = trimmed.startsWith('- ') || trimmed.startsWith('* ')
        const body = isBullet ? trimmed.slice(2) : line
        const parts = []
        const regex = /(\*\*[^*]+\*\*|`[^`]+`)/g
        let last = 0, m
        while ((m = regex.exec(body)) !== null) {
            if (m.index > last) parts.push(body.slice(last, m.index))
            const tok = m[0]
            if (tok.startsWith('**')) parts.push(<strong key={parts.length}>{tok.slice(2, -2)}</strong>)
            else parts.push(<code key={parts.length}>{tok.slice(1, -1)}</code>)
            last = m.index + tok.length
        }
        if (last < body.length) parts.push(body.slice(last))
        return isBullet
            ? <div key={li} className="ad-bullet">• {parts}</div>
            : <div key={li}>{parts.length ? parts : ' '}</div>
    })
}
