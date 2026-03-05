import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { API } from '../services/api'
import toast from 'react-hot-toast'
import { FiMail, FiUser, FiLock, FiEye, FiEyeOff, FiArrowRight, FiDollarSign, FiCpu, FiLink, FiMessageCircle } from 'react-icons/fi'
import './Auth.css'

export default function Auth({ isRegister = false }) {
    const navigate = useNavigate()
    const { login, register } = useAuth()
    const [mode, setMode] = useState(isRegister ? 'register' : 'login')
    const [form, setForm] = useState({ email: '', username: '', password: '', newPassword: '' })
    const [loading, setLoading] = useState(false)
    const [showPassword, setShowPassword] = useState(false)

    const handleSubmit = async (e) => {
        e.preventDefault()
        setLoading(true)
        try {
            if (mode === 'register') {
                await register(form.email, form.username, form.password)
                setMode('login')
                toast.success('Account created! Please sign in.')
            } else if (mode === 'forgot') {
                await API.resetPassword(form.username, form.email, form.newPassword)
                setMode('login')
                toast.success('Password reset! Please sign in with your new password.')
            } else {
                await login(form.username, form.password)
                toast.success('Welcome back!')
                navigate('/')
            }
        } catch (err) {
            toast.error(err.message)
        } finally {
            setLoading(false)
        }
    }

    const updateForm = (key, value) => setForm(prev => ({ ...prev, [key]: value }))

    const switchMode = (m) => {
        setMode(m)
        setForm({ email: '', username: '', password: '', newPassword: '' })
        setShowPassword(false)
    }

    const features = [
        { icon: <FiDollarSign />, title: 'Price Comparison', desc: 'Compare across 7+ Indian retailers' },
        { icon: <FiCpu />, title: 'AI Build Advisor', desc: 'Get smart recommendations' },
        { icon: <FiLink />, title: 'Shareable Builds', desc: 'Share builds with a single link' },
        { icon: <FiMessageCircle />, title: 'Community Forum', desc: 'Get help from fellow builders' },
    ]

    const titles = {
        login: { h: 'Welcome Back', p: 'Sign in to your PCease account' },
        register: { h: 'Create Account', p: 'Join PCease and start building' },
        forgot: { h: 'Reset Password', p: 'Verify your identity to reset password' },
    }

    return (
        <main className="page au">
            <div className="au-container">
                <div className="au-brand">
                    <h2 className="au-logo">PCease<span>.</span></h2>
                    <p className="au-tagline">Build your dream PC with confidence</p>
                    <div className="au-features">
                        {features.map((f, i) => (
                            <div key={i} className="au-feature">
                                <span className="au-feature__icon">{f.icon}</span>
                                <div>
                                    <strong>{f.title}</strong>
                                    <p>{f.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="au-card">
                    <div className="au-tabs">
                        <button className={`au-tab ${mode === 'login' ? 'au-tab--active' : ''}`} onClick={() => switchMode('login')}>Sign In</button>
                        <button className={`au-tab ${mode === 'register' ? 'au-tab--active' : ''}`} onClick={() => switchMode('register')}>Sign Up</button>
                    </div>

                    <div className="au-header">
                        <h1>{titles[mode].h}</h1>
                        <p>{titles[mode].p}</p>
                    </div>

                    <form onSubmit={handleSubmit} className="au-form">
                        {/* Login: username only */}
                        {mode === 'login' && (
                            <div className="au-field">
                                <label className="au-label"><FiUser size={14} /> Username</label>
                                <input
                                    type="text"
                                    value={form.username}
                                    onChange={e => updateForm('username', e.target.value)}
                                    required
                                    placeholder="Your username"
                                    autoComplete="username"
                                />
                            </div>
                        )}

                        {/* Register: email + username */}
                        {mode === 'register' && (
                            <>
                                <div className="au-field">
                                    <label className="au-label"><FiMail size={14} /> Email</label>
                                    <input
                                        type="email"
                                        value={form.email}
                                        onChange={e => updateForm('email', e.target.value)}
                                        required
                                        placeholder="you@example.com"
                                        autoComplete="email"
                                    />
                                </div>
                                <div className="au-field">
                                    <label className="au-label"><FiUser size={14} /> Username</label>
                                    <input
                                        type="text"
                                        value={form.username}
                                        onChange={e => updateForm('username', e.target.value)}
                                        required
                                        placeholder="Choose a username"
                                        minLength="3"
                                        autoComplete="username"
                                    />
                                </div>
                            </>
                        )}

                        {/* Forgot: username + email + new password */}
                        {mode === 'forgot' && (
                            <>
                                <div className="au-field">
                                    <label className="au-label"><FiUser size={14} /> Username</label>
                                    <input
                                        type="text"
                                        value={form.username}
                                        onChange={e => updateForm('username', e.target.value)}
                                        required
                                        placeholder="Your username"
                                        autoComplete="username"
                                    />
                                </div>
                                <div className="au-field">
                                    <label className="au-label"><FiMail size={14} /> Email</label>
                                    <input
                                        type="email"
                                        value={form.email}
                                        onChange={e => updateForm('email', e.target.value)}
                                        required
                                        placeholder="Email linked to your account"
                                        autoComplete="email"
                                    />
                                </div>
                            </>
                        )}

                        {/* Password field for login & register */}
                        {mode !== 'forgot' && (
                            <div className="au-field">
                                <label className="au-label"><FiLock size={14} /> Password</label>
                                <div className="au-pw">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={form.password}
                                        onChange={e => updateForm('password', e.target.value)}
                                        required
                                        placeholder="••••••••"
                                        minLength="6"
                                        autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                                    />
                                    <button type="button" className="au-pw__toggle" onClick={() => setShowPassword(!showPassword)}>
                                        {showPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* New password for forgot mode */}
                        {mode === 'forgot' && (
                            <div className="au-field">
                                <label className="au-label"><FiLock size={14} /> New Password</label>
                                <div className="au-pw">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={form.newPassword}
                                        onChange={e => updateForm('newPassword', e.target.value)}
                                        required
                                        placeholder="Choose a new password"
                                        minLength="6"
                                        autoComplete="new-password"
                                    />
                                    <button type="button" className="au-pw__toggle" onClick={() => setShowPassword(!showPassword)}>
                                        {showPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                                    </button>
                                </div>
                            </div>
                        )}

                        <button type="submit" className="btn btn-primary au-submit" disabled={loading}>
                            {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : mode === 'register' ? 'Create Account' : 'Reset Password'}
                            {!loading && <FiArrowRight size={16} />}
                        </button>
                    </form>

                    {mode === 'login' && (
                        <button className="au-forgot-link" onClick={() => switchMode('forgot')}>
                            Forgot password?
                        </button>
                    )}
                    {mode === 'forgot' && (
                        <button className="au-forgot-link" onClick={() => switchMode('login')}>
                            Back to Sign In
                        </button>
                    )}

                    <p className="au-footer">
                        By signing up, you agree to our Terms of Service.
                    </p>
                </div>
            </div>
        </main>
    )
}
