import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { FiHeart, FiBookmark, FiArrowRight, FiGlobe, FiLock, FiArrowLeft } from 'react-icons/fi'
import toast from 'react-hot-toast'
import { API, formatPrice } from '../services/api'
import { useAuth } from '../context/AuthContext'
import Avatar from '../components/Avatar'
import './BuildDetail.css'

export default function BuildDetail() {
    const { slug } = useParams()
    const navigate = useNavigate()
    const { user } = useAuth()
    const [build, setBuild] = useState(null)
    const [error, setError] = useState(null)
    const [liked, setLiked] = useState(false)
    const [likes, setLikes] = useState(0)
    const [faved, setFaved] = useState(false)

    useEffect(() => {
        setError(null)
        API.getBuildBySlug(slug).then(b => {
            setBuild(b); setLiked(!!b.liked_by_me); setLikes(b.likes_count || 0); setFaved(!!b.favorited_by_me)
        }).catch(e => setError(e.message))
    }, [slug])

    const isOwner = user && build && build.user_id === user.id
    const requireLogin = () => { toast.error('Sign in to do that'); navigate('/login') }

    const toggleLike = async () => {
        if (!user) return requireLogin()
        try {
            const res = liked ? await API.unlikeBuild(build.id) : await API.likeBuild(build.id)
            setLiked(res.liked); setLikes(res.likes_count)
        } catch (e) { toast.error(e.message) }
    }
    const toggleFav = async () => {
        if (!user) return requireLogin()
        try {
            const res = faved ? await API.unfavoriteBuild(build.id) : await API.favoriteBuild(build.id)
            setFaved(res.favorited)
        } catch (e) { toast.error(e.message) }
    }
    const toggleVisibility = async () => {
        try {
            const updated = await API.updateBuild(build.id, { is_public: !build.is_public })
            setBuild(b => ({ ...b, is_public: updated.is_public }))
            toast.success(updated.is_public ? 'Build is now public' : 'Build is now private')
        } catch (e) { toast.error(e.message) }
    }
    const openInBuilder = () => {
        const components = Object.entries(build.components || {}).map(([slot, id]) => ({ category: slot, component_id: id }))
        navigate('/builder', { state: { recommendation: { name: build.name, components } } })
    }

    if (error) return (
        <main className="page"><div className="container empty-state"><h3>Build unavailable</h3><p>{error}</p>
            <Link to="/builds" className="btn">Back to community</Link></div></main>
    )
    if (!build) return <main className="page"><div className="container"><div className="skeleton" style={{ height: 320, borderRadius: 12 }} /></div></main>

    return (
        <main className="page">
            <div className="container bd-detail">
                <button className="bd-detail__back" onClick={() => navigate(-1)}><FiArrowLeft size={14} /> Back</button>

                <div className="bd-detail__top">
                    <div>
                        <div className="bd-detail__title-row">
                            <h1>{build.name}</h1>
                            {isOwner && (
                                <span className={`bd-detail__vis bd-detail__vis--${build.is_public ? 'pub' : 'priv'}`}>
                                    {build.is_public ? <><FiGlobe size={12} /> Public</> : <><FiLock size={12} /> Private</>}
                                </span>
                            )}
                        </div>
                        {build.owner && (
                            <Link to={`/u/${build.owner.username}`} className="bd-detail__owner">
                                <Avatar user={build.owner} size={26} /> {build.owner.username}
                            </Link>
                        )}
                    </div>
                    <div className="bd-detail__price">{formatPrice(build.total_price)}</div>
                </div>

                <div className="bd-detail__actions">
                    <button className={`btn${liked ? ' btn-liked' : ''}`} onClick={toggleLike}>
                        <FiHeart size={14} /> {likes} {likes === 1 ? 'like' : 'likes'}
                    </button>
                    <button className={`btn${faved ? ' btn-secondary' : ''}`} onClick={toggleFav}>
                        <FiBookmark size={14} /> {faved ? 'Saved' : 'Save'}
                    </button>
                    <button className="btn btn-primary" onClick={openInBuilder}>Open in Builder <FiArrowRight size={14} /></button>
                    {isOwner && (
                        <button className="btn" onClick={toggleVisibility}>
                            {build.is_public ? <><FiLock size={14} /> Make private</> : <><FiGlobe size={14} /> Make public</>}
                        </button>
                    )}
                </div>

                <div className="bd-detail__parts">
                    <div className="bd-detail__parts-head"><span>{build.part_count} components</span><span>Lowest price</span></div>
                    {(build.parts || []).map(p => (
                        <div key={p.slot} className="bd-detail__part">
                            <span className="bd-detail__slot">{p.slot}</span>
                            <span className="bd-detail__pname">{p.name}</span>
                            <span className="bd-detail__pprice">{p.price ? formatPrice(p.price) : '-'}</span>
                        </div>
                    ))}
                    <div className="bd-detail__total">
                        <span>Total</span>
                        <span>{formatPrice(build.total_price)}</span>
                    </div>
                </div>
            </div>
        </main>
    )
}
