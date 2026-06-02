import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { FiSearch, FiArrowRight } from 'react-icons/fi'
import { API } from '../services/api'
import Avatar from './Avatar'

/**
 * Builders directory - browse PCease users and open their public profiles.
 * Rendered inside the Community page's Builders tab.
 */
export default function Builders() {
    const [q, setQ] = useState('')
    const [users, setUsers] = useState(null)

    useEffect(() => {
        const t = setTimeout(() => {
            setUsers(null)
            API.getBuilders({ q })
                .then(d => setUsers(d.items || []))
                .catch(() => setUsers([]))
        }, q ? 300 : 0)
        return () => clearTimeout(t)
    }, [q])

    return (
        <>
            <div className="cm-builders__search">
                <FiSearch className="cm-builders__search-icon" />
                <input
                    type="search"
                    placeholder="Search builders by name..."
                    value={q}
                    onChange={e => setQ(e.target.value)}
                />
            </div>

            {users === null ? (
                <div className="cm-builders__grid">
                    {Array(6).fill(0).map((_, i) => <div key={i} className="skeleton cm-builder-skel" />)}
                </div>
            ) : users.length === 0 ? (
                <div className="empty-state">
                    <h3>No builders found</h3>
                    <p>{q ? 'Try a different name.' : 'Be the first to share a build.'}</p>
                </div>
            ) : (
                <div className="cm-builders__grid">
                    {users.map(u => (
                        <Link key={u.id} to={`/u/${u.username}`} className="cm-builder">
                            <Avatar user={u} size={48} />
                            <div className="cm-builder__body">
                                <span className="cm-builder__name">{u.username}</span>
                                <span className="cm-builder__meta">
                                    {u.public_builds} {u.public_builds === 1 ? 'public build' : 'public builds'}
                                </span>
                                {u.bio && <p className="cm-builder__bio">{u.bio}</p>}
                            </div>
                            <FiArrowRight size={15} className="cm-builder__arrow" />
                        </Link>
                    ))}
                </div>
            )}
        </>
    )
}
