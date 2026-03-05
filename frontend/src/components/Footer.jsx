import { Link } from 'react-router-dom'
import './Footer.css'

export default function Footer() {
    return (
        <footer className="ft">
            <div className="container ft__inner">
                <span className="ft__copy">&copy; 2026 PCease</span>
                <Link to="/contact" className="ft__link">Contact</Link>
            </div>
        </footer>
    )
}
