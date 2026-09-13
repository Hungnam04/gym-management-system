import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { ArrowUpRight, Eye, EyeOff } from 'lucide-react'
import { api } from '../api'
import { loginDestination } from '../auth-routing'
import { useAuth, useToast } from '../context'
import { Button, Field } from '../components/UI'

export default function Auth({ register = false }) {
  const { user, setUser, refresh } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [show, setShow] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const notify = useToast()
  const from = location.state?.from
  if (user) return <Navigate to={loginDestination(user, from)} replace />
  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    const body = Object.fromEntries(new FormData(event.currentTarget))
    if (register && body.password !== body.confirm_password) {
      setError('Mật khẩu xác nhận chưa khớp.')
      setBusy(false)
      return
    }
    try {
      const result = await api(`/auth/${register ? 'register' : 'login'}`, { method: 'POST', body })
      setUser(result.user)
      await refresh()
      notify(register ? 'Chào mừng bạn đến với Gym TN!' : `Chào mừng trở lại, ${result.user.name}!`)
      navigate(loginDestination(result.user, from), {
        replace: true,
      })
    } catch (error) {
      setError(error.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="auth-page">
      <div className="auth-visual">
        <img src="/images/strength.jpg" alt="Hành trình tập luyện cùng Gym TN" />
        <div>
          <p className="eyebrow">YOUR NEXT CHAPTER STARTS HERE</p>
          <h1>
            MỘT BƯỚC NHỎ.
            <br />
            <span className="text-lime">MỘT BẠN MỚI.</span>
          </h1>
          <p>
            Tập luyện có thể bắt đầu một mình.
            <br />
            Nhưng bạn luôn có chúng mình đồng hành.
          </p>
        </div>
      </div>
      <div className="auth-form-wrap">
        <form className="form-stack auth-form" onSubmit={submit}>
          <p className="eyebrow">GYM TN MEMBERSHIP</p>
          <h2>{register ? 'Bắt đầu hành trình.' : 'Chào mừng trở lại.'}</h2>
          <p className="muted">
            {register
              ? 'Tạo tài khoản để chọn gói tập và đặt lớp yêu thích.'
              : 'Đăng nhập để tiếp tục hành trình của bạn.'}
          </p>
          {register && (
            <Field
              name="name"
              label="Họ và tên"
              required
              minLength={2}
              maxLength={80}
              autoComplete="name"
              placeholder="Nguyễn Minh Anh"
            />
          )}
          <Field
            label="Email"
            name="email"
            type="email"
            required
            maxLength={254}
            autoComplete="email"
            placeholder="ban@email.com"
          />
          {register && (
            <Field
              label="Số điện thoại"
              name="phone"
              type="tel"
              maxLength={20}
              autoComplete="tel"
              placeholder="09xx xxx xxx"
            />
          )}
          <div className="password-field">
            <Field
              label="Mật khẩu"
              name="password"
              type={show ? 'text' : 'password'}
              required
              minLength={register ? 8 : 1}
              maxLength={128}
              autoComplete={register ? 'new-password' : 'current-password'}
              placeholder={register ? 'Ít nhất 8 ký tự' : 'Nhập mật khẩu'}
            />
            <button
              type="button"
              onClick={() => setShow(!show)}
              aria-label={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            >
              {show ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {register && (
            <>
              <Field
                label="Xác nhận mật khẩu"
                name="confirm_password"
                type="password"
                required
                minLength={8}
                maxLength={128}
                autoComplete="new-password"
                placeholder="Nhập lại mật khẩu"
              />
              <label className="checkbox-label">
                <input type="checkbox" required />
                Tôi đồng ý với{' '}
                <Link to="/chinh-sach" className="underline">
                  điều khoản sử dụng
                </Link>
                .
              </label>
            </>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" busy={busy} className="w-full">
            {register ? 'Tạo tài khoản' : 'Đăng nhập'}
            <ArrowUpRight size={18} />
          </Button>
          <p className="text-center muted text-sm">
            {register ? 'Đã có tài khoản? ' : 'Bạn mới đến Gym TN? '}
            <Link
              className="font-bold underline text-ink"
              to={register ? '/dang-nhap' : '/dang-ky'}
              state={location.state}
            >
              {register ? 'Đăng nhập' : 'Đăng ký ngay'}
            </Link>
          </p>
          {!register && (
            <p className="text-center text-sm muted">
              Cần hỗ trợ tài khoản?{' '}
              <Link to="/lien-he?topic=Hỗ trợ tài khoản" className="underline">
                Liên hệ Gym TN
              </Link>
            </p>
          )}
          {!register && (
            <Link className="admin-entry-link" to="/quan-tri/dang-nhap">
              Đăng nhập dành cho quản trị viên <ArrowUpRight size={14} />
            </Link>
          )}
        </form>
      </div>
    </section>
  )
}
