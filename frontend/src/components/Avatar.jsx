import './Avatar.css'

const COLORS = ['#c6f24e', '#3ad29f', '#f5b544', '#ff6b6b', '#7aa2ff', '#c78bff', '#4ec8d4']

function colorFor(name = '') {
    let h = 0
    for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0
    return COLORS[h % COLORS.length]
}

/** Avatar image when the user has one, otherwise a colored initial. */
export default function Avatar({ user, size = 40, className = '' }) {
    const name = user?.username || '?'
    if (user?.avatar_url) {
        return (
            <img
                className={`avatar ${className}`}
                src={user.avatar_url}
                alt={name}
                style={{ width: size, height: size }}
            />
        )
    }
    return (
        <span
            className={`avatar avatar--initial ${className}`}
            style={{ width: size, height: size, fontSize: size * 0.42, background: colorFor(name) }}
        >
            {name.charAt(0).toUpperCase()}
        </span>
    )
}
