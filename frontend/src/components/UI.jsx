import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Dumbbell, LoaderCircle, X, ArrowRight, AlertCircle } from 'lucide-react'
import { statusLabels } from '../api'

export function Logo() {
  return (
    <Link to="/" className="logo" aria-label="Gym TN — Trang chủ">
      <span className="logo-mark">
        <Dumbbell size={24} strokeWidth={2.6} />
      </span>
      <span>
        GYM<span className="text-lime">TN</span>
        <i>FITNESS & LIFESTYLE</i>
      </span>
    </Link>
  )
}
export function Button({ children, variant = 'primary', busy, className = '', ...props }) {
  return (
    <button
      className={`btn btn-${variant} ${className}`}
      {...props}
      disabled={props.disabled || busy}
    >
      {busy && <LoaderCircle size={17} className="animate-spin" />}
      {children}
    </button>
  )
}
export function LinkButton({ to, children, variant = 'primary', arrow = true, className = '' }) {
  return (
    <Link to={to} className={`btn btn-${variant} ${className}`}>
      {children}
      {arrow && <ArrowUpRight size={18} />}
    </Link>
  )
}
export function SectionHeading({ eyebrow, title, subtitle, link, linkText = 'Khám phá thêm' }) {
  return (
    <div className="section-heading">
      <div>
        {eyebrow && (
          <p className="eyebrow">
            <span />
            {eyebrow}
          </p>
        )}
        <h2>{title}</h2>
        {subtitle && <p className="muted max-w-xl mt-4">{subtitle}</p>}
      </div>
      {link && (
        <Link to={link} className="text-link">
          {linkText}
          <ArrowUpRight size={18} />
        </Link>
      )}
    </div>
  )
}
export function PageHero({ eyebrow, title, text, children }) {
  return (
    <section className="page-hero">
      <div className="container">
        <p className="eyebrow">
          <span />
          {eyebrow}
        </p>
        <h1>{title}</h1>
        <p>{text}</p>
        {children}
      </div>
      <span className="page-hero-decoration" aria-hidden="true">
        TN.
      </span>
    </section>
  )
}
export function Loading() {
  return (
    <div className="state-box" role="status">
      <LoaderCircle className="animate-spin" />
      <p>Đang tải dữ liệu…</p>
    </div>
  )
}
export function ErrorBox({ error, retry }) {
  return (
    <div className="state-box error-box" role="alert">
      <AlertCircle />
      <p>{error}</p>
      {retry && (
        <Button variant="outline" onClick={retry}>
          Thử lại
        </Button>
      )}
    </div>
  )
}
export function Empty({ title = 'Chưa có dữ liệu', text, to, action }) {
  return (
    <div className="state-box">
      <Dumbbell size={32} className="muted" />
      <h3>{title}</h3>
      {text && <p className="muted">{text}</p>}
      {to && <LinkButton to={to}>{action || 'Khám phá ngay'}</LinkButton>}
    </div>
  )
}
export function Field({ label, name, type = 'text', as = 'input', children, ...props }) {
  const Component = as
  return (
    <label className="field">
      <span>
        {label}
        {props.required && <b> *</b>}
      </span>
      <Component name={name} type={as === 'input' ? type : undefined} {...props}>
        {children}
      </Component>
    </label>
  )
}
export function Modal({ title, children, onClose }) {
  const ref = useRef(null)
  useEffect(() => {
    const dialog = ref.current
    dialog.showModal()
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      dialog.close()
      document.body.style.overflow = previous
    }
  }, [])
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby="modal-title"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        if (event.target === ref.current) onClose()
      }}
    >
      <div className="modal-inner">
        <div className="modal-heading">
          <h2 id="modal-title">{title}</h2>
          <button className="icon-button" onClick={onClose} aria-label="Đóng">
            <X />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  )
}
export function Badge({ status, children }) {
  return (
    <span className={`badge badge-${status}`}>{children || statusLabels[status] || status}</span>
  )
}
export function Stat({ icon: Icon, label, value, detail }) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <span>{label}</span>
        <Icon size={20} />
      </div>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
    </div>
  )
}
export function Photo({ src, alt, className = '', ...props }) {
  return (
    <img
      src={src || '/images/gym.jpg'}
      alt={alt}
      className={`photo ${className}`}
      loading="lazy"
      {...props}
      onError={(event) => {
        if (!event.currentTarget.dataset.fallback) {
          event.currentTarget.dataset.fallback = '1'
          event.currentTarget.src = '/images/gym.jpg'
        }
      }}
    />
  )
}
export function CTA() {
  return (
    <section className="cta">
      <div className="container">
        <div>
          <p className="eyebrow">BƯỚC ĐẦU TIÊN LÀ CỦA BẠN</p>
          <h2>
            Phiên bản tốt hơn.
            <br />
            Bắt đầu từ hôm nay.
          </h2>
        </div>
        <LinkButton to="/goi-tap" variant="dark">
          Chọn gói tập của bạn <ArrowRight size={18} />
        </LinkButton>
      </div>
    </section>
  )
}
