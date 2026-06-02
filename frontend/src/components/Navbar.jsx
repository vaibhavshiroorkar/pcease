import { useState, useEffect, useRef } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { FiMenu, FiX, FiLogOut, FiUser, FiSettings, FiShield, FiBookmark } from 'react-icons/fi'
import { useAuth } from '../context/AuthContext'
import { useWatchlist } from '../hooks/useWatchlist'
import './Navbar.css'

const navItems = [
    { to: '/browse', label: 'Browse' },
    { to: '/builder', label: 'Builder' },
    { to: '/compare', label: 'Compare' },
    { to: '/advisor', label: 'Advisor' },
    { to: '/builds', label: 'Community' },
]

export default function Navbar() {
    const [open, setOpen] = useState(false)
    const [scrolled, setScrolled] = useState(false)
    const [dropdown, setDropdown] = useState(false)
    const { user, logout } = useAuth()
    const { count: watchCount } = useWatchlist()
    const location = useLocation()
    const dropdownRef = useRef(null)

    useEffect(() => { setOpen(false); setDropdown(false) }, [location])
    useEffect(() => {
        const fn = () => setScrolled(window.scrollY > 10)
        window.addEventListener('scroll', fn)
        return () => window.removeEventListener('scroll', fn)
    }, [])
    useEffect(() => {
        const handler = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdown(false)
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    return (
        <nav className={`nav${scrolled ? ' nav--scrolled' : ''}`}>
            <div className="container nav__inner">
                <Link to="/" className="nav__logo">
                    <svg className="nav__logo-mark" viewBox="0 0 32 32" aria-hidden="true">
                        <rect x="6.5" y="17" width="4" height="8" rx="1.5" />
                        <rect x="14" y="11" width="4" height="14" rx="1.5" />
                        <rect x="21.5" y="6" width="4" height="19" rx="1.5" />
                    </svg>
                    PC<span className="nav__logo-accent">ease</span>
                </Link>

                <div className={`nav__links${open ? ' nav__links--open' : ''}`}>
                    {navItems.map(item => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            className={({ isActive }) => `nav__link${isActive ? ' nav__link--active' : ''}`}
                        >
                            {item.label}
                        </NavLink>
                    ))}
                </div>

                <div className="nav__right">
                    {user ? (
                        <div className="nav__user" ref={dropdownRef}>
                            <button className="nav__avatar-btn" onClick={() => setDropdown(!dropdown)}>
                                <span className="nav__avatar">{user.username?.charAt(0).toUpperCase()}</span>
                                <span className="nav__username">{user.username}</span>
                            </button>
                            {dropdown && (
                                <div className="nav__dropdown">
                                    <Link to="/profile" className="nav__dropdown-item">
                                        <FiUser size={14} /> Profile
                                    </Link>
                                    <Link to="/watchlist" className="nav__dropdown-item">
                                        <FiBookmark size={14} /> Watchlist
                                        {watchCount > 0 && <span className="nav__dropdown-badge">{watchCount}</span>}
                                    </Link>
                                    <Link to="/profile" className="nav__dropdown-item">
                                        <FiSettings size={14} /> Settings
                                    </Link>
                                    {user.is_admin && (
                                        <Link to="/admin" className="nav__dropdown-item">
                                            <FiShield size={14} /> Admin Panel
                                        </Link>
                                    )}
                                    <div className="nav__dropdown-divider" />
                                    <button className="nav__dropdown-item nav__dropdown-item--danger" onClick={logout}>
                                        <FiLogOut size={14} /> Logout
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <>
                            <Link to="/watchlist" className="nav__watch" aria-label="Watchlist" title="Watchlist">
                                <FiBookmark size={16} />
                                {watchCount > 0 && <span className="nav__watch-badge">{watchCount}</span>}
                            </Link>
                            <NavLink to="/login" className="btn btn-primary btn-sm nav__signin">Sign In</NavLink>
                        </>
                    )}
                    <button className="nav__toggle" onClick={() => setOpen(!open)} aria-label="Menu">
                        {open ? <FiX size={17} /> : <FiMenu size={17} />}
                    </button>
                </div>
            </div>
        </nav>
    )
}
