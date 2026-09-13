import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowUpRight,
  Check,
  CalendarDays,
  Clock,
  Users,
  MapPin,
  Search,
  Phone,
  Mail,
  Sparkles,
} from 'lucide-react'
import { api, money, dateLabel, timeLabel } from '../api'
import { useAuth, useResource, useToast } from '../context'
import {
  PageHero,
  Button,
  LinkButton,
  Loading,
  ErrorBox,
  Empty,
  Photo,
  Field,
  Modal,
  Badge,
  CTA,
} from '../components/UI'

export function Plans() {
  const { data, loading, error, reload } = useResource('/plans')
  const { user, demoPayments } = useAuth()
  const navigate = useNavigate()
  const notify = useToast()
  const [selected, setSelected] = useState(null)
  const [method, setMethod] = useState('cash')
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState('')
  const [params] = useSearchParams()
  const choose = (plan) => {
    if (!user) return navigate('/dang-nhap', { state: { from: `/goi-tap?plan=${plan.id}` } })
    setSelected(plan)
    setFailure('')
    setMethod('cash')
  }
  const checkout = async (event) => {
    event.preventDefault()
    setBusy(true)
    setFailure('')
    try {
      const result = await api('/orders', {
        method: 'POST',
        body: { plan_id: selected.id, payment_method: method },
      })
      setSelected(null)
      notify(
        `Đã tạo đơn #${result.order.id}. ${method === 'cash' ? 'Thanh toán tại quầy để kích hoạt gói.' : 'Xác nhận mô phỏng tại mục đơn hàng.'}`,
      )
      navigate('/hoi-vien?tab=orders')
    } catch (error) {
      setFailure(error.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <PageHero
        eyebrow="ĐẦU TƯ CHO CHÍNH MÌNH"
        title={
          <>
            Gói tập linh hoạt.
            <br />
            <span className="text-lime">Cam kết của bạn.</span>
          </>
        }
        text="Chọn gói phù hợp, tập luyện theo nhịp riêng. Tất cả gói tập đều bao gồm quyền đặt lớp nhóm."
      />
      <section className="section container">
        {loading ? (
          <Loading />
        ) : error ? (
          <ErrorBox error={error} retry={reload} />
        ) : data.plans.length ? (
          <div className="pricing-grid">
            {data.plans.map((plan) => (
              <article
                className={`price-card ${plan.popular ? 'featured' : ''} ${params.get('plan') === String(plan.id) ? 'selected-plan' : ''}`}
                key={plan.id}
              >
                {!!plan.popular && (
                  <span className="popular-label">
                    <Sparkles size={14} /> LỰA CHỌN NỔI BẬT
                  </span>
                )}
                <p className="plan-duration">{plan.duration_days} NGÀY ĐỒNG HÀNH</p>
                <h2>{plan.name}</h2>
                <p className="plan-tagline">{plan.tagline}</p>
                <div className="price">
                  {money(plan.price)}
                  <small>/ {plan.duration_days} ngày</small>
                </div>
                <Button
                  variant={plan.popular ? 'primary' : 'outline'}
                  className="w-full"
                  onClick={() => choose(plan)}
                >
                  Đăng ký gói tập <ArrowUpRight size={18} />
                </Button>
                <ul>
                  {plan.features.map((f) => (
                    <li key={f}>
                      <Check size={17} />
                      {f}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        ) : (
          <Empty title="Gói tập đang được cập nhật" />
        )}
        <div className="info-banner">
          <Check />
          <p>
            Gia hạn sớm không mất ngày tập. Gói mới bắt đầu khi gói hiện tại kết thúc. Lịch lớp áp
            dụng theo chỗ trống và thời hạn gói.
          </p>
        </div>
      </section>
      {selected && (
        <Modal
          title={`Đăng ký gói ${selected.name}`}
          onClose={() => {
            if (!busy) setSelected(null)
          }}
        >
          <form onSubmit={checkout} className="form-stack">
            <div className="checkout-summary">
              <span>{selected.duration_days} ngày tập luyện</span>
              <strong>{money(selected.price)}</strong>
            </div>
            <p className="muted">Tài khoản: {user.email}</p>
            <label className="payment-option">
              <input
                type="radio"
                name="payment"
                value="cash"
                checked={method === 'cash'}
                onChange={() => setMethod('cash')}
              />
              <div>
                <strong>Thanh toán tại quầy</strong>
                <p>Nhân viên xác nhận sau khi nhận tiền. Gói được kích hoạt sau xác nhận.</p>
              </div>
            </label>
            {demoPayments && (
              <label className="payment-option">
                <input
                  type="radio"
                  name="payment"
                  value="demo"
                  checked={method === 'demo'}
                  onChange={() => setMethod('demo')}
                />
                <div>
                  <strong>Thanh toán mô phỏng</strong>
                  <p>
                    Dành cho trải nghiệm demo. Không thu tiền thật. Xác nhận bước tiếp theo tại
                    trang hội viên.
                  </p>
                </div>
              </label>
            )}
            <p className="text-sm muted">
              Bằng cách tạo đơn, bạn đồng ý với{' '}
              <Link to="/chinh-sach" className="underline">
                điều khoản sử dụng
              </Link>
              .
            </p>
            {failure && (
              <p className="form-error" role="alert">
                {failure}
              </p>
            )}
            <Button busy={busy} type="submit" className="w-full">
              Tạo đơn · {money(selected.price)}
            </Button>
          </form>
        </Modal>
      )}
    </>
  )
}

export function Schedule() {
  const { data, loading, error, reload } = useResource('/classes')
  const { user } = useAuth()
  const notify = useToast()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [day, setDay] = useState('all')
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(null)
  const category = params.get('category') || 'all'
  const classes = data?.classes || []
  const days = [...new Set(classes.map((c) => c.starts_at.slice(0, 10)))]
  const categories = [...new Set(classes.map((c) => c.category))]
  const filtered = classes.filter(
    (c) =>
      (category === 'all' || c.category === category) &&
      (day === 'all' || c.starts_at.startsWith(day)) &&
      `${c.title} ${c.trainer_name} ${c.level}`.toLowerCase().includes(query.toLowerCase()),
  )
  const book = async (cls) => {
    if (!user) return navigate('/dang-nhap', { state: { from: '/lich-tap' } })
    setBusy(cls.id)
    try {
      const result = await api('/bookings', { method: 'POST', body: { class_id: cls.id } })
      notify(result.message)
      reload()
    } catch (error) {
      notify(error.message, 'error')
    } finally {
      setBusy(null)
    }
  }
  return (
    <>
      <PageHero
        eyebrow="MAKE TIME FOR YOURSELF"
        title={
          <>
            Một lịch hẹn.
            <br />
            <span className="text-lime">Dành cho chính bạn.</span>
          </>
        }
        text="Chọn lớp yêu thích, giữ chỗ và mang theo năng lượng của bạn. Thời gian hiển thị theo giờ Việt Nam."
      />
      <section className="section container">
        <div className="filter-bar">
          <div className="filter-tabs">
            <button className={category === 'all' ? 'active' : ''} onClick={() => setParams({})}>
              Tất cả bộ môn
            </button>
            {categories.map((c) => (
              <button
                key={c}
                className={category === c ? 'active' : ''}
                onClick={() => setParams({ category: c })}
              >
                {c}
              </button>
            ))}
          </div>
          <label className="search-field">
            <Search size={18} />
            <input
              aria-label="Tìm lớp hoặc huấn luyện viên"
              placeholder="Tìm lớp, huấn luyện viên…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
        </div>
        <div className="date-tabs">
          <button className={day === 'all' ? 'active' : ''} onClick={() => setDay('all')}>
            <CalendarDays size={21} />
            <span>Tất cả ngày</span>
          </button>
          {days.map((d) => (
            <button className={day === d ? 'active' : ''} onClick={() => setDay(d)} key={d}>
              <span>
                {new Date(`${d}T12:00:00+07:00`).toLocaleDateString('vi-VN', { weekday: 'short' })}
              </span>
              <strong>
                {d.slice(8)}/{d.slice(5, 7)}
              </strong>
            </button>
          ))}
        </div>
        <div className="flex justify-between items-center mb-6 gap-4">
          <p className="muted">{filtered.length} lớp tập phù hợp</p>
          <Link to="/hoi-vien?tab=bookings" className="text-link">
            Lịch đã đặt <ArrowUpRight size={16} />
          </Link>
        </div>
        {loading ? (
          <Loading />
        ) : error ? (
          <ErrorBox error={error} retry={reload} />
        ) : filtered.length ? (
          <div className="class-grid">
            {filtered.map((cls) => (
              <article className="class-card" key={cls.id}>
                <div className="flex justify-between items-center">
                  <span className={`class-category category-${cls.category.toLowerCase()}`}>
                    {cls.category}
                  </span>
                  <span className="text-sm muted">{cls.level}</span>
                </div>
                <h2>{cls.title}</h2>
                <p className="class-trainer">Cùng {cls.trainer_name}</p>
                <div className="class-details">
                  <span>
                    <CalendarDays size={16} />
                    {dateLabel(cls.starts_at)}
                  </span>
                  <span>
                    <Clock size={16} />
                    {timeLabel(cls.starts_at)} · {cls.duration_minutes} phút
                  </span>
                  <span>
                    <MapPin size={16} />
                    {cls.room}
                  </span>
                  <span>
                    <Users size={16} />
                    Còn {Math.max(0, cls.capacity - cls.booked)}/{cls.capacity} chỗ
                  </span>
                </div>
                <div className="capacity-track">
                  <span style={{ width: `${Math.min(100, (cls.booked / cls.capacity) * 100)}%` }} />
                </div>
                <Button
                  className="w-full"
                  variant={cls.my_status === 'confirmed' ? 'outline' : 'dark'}
                  busy={busy === cls.id}
                  disabled={
                    busy !== null ||
                    cls.booked >= cls.capacity ||
                    ['confirmed', 'attended'].includes(cls.my_status)
                  }
                  onClick={() => book(cls)}
                >
                  {['confirmed', 'attended'].includes(cls.my_status)
                    ? 'Đã đăng ký'
                    : cls.booked >= cls.capacity
                      ? 'Lớp đã đủ chỗ'
                      : 'Đặt chỗ ngay'}
                  <ArrowUpRight size={17} />
                </Button>
              </article>
            ))}
          </div>
        ) : (
          <Empty
            title="Chưa có lớp phù hợp"
            text="Thử thay đổi bộ lọc hoặc quay lại sau khi lịch mới được cập nhật."
          />
        )}
        <div className="info-banner">
          <Clock size={20} />
          <p>
            Có mặt trước 10 phút. Bạn cần gói tập còn hiệu lực vào ngày diễn ra lớp và có thể hủy
            đặt chỗ trước giờ bắt đầu.
          </p>
        </div>
      </section>
    </>
  )
}

export function Trainers() {
  const { data, loading, error, reload } = useResource('/trainers')
  return (
    <>
      <PageHero
        eyebrow="MEET YOUR TEAM"
        title={
          <>
            Bạn có mục tiêu.
            <br />
            <span className="text-lime">Chúng mình có mặt.</span>
          </>
        }
        text="Những người đồng hành giúp bạn hiểu chuyển động, xây thói quen và tự tin hơn trong từng buổi tập."
      />
      <section className="section container">
        {loading ? (
          <Loading />
        ) : error ? (
          <ErrorBox error={error} retry={reload} />
        ) : data.trainers.length ? (
          <div className="trainers-grid">
            {data.trainers.map((trainer) => (
              <article className="trainer-card" key={trainer.id}>
                <div className="trainer-photo">
                  <Photo src={trainer.image} alt={trainer.name} />
                  <span>{trainer.experience}+ NĂM KINH NGHIỆM</span>
                </div>
                <div className="trainer-info">
                  <div>
                    <h2>{trainer.name}</h2>
                    <p>{trainer.specialty}</p>
                  </div>
                </div>
                <p className="muted my-4 leading-relaxed">{trainer.bio}</p>
                <LinkButton to="/lien-he?topic=Huấn luyện cá nhân" variant="outline">
                  Đăng ký tư vấn PT
                </LinkButton>
              </article>
            ))}
          </div>
        ) : (
          <Empty title="Đội ngũ đang được cập nhật" />
        )}
      </section>
      <CTA />
    </>
  )
}

export function Blog() {
  const { data, loading, error, reload } = useResource('/posts')
  const [query, setQuery] = useState('')
  const posts =
    data?.posts.filter((p) =>
      `${p.title} ${p.category}`.toLowerCase().includes(query.toLowerCase()),
    ) || []
  return (
    <>
      <PageHero
        eyebrow="THE TN JOURNAL"
        title={
          <>
            Tập luyện. Thói quen.
            <br />
            <span className="text-lime">Và những điều nhỏ.</span>
          </>
        }
        text="Góc chia sẻ để hành trình tập luyện trở nên gần gũi và dễ bắt đầu hơn."
      />
      <section className="section container">
        <label className="search-field max-w-md mb-8">
          <Search size={18} />
          <input
            placeholder="Tìm bài viết…"
            aria-label="Tìm bài viết"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        {loading ? (
          <Loading />
        ) : error ? (
          <ErrorBox error={error} retry={reload} />
        ) : posts.length ? (
          <div className="blog-grid">
            {posts.map((post) => (
              <Link className="post-card" to={`/bai-viet/${post.id}`} key={post.id}>
                <Photo src={post.image} alt={post.title} />
                <div className="post-meta">
                  <span>{post.category}</span>
                  <time>{dateLabel(post.created_at)}</time>
                </div>
                <h2>{post.title}</h2>
                <p>{post.excerpt}</p>
                <span className="text-link">
                  Đọc bài viết <ArrowUpRight size={17} />
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <Empty title="Không tìm thấy bài viết" />
        )}
      </section>
    </>
  )
}

export function Post() {
  const { id } = useParams()
  const { data, loading, error, reload } = useResource(`/posts/${id}`)
  if (loading) return <Loading />
  if (error) return <ErrorBox error={error} retry={reload} />
  const post = data.post
  return (
    <article className="article container">
      <Link className="text-link" to="/bai-viet">
        ← Góc chia sẻ
      </Link>
      <p className="eyebrow mt-10">
        {post.category} · {dateLabel(post.created_at)}
      </p>
      <h1>{post.title}</h1>
      <p className="article-intro">{post.excerpt}</p>
      <Photo src={post.image} alt={post.title} />
      <div className="article-body">
        {post.content
          .split('\n')
          .filter(Boolean)
          .map((paragraph, i) => (
            <p key={i}>{paragraph}</p>
          ))}
      </div>
      <LinkButton to="/lich-tap" variant="dark">
        Tìm buổi tập tiếp theo
      </LinkButton>
    </article>
  )
}

export function Contact() {
  const [params] = useSearchParams()
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const { user } = useAuth()
  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    const body = Object.fromEntries(new FormData(event.currentTarget))
    try {
      await api('/contacts', { method: 'POST', body })
      setSent(true)
    } catch (error) {
      setError(error.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <PageHero
        eyebrow="SAY HELLO TO YOUR NEXT CHAPTER"
        title={
          <>
            Bắt đầu bằng
            <br />
            <span className="text-lime">một lời chào.</span>
          </>
        }
        text="Cần tư vấn gói tập, huấn luyện cá nhân hay muốn tham quan? Để lại thông tin, chúng mình sẽ kết nối với bạn."
      />
      <section className="section container contact-grid">
        <div>
          <p className="eyebrow">HẸN GẶP TẠI GYM TN</p>
          <h2 className="text-3xl font-bold mb-8">
            Một không gian.
            <br />
            Nhiều khởi đầu mới.
          </h2>
          <div className="contact-details">
            <p>
              <MapPin />
              <span>
                <strong>Địa chỉ minh họa</strong>123 Đường Thể Thao, TP. Thái Nguyên
              </span>
            </p>
            <p>
              <Phone />
              <span>
                <strong>Điện thoại demo</strong>
                <a href="tel:0901234567">0901 234 567</a>
              </span>
            </p>
            <p>
              <Mail />
              <span>
                <strong>Email demo</strong>hello@gymtn.vn
              </span>
            </p>
            <p>
              <Clock />
              <span>
                <strong>Giờ mở cửa</strong>Thứ 2 – Chủ nhật · 05:00 – 22:00
              </span>
            </p>
          </div>
          <Photo src="/images/gym.jpg" alt="Không gian phòng tập" className="contact-photo" />
        </div>
        <div className="panel contact-form">
          {sent ? (
            <div className="state-box">
              <span className="success-icon">
                <Check size={32} />
              </span>
              <h2>Đã nhận lời nhắn của bạn!</h2>
              <p className="muted">
                Yêu cầu đã được lưu. Đội ngũ Gym TN có thể xem và xử lý trong trang quản trị.
              </p>
              <Button variant="outline" onClick={() => setSent(false)}>
                Gửi yêu cầu khác
              </Button>
            </div>
          ) : (
            <form onSubmit={submit} className="form-stack">
              <h2>Chúng mình có thể giúp gì?</h2>
              <p className="muted">Điền thông tin bên dưới để được tư vấn.</p>
              <Field
                label="Họ và tên"
                name="name"
                required
                minLength={2}
                maxLength={80}
                defaultValue={user?.name || ''}
                placeholder="Tên của bạn"
                autoComplete="name"
              />
              <div className="form-row">
                <Field
                  label="Email"
                  name="email"
                  type="email"
                  required
                  maxLength={254}
                  defaultValue={user?.email || ''}
                  placeholder="ban@email.com"
                  autoComplete="email"
                />
                <Field
                  label="Số điện thoại"
                  name="phone"
                  type="tel"
                  maxLength={20}
                  defaultValue={user?.phone || ''}
                  placeholder="09xx xxx xxx"
                  autoComplete="tel"
                />
              </div>
              <Field
                label="Bạn quan tâm đến"
                name="topic"
                as="select"
                defaultValue={params.get('topic') || 'Tư vấn gói tập'}
              >
                {[
                  'Tư vấn gói tập',
                  'Huấn luyện cá nhân',
                  'Tham quan phòng tập',
                  'Hỗ trợ tài khoản',
                  'Góp ý',
                ].map((topic) => (
                  <option key={topic}>{topic}</option>
                ))}
              </Field>
              <Field
                label="Lời nhắn"
                name="message"
                as="textarea"
                rows={5}
                required
                minLength={10}
                maxLength={3000}
                placeholder="Chia sẻ mục tiêu hoặc điều bạn cần hỗ trợ…"
              />
              <label className="checkbox-label">
                <input type="checkbox" required />
                Tôi đồng ý để Gym TN sử dụng thông tin trên để liên hệ tư vấn.
              </label>
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
              <Button type="submit" busy={busy}>
                Gửi lời nhắn <ArrowUpRight size={18} />
              </Button>
            </form>
          )}
        </div>
      </section>
    </>
  )
}

export function Policy() {
  return (
    <>
      <PageHero
        eyebrow="MINH BẠCH TỪ ĐẦU"
        title="Điều khoản & bảo mật"
        text="Thông tin áp dụng cho phiên bản demo Gym TN."
      />
      <article className="article container article-body">
        <h2>Tài khoản và thông tin cá nhân</h2>
        <p>
          Website lưu họ tên, email, số điện thoại, mật khẩu đã băm, lịch đặt lớp, đơn hàng, nhật ký
          tập và chỉ số do bạn nhập. Dữ liệu được sử dụng để vận hành tài khoản và phục vụ các yêu
          cầu của bạn. Quản trị viên có thể xem tài khoản, đơn hàng, lịch lớp và lời nhắn tư vấn.
          Huấn luyện viên được xem họ tên, email, số điện thoại và điểm danh của hội viên đăng ký
          các lớp họ được phân công.
        </p>
        <h2>Đăng ký gói và đặt lớp</h2>
        <p>
          Đơn tại quầy chỉ được kích hoạt sau khi quản trị viên xác nhận. Thanh toán mô phỏng phục
          vụ kiểm thử, không thu tiền thật. Gói gia hạn được nối tiếp thời hạn đã có. Bạn cần gói có
          hiệu lực tại thời điểm lớp diễn ra và không được đặt lớp trùng giờ. Có thể hủy đặt chỗ
          trước giờ bắt đầu.
        </p>
        <h2>Cookie phiên đăng nhập</h2>
        <p>
          Website dùng cookie cần thiết để duy trì đăng nhập và bảo vệ các yêu cầu thay đổi dữ liệu.
          Bạn có thể đăng xuất để kết thúc phiên trên trình duyệt hiện tại; đổi mật khẩu sẽ vô hiệu
          hóa các phiên đăng nhập khác.
        </p>
        <h2>Chỉnh sửa và yêu cầu hỗ trợ</h2>
        <p>
          Bạn có thể sửa họ tên, điện thoại, đổi mật khẩu và xóa nhật ký hoặc chỉ số đã ghi trong
          trang hội viên. Các yêu cầu khác về dữ liệu có thể gửi qua biểu mẫu liên hệ. Phiên bản
          demo chưa cung cấp tự động xóa toàn bộ tài khoản, gửi email hoặc khôi phục mật khẩu.
        </p>
        <h2>Phạm vi bản demo</h2>
        <p>
          Thông tin phòng tập, huấn luyện viên và dữ liệu mẫu chỉ để minh họa. Ảnh lấy từ Unsplash
          không xác nhận danh tính hay liên hệ thực tế với Gym TN. Các chỉ số cơ thể chỉ được ghi
          nhận theo dữ liệu người dùng nhập.
        </p>
        <LinkButton to="/lien-he" variant="dark">
          Liên hệ hỗ trợ
        </LinkButton>
      </article>
    </>
  )
}
