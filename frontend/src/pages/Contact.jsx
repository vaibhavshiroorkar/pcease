import { useState } from 'react'
import toast from 'react-hot-toast'
import { FiSend, FiMail, FiUser, FiMessageSquare, FiMapPin, FiGithub } from 'react-icons/fi'
import './Contact.css'

export default function Contact() {
    const [form, setForm] = useState({ name: '', email: '', message: '' })
    const [sent, setSent] = useState(false)

    const handleSubmit = (e) => {
        e.preventDefault()
        setSent(true)
        toast.success('Message sent! We\'ll get back to you soon.')
        setForm({ name: '', email: '', message: '' })
    }

    return (
        <main className="page ct">
            <div className="container">
                <div className="ct-header">
                    <h1>Get in Touch</h1>
                    <p>Have a question, suggestion, or found a bug? We'd love to hear from you.</p>
                </div>

                <div className="ct-layout">
                    <div className="ct-info">
                        <div className="ct-info-card">
                            <FiMail size={20} />
                            <div>
                                <h4>Email</h4>
                                <p>support@pcease.in</p>
                            </div>
                        </div>
                        <div className="ct-info-card">
                            <FiMapPin size={20} />
                            <div>
                                <h4>Location</h4>
                                <p>India</p>
                            </div>
                        </div>
                        <div className="ct-info-card">
                            <FiGithub size={20} />
                            <div>
                                <h4>Open Source</h4>
                                <p>Contribute on GitHub</p>
                            </div>
                        </div>
                    </div>

                    <div className="ct-form-card">
                        {sent ? (
                            <div className="ct-success">
                                <FiSend size={32} />
                                <h3>Thank you!</h3>
                                <p>Your message has been received. We'll respond as soon as possible.</p>
                                <button className="btn btn-primary" onClick={() => setSent(false)}>
                                    Send Another Message
                                </button>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="ct-form">
                                <div className="ct-field">
                                    <label><FiUser size={13} /> Name</label>
                                    <input
                                        type="text"
                                        value={form.name}
                                        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                        required
                                        placeholder="Your name"
                                    />
                                </div>
                                <div className="ct-field">
                                    <label><FiMail size={13} /> Email</label>
                                    <input
                                        type="email"
                                        value={form.email}
                                        onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                                        required
                                        placeholder="you@example.com"
                                    />
                                </div>
                                <div className="ct-field">
                                    <label><FiMessageSquare size={13} /> Message</label>
                                    <textarea
                                        value={form.message}
                                        onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                                        required
                                        placeholder="What's on your mind?"
                                        rows={5}
                                    />
                                </div>
                                <button type="submit" className="btn btn-primary ct-submit">
                                    <FiSend size={14} /> Send Message
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            </div>
        </main>
    )
}
