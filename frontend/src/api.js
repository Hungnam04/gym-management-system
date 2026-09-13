let csrfToken = ''
let sessionPromise
const sessionListeners = new Set()

export function onSessionChange(listener) {
  sessionListeners.add(listener)
  return () => sessionListeners.delete(listener)
}

function publishSession(session) {
  sessionListeners.forEach((listener) => listener(session))
}

export async function api(path, options = {}, csrfRetried = false) {
  const method = options.method || 'GET'
  if (method !== 'GET' && !csrfToken) {
    sessionPromise ||= api('/auth/session').finally(() => {
      sessionPromise = undefined
    })
    await sessionPromise
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15000)
  try {
    const response = await fetch(`/api${path}`, {
      ...options,
      credentials: 'same-origin',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(method !== 'GET' ? { 'X-CSRF-Token': csrfToken } : {}),
        ...options.headers,
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    })
    const result = await response.json().catch(() => ({}))
    if (result.csrf_token) csrfToken = result.csrf_token
    if (response.ok && path === '/auth/session') publishSession(result)
    if (response.status === 403 && result.code === 'csrf_expired' && !csrfRetried) {
      // The server rejected this request before any mutation. Refresh and retry once.
      await api('/auth/session')
      return await api(path, options, true)
    }
    if (!response.ok) {
      if (response.status === 401 && !path.startsWith('/auth/')) {
        csrfToken = ''
        publishSession({ user: null })
      }
      const error = new Error(result.error || `Yêu cầu thất bại (${response.status}).`)
      error.status = response.status
      throw error
    }
    return result
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('Kết nối quá thời gian chờ. Vui lòng thử lại.')
    if (error instanceof TypeError)
      throw new Error('Không thể kết nối máy chủ. Kiểm tra Flask đang chạy tại cổng 5000.')
    throw error
  } finally {
    clearTimeout(timer)
  }
}

export const money = (value) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value || 0)
export const dateLabel = (value) =>
  new Date(value).toLocaleDateString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
export const timeLabel = (value) =>
  new Date(value).toLocaleTimeString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
  })
export const today = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
export const statusLabels = {
  pending: 'Chờ thanh toán',
  paid: 'Đã thanh toán',
  cancelled: 'Đã hủy',
  confirmed: 'Đã đặt',
  attended: 'Đã tham gia',
  scheduled: 'Sắp diễn ra',
  new: 'Chưa xử lý',
  contacted: 'Đã liên hệ',
  closed: 'Hoàn tất',
}
