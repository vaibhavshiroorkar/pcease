/**
 * Watchlist store - a persistent list of saved components.
 *
 * Source of truth is a small in-memory array of "lite" component snapshots
 * (enough to render cards), mirrored to localStorage so it survives reloads and
 * works logged-out. When a token is present, mutations are also sent to the
 * backend and, on sign-in, the local list is merged into the account.
 *
 * Plain module (no React) + a tiny pub/sub so any component can subscribe.
 */
import { API } from './api'

const KEY = 'pcease_watchlist'
const listeners = new Set()
let items = load()

function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || [] }
    catch { return [] }
}

function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(items)) } catch { /* quota */ }
    listeners.forEach(fn => fn(items))
}

// Keep only what the cards need, so we can render the watchlist offline.
function lite(c) {
    return {
        id: c.id,
        name: c.name,
        brand: c.brand,
        image_url: c.image_url ?? null,
        category: c.category || (c.category_name ? { name: c.category_name } : null),
        prices: c.prices || [],
    }
}

function hasToken() {
    return !!(localStorage.getItem('pcease_token') || sessionStorage.getItem('pcease_token'))
}

export function subscribe(fn) {
    listeners.add(fn)
    return () => listeners.delete(fn)
}

export function getItems() { return items }
export function has(id) { return items.some(i => i.id === id) }

export async function add(component) {
    if (has(component.id)) return
    items = [lite(component), ...items]
    persist()
    if (hasToken()) { try { await API.addToWatchlist(component.id) } catch { /* offline-friendly */ } }
}

export async function remove(id) {
    if (!has(id)) return
    items = items.filter(i => i.id !== id)
    persist()
    if (hasToken()) { try { await API.removeFromWatchlist(id) } catch { /* offline-friendly */ } }
}

export async function toggle(component) {
    return has(component.id) ? remove(component.id) : add(component)
}

export async function clear() {
    const ids = items.map(i => i.id)
    items = []
    persist()
    if (hasToken()) { try { await Promise.all(ids.map(id => API.removeFromWatchlist(id))) } catch { /* noop */ } }
}

/** Replace the local list with the server's (call on reload when signed in). */
export async function syncFromServer() {
    if (!hasToken()) return
    try {
        const server = await API.getWatchlist()
        items = (server || []).map(lite)
        persist()
    } catch { /* keep local copy */ }
}

/** Merge the guest list into the account on sign-in, then adopt the server list. */
export async function mergeOnLogin() {
    if (!hasToken()) return
    try {
        const server = await API.mergeWatchlist(items.map(i => i.id))
        items = (server || []).map(lite)
        persist()
    } catch { /* keep local copy */ }
}
