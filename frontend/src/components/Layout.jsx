import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  ArrowUpRight,
  Menu,
  X,
  Instagram,
  Facebook,
  MapPin,
  Phone,
  Clock,
  LogOut,
  UserRound,
} from 'lucide-react'
import { useAuth } from '../context'
import { accountHome } from '../auth-routing'
import { Logo, LinkButton } from './UI'

const links = [
  ['/', 'Trang chủ'],
  ['/goi-tap', 'Gói tập'],
  ['/lich-tap', 'Lịch tập'],
  ['/huan-luyen-vien', 'Huấn luyện viên'],
  ['/bai-viet', 'Góc chia sẻ'],
]

export default function Layout() {
  const [menu, setMenu] = useState(false)
  const { user, logout } = useAuth()
  const { pathname } = useLocation()
  useEffect(() => {
    setMenu(false)
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname])
  return (
    <>
      <a href="#main-content" className="skip-link">
        Chuyển đến nội dung
      </a>
      <header className="site-header">
        <div className="container nav-wrap">
          <Logo />
          <nav className="desktop-nav" aria-label="Điều hướng chính">
            {links.map(([path, label]) => (
              <NavLink key={path} to={path} end>
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="nav-actions">
            {user ? (
              <>
                <Link to={accountHome(user)} className="account-link">
                  <UserRound size={17} />
                  <span>{user.name.split(' ').slice(-2).join(' ')}</span>
                </Link>
                <button
                  className="icon-button"
                  title="Đăng xuất"
                  aria-label="Đăng xuất"
                  onClick={logout}
                >
                  <LogOut size={18} />
                </button>
              </>
            ) : (
              <Link to="/dang-nhap" className="login-link">
                Đăng nhập
              </Link>
            )}
            <LinkButton to={user ? accountHome(user) : '/dang-ky'} className="nav-join">
              {user
                ? user.role === 'admin'
                  ? 'Quản trị'
                  : user.role === 'trainer'
                    ? 'Lịch dạy'
                    : 'Hội viên'
                : 'Tham gia ngay'}
            </LinkButton>
            <button
              className="icon-button menu-toggle"
              aria-label={menu ? 'Đóng menu' : 'Mở menu'}
              aria-expanded={menu}
              onClick={() => setMenu(!menu)}
            >
              {menu ? <X /> : <Menu />}
            </button>
          </div>
        </div>
        {menu && (
          <nav className="mobile-nav" aria-label="Điều hướng di động">
            {links.map(([path, label]) => (
              <NavLink key={path} to={path} end>
                {label}
              </NavLink>
            ))}
            <NavLink to="/lien-he">Liên hệ</NavLink>
            {user?.role === 'admin' && <NavLink to="/quan-tri">Quản trị</NavLink>}
            {user?.role === 'trainer' && <NavLink to="/hlv">Lịch dạy của tôi</NavLink>}
          </nav>
        )}
      </header>
      <main id="main-content" tabIndex={-1}>
        <Outlet />
      </main>
      <footer className="site-footer">
        <div className="container">
          <div className="footer-top">
            <div className="footer-brand">
              <Logo />
              <p>
                Nơi bạn tìm thấy sức mạnh của mình.
                <br />
                Từng buổi tập. Từng ngày.
              </p>
              <div className="social-labels">
                <span>
                  <Instagram size={18} /> Gym TN
                </span>
                <span>
                  <Facebook size={18} /> Cộng đồng Gym TN
                </span>
              </div>
            </div>
            <div>
              <h3>Khám phá</h3>
              <Link to="/goi-tap">Gói tập & quyền lợi</Link>
              <Link to="/lich-tap">Lịch lớp hàng tuần</Link>
              <Link to="/huan-luyen-vien">Đội ngũ huấn luyện</Link>
              <Link to="/bai-viet">Góc chia sẻ</Link>
            </div>
            <div>
              <h3>Kết nối với chúng tôi</h3>
              <Link to="/lien-he">
                <MapPin size={16} />
                123 Đường Thể Thao, TP. Thái Nguyên
              </Link>
              <a href="tel:0901234567">
                <Phone size={16} />
                0901 234 567
              </a>
              <p>
                <Clock size={16} />
                Thứ 2 – CN · 05:00 – 22:00
              </p>
              <Link to="/lien-he" className="text-lime">
                Đăng ký tư vấn <ArrowUpRight size={16} />
              </Link>
            </div>
          </div>
          <div className="footer-bottom">
            <span>© {new Date().getFullYear()} Gym TN. Mạnh hơn mỗi ngày.</span>
            <span>Website demo · Địa chỉ, nhân sự và nội dung minh họa.</span>
            <Link to="/chinh-sach">Điều khoản & bảo mật</Link>
            <Link to="/quan-tri/dang-nhap">Quản trị viên</Link>
          </div>
        </div>
      </footer>
    </>
  )
}
