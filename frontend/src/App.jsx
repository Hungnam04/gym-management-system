import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Component, useEffect } from 'react'
import { useAuth } from './context'
import Layout from './components/Layout'
import { Empty, ErrorBox, Loading } from './components/UI'
import Home from './pages/Home'
import Auth from './pages/Auth'
import Member from './pages/Member'
import Admin from './pages/Admin'
import AdminLogin from './pages/AdminLogin'
import Trainer from './pages/Trainer'
import { accountHome } from './auth-routing'
import { Plans, Schedule, Trainers, Blog, Post, Contact, Policy } from './pages/Public'

class ErrorBoundary extends Component {
  state = { error: false }
  static getDerivedStateFromError() {
    return { error: true }
  }
  render() {
    return this.state.error ? (
      <ErrorBox
        error="Giao diện gặp lỗi. Hãy tải lại trang để tiếp tục."
        retry={() => window.location.reload()}
      />
    ) : (
      this.props.children
    )
  }
}
function Protected({ children, admin = false, trainer = false }) {
  const { user, loading, authError, refresh } = useAuth()
  const location = useLocation()
  if (loading) return <Loading />
  if (authError) return <ErrorBox error={authError} retry={() => refresh().catch(() => {})} />
  if (!user)
    return (
      <Navigate
        to={admin ? '/quan-tri/dang-nhap' : '/dang-nhap'}
        state={{ from: `${location.pathname}${location.search}` }}
        replace
      />
    )
  if (admin && user.role !== 'admin') return <Navigate to="/quan-tri/dang-nhap" replace />
  if (trainer && user.role !== 'trainer')
    return (
      <Empty
        title="Khu vực dành cho huấn luyện viên"
        to={accountHome(user)}
        action="Về khu vực của tôi"
      />
    )
  return children
}
function PageTitle() {
  const { pathname } = useLocation()
  useEffect(() => {
    const title =
      {
        '/': 'Mạnh hơn mỗi ngày',
        '/goi-tap': 'Gói tập',
        '/lich-tap': 'Lịch tập',
        '/huan-luyen-vien': 'Huấn luyện viên',
        '/bai-viet': 'Góc chia sẻ',
        '/lien-he': 'Liên hệ',
        '/dang-nhap': 'Đăng nhập',
        '/dang-ky': 'Đăng ký',
        '/hoi-vien': 'Trang hội viên',
        '/quan-tri': 'Quản trị',
        '/quan-tri/dang-nhap': 'Đăng nhập quản trị',
        '/hlv': 'Lịch dạy của tôi',
        '/chinh-sach': 'Điều khoản & bảo mật',
      }[pathname] || 'Góc chia sẻ'
    document.title = `${title} | Gym TN`
  }, [pathname])
  return null
}
export default function App() {
  return (
    <ErrorBoundary>
      <PageTitle />
      <Routes>
        <Route path="quan-tri/dang-nhap" element={<AdminLogin />} />
        <Route
          path="quan-tri"
          element={
            <Protected admin>
              <Admin />
            </Protected>
          }
        />
        <Route
          path="hlv"
          element={
            <Protected trainer>
              <Trainer />
            </Protected>
          }
        />
        <Route path="admin" element={<Navigate to="/quan-tri" replace />} />
        <Route path="admin/login" element={<Navigate to="/quan-tri/dang-nhap" replace />} />
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="goi-tap" element={<Plans />} />
          <Route path="lich-tap" element={<Schedule />} />
          <Route path="huan-luyen-vien" element={<Trainers />} />
          <Route path="bai-viet" element={<Blog />} />
          <Route path="bai-viet/:id" element={<Post />} />
          <Route path="lien-he" element={<Contact />} />
          <Route path="chinh-sach" element={<Policy />} />
          <Route path="dang-nhap" element={<Auth key="login" />} />
          <Route path="dang-ky" element={<Auth key="register" register />} />
          <Route
            path="hoi-vien"
            element={
              <Protected>
                <Member />
              </Protected>
            }
          />
          <Route
            path="*"
            element={
              <Empty
                title="404 — Bạn đi hơi xa rồi"
                text="Trang này không tồn tại. Quay lại để tiếp tục hành trình."
                to="/"
                action="Về trang chủ"
              />
            }
          />
        </Route>
      </Routes>
    </ErrorBoundary>
  )
}
