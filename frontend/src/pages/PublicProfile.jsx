import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { FiCalendar, FiUserPlus, FiUserCheck, FiSettings } from 'react-icons/fi'
import toast from 'react-hot-toast'
import { API } from '../services/api'
import { useAuth } from '../context/AuthContext'
import Avatar from '../components/Avatar'
import BuildCard from '../components/BuildCard'
import './PublicProfile.css'

export default function PublicProfile() {
    const { username } = useParams()
    const { user } = useAuth()
    const [data, setData] = useState(null)
    const [error, setError] = useState(null)
    const [tab, setTab] = useState('builds')
    const [following, setFollowing] = useState(false)
    const [followers, setFollowers] = useState(0)

    useEffect(() => {
        setData(null); setError(null); setTab('builds')
        API.getProfile(username).then(d => {
            setData(d); setFollowing(d.is_following); setFollowers(d.counts.followers)
        }).catch(e => setError(e.message))
    }, [username])

    const toggleFollow = async () => {
        if (!user) { toast.error('Sign in to follow'); return }
        try {
            const res = following ? await API.unfollowUser(username) : await API.followUser(username)
            setFollowing(res.following)
            setFollowers(c => c + (res.following ? 1 : -1))
        } catch (e) { toast.error(e.message) }
    }

    if (error) return <main className="page"><div className="container empty-state"><h3>User not found</h3><p>{error}</p><Link to="/builds" className="btn">Community builds</Link></div></main>
    if (!data) return <main className="page"><div className="container"><div className="skeleton" style={{ height: 180, borderRadius: 12 }} /></div></main>

    const { user: profile, counts, is_self, builds, favorites, favorites_visible } = data
    const list = tab === 'builds' ? builds : favorites

    return (
        <main className="page">
            <div className="container pp">
                <header className="pp-head">
                    <Avatar user={profile} size={84} />
                    <div className="pp-head__main">
                        <h1>{profile.username}</h1>
                        {profile.bio && <p className="pp-bio">{profile.bio}</p>}
                        <div className="pp-meta">
                            <span><FiCalendar size={13} /> Joined {new Date(profile.created_at).toLocaleDateString()}</span>
                            <span><b>{counts.public_builds}</b> builds</span>
                            <span><b>{followers}</b> followers</span>
                            <span><b>{counts.following}</b> following</span>
                        </div>
                    </div>
                    <div className="pp-head__action">
                        {is_self ? (
                            <Link to="/profile" className="btn"><FiSettings size={14} /> Edit profile</Link>
                        ) : (
                            <button className={`btn${following ? '' : ' btn-primary'}`} onClick={toggleFollow}>
                                {following ? <><FiUserCheck size={14} /> Following</> : <><FiUserPlus size={14} /> Follow</>}
                            </button>
                        )}
                    </div>
                </header>

                <div className="pp-tabs">
                    <button className={`pp-tab${tab === 'builds' ? ' active' : ''}`} onClick={() => setTab('builds')}>
                        Builds ({builds.length})
                    </button>
                    {favorites_visible && (
                        <button className={`pp-tab${tab === 'favorites' ? ' active' : ''}`} onClick={() => setTab('favorites')}>
                            Favourites ({favorites.length})
                        </button>
                    )}
                </div>

                {list.length === 0 ? (
                    <div className="empty-state">
                        <h3>{tab === 'builds' ? 'No public builds yet' : 'No favourites yet'}</h3>
                    </div>
                ) : (
                    <div className="pp-grid">
                        {list.map(b => <BuildCard key={b.id} build={b} />)}
                    </div>
                )}
            </div>
        </main>
    )
}
