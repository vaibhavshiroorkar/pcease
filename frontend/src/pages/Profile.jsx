import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { API, formatPrice, imageToAvatarDataUrl } from '../services/api'
import toast from 'react-hot-toast'
import {
    FiUser, FiMail, FiLock, FiTrash2, FiSave, FiCalendar, FiShield,
    FiGlobe, FiLock as FiLockSmall, FiArrowRight, FiCamera, FiExternalLink, FiLayers,
} from 'react-icons/fi'
import Avatar from '../components/Avatar'
import BuildCard from '../components/BuildCard'
import './Profile.css'

export default function Profile() {
    const navigate = useNavigate()
    const { user, logout, refreshUser } = useAuth()
    const fileInput = useRef(null)
    const [tab, setTab] = useState('builds')
    const [profile, setProfile] = useState({ username: '', email: '', bio: '' })
    const [passwords, setPasswords] = useState({ current: '', newPw: '', confirm: '' })
    const [loading, setLoading] = useState(false)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [builds, setBuilds] = useState(null)
    const [favorites, setFavorites] = useState(null)

    useEffect(() => {
        if (!user) { navigate('/login'); return }
        setProfile({ username: user.username || '', email: user.email || '', bio: user.bio || '' })
    }, [user, navigate])

    useEffect(() => {
        if (!user) return
        API.getBuilds().then(setBuilds).catch(() => setBuilds([]))
        API.getMyFavorites().then(setFavorites).catch(() => setFavorites([]))
    }, [user])

    if (!user) return null

    const handleUpdateProfile = async (e) => {
        e.preventDefault()
        setLoading(true)
        try {
            await API.updateProfile({ username: profile.username, email: profile.email, bio: profile.bio })
            await refreshUser()
            toast.success('Profile updated!')
        } catch (err) { toast.error(err.message) } finally { setLoading(false) }
    }

    const handleAvatar = async (e) => {
        const file = e.target.files?.[0]
        if (!file) return
        if (file.size > 8 * 1024 * 1024) return toast.error('Image too large (max 8MB)')
        try {
            const dataUrl = await imageToAvatarDataUrl(file)
            await API.updateProfile({ avatar_url: dataUrl })
            await refreshUser()
            toast.success('Avatar updated!')
        } catch (err) { toast.error(err.message) }
    }

    const removeAvatar = async () => {
        try { await API.updateProfile({ avatar_url: '' }); await refreshUser(); toast.success('Avatar removed') }
        catch (err) { toast.error(err.message) }
    }

    const toggleFavoritesPublic = async () => {
        try {
            await API.updateProfile({ favorites_public: !user.favorites_public })
            await refreshUser()
        } catch (err) { toast.error(err.message) }
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
        } catch (err) { toast.error(err.message) } finally { setLoading(false) }
    }

    const handleDeleteAccount = async () => {
        setLoading(true)
        try { await API.deleteAccount(); logout(); toast.success('Account deleted'); navigate('/') }
        catch (err) { toast.error(err.message) } finally { setLoading(false) }
    }

    const toggleBuildVisibility = async (b) => {
        try {
            const updated = await API.updateBuild(b.id, { is_public: !b.is_public })
            setBuilds(list => list.map(x => x.id === b.id ? { ...x, is_public: updated.is_public } : x))
            toast.success(updated.is_public ? 'Build published' : 'Build made private')
        } catch (err) { toast.error(err.message) }
    }

    const deleteBuild = async (b) => {
        try { await API.deleteBuild(b.id); setBuilds(list => list.filter(x => x.id !== b.id)); toast.success('Build deleted') }
        catch (err) { toast.error(err.message) }
    }

    const openInBuilder = (b) => {
        const components = Object.entries(b.components || {}).map(([slot, id]) => ({ category: slot, component_id: id }))
        navigate('/builder', { state: { recommendation: { name: b.name, components } } })
    }

    const tabs = [
        { key: 'builds', label: 'My Builds' },
        { key: 'favorites', label: 'Favourites' },
        { key: 'details', label: 'Account' },
        { key: 'security', label: 'Security' },
        { key: 'danger', label: 'Danger Zone' },
    ]

    return (
        <main className="page pf">
            <div className="container">
                <div className="pf-layout">
                    <aside className="pf-sidebar">
                        <div className="pf-avatar-wrap">
                            <Avatar user={user} size={96} />
                            <button className="pf-avatar-edit" onClick={() => fileInput.current?.click()} title="Change avatar">
                                <FiCamera size={14} />
                            </button>
                            <input ref={fileInput} type="file" accept="image/*" hidden onChange={handleAvatar} />
                        </div>
                        <h2 className="pf-name">{user.username}</h2>
                        <p className="pf-email">{user.email}</p>
                        <div className="pf-meta">
                            <span><FiCalendar size={13} /> Joined {new Date(user.created_at).toLocaleDateString()}</span>
                            {user.is_admin && <span className="pf-badge"><FiShield size={12} /> Admin</span>}
                        </div>
                        <Link to={`/u/${user.username}`} className="pf-view-public">
                            View public profile <FiExternalLink size={12} />
                        </Link>
                        <nav className="pf-tabs-vert">
                            {tabs.map(t => (
                                <button key={t.key} className={`pf-tab-vert${tab === t.key ? ' pf-tab-vert--active' : ''}`} onClick={() => setTab(t.key)}>
                                    {t.label}
                                </button>
                            ))}
                        </nav>
                    </aside>

                    <section className="pf-content">
                        {tab === 'builds' && (
                            <div className="pf-section">
                                <h3 className="pf-section__title"><FiLayers size={16} /> My Builds</h3>
                                {builds === null ? <p className="text-muted">Loading...</p>
                                    : builds.length === 0 ? (
                                        <div className="empty-state">
                                            <h3>No saved builds yet</h3>
                                            <p>Create one in the Builder, then publish it to the community.</p>
                                            <Link to="/builder" className="btn btn-primary">Open Builder <FiArrowRight size={14} /></Link>
                                        </div>
                                    ) : (
                                        <div className="pf-builds">
                                            {builds.map(b => (
                                                <div key={b.id} className="pf-build">
                                                    <div className="pf-build__info">
                                                        <span className="pf-build__name">{b.name}</span>
                                                        <span className={`pf-build__vis pf-build__vis--${b.is_public ? 'pub' : 'priv'}`}>
                                                            {b.is_public ? <><FiGlobe size={11} /> Public</> : <><FiLockSmall size={11} /> Private</>}
                                                        </span>
                                                    </div>
                                                    <span className="pf-build__price">{formatPrice(b.total_price)}</span>
                                                    <div className="pf-build__actions">
                                                        <button className="btn btn-sm" onClick={() => toggleBuildVisibility(b)}>
                                                            {b.is_public ? 'Make private' : 'Publish'}
                                                        </button>
                                                        {b.slug && <Link className="btn btn-sm" to={`/build/${b.slug}`}>View</Link>}
                                                        <button className="btn btn-sm" onClick={() => openInBuilder(b)}>Open</button>
                                                        <button className="btn btn-sm btn-danger" onClick={() => deleteBuild(b)}><FiTrash2 size={13} /></button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                            </div>
                        )}

                        {tab === 'favorites' && (
                            <div className="pf-section">
                                <h3 className="pf-section__title"><FiUser size={16} /> Favourites</h3>
                                <label className="pf-toggle">
                                    <input type="checkbox" checked={!!user.favorites_public} onChange={toggleFavoritesPublic} />
                                    Show my favourites on my public profile
                                </label>
                                {favorites === null ? <p className="text-muted">Loading...</p>
                                    : favorites.length === 0 ? (
                                        <div className="empty-state">
                                            <h3>No favourites yet</h3>
                                            <p>Save builds you like from the <Link to="/builds">community feed</Link>.</p>
                                        </div>
                                    ) : (
                                        <div className="pf-fav-grid">
                                            {favorites.map(b => (
                                                <BuildCard key={b.id} build={b}
                                                    onFavoriteChange={(id, fav) => { if (!fav) setFavorites(list => list.filter(x => x.id !== id)) }} />
                                            ))}
                                        </div>
                                    )}
                            </div>
                        )}

                        {tab === 'details' && (
                            <div className="pf-section">
                                <h3 className="pf-section__title"><FiUser size={16} /> Edit Profile</h3>
                                <form onSubmit={handleUpdateProfile} className="pf-form">
                                    <div className="pf-field">
                                        <label>Username</label>
                                        <input type="text" value={profile.username} onChange={e => setProfile(p => ({ ...p, username: e.target.value }))} required minLength="3" />
                                    </div>
                                    <div className="pf-field">
                                        <label><FiMail size={13} /> Email</label>
                                        <input type="email" value={profile.email} onChange={e => setProfile(p => ({ ...p, email: e.target.value }))} required />
                                    </div>
                                    <div className="pf-field">
                                        <label>Bio <span className="pf-hint">{(profile.bio || '').length}/280</span></label>
                                        <textarea rows={3} maxLength={280} placeholder="Tell the community about your builds..."
                                            value={profile.bio} onChange={e => setProfile(p => ({ ...p, bio: e.target.value }))} />
                                    </div>
                                    <div className="pf-avatar-actions">
                                        <button type="button" className="btn btn-sm" onClick={() => fileInput.current?.click()}><FiCamera size={13} /> Change avatar</button>
                                        {user.avatar_url && <button type="button" className="btn btn-sm" onClick={removeAvatar}>Remove avatar</button>}
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
                                        <input type="password" value={passwords.current} onChange={e => setPasswords(p => ({ ...p, current: e.target.value }))} required autoComplete="current-password" />
                                    </div>
                                    <div className="pf-field">
                                        <label>New Password</label>
                                        <input type="password" value={passwords.newPw} onChange={e => setPasswords(p => ({ ...p, newPw: e.target.value }))} required minLength="6" autoComplete="new-password" />
                                    </div>
                                    <div className="pf-field">
                                        <label>Confirm New Password</label>
                                        <input type="password" value={passwords.confirm} onChange={e => setPasswords(p => ({ ...p, confirm: e.target.value }))} required minLength="6" autoComplete="new-password" />
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
                                    Deleting your account is permanent. All your builds, favourites, follows, and forum posts will be removed and cannot be recovered.
                                </p>
                                {!showDeleteConfirm ? (
                                    <button className="btn btn-danger" onClick={() => setShowDeleteConfirm(true)}><FiTrash2 size={14} /> Delete My Account</button>
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
