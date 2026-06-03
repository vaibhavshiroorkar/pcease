import { useState, useEffect, useMemo } from 'react'
import { API, timeAgo } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { Link } from 'react-router-dom'
import { FiPlus, FiSearch, FiChevronUp, FiChevronDown, FiX, FiMessageCircle, FiUser, FiClock, FiBookOpen, FiArrowRight, FiCornerDownRight } from 'react-icons/fi'
import toast from 'react-hot-toast'
import '../pages/Forum.css'

const categories = ['All', 'Build Help', 'Troubleshooting', 'Discussion', 'Showcase', 'Deals']

/**
 * Community discussions (the former Forum), rendered inside the Community page's
 * Discussions tab. No outer page/container wrapper - the host provides it.
 */
export default function Discussions() {
    const { user } = useAuth()
    const [threads, setThreads] = useState([])
    const [loading, setLoading] = useState(true)
    const [category, setCategory] = useState('All')
    const [search, setSearch] = useState('')
    const [activeThread, setActiveThread] = useState(null)
    const [showNewThread, setShowNewThread] = useState(false)
    const [newThread, setNewThread] = useState({ title: '', content: '', category: 'Discussion' })
    const [newReply, setNewReply] = useState('')
    const [replyingTo, setReplyingTo] = useState(null)   // reply id being replied to (null = top-level)
    const [collapsed, setCollapsed] = useState(() => new Set())

    useEffect(() => { loadThreads() }, [category])

    const loadThreads = async () => {
        setLoading(true)
        try { setThreads(await API.getThreads({ category: category === 'All' ? '' : category })) }
        catch { setThreads([]) }
        finally { setLoading(false) }
    }

    const openThread = async (id) => {
        try { setActiveThread(await API.getThread(id)); setReplyingTo(null); setNewReply('') }
        catch { toast.error('Failed to load thread') }
    }

    const handleCreateThread = async (e) => {
        e.preventDefault()
        if (!user) return toast.error('Please login')
        try { await API.createThread(newThread); setNewThread({ title: '', content: '', category: 'Discussion' }); setShowNewThread(false); loadThreads(); toast.success('Thread created!') }
        catch (err) { toast.error('Failed: ' + err.message) }
    }

    const handleReply = async (e, parentId = null) => {
        e.preventDefault()
        if (!user) return toast.error('Please login')
        if (!newReply.trim()) return
        try {
            await API.createReply(activeThread.id, newReply, parentId)
            setNewReply(''); setReplyingTo(null)
            openThread(activeThread.id)
            toast.success('Reply posted!')
        } catch (err) { toast.error('Failed: ' + err.message) }
    }

    const toggleCollapse = (id) => setCollapsed(prev => {
        const next = new Set(prev)
        next.has(id) ? next.delete(id) : next.add(id)
        return next
    })

    // Group replies by parent so we can render a Reddit-style nested tree.
    const repliesByParent = useMemo(() => {
        const map = {}
        for (const r of activeThread?.replies || []) {
            const p = r.parent_reply_id || 0
            ;(map[p] ||= []).push(r)
        }
        return map
    }, [activeThread])

    const handleVoteThread = async (id, type) => {
        if (!user) return toast.error('Please login')
        try { await API.voteThread(id, type); if (activeThread?.id === id) openThread(id); loadThreads() }
        catch (err) { toast.error(err.message) }
    }

    const handleVoteReply = async (id, type) => {
        if (!user) return toast.error('Please login')
        try { await API.voteReply(id, type); if (activeThread) openThread(activeThread.id) }
        catch (err) { toast.error(err.message) }
    }

    const filtered = threads.filter(t => !search || t.title?.toLowerCase().includes(search.toLowerCase()))
    const getAuthor = (t) => t.author_username || t.author?.username || 'Unknown'

    // Recursive Reddit-style reply tree (indented, collapsible, reply-to-comment).
    const renderReplies = (parentId = 0, depth = 0) => (repliesByParent[parentId] || []).map(r => {
        const kids = repliesByParent[r.id] || []
        const isCollapsed = collapsed.has(r.id)
        const author = r.author_username || r.author?.username || 'Unknown'
        return (
            <div key={r.id} className={`fm-reply${depth ? ' fm-reply--nested' : ''}`}>
                <div className="fm-votes fm-votes--sm">
                    <button className="fm-vote" onClick={() => handleVoteReply(r.id, 'upvote')}><FiChevronUp size={14} /></button>
                    <span className="fm-vote__count">{(r.upvotes || 0) - (r.downvotes || 0)}</span>
                    <button className="fm-vote" onClick={() => handleVoteReply(r.id, 'downvote')}><FiChevronDown size={14} /></button>
                </div>
                <div className="fm-reply__content">
                    <div className="fm-reply__meta">
                        <Link to={`/u/${author}`} className="fm-author"><strong>{author}</strong></Link>
                        <span>{timeAgo(r.created_at)}</span>
                    </div>
                    <p>{r.content}</p>
                    <div className="fm-reply__actions">
                        {user && (
                            <button className="fm-reply__act" onClick={() => { setReplyingTo(replyingTo === r.id ? null : r.id); setNewReply('') }}>
                                <FiCornerDownRight size={12} /> Reply
                            </button>
                        )}
                        {kids.length > 0 && (
                            <button className="fm-reply__act" onClick={() => toggleCollapse(r.id)}>
                                {isCollapsed ? `Show ${kids.length} repl${kids.length > 1 ? 'ies' : 'y'}` : 'Hide replies'}
                            </button>
                        )}
                    </div>
                    {replyingTo === r.id && (
                        <form className="fm-reply-form fm-reply-form--inline" onSubmit={(e) => handleReply(e, r.id)}>
                            <textarea rows="2" value={newReply} onChange={e => setNewReply(e.target.value)} required placeholder={`Reply to ${author}...`} autoFocus />
                            <div className="fm-reply-form__actions">
                                <button type="button" className="btn btn-sm" onClick={() => { setReplyingTo(null); setNewReply('') }}>Cancel</button>
                                <button type="submit" className="btn btn-sm btn-primary">Reply</button>
                            </div>
                        </form>
                    )}
                    {!isCollapsed && kids.length > 0 && renderReplies(r.id, depth + 1)}
                </div>
            </div>
        )
    })

    return (
        <>
            <div className="fm-toolbar">
                <div className="fm-search"><FiSearch className="fm-search__icon" /><input type="text" placeholder="Search threads..." value={search} onChange={e => setSearch(e.target.value)} /></div>
                <div className="fm-toolbar__right">
                    <div className="fm-chips">{categories.map(cat => <button key={cat} className={`chip ${category === cat ? 'active' : ''}`} onClick={() => setCategory(cat)}>{cat}</button>)}</div>
                    {user ? <button className="btn btn-primary fm-new-btn" onClick={() => setShowNewThread(true)}><FiPlus size={14} /> New Thread</button>
                        : <Link to="/login" className="btn btn-primary fm-new-btn">Login to Post</Link>}
                </div>
            </div>

            <Link to="/guide" className="fm-pinned">
                <div className="fm-pinned__icon"><FiBookOpen size={20} /></div>
                <div className="fm-pinned__body">
                    <span className="fm-pinned__tag">Pinned · Guide</span>
                    <h3>How to Build a PC - The Complete Beginner's Guide</h3>
                    <p>Everything you need to know to plan, buy, and assemble your first PC build in India.</p>
                </div>
                <FiArrowRight size={16} className="fm-pinned__arrow" />
            </Link>

            <span className="fm-count">{threads.length} threads</span>

            <section className="fm-list">
                {loading ? <p className="text-muted">Loading...</p>
                    : filtered.length === 0 ? <div className="fm-empty"><FiMessageCircle size={32} /><h3>No threads found</h3><p>{search ? 'Try a different term.' : 'Start a discussion!'}</p></div>
                    : filtered.map(thread => (
                        <article key={thread.id} className="fm-thread">
                            <div className="fm-votes">
                                <button className="fm-vote" onClick={() => handleVoteThread(thread.id, 'upvote')}><FiChevronUp size={16} /></button>
                                <span className="fm-vote__count">{(thread.upvotes || 0) - (thread.downvotes || 0)}</span>
                                <button className="fm-vote" onClick={() => handleVoteThread(thread.id, 'downvote')}><FiChevronDown size={16} /></button>
                            </div>
                            <div className="fm-thread__main" onClick={() => openThread(thread.id)}>
                                <div className="fm-thread__top">
                                    <span className="fm-thread__cat">{thread.category}</span>
                                    <h3>{thread.title}</h3>
                                </div>
                                <div className="fm-thread__meta">
                                    <span><FiUser size={12} /> {getAuthor(thread)}</span>
                                    <span><FiMessageCircle size={12} /> {thread.reply_count || 0}</span>
                                    <span><FiClock size={12} /> {timeAgo(thread.created_at)}</span>
                                </div>
                            </div>
                        </article>
                    ))}
            </section>

            {showNewThread && (
                <div className="modal-overlay" onClick={() => setShowNewThread(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header"><h2>New Thread</h2><button className="modal-close" onClick={() => setShowNewThread(false)}><FiX /></button></div>
                        <form className="modal-body" onSubmit={handleCreateThread}>
                            <div className="form-group"><label>Title</label><input type="text" value={newThread.title} onChange={e => setNewThread(p => ({ ...p, title: e.target.value }))} required placeholder="Your question or topic" /></div>
                            <div className="form-group"><label>Category</label><select value={newThread.category} onChange={e => setNewThread(p => ({ ...p, category: e.target.value }))}>{categories.slice(1).map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                            <div className="form-group"><label>Content</label><textarea rows="5" value={newThread.content} onChange={e => setNewThread(p => ({ ...p, content: e.target.value }))} required placeholder="Details, specs, context..." /></div>
                            <button type="submit" className="btn btn-primary">Post Thread</button>
                        </form>
                    </div>
                </div>
            )}

            {activeThread && (
                <div className="modal-overlay" onClick={() => setActiveThread(null)}>
                    <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
                        <div className="modal-header"><h2>{activeThread.title}</h2><button className="modal-close" onClick={() => setActiveThread(null)}><FiX /></button></div>
                        <div className="modal-body">
                            <div className="fm-detail">
                                <div className="fm-detail__meta">
                                    <span className="fm-thread__cat">{activeThread.category}</span>
                                    <Link to={`/u/${getAuthor(activeThread)}`} className="fm-author"><FiUser size={12} /> {getAuthor(activeThread)}</Link>
                                    <span><FiClock size={12} /> {timeAgo(activeThread.created_at)}</span>
                                </div>
                                <div className="fm-detail__votes">
                                    <button className="fm-vote" onClick={() => handleVoteThread(activeThread.id, 'upvote')}><FiChevronUp size={16} /></button>
                                    <span className="fm-vote__count">{(activeThread.upvotes || 0) - (activeThread.downvotes || 0)}</span>
                                    <button className="fm-vote" onClick={() => handleVoteThread(activeThread.id, 'downvote')}><FiChevronDown size={16} /></button>
                                </div>
                                <p className="fm-detail__body">{activeThread.content}</p>
                            </div>
                            <div className="fm-replies">
                                <h4><FiMessageCircle size={14} /> {activeThread.replies?.length || 0} Replies</h4>
                                {renderReplies(0, 0)}
                                {(!activeThread.replies || activeThread.replies.length === 0) && (
                                    <p className="text-muted" style={{ fontSize: '.85rem' }}>No replies yet. Start the conversation.</p>
                                )}
                            </div>
                            {user ? (
                                replyingTo === null && (
                                    <form className="fm-reply-form" onSubmit={(e) => handleReply(e, null)}>
                                        <textarea rows="3" value={newReply} onChange={e => setNewReply(e.target.value)} required placeholder="Write a reply..." />
                                        <button type="submit" className="btn btn-primary">Post Reply</button>
                                    </form>
                                )
                            ) : <div className="fm-login-prompt"><Link to="/login" className="btn btn-primary">Login to Reply</Link></div>}
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
