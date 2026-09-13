import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, LogOut, Menu, X, ShieldCheck, Dumbbell } from 'lucide-react'
import { Logo } from './UI'
import { useAuth } from '../context'
import { roleLabels } from '../auth-routing'

export default function ManagementShell({ tabs, active, onSelect, children }) {
  const { user, logout } = useAuth()
  const [mobile, setMobile] = useState(false)
  const admin = user.role === 'admin'
  return (
    <div className="management-shell" onKeyDown={event => { if (event.key === 'Escape') setMobile(false) }}>
      <a href="#management-content" className="skip-link">
        Chuyển đến nội dung
      </a>
      {mobile && (
        <button
          className="management-backdrop"
          aria-label="Đóng menu"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className={`management-sidebar ${mobile ? 'is-open' : ''}`}>
        <div className="management-brand">
          <Logo />
          <button
            className="icon-button management-close"
            aria-label="Đóng menu"
            onClick={() => setMobile(false)}
          >
            <X />
          </button>
        </div>
        <div className="management-space">
          {admin ? <ShieldCheck size={17} /> : <Dumbbell size={17} />}
          <span>{admin ? 'KHÔNG GIAN QUẢN TRỊ' : 'KHÔNG GIAN HUẤN LUYỆN'}</span>
        </div>
        <p className="management-nav-label">{admin ? 'ĐIỀU HÀNH PHÒNG TẬP' : 'LỊCH LÀM VIỆC'}</p>
        <nav aria-label={admin ? 'Menu quản trị' : 'Menu huấn luyện viên'}>
          {tabs.map(([key, label, Icon]) => (
            <button
              key={key}
              className={active === key ? 'active' : ''}
              aria-current={active === key ? 'page' : undefined}
              onClick={() => {
                onSelect(key)
                setMobile(false)
              }}
            >
              <Icon size={19} />
              <span>{label}</span>
              {active === key && <i />}
            </button>
          ))}
        </nav>
        <div className="management-sidebar-footer">
          <Link to="/">
            Xem website <ArrowUpRight size={16} />
          </Link>
          <button onClick={logout}>
            <LogOut size={16} />
            Đăng xuất
          </button>
        </div>
      </aside>
      <div className="management-main">
        <header className="management-topbar">
          <div className="flex items-center gap-3">
            <button
              className="icon-button management-menu"
              aria-label="Mở menu quản lý"
              aria-expanded={mobile}
              onClick={() => setMobile(!mobile)}
            >
              <Menu />
            </button>
            <span>
              Gym TN{' '}
              <span className="management-breadcrumb">
                / {tabs.find(([key]) => key === active)?.[1]}
              </span>
            </span>
          </div>
          <button
            className="management-account"
            onClick={() => onSelect('account')}
            aria-label="Mở tài khoản của tôi"
          >
            <span className="management-avatar">{user.name.slice(0, 1)}</span>
            <span>
              <strong>{user.name}</strong>
              <small>{roleLabels[user.role]}</small>
            </span>
          </button>
        </header>
        <main id="management-content" tabIndex={-1} className="management-body">
          {children}
        </main>
        <footer className="management-footer">
          © {new Date().getFullYear()} Gym TN{' '}
          <span>{admin ? 'Hệ thống quản trị phòng tập' : 'Khu vực huấn luyện viên'}</span>
        </footer>
      </div>
    </div>
  )
}
