import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { API } from '../services/api'
import toast from 'react-hot-toast'
import { FiShield, FiUsers, FiMessageSquare, FiBox, FiCpu, FiTrash2, FiRefreshCw } from 'react-icons/fi'
import './Admin.css'

export default function Admin() {
    const navigate = useNavigate()
    const { user } = useAuth()
    const [stats, setStats] = useState(null)
    const [users, setUsers] = useState([])
    const [tickets, setTickets] = useState([])
    const [tab, setTab] = useState('overview')
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!user?.is_admin) { navigate('/'); return }
        loadData()
    }, [user])

    const loadData = async () => {
        setLoading(true)
        try {
            const [s, u, t] = await Promise.all([API.adminGetStats(), API.adminGetUsers(), API.adminGetTickets()])
            setStats(s)
            setUsers(u)
            setTickets(t)
        } catch (err) { toast.error('Failed to load admin data: ' + err.message) }
        finally { setLoading(false) }
    }

    const handleTicketStatus = async (id, status) => {
        try {
            await API.adminUpdateTicket(id, status)
            setTickets(prev => prev.map(t => (t.id === id ? { ...t, status } : t)))
        } catch (err) { toast.error(err.message) }
    }

    const handleDeleteUser = async (id, username) => {
        if (!window.confirm(`Delete user "${username}"? This removes all their data.`)) return
        try {
            await API.adminDeleteUser(id)
            setUsers(prev => prev.filter(u => u.id !== id))
            toast.success(`User "${username}" deleted`)
        } catch (err) { toast.error(err.message) }
    }

    const handleDeleteThread = async (id) => {
        if (!window.confirm('Delete this thread and all its replies?')) return
        try {
            await API.adminDeleteThread(id)
            toast.success('Thread deleted')
        } catch (err) { toast.error(err.message) }
    }

    if (!user?.is_admin) return null

    const statCards = stats ? [
        { label: 'Users', value: stats.users, icon: <FiUsers size={20} />, color: 'var(--accent)' },
        { label: 'Builds', value: stats.builds, icon: <FiBox size={20} />, color: '#8b5cf6' },
        { label: 'Forum Threads', value: stats.threads, icon: <FiMessageSquare size={20} />, color: '#f59e0b' },
        { label: 'Forum Replies', value: stats.replies, icon: <FiMessageSquare size={20} />, color: '#10b981' },
        { label: 'Components', value: stats.components, icon: <FiCpu size={20} />, color: '#ef4444' },
    ] : []

    return (
        <main className="page adm">
            <div className="container">
                <div className="adm-header">
                    <div className="adm-header__left">
                        <h1><FiShield size={22} /> Admin Panel</h1>
                        <p>Manage users, content, and monitor platform activity.</p>
                    </div>
                    <button className="btn" onClick={loadData} disabled={loading}>
                        <FiRefreshCw size={14} className={loading ? 'adm-spin' : ''} /> Refresh
                    </button>
                </div>

                <div className="adm-tabs">
                    <button className={`adm-tab${tab === 'overview' ? ' adm-tab--active' : ''}`} onClick={() => setTab('overview')}>Overview</button>
                    <button className={`adm-tab${tab === 'users' ? ' adm-tab--active' : ''}`} onClick={() => setTab('users')}>Users</button>
                    <button className={`adm-tab${tab === 'tickets' ? ' adm-tab--active' : ''}`} onClick={() => setTab('tickets')}>Tickets {tickets.length > 0 && `(${tickets.length})`}</button>
                </div>

                {loading ? (
                    <div className="adm-loading"><div className="spinner" /></div>
                ) : (
                    <>
                        {tab === 'overview' && (
                            <div className="adm-stats">
                                {statCards.map((s, i) => (
                                    <div key={i} className="adm-stat-card">
                                        <div className="adm-stat-card__icon" style={{ color: s.color }}>{s.icon}</div>
                                        <div className="adm-stat-card__value">{s.value?.toLocaleString() ?? '-'}</div>
                                        <div className="adm-stat-card__label">{s.label}</div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {tab === 'users' && (
                            <div className="adm-table-wrap">
                                <table className="adm-table">
                                    <thead>
                                        <tr>
                                            <th>Username</th>
                                            <th>Email</th>
                                            <th>Joined</th>
                                            <th>Admin</th>
                                            <th></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {users.map(u => (
                                            <tr key={u.id}>
                                                <td className="adm-user-cell">
                                                    <span className="adm-user-avatar">{u.username?.charAt(0).toUpperCase()}</span>
                                                    {u.username}
                                                </td>
                                                <td className="adm-muted">{u.email}</td>
                                                <td className="adm-muted">{new Date(u.created_at).toLocaleDateString()}</td>
                                                <td>{u.is_admin ? <span className="adm-badge">Admin</span> : '-'}</td>
                                                <td>
                                                    {u.id !== user.id && (
                                                        <button
                                                            className="adm-delete-btn"
                                                            onClick={() => handleDeleteUser(u.id, u.username)}
                                                            title="Delete user"
                                                        >
                                                            <FiTrash2 size={14} />
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {users.length === 0 && <p className="adm-empty">No users found.</p>}
                            </div>
                        )}

                        {tab === 'tickets' && (
                            <div className="adm-table-wrap">
                                <table className="adm-table">
                                    <thead>
                                        <tr>
                                            <th>Reference</th>
                                            <th>Subject</th>
                                            <th>From</th>
                                            <th>Category</th>
                                            <th>Created</th>
                                            <th>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {tickets.map(t => (
                                            <tr key={t.id}>
                                                <td className="adm-muted" style={{ fontFamily: 'var(--font-mono)', fontSize: '.75rem' }}>{t.reference}</td>
                                                <td title={t.message}>{t.subject}</td>
                                                <td className="adm-muted">{t.name || 'Guest'}<br /><span style={{ fontSize: '.72rem' }}>{t.email}</span></td>
                                                <td className="adm-muted">{t.category}</td>
                                                <td className="adm-muted">{new Date(t.created_at).toLocaleDateString()}</td>
                                                <td>
                                                    <select
                                                        className="adm-ticket-status"
                                                        value={t.status}
                                                        onChange={e => handleTicketStatus(t.id, e.target.value)}
                                                    >
                                                        <option value="open">Open</option>
                                                        <option value="in_progress">In progress</option>
                                                        <option value="closed">Closed</option>
                                                    </select>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {tickets.length === 0 && <p className="adm-empty">No tickets yet.</p>}
                            </div>
                        )}
                    </>
                )}
            </div>
        </main>
    )
}
