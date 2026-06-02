import { Link } from 'react-router-dom'
import './Footer.css'

// Deliberately not the navbar items (Browse/Builder/Advisor/Community) -
// the footer surfaces the secondary pages the nav doesn't.
const links = [
    { to: '/guide', label: 'Guide' },
    { to: '/contact', label: 'Contact' },
]

export default function Footer() {
    return (
        <footer className="ft">
            <div className="container ft__inner">
                <Link to="/" className="ft__brand">
                    <svg className="ft__mark" viewBox="0 0 32 32" aria-hidden="true">
                        <rect x="6.5" y="17" width="4" height="8" rx="1.5" />
                        <rect x="14" y="11" width="4" height="14" rx="1.5" />
                        <rect x="21.5" y="6" width="4" height="19" rx="1.5" />
                    </svg>
                    <span>PC<span className="ft__brand-accent">ease</span></span>
                </Link>

                <nav className="ft__links">
                    {links.map(l => (
                        <Link key={l.to} to={l.to} className="ft__link">{l.label}</Link>
                    ))}
                </nav>

                <span className="ft__copy">&copy; 2026 PCease &middot; Built for Indian PC builders</span>
            </div>
        </footer>
    )
}
