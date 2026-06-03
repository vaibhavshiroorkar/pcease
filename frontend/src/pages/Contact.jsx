import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { FiSend, FiMail, FiMapPin, FiGithub, FiLifeBuoy, FiSearch, FiCheckCircle } from 'react-icons/fi'
import { API, timeAgo } from '../services/api'
import { useAuth } from '../context/AuthContext'
import './Contact.css'

const CATEGORIES = ['General', 'Bug', 'Feature', 'Account', 'Other']
const STATUS_LABEL = { open: 'Open', in_progress: 'In progress', closed: 'Closed' }

function StatusBadge({ status }) {
    return <span className={`ct-status ct-status--${status}`}>{STATUS_LABEL[status] || status}</span>
}

export default function Contact() {
    const { user } = useAuth()
    const [form, setForm] = useState({ subject: '', category: 'General', name: '', email: '', message: '' })
    const [created, setCreated] = useState(null)   // { reference, status }
    const [submitting, setSubmitting] = useState(false)

    const [myTickets, setMyTickets] = useState([])
    const [lookup, setLookup] = useState({ reference: '', email: '' })
    const [lookupResult, setLookupResult] = useState(null)
    const [lookupError, setLookupError] = useState('')

    useEffect(() => {
        if (user) {
            setForm(f => ({ ...f, name: f.name || user.username || '', email: user.email || f.email }))
            API.getMyTickets().then(setMyTickets).catch(() => {})
        }
    }, [user])

    const handleSubmit = async (e) => {
        e.preventDefault()
        setSubmitting(true)
        try {
            const res = await API.createTicket(form)
            setCreated(res)
            toast.success(`Ticket ${res.reference} created`)
            setForm(f => ({ ...f, subject: '', message: '', category: 'General' }))
            if (user) API.getMyTickets().then(setMyTickets).catch(() => {})
        } catch (err) {
            toast.error('Failed: ' + err.message)
        } finally {
            setSubmitting(false)
        }
    }

    const handleLookup = async (e) => {
        e.preventDefault()
        setLookupError(''); setLookupResult(null)
        try {
            setLookupResult(await API.lookupTicket(lookup.reference.trim(), lookup.email.trim()))
        } catch (err) {
            setLookupError(err.message || 'Not found')
        }
    }

    return (
        <main className="page ct">
            <div className="container">
                <div className="ct-header">
                    <h1>Support</h1>
                    <p>Found a bug or have a question? Open a ticket and track it here, no account required.</p>
                </div>

                <div className="ct-layout">
                    <div className="ct-info">
                        <div className="ct-info-card">
                            <FiMail size={20} />
                            <div><h4>Email</h4><p>support@pcease.in</p></div>
                        </div>
                        <div className="ct-info-card">
                            <FiMapPin size={20} />
                            <div><h4>Location</h4><p>India</p></div>
                        </div>
                        <div className="ct-info-card">
                            <FiGithub size={20} />
                            <div><h4>Open Source</h4><p>Contribute on GitHub</p></div>
                        </div>

                        {/* Guests: track an existing ticket by reference + email */}
                        {!user && (
                            <form className="ct-track" onSubmit={handleLookup}>
                                <h4><FiSearch size={13} /> Track a ticket</h4>
                                <input placeholder="Reference (PCE-XXXXXX)" value={lookup.reference}
                                    onChange={e => setLookup(l => ({ ...l, reference: e.target.value }))} required />
                                <input type="email" placeholder="Email used" value={lookup.email}
                                    onChange={e => setLookup(l => ({ ...l, email: e.target.value }))} required />
                                <button className="btn btn-sm" type="submit">Track</button>
                                {lookupError && <p className="ct-track__err">{lookupError}</p>}
                                {lookupResult && (
                                    <div className="ct-track__result">
                                        <StatusBadge status={lookupResult.status} />
                                        <span>{lookupResult.subject}</span>
                                    </div>
                                )}
                            </form>
                        )}
                    </div>

                    <div className="ct-form-card">
                        {created ? (
                            <div className="ct-success">
                                <FiCheckCircle size={32} />
                                <h3>Ticket created</h3>
                                <p>Your reference is <strong>{created.reference}</strong>. {user ? "It's listed below so you can track it." : 'Save it to track your ticket via email + reference.'}</p>
                                <button className="btn btn-primary" onClick={() => setCreated(null)}>Open another ticket</button>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="ct-form">
                                <div className="ct-field">
                                    <label><FiLifeBuoy size={13} /> Subject</label>
                                    <input type="text" value={form.subject} required placeholder="Short summary"
                                        onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} />
                                </div>
                                <div className="ct-row">
                                    <div className="ct-field">
                                        <label>Category</label>
                                        <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                                            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                    {!user && (
                                        <div className="ct-field">
                                            <label>Name</label>
                                            <input type="text" value={form.name} placeholder="Your name"
                                                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                                        </div>
                                    )}
                                </div>
                                {!user && (
                                    <div className="ct-field">
                                        <label><FiMail size={13} /> Email</label>
                                        <input type="email" value={form.email} required placeholder="you@example.com"
                                            onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                                    </div>
                                )}
                                {user && <p className="ct-asaccount">Filing as <strong>{user.username}</strong> ({user.email})</p>}
                                <div className="ct-field">
                                    <label><FiSend size={13} /> Message</label>
                                    <textarea value={form.message} required rows={5} placeholder="Describe your issue or question..."
                                        onChange={e => setForm(f => ({ ...f, message: e.target.value }))} />
                                </div>
                                <button type="submit" className="btn btn-primary ct-submit" disabled={submitting}>
                                    <FiSend size={14} /> {submitting ? 'Submitting...' : 'Open ticket'}
                                </button>
                            </form>
                        )}

                        {/* Logged-in users: their tickets + statuses */}
                        {user && myTickets.length > 0 && (
                            <div className="ct-mine">
                                <h3>Your tickets</h3>
                                <ul className="ct-ticket-list">
                                    {myTickets.map(t => (
                                        <li key={t.id} className="ct-ticket">
                                            <div className="ct-ticket__main">
                                                <span className="ct-ticket__ref">{t.reference}</span>
                                                <span className="ct-ticket__subj">{t.subject}</span>
                                            </div>
                                            <div className="ct-ticket__meta">
                                                <StatusBadge status={t.status} />
                                                <span className="ct-ticket__time">{timeAgo(t.created_at)}</span>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </main>
    )
}
