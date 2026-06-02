import { createContext, useContext, useState, useEffect } from 'react'
import { API } from '../services/api'

// eslint-disable-next-line react-refresh/only-export-components
const AuthContext = createContext(null)

const readToken = () => localStorage.getItem('pcease_token') || sessionStorage.getItem('pcease_token')

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null)
    const [token, setToken] = useState(readToken)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (token) {
            fetchUser()
        } else {
            setLoading(false)
        }
    }, [token])

    const fetchUser = async () => {
        try {
            const userData = await API.getMe(token)
            setUser(userData)
        } catch {
            logout()
        } finally {
            setLoading(false)
        }
    }

    const login = async (username, password, remember = true) => {
        const data = await API.login(username, password)
        const store = remember ? localStorage : sessionStorage
        const other = remember ? sessionStorage : localStorage
        store.setItem('pcease_token', data.access_token)
        other.removeItem('pcease_token')
        setToken(data.access_token)
        await fetchUser()
        return data
    }

    const register = async (email, username, password) => {
        const data = await API.register(email, username, password)
        return data
    }

    const logout = () => {
        localStorage.removeItem('pcease_token')
        sessionStorage.removeItem('pcease_token')
        setToken(null)
        setUser(null)
    }

    const refreshUser = async () => {
        if (token) await fetchUser()
    }

    return (
        <AuthContext.Provider value={{ user, token, loading, login, register, logout, refreshUser }}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const context = useContext(AuthContext)
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
}
