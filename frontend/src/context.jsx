import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api, onSessionChange } from './api'

const AuthContext = createContext(null)
const ToastContext = createContext(null)

export function useAuth() {
  return useContext(AuthContext)
}
export function useToast() {
  return useContext(ToastContext)
}

export function useResource(path) {
  const [state, setState] = useState({ data: null, loading: true, error: '' })
  const [revision, setRevision] = useState(0)
  const reload = useCallback(() => setRevision((v) => v + 1), [])
  useEffect(() => {
    let current = true
    setState((previous) => ({ ...previous, loading: true, error: '' }))
    api(path)
      .then((data) => {
        if (current) setState({ data, loading: false, error: '' })
      })
      .catch((error) => {
        if (current) setState((previous) => ({ ...previous, loading: false, error: error.message }))
      })
    return () => {
      current = false
    }
  }, [path, revision])
  return { ...state, reload }
}

export function Providers({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [demoPayments, setDemoPayments] = useState(false)
  const [authError, setAuthError] = useState('')
  const [toast, setToast] = useState(null)
  const refresh = useCallback(async () => {
    try {
      const result = await api('/auth/session')
      setUser(result.user)
      setDemoPayments(result.demo_payments)
      setAuthError('')
    } catch (error) {
      setAuthError(error.message)
      throw error
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => {
    const unsubscribe = onSessionChange((result) => {
      setUser(result.user)
      if (typeof result.demo_payments === 'boolean') setDemoPayments(result.demo_payments)
      setAuthError('')
    })
    refresh().catch(() => {})
    return unsubscribe
  }, [refresh])
  const notify = useCallback(
    (message, type = 'success') => setToast({ message, type, key: Date.now() }),
    [],
  )
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 5000)
    return () => clearTimeout(timer)
  }, [toast])
  const logout = async () => {
    try {
      await api('/auth/logout', { method: 'POST' })
      setUser(null)
      notify('Đã đăng xuất.')
    } catch (error) {
      notify(error.message, 'error')
    }
  }
  return (
    <AuthContext.Provider
      value={{ user, setUser, loading, refresh, logout, demoPayments, authError }}
    >
      <ToastContext.Provider value={notify}>
        {children}
        {toast && (
          <div className={`toast ${toast.type}`} role="status">
            <span>{toast.message}</span>
            <button onClick={() => setToast(null)} aria-label="Đóng thông báo">
              ×
            </button>
          </div>
        )}
      </ToastContext.Provider>
    </AuthContext.Provider>
  )
}
