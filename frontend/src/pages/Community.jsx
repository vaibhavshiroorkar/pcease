import { useEffect, useState } from 'react'
import { FiUsers } from 'react-icons/fi'
import { API } from '../services/api'
import { useAuth } from '../context/AuthContext'
import BuildCard from '../components/BuildCard'
import './Community.css'

const TABS = [
    { id: 'recent', label: 'Recent', sort: 'recent', scope: 'all' },
    { id: 'popular', label: 'Popular', sort: 'popular', scope: 'all' },
    { id: 'following', label: 'Following', sort: 'recent', scope: 'following', auth: true },
]

export default function Community() {
    const { user } = useAuth()
    const [tab, setTab] = useState('recent')
    const [builds, setBuilds] = useState(null)

    useEffect(() => {
        const t = TABS.find(x => x.id === tab)
        setBuilds(null)
        API.getPublicBuilds({ sort: t.sort, scope: t.scope })
            .then(d => setBuilds(d.items))
            .catch(() => setBuilds([]))
    }, [tab])

    const visibleTabs = TABS.filter(t => !t.auth || user)

    return (
        <main className="page">
            <div className="container cm">
                <header className="cm-header">
                    <h1><FiUsers size={20} /> Community Builds</h1>
                    <p>Real builds shared by PCease users. Like them, save your favourites, or open any in the Builder.</p>
                </header>

                <div className="cm-tabs">
                    {visibleTabs.map(t => (
                        <button key={t.id} className={`cm-tab${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)}>
                            {t.label}
                        </button>
                    ))}
                </div>

                {builds === null ? (
                    <div className="cm-grid">{Array(6).fill(0).map((_, i) => <div key={i} className="skeleton cm-skel" />)}</div>
                ) : builds.length === 0 ? (
                    <div className="empty-state">
                        <h3>{tab === 'following' ? 'Nothing from people you follow yet' : 'No public builds yet'}</h3>
                        <p>{tab === 'following' ? 'Follow some builders to see their builds here.' : 'Publish a build from the Builder to get things started.'}</p>
                    </div>
                ) : (
                    <div className="cm-grid">
                        {builds.map(b => <BuildCard key={b.id} build={b} />)}
                    </div>
                )}
            </div>
        </main>
    )
}
