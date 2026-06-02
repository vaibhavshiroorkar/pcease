import { Component } from 'react'

/**
 * Top-level error boundary. Stops a render error in any page from white-screening
 * the whole app - shows a recoverable fallback instead.
 */
export default class ErrorBoundary extends Component {
    constructor(props) {
        super(props)
        this.state = { error: null }
    }

    static getDerivedStateFromError(error) {
        return { error }
    }

    componentDidCatch(error, info) {
        // eslint-disable-next-line no-console
        console.error('Unhandled UI error:', error, info)
    }

    render() {
        if (this.state.error) {
            return (
                <main className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="card" style={{ maxWidth: 440, textAlign: 'center' }}>
                        <h2 style={{ marginBottom: 8 }}>Something went wrong</h2>
                        <p style={{ marginBottom: 20 }}>
                            An unexpected error occurred while rendering this page. Reloading usually fixes it.
                        </p>
                        <button className="btn btn-primary" onClick={() => window.location.assign('/')}>
                            Back to home
                        </button>
                    </div>
                </main>
            )
        }
        return this.props.children
    }
}
