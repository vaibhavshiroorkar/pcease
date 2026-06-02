import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { FiUsers, FiGrid, FiMessageCircle, FiUserPlus } from 'react-icons/fi'
import { API } from '../services/api'
import { useAuth } from '../context/AuthContext'
import BuildCard from '../components/BuildCard'
import Discussions from '../components/Discussions'
import Builders from '../components/Builders'
import './Community.css'

const TABS = [
    { id: 'builds', label: 'Builds', icon: <FiGrid size={15} /> },
    { id: 'discussions', label: 'Discussions', icon: <FiMessageCircle size={15} /> },
    { id: 'builders', label: 'Builders', icon: <FiUserPlus size={15} /> },
]

const BUILD_SORTS = [
    { id: 'recent', label: 'Recent', sort: 'recent', scope: 'all' },
    { id: 'popular', label: 'Popular', sort: 'popular', scope: 'all' },
    { id: 'following', label: 'Following', sort: 'recent', scope: 'following', auth: true },
]

function BuildsTab() {
    const { user } = useAuth()
    const [sort, setSort] = useState('recent')
    const [builds, setBuilds] = useState(null)

    useEffect(() => {
        const s = BUILD_SORTS.find(x => x.id === sort)
        setBuilds(null)
        API.getPublicBuilds({ sort: s.sort, scope: s.scope })
            .then(d => setBuilds(d.items))
            .catch(() => setBuilds([]))
    }, [sort])

    const visibleSorts = BUILD_SORTS.filter(s => !s.auth || user)

    return (
        <>
            <div className="cm-subtabs">
                {visibleSorts.map(s => (
                    <button key={s.id} className={`cm-subtab${sort === s.id ? ' active' : ''}`} onClick={() => setSort(s.id)}>
                        {s.label}
                    </button>
                ))}
            </div>

            {builds === null ? (
                <div className="cm-grid">{Array(6).fill(0).map((_, i) => <div key={i} className="skeleton cm-skel" />)}</div>
            ) : builds.length === 0 ? (
                <div className="empty-state">
                    <h3>{sort === 'following' ? 'Nothing from people you follow yet' : 'No public builds yet'}</h3>
                    <p>{sort === 'following' ? 'Follow some builders to see their builds here.' : 'Publish a build from the Builder to get things started.'}</p>
                </div>
            ) : (
                <div className="cm-grid">
                    {builds.map(b => <BuildCard key={b.id} build={b} />)}
                </div>
            )}
        </>
    )
}

export default function Community() {
    const [params, setParams] = useSearchParams()
    const tab = TABS.some(t => t.id === params.get('tab')) ? params.get('tab') : 'builds'

    const setTab = (id) => setParams(id === 'builds' ? {} : { tab: id }, { replace: true })

    return (
        <main className="page">
            <div className="container cm">
                <header className="cm-header">
                    <h1><FiUsers size={20} /> Community</h1>
                    <p>Real builds, discussions, and the people behind them. Share your rig, get advice, and find other Indian builders.</p>
                </header>

                <div className="cm-tabs" role="tablist">
                    {TABS.map(t => (
                        <button
                            key={t.id}
                            role="tab"
                            aria-selected={tab === t.id}
                            className={`cm-tab${tab === t.id ? ' active' : ''}`}
                            onClick={() => setTab(t.id)}
                        >
                            {t.icon} {t.label}
                        </button>
                    ))}
                </div>

                {tab === 'builds' && <BuildsTab />}
                {tab === 'discussions' && <Discussions />}
                {tab === 'builders' && <Builders />}
            </div>
        </main>
    )
}
