import { useState, useEffect, useRef } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { FiMenu, FiX, FiLogOut, FiUser, FiSettings, FiShield } from 'react-icons/fi'
import { useAuth } from '../context/AuthContext'
import './Navbar.css'

const navItems = [
    { to: '/browse', label: 'Browse' },
    { to: '/builder', label: 'Builder' },
    { to: '/advisor', label: 'Advisor' },
    { to: '/compare', label: 'Compare' },
    { to: '/forum', label: 'Forum' },
]

export default function Navbar() {
    const [open, setOpen] = useState(false)
    const [scrolled, setScrolled] = useState(false)
    const [dropdown, setDropdown] = useState(false)
    const { user, logout } = useAuth()
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
                    PC<span className="nav__logo-accent">ease</span><span className="nav__dot">.</span>
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
                        <NavLink to="/login" className="btn btn-primary btn-sm nav__signin">Sign In</NavLink>
                    )}
                    <button className="nav__toggle" onClick={() => setOpen(!open)} aria-label="Menu">
                        {open ? <FiX size={17} /> : <FiMenu size={17} />}
                    </button>
                </div>
            </div>
        </nav>
    )
}
