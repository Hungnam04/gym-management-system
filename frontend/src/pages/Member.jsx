import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Activity,
  CalendarDays,
  CreditCard,
  Dumbbell,
  LayoutDashboard,
  UserRound,
  ArrowUpRight,
  Clock,
  Trash2,
  Download,
  Scale,
  Check,
} from 'lucide-react'
import { api, money, dateLabel, timeLabel, today } from '../api'
import { useAuth, useResource, useToast } from '../context'
import {
  Badge,
  Button,
  Empty,
  ErrorBox,
  Field,
  LinkButton,
  Loading,
  Modal,
  Stat,
} from '../components/UI'

const tabs = [
  ['overview', 'Tổng quan', LayoutDashboard],
  ['bookings', 'Lịch đã đặt', CalendarDays],
  ['orders', 'Gói tập & đơn hàng', CreditCard],
  ['workouts', 'Nhật ký tập', Dumbbell],
  ['progress', 'Chỉ số cơ thể', Activity],
  ['profile', 'Hồ sơ cá nhân', UserRound],
]

export default function Member() {
  const { user, refresh, demoPayments } = useAuth()
  const { data, loading, error, reload } = useResource('/me/dashboard')
  const notify = useToast()
  const [params, setParams] = useSearchParams()
  const tab = tabs.some(([key]) => key === params.get('tab')) ? params.get('tab') : 'overview'
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(null)
  const [receipt, setReceipt] = useState(null)
  const act = async (path, method = 'POST', body, success) => {
    setBusy(true)
    try {
      const result = await api(path, { method, body })
      notify(success || result.message)
      reload()
      setConfirm(null)
      return true
    } catch (error) {
      setConfirm((previous) => (previous ? { ...previous, error: error.message } : previous))
      notify(error.message, 'error')
      return false
    } finally {
      setBusy(false)
    }
  }
  const submitLog = (resource, numericFields) => async (event) => {
    event.preventDefault()
    const form = event.currentTarget
    const body = Object.fromEntries(new FormData(form))
    numericFields.forEach((key) => {
      body[key] = Number(body[key])
    })
    if (await act(`/me/${resource}`, 'POST', body)) form.reset()
  }
  const profileSubmit = async (event) => {
    event.preventDefault()
    const body = Object.fromEntries(new FormData(event.currentTarget))
    if (await act('/me', 'PUT', body))
      await refresh().catch((error) => notify(error.message, 'error'))
  }
  const passwordSubmit = async (event) => {
    event.preventDefault()
    const form = event.currentTarget
    const body = Object.fromEntries(new FormData(form))
    if (body.new_password !== body.confirm_password)
      return notify('Mật khẩu xác nhận chưa khớp.', 'error')
    if (await act('/me/password', 'PUT', body)) form.reset()
  }
  const activeMembership = data?.memberships.find(
    (m) => new Date(m.starts_at) <= new Date() && new Date(m.ends_at) > new Date(),
  )
  const upcoming =
    data?.bookings.filter(
      (b) =>
        b.status === 'confirmed' &&
        b.class_status === 'scheduled' &&
        new Date(b.starts_at) > new Date(),
    ) || []
  const latest = data?.progress.at(-1)
  const totalMinutes = data?.workouts.reduce((sum, item) => sum + item.duration_minutes, 0) || 0
  const ask = (title, text, path, method = 'POST', body) =>
    setConfirm({ title, text, path, method, body })
  return (
    <div className="workspace">
      <div className="container workspace-grid">
        <aside className="workspace-sidebar">
          <p className="eyebrow">MY GYM TN</p>
          <div className="member-avatar">{user.name.slice(0, 1).toUpperCase()}</div>
          <h2>{user.name}</h2>
          <p className="muted text-sm break-all">{user.email}</p>
          <nav aria-label="Trang hội viên">
            {tabs.map(([key, label, Icon]) => (
              <button
                className={tab === key ? 'active' : ''}
                key={key}
                onClick={() => setParams({ tab: key })}
              >
                <Icon size={18} />
                {label}
              </button>
            ))}
          </nav>
          {user.role === 'admin' && (
            <Link to="/quan-tri" className="text-link">
              Trang quản trị <ArrowUpRight size={16} />
            </Link>
          )}
        </aside>
        <div className="workspace-content">
          <div className="workspace-heading">
            <div>
              <p className="eyebrow">YOUR PERSONAL SPACE</p>
              <h1>
                {tab === 'overview'
                  ? `Chào ${user.name.split(' ').at(-1)}, sẵn sàng tập chứ?`
                  : tabs.find(([key]) => key === tab)[1]}
              </h1>
            </div>
            <LinkButton to="/lich-tap" variant="dark">
              Đặt lịch tập
            </LinkButton>
          </div>
          {loading && !data ? (
            <Loading />
          ) : error ? (
            <ErrorBox error={error} retry={reload} />
          ) : (
            data && (
              <>
                {tab === 'overview' && (
                  <>
                    <div className="stats-grid">
                      <Stat
                        icon={CreditCard}
                        label="Gói tập hiện tại"
                        value={activeMembership?.plan_name || 'Chưa có gói'}
                        detail={
                          activeMembership
                            ? `Hết hạn ${dateLabel(activeMembership.ends_at)}`
                            : 'Khám phá gói phù hợp với bạn'
                        }
                      />
                      <Stat
                        icon={CalendarDays}
                        label="Lớp sắp tham gia"
                        value={upcoming.length}
                        detail="Lịch đặt đã được xác nhận"
                      />
                      <Stat
                        icon={Dumbbell}
                        label="Buổi tập đã ghi"
                        value={data.workouts.length}
                        detail={`${totalMinutes} phút tập luyện`}
                      />
                      <Stat
                        icon={Scale}
                        label="Cân nặng gần nhất"
                        value={latest ? `${latest.weight} kg` : '—'}
                        detail={
                          latest ? dateLabel(latest.recorded_on) : 'Bắt đầu ghi chỉ số của bạn'
                        }
                      />
                    </div>
                    <div className="member-welcome">
                      <div>
                        <p className="eyebrow">KEEP SHOWING UP</p>
                        <h2>Mỗi buổi tập đều có ý nghĩa.</h2>
                        <p>Giữ nhịp của bạn. Chúng mình sẽ gặp bạn ở buổi tiếp theo.</p>
                        <LinkButton to="/lich-tap">Tìm lớp phù hợp</LinkButton>
                      </div>
                      <Dumbbell size={120} strokeWidth={1} />
                    </div>
                    <div className="panel">
                      <div className="panel-heading">
                        <h2>Lịch hẹn tiếp theo</h2>
                        <button
                          className="text-link"
                          onClick={() => setParams({ tab: 'bookings' })}
                        >
                          Xem tất cả <ArrowUpRight size={16} />
                        </button>
                      </div>
                      {upcoming.length ? (
                        upcoming
                          .slice()
                          .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
                          .slice(0, 3)
                          .map((b) => (
                            <div className="booking-row" key={b.id}>
                              <div className="date-square">
                                <strong>{b.starts_at.slice(8, 10)}</strong>
                                <span>THÁNG {b.starts_at.slice(5, 7)}</span>
                              </div>
                              <div>
                                <h3>{b.title}</h3>
                                <p className="muted text-sm">
                                  {timeLabel(b.starts_at)} · {b.duration_minutes} phút ·{' '}
                                  {b.trainer_name}
                                </p>
                              </div>
                              <Badge status="confirmed" />
                            </div>
                          ))
                      ) : (
                        <Empty
                          title="Một lịch hẹn mới đang chờ bạn"
                          text="Đặt một lớp để có thêm động lực đến phòng tập."
                          to="/lich-tap"
                          action="Khám phá lịch tập"
                        />
                      )}
                    </div>
                  </>
                )}
                {tab === 'bookings' && (
                  <div className="panel">
                    <h2 className="mb-5">Lịch tập của bạn</h2>
                    {data.bookings.length ? (
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>Lớp tập</th>
                              <th>Thời gian</th>
                              <th>Phòng</th>
                              <th>Trạng thái</th>
                              <th>Thao tác</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.bookings.map((b) => (
                              <tr key={b.id}>
                                <td>
                                  <strong>{b.title}</strong>
                                  <small>{b.trainer_name}</small>
                                </td>
                                <td>
                                  {dateLabel(b.starts_at)}
                                  <small>
                                    {timeLabel(b.starts_at)} · {b.duration_minutes} phút
                                  </small>
                                </td>
                                <td>{b.room}</td>
                                <td>
                                  <Badge status={b.status} />
                                </td>
                                <td>
                                  {b.status === 'confirmed' &&
                                    new Date(b.starts_at) > new Date() && (
                                      <Button
                                        variant="danger"
                                        onClick={() =>
                                          ask(
                                            'Hủy đặt lớp?',
                                            `${b.title} · ${timeLabel(b.starts_at)} ngày ${dateLabel(b.starts_at)}. Chỗ của bạn sẽ được trả lại cho lớp.`,
                                            `/bookings/${b.id}/cancel`,
                                          )
                                        }
                                      >
                                        Hủy lịch
                                      </Button>
                                    )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <Empty title="Bạn chưa đặt lớp nào" to="/lich-tap" />
                    )}
                  </div>
                )}
                {tab === 'orders' && (
                  <>
                    <div className="panel">
                      <div className="panel-heading">
                        <h2>Thẻ hội viên</h2>
                        <Link to="/goi-tap" className="text-link">
                          Mua / gia hạn <ArrowUpRight size={16} />
                        </Link>
                      </div>
                      {data.memberships.length ? (
                        <div className="membership-grid">
                          {data.memberships.map((m) => (
                            <div className="membership-card" key={m.id}>
                              <Dumbbell />
                              <p>GYM TN · MEMBERSHIP</p>
                              <h3>{m.plan_name}</h3>
                              <span>
                                {dateLabel(m.starts_at)} → {dateLabel(m.ends_at)}
                              </span>
                              <small>
                                {new Date(m.ends_at) <= new Date()
                                  ? 'Đã hết hạn'
                                  : new Date(m.starts_at) > new Date()
                                    ? 'Gói kế tiếp'
                                    : 'Đang có hiệu lực'}
                              </small>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <Empty
                          title="Chưa có gói tập"
                          text="Gói được kích hoạt sau khi thanh toán được xác nhận."
                          to="/goi-tap"
                        />
                      )}
                    </div>
                    <div className="panel">
                      <h2 className="mb-5">Lịch sử đơn hàng</h2>
                      {data.orders.length ? (
                        <div className="table-wrap">
                          <table>
                            <thead>
                              <tr>
                                <th>Đơn hàng</th>
                                <th>Gói tập</th>
                                <th>Tổng tiền</th>
                                <th>Trạng thái</th>
                                <th>Thao tác</th>
                              </tr>
                            </thead>
                            <tbody>
                              {data.orders.map((o) => (
                                <tr key={o.id}>
                                  <td>
                                    <strong>#TN{String(o.id).padStart(5, '0')}</strong>
                                    <small>{dateLabel(o.created_at)}</small>
                                  </td>
                                  <td>
                                    {o.plan_name}
                                    <small>
                                      {o.duration_days} ngày ·{' '}
                                      {o.payment_method === 'demo' ? 'Mô phỏng' : 'Tại quầy'}
                                    </small>
                                  </td>
                                  <td>{money(o.amount)}</td>
                                  <td>
                                    <Badge status={o.status} />
                                  </td>
                                  <td>
                                    <div className="table-actions">
                                      {o.status === 'pending' && (
                                        <>
                                          {o.payment_method === 'demo' && demoPayments && (
                                            <Button
                                              variant="dark"
                                              onClick={() =>
                                                ask(
                                                  'Xác nhận thanh toán mô phỏng?',
                                                  `Đơn #${o.id}: ${money(o.amount)}. Không thu tiền thật. Gói tập sẽ được kích hoạt sau khi xác nhận.`,
                                                  `/orders/${o.id}/pay-demo`,
                                                )
                                              }
                                            >
                                              Mô phỏng trả tiền
                                            </Button>
                                          )}
                                          <Button
                                            variant="danger"
                                            onClick={() =>
                                              ask(
                                                'Hủy đơn hàng?',
                                                `Hủy đơn #${o.id} — ${o.plan_name}. Bạn có thể đăng ký lại gói tập bất cứ lúc nào.`,
                                                `/orders/${o.id}/cancel`,
                                              )
                                            }
                                          >
                                            Hủy
                                          </Button>
                                        </>
                                      )}
                                      <button
                                        className="icon-button"
                                        onClick={() => setReceipt(o)}
                                        aria-label={`Xem phiếu đơn ${o.id}`}
                                        title="Xem phiếu đơn hàng"
                                      >
                                        <Download size={17} />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <Empty title="Chưa có đơn hàng" />
                      )}
                    </div>
                  </>
                )}
                {tab === 'workouts' && (
                  <>
                    <div className="panel">
                      <h2 className="mb-5">Ghi lại buổi tập</h2>
                      <form
                        onSubmit={submitLog('workouts', ['duration_minutes'])}
                        className="form-stack"
                      >
                        <div className="form-row">
                          <Field
                            label="Tên buổi tập"
                            name="title"
                            required
                            minLength={2}
                            maxLength={100}
                            placeholder="Ví dụ: Upper body / Cardio"
                          />
                          <Field
                            label="Ngày tập"
                            name="recorded_on"
                            type="date"
                            required
                            min="2000-01-01"
                            max={today()}
                            defaultValue={today()}
                          />
                          <Field
                            label="Thời lượng (phút)"
                            name="duration_minutes"
                            type="number"
                            required
                            min={1}
                            max={600}
                            defaultValue={60}
                          />
                        </div>
                        <Field
                          label="Ghi chú bài tập"
                          name="note"
                          as="textarea"
                          rows={3}
                          maxLength={1000}
                          placeholder="Bài tập, số hiệp, mức tạ và cảm nhận…"
                        />
                        <Button type="submit" busy={busy}>
                          Lưu buổi tập <Check size={17} />
                        </Button>
                      </form>
                    </div>
                    <div className="panel">
                      <h2 className="mb-5">Hành trình đã ghi</h2>
                      {data.workouts.length ? (
                        data.workouts.map((w) => (
                          <div className="workout-row" key={w.id}>
                            <div className="workout-icon">
                              <Dumbbell />
                            </div>
                            <div className="flex-1">
                              <h3>{w.title}</h3>
                              <p className="muted text-sm">
                                {dateLabel(w.recorded_on)} · {w.duration_minutes} phút
                              </p>
                              {w.note && (
                                <p className="text-sm mt-2 whitespace-pre-wrap">{w.note}</p>
                              )}
                            </div>
                            <button
                              className="icon-button danger-text"
                              onClick={() =>
                                ask('Xóa buổi tập?', w.title, `/me/workouts/${w.id}`, 'DELETE')
                              }
                              aria-label={`Xóa ${w.title}`}
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        ))
                      ) : (
                        <Empty title="Bắt đầu từ buổi tập đầu tiên" />
                      )}
                    </div>
                  </>
                )}
                {tab === 'progress' && (
                  <>
                    <div className="panel">
                      <h2 className="mb-2">Ghi nhận chỉ số</h2>
                      <p className="muted text-sm mb-5">
                        Mỗi ngày có một bản ghi. Lưu lại cùng ngày sẽ cập nhật số liệu trước đó.
                      </p>
                      <form
                        onSubmit={submitLog('progress', ['weight', 'height'])}
                        className="form-stack"
                      >
                        <div className="form-row">
                          <Field
                            label="Ngày ghi nhận"
                            name="recorded_on"
                            type="date"
                            required
                            min="2000-01-01"
                            max={today()}
                            defaultValue={today()}
                          />
                          <Field
                            label="Cân nặng (kg)"
                            name="weight"
                            type="number"
                            required
                            min={20}
                            max={350}
                            step="0.1"
                            placeholder="65.0"
                          />
                          <Field
                            label="Chiều cao (cm)"
                            name="height"
                            type="number"
                            required
                            min={80}
                            max={250}
                            step="0.1"
                            defaultValue={latest?.height || ''}
                            placeholder="170"
                          />
                        </div>
                        <Field
                          label="Ghi chú"
                          name="note"
                          maxLength={500}
                          placeholder="Cảm nhận hôm nay…"
                        />
                        <Button busy={busy} type="submit">
                          Lưu chỉ số <Check size={17} />
                        </Button>
                      </form>
                    </div>
                    <div className="panel">
                      <h2 className="mb-5">Cân nặng qua các lần ghi</h2>
                      {data.progress.length ? (
                        <>
                          <div
                            className="weight-chart"
                            role="img"
                            aria-label="Biểu đồ cân nặng; số liệu chi tiết trong bảng bên dưới"
                          >
                            {data.progress.slice(-12).map((p) => (
                              <div key={p.id}>
                                <strong>
                                  {p.weight} <small>kg</small>
                                </strong>
                                <span
                                  style={{
                                    height: `${(p.weight / Math.max(...data.progress.map((item) => item.weight))) * 130}px`,
                                  }}
                                />
                                <small>{dateLabel(p.recorded_on).slice(0, 5)}</small>
                              </div>
                            ))}
                          </div>
                          <div className="table-wrap">
                            <table>
                              <thead>
                                <tr>
                                  <th>Ngày</th>
                                  <th>Cân nặng</th>
                                  <th>Chiều cao</th>
                                  <th>BMI tham khảo</th>
                                  <th>Ghi chú</th>
                                  <th />
                                </tr>
                              </thead>
                              <tbody>
                                {data.progress
                                  .slice()
                                  .reverse()
                                  .map((p) => (
                                    <tr key={p.id}>
                                      <td>{dateLabel(p.recorded_on)}</td>
                                      <td>{p.weight} kg</td>
                                      <td>{p.height} cm</td>
                                      <td>{(p.weight / (p.height / 100) ** 2).toFixed(1)}</td>
                                      <td>{p.note || '—'}</td>
                                      <td>
                                        <button
                                          className="icon-button danger-text"
                                          aria-label={`Xóa chỉ số ngày ${dateLabel(p.recorded_on)}`}
                                          onClick={() =>
                                            ask(
                                              'Xóa bản ghi chỉ số?',
                                              dateLabel(p.recorded_on),
                                              `/me/progress/${p.id}`,
                                              'DELETE',
                                            )
                                          }
                                        >
                                          <Trash2 size={17} />
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                              </tbody>
                            </table>
                          </div>
                          <p className="muted text-xs mt-4">
                            BMI = cân nặng (kg) / chiều cao (m)². Giá trị tính từ số liệu bạn nhập,
                            không phải kết luận sức khỏe.
                          </p>
                        </>
                      ) : (
                        <Empty
                          title="Chưa có chỉ số nào"
                          text="Lưu lần đo đầu tiên để bắt đầu theo dõi."
                        />
                      )}
                    </div>
                  </>
                )}
                {tab === 'profile' && (
                  <div className="profile-grid">
                    <div className="panel">
                      <h2 className="mb-5">Thông tin cá nhân</h2>
                      <form onSubmit={profileSubmit} className="form-stack">
                        <Field
                          label="Họ và tên"
                          name="name"
                          required
                          minLength={2}
                          maxLength={80}
                          defaultValue={user.name}
                        />
                        <Field label="Email" value={user.email} disabled />
                        <Field
                          label="Điện thoại"
                          name="phone"
                          type="tel"
                          maxLength={20}
                          defaultValue={user.phone}
                        />
                        <Button type="submit" busy={busy}>
                          Lưu thay đổi
                        </Button>
                      </form>
                    </div>
                    <div className="panel">
                      <h2 className="mb-5">Đổi mật khẩu</h2>
                      <form onSubmit={passwordSubmit} className="form-stack">
                        <Field
                          label="Mật khẩu hiện tại"
                          name="current_password"
                          type="password"
                          required
                          maxLength={128}
                          autoComplete="current-password"
                        />
                        <Field
                          label="Mật khẩu mới"
                          name="new_password"
                          type="password"
                          required
                          minLength={8}
                          maxLength={128}
                          autoComplete="new-password"
                        />
                        <Field
                          label="Xác nhận mật khẩu mới"
                          name="confirm_password"
                          type="password"
                          required
                          minLength={8}
                          maxLength={128}
                          autoComplete="new-password"
                        />
                        <p className="muted text-sm">
                          Ít nhất 8 ký tự. Đổi mật khẩu sẽ đăng xuất các phiên khác.
                        </p>
                        <Button type="submit" variant="dark" busy={busy}>
                          Đổi mật khẩu
                        </Button>
                      </form>
                    </div>
                  </div>
                )}
              </>
            )
          )}
        </div>
      </div>
      {confirm && (
        <Modal
          title={confirm.title}
          onClose={() => {
            if (!busy) setConfirm(null)
          }}
        >
          <p className="muted mb-6">{confirm.text}</p>
          {confirm.error && (
            <p className="form-error mb-5" role="alert">
              {confirm.error}
            </p>
          )}
          <div className="flex gap-3 justify-end">
            <Button variant="outline" disabled={busy} onClick={() => setConfirm(null)}>
              Quay lại
            </Button>
            <Button busy={busy} onClick={() => act(confirm.path, confirm.method, confirm.body)}>
              Xác nhận
            </Button>
          </div>
        </Modal>
      )}
      {receipt && (
        <Modal title="Phiếu đơn hàng Gym TN" onClose={() => setReceipt(null)}>
          <div className="receipt">
            <p className="eyebrow">GYM TN · FITNESS & LIFESTYLE</p>
            <h3>#TN{String(receipt.id).padStart(5, '0')}</h3>
            <p>
              {user.name} · {user.email}
            </p>
            <dl>
              <div>
                <dt>Gói tập</dt>
                <dd>{receipt.plan_name}</dd>
              </div>
              <div>
                <dt>Thời hạn</dt>
                <dd>{receipt.duration_days} ngày</dd>
              </div>
              <div>
                <dt>Ngày tạo</dt>
                <dd>{dateLabel(receipt.created_at)}</dd>
              </div>
              <div>
                <dt>Phương thức</dt>
                <dd>{receipt.payment_method === 'demo' ? 'Mô phỏng' : 'Tại quầy'}</dd>
              </div>
              <div>
                <dt>Trạng thái</dt>
                <dd>
                  <Badge status={receipt.status} />
                </dd>
              </div>
              <div>
                <dt>Tổng cộng</dt>
                <dd>
                  <strong>{money(receipt.amount)}</strong>
                </dd>
              </div>
            </dl>
            <p className="muted text-xs">
              Phiếu thông tin đơn hàng, không phải hóa đơn thuế.
              {receipt.payment_method === 'demo' && ' Thanh toán mô phỏng không thu tiền thật.'}
            </p>
            <Button className="no-print mt-5" onClick={() => window.print()}>
              In / lưu PDF <Download size={17} />
            </Button>
          </div>
        </Modal>
      )}
    </div>
  )
}
