import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { API } from '../services/api'
import toast from 'react-hot-toast'
import { FiUser, FiMail, FiLock, FiTrash2, FiSave, FiCalendar, FiShield } from 'react-icons/fi'
import './Profile.css'

export default function Profile() {
    const navigate = useNavigate()
    const { user, logout, refreshUser } = useAuth()
    const [tab, setTab] = useState('details')
    const [profile, setProfile] = useState({ username: user?.username || '', email: user?.email || '' })
    const [passwords, setPasswords] = useState({ current: '', newPw: '', confirm: '' })
    const [loading, setLoading] = useState(false)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

    if (!user) {
        navigate('/login')
        return null
    }

    const handleUpdateProfile = async (e) => {
        e.preventDefault()
        setLoading(true)
        try {
            await API.updateProfile(profile)
            await refreshUser()
            toast.success('Profile updated!')
        } catch (err) { toast.error(err.message) }
        finally { setLoading(false) }
    }

    const handleChangePassword = async (e) => {
        e.preventDefault()
        if (passwords.newPw !== passwords.confirm) return toast.error('Passwords do not match')
        if (passwords.newPw.length < 6) return toast.error('Password must be at least 6 characters')
        setLoading(true)
        try {
            await API.changePassword(passwords.current, passwords.newPw)
            setPasswords({ current: '', newPw: '', confirm: '' })
            toast.success('Password changed!')
        } catch (err) { toast.error(err.message) }
        finally { setLoading(false) }
    }

    const handleDeleteAccount = async () => {
        setLoading(true)
        try {
            await API.deleteAccount()
            logout()
            toast.success('Account deleted')
            navigate('/')
        } catch (err) { toast.error(err.message) }
        finally { setLoading(false) }
    }

    const tabs = [
        { key: 'details', label: 'Account Details' },
        { key: 'security', label: 'Security' },
        { key: 'danger', label: 'Danger Zone' },
    ]

    return (
        <main className="page pf">
            <div className="container">
                <div className="pf-layout">
                    {/* Sidebar */}
                    <aside className="pf-sidebar">
                        <div className="pf-avatar-large">
                            {user.username?.charAt(0).toUpperCase()}
                        </div>
                        <h2 className="pf-name">{user.username}</h2>
                        <p className="pf-email">{user.email}</p>
                        <div className="pf-meta">
                            <span><FiCalendar size={13} /> Joined {new Date(user.created_at).toLocaleDateString()}</span>
                            {user.is_admin && <span className="pf-badge"><FiShield size={12} /> Admin</span>}
                        </div>
                        <nav className="pf-tabs-vert">
                            {tabs.map(t => (
                                <button
                                    key={t.key}
                                    className={`pf-tab-vert${tab === t.key ? ' pf-tab-vert--active' : ''}`}
                                    onClick={() => setTab(t.key)}
                                >
                                    {t.label}
                                </button>
                            ))}
                        </nav>
                    </aside>

                    {/* Content */}
                    <section className="pf-content">
                        {tab === 'details' && (
                            <div className="pf-section">
                                <h3 className="pf-section__title"><FiUser size={16} /> Edit Profile</h3>
                                <form onSubmit={handleUpdateProfile} className="pf-form">
                                    <div className="pf-field">
                                        <label>Username</label>
                                        <input
                                            type="text"
                                            value={profile.username}
                                            onChange={e => setProfile(p => ({ ...p, username: e.target.value }))}
                                            required
                                            minLength="3"
                                        />
                                    </div>
                                    <div className="pf-field">
                                        <label><FiMail size={13} /> Email</label>
                                        <input
                                            type="email"
                                            value={profile.email}
                                            onChange={e => setProfile(p => ({ ...p, email: e.target.value }))}
                                            required
                                        />
                                    </div>
                                    <button type="submit" className="btn btn-primary" disabled={loading}>
                                        <FiSave size={14} /> {loading ? 'Saving...' : 'Save Changes'}
                                    </button>
                                </form>
                            </div>
                        )}

                        {tab === 'security' && (
                            <div className="pf-section">
                                <h3 className="pf-section__title"><FiLock size={16} /> Change Password</h3>
                                <form onSubmit={handleChangePassword} className="pf-form">
                                    <div className="pf-field">
                                        <label>Current Password</label>
                                        <input
                                            type="password"
                                            value={passwords.current}
                                            onChange={e => setPasswords(p => ({ ...p, current: e.target.value }))}
                                            required
                                            autoComplete="current-password"
                                        />
                                    </div>
                                    <div className="pf-field">
                                        <label>New Password</label>
                                        <input
                                            type="password"
                                            value={passwords.newPw}
                                            onChange={e => setPasswords(p => ({ ...p, newPw: e.target.value }))}
                                            required
                                            minLength="6"
                                            autoComplete="new-password"
                                        />
                                    </div>
                                    <div className="pf-field">
                                        <label>Confirm New Password</label>
                                        <input
                                            type="password"
                                            value={passwords.confirm}
                                            onChange={e => setPasswords(p => ({ ...p, confirm: e.target.value }))}
                                            required
                                            minLength="6"
                                            autoComplete="new-password"
                                        />
                                    </div>
                                    <button type="submit" className="btn btn-primary" disabled={loading}>
                                        <FiLock size={14} /> {loading ? 'Changing...' : 'Change Password'}
                                    </button>
                                </form>
                            </div>
                        )}

                        {tab === 'danger' && (
                            <div className="pf-section">
                                <h3 className="pf-section__title pf-section__title--danger"><FiTrash2 size={16} /> Danger Zone</h3>
                                <p className="pf-danger-text">
                                    Deleting your account is permanent. All your builds, forum posts, and data will be removed and cannot be recovered.
                                </p>
                                {!showDeleteConfirm ? (
                                    <button className="btn btn-danger" onClick={() => setShowDeleteConfirm(true)}>
                                        <FiTrash2 size={14} /> Delete My Account
                                    </button>
                                ) : (
                                    <div className="pf-confirm-delete">
                                        <p>Are you sure? This action cannot be undone.</p>
                                        <div className="pf-confirm-actions">
                                            <button className="btn" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
                                            <button className="btn btn-danger" onClick={handleDeleteAccount} disabled={loading}>
                                                {loading ? 'Deleting...' : 'Yes, Delete Forever'}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </section>
                </div>
            </div>
        </main>
    )
}
