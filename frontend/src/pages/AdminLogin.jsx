import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowUpRight,
  Eye,
  EyeOff,
  ShieldCheck,
  Users,
  CalendarDays,
  BarChart3,
} from 'lucide-react'
import { api } from '../api'
import { accountHome, roleLabels } from '../auth-routing'
import { useAuth, useToast } from '../context'
import { Button, Field, Loading, Logo } from '../components/UI'

export default function AdminLogin() {
  const { user, loading, refresh, logout } = useAuth()
  const [busy, setBusy] = useState(false)
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const notify = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from
  const destination =
    typeof from === 'string' &&
    (from === '/quan-tri' || from.startsWith('/quan-tri?')) &&
    !from.includes('\\')
      ? from
      : '/quan-tri'
  if (loading) return <Loading />
  if (user?.role === 'admin') return <Navigate to={destination} replace />
  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api('/auth/admin-login', {
        method: 'POST',
        body: Object.fromEntries(new FormData(event.currentTarget)),
      })
      await refresh()
      notify('Đăng nhập quản trị thành công.')
      navigate(destination, { replace: true })
    } catch (error) {
      setError(error.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="admin-login-page">
      <section className="admin-login-brand">
        <Logo />
        <div className="admin-login-pitch">
          <span className="admin-access-tag">
            <ShieldCheck size={16} /> GYM TN MANAGEMENT
          </span>
          <h1>
            Mọi hoạt động.
            <br />
            <span>Một nơi quản lý.</span>
          </h1>
          <p>Không gian làm việc dành riêng cho đội ngũ quản trị Gym TN.</p>
          <div className="admin-login-benefits">
            <span>
              <Users />
              Hội viên & huấn luyện viên
            </span>
            <span>
              <CalendarDays />
              Gói tập, lịch lớp & điểm danh
            </span>
            <span>
              <BarChart3 />
              Đơn hàng & báo cáo doanh thu
            </span>
          </div>
        </div>
        <p className="admin-login-bottom">GYM TN · FITNESS & LIFESTYLE</p>
      </section>
      <section className="admin-login-form">
        <Link to="/" className="text-link">
          <ArrowLeft size={16} />
          Về website Gym TN
        </Link>
        <div className="admin-login-box">
          <div className="admin-lock-icon">
            <ShieldCheck size={29} />
          </div>
          <p className="eyebrow">CỔNG QUẢN TRỊ</p>
          <h2>Đăng nhập admin</h2>
          <p className="muted">Sử dụng tài khoản được cấp quyền quản trị để tiếp tục.</p>
          {user ? (
            <div className="form-stack mt-7">
              <div className="info-banner">
                <p>
                  Bạn đang đăng nhập bằng tài khoản {roleLabels[user.role].toLowerCase()}:{' '}
                  <strong>{user.email}</strong>.
                </p>
              </div>
              <Button onClick={logout}>Đăng xuất để dùng tài khoản admin</Button>
              <Link className="text-link" to={accountHome(user)}>
                Về khu vực của tôi <ArrowUpRight size={16} />
              </Link>
            </div>
          ) : (
            <form className="form-stack mt-7" onSubmit={submit}>
              <Field
                label="Email quản trị"
                name="email"
                type="email"
                required
                autoComplete="username"
                maxLength={254}
                placeholder="Email quản trị của bạn"
              />
              <div className="password-field">
                <Field
                  label="Mật khẩu"
                  name="password"
                  type={show ? 'text' : 'password'}
                  required
                  maxLength={128}
                  autoComplete="current-password"
                  placeholder="Nhập mật khẩu"
                />
                <button
                  type="button"
                  onClick={() => setShow(!show)}
                  aria-label={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
              <Button type="submit" variant="dark" className="w-full" busy={busy}>
                Vào trang quản trị <ArrowUpRight size={18} />
              </Button>
              <p className="admin-login-note">
                Tài khoản hội viên và HLV sử dụng <Link to="/dang-nhap">trang đăng nhập chung</Link>
                .
              </p>
            </form>
          )}
        </div>
      </section>
    </div>
  )
}
