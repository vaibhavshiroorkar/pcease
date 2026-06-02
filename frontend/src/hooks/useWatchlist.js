import { useState, useEffect, useMemo } from 'react'
import { subscribe, getItems, toggle, remove, clear } from '../services/watchlist'

/**
 * Reactive view of the watchlist store. Re-renders whenever the list changes,
 * from anywhere in the app.
 */
export function useWatchlist() {
    const [items, setItems] = useState(getItems)

    useEffect(() => subscribe(setItems), [])

    const ids = useMemo(() => new Set(items.map(i => i.id)), [items])

    return {
        items,
        ids,
        count: items.length,
        has: (id) => ids.has(id),
        toggle,
        remove,
        clear,
    }
}
