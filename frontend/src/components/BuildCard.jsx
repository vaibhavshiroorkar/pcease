import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FiHeart, FiBookmark } from 'react-icons/fi'
import toast from 'react-hot-toast'
import { API, formatPrice } from '../services/api'
import { useAuth } from '../context/AuthContext'
import Avatar from './Avatar'
import './BuildCard.css'

/** Community/profile build card with inline like + favourite. */
export default function BuildCard({ build, onFavoriteChange }) {
    const { user } = useAuth()
    const navigate = useNavigate()
    const [liked, setLiked] = useState(!!build.liked_by_me)
    const [likes, setLikes] = useState(build.likes_count || 0)
    const [faved, setFaved] = useState(!!build.favorited_by_me)
    const [busy, setBusy] = useState(false)

    const requireLogin = () => { toast.error('Sign in to do that'); navigate('/login') }

    const toggleLike = async (e) => {
        e.preventDefault(); e.stopPropagation()
        if (!user) return requireLogin()
        if (busy) return
        setBusy(true)
        try {
            const res = liked ? await API.unlikeBuild(build.id) : await API.likeBuild(build.id)
            setLiked(res.liked); setLikes(res.likes_count)
        } catch (err) { toast.error(err.message) } finally { setBusy(false) }
    }

    const toggleFav = async (e) => {
        e.preventDefault(); e.stopPropagation()
        if (!user) return requireLogin()
        try {
            const res = faved ? await API.unfavoriteBuild(build.id) : await API.favoriteBuild(build.id)
            setFaved(res.favorited)
            onFavoriteChange?.(build.id, res.favorited)
        } catch (err) { toast.error(err.message) }
    }

    return (
        <Link to={`/build/${build.slug}`} className="bc">
            <div className="bc__head">
                <h3 className="bc__name">{build.name}</h3>
                <span className="bc__total">{formatPrice(build.total_price)}</span>
            </div>
            <div className="bc__parts">
                {(build.parts || []).slice(0, 4).map(p => (
                    <span key={p.slot} className="bc__part"><i>{p.slot}</i>{p.name}</span>
                ))}
                {build.part_count > 4 && <span className="bc__more">+{build.part_count - 4} more</span>}
            </div>
            <div className="bc__foot">
                {build.owner ? (
                    <button
                        type="button"
                        className="bc__owner"
                        onClick={(e) => { e.preventDefault(); navigate(`/u/${build.owner.username}`) }}
                    >
                        <Avatar user={build.owner} size={22} /> {build.owner.username}
                    </button>
                ) : <span />}
                <div className="bc__actions">
                    <button className={`bc__btn${liked ? ' is-on' : ''}`} onClick={toggleLike} title="Like" aria-label="Like">
                        <FiHeart size={14} /> {likes}
                    </button>
                    <button className={`bc__btn${faved ? ' is-on bc__btn--fav' : ''}`} onClick={toggleFav} title="Favourite" aria-label="Favourite">
                        <FiBookmark size={14} />
                    </button>
                </div>
            </div>
        </Link>
    )
}
