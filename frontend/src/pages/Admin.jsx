import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Activity,
  ArrowUpRight,
  CalendarDays,
  Check,
  CreditCard,
  Download,
  Edit3,
  Eye,
  LayoutDashboard,
  Mail,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UserRound,
  Users,
  FileText,
  Wallet,
} from 'lucide-react'
import { api, dateLabel, money, statusLabels, timeLabel } from '../api'
import { useResource, useToast } from '../context'
import { Badge, Button, Empty, ErrorBox, Field, Loading, Modal, Stat } from '../components/UI'
import ManagementShell from '../components/ManagementShell'
import AccountSettings from '../components/AccountSettings'
import Accounts from './Accounts'

const tabs = [
  ['overview', 'Tổng quan', LayoutDashboard],
  ['users', 'Quản lý tài khoản', Users],
  ['plans', 'Gói tập', CreditCard],
  ['trainers', 'Huấn luyện viên', UserRound],
  ['classes', 'Lịch lớp', CalendarDays],
  ['bookings', 'Đặt lịch & điểm danh', Check],
  ['orders', 'Đơn hàng', Wallet],
  ['posts', 'Bài viết', FileText],
  ['contacts', 'Yêu cầu tư vấn', Mail],
  ['account', 'Tài khoản của tôi', ShieldCheck],
]
const fields = {
  plans: [
    ['name', 'Tên gói', 'text', 2, 80],
    ['tagline', 'Mô tả ngắn', 'text', 2, 180],
    ['price', 'Giá (VNĐ)', 'number', 0, 100000000],
    ['duration_days', 'Thời hạn (ngày)', 'number', 1, 730],
    ['features', 'Quyền lợi — mỗi dòng một quyền lợi', 'textarea', 1, 2265],
    ['popular', 'Gói nổi bật', 'boolean'],
    ['active', 'Hiển thị', 'boolean'],
  ],
  trainers: [
    ['name', 'Họ và tên', 'text', 2, 80],
    ['specialty', 'Chuyên môn', 'text', 2, 100],
    ['experience', 'Số năm kinh nghiệm', 'number', 0, 60],
    ['image', 'URL ảnh HTTPS (không bắt buộc)', 'image'],
    ['bio', 'Giới thiệu', 'textarea', 10, 2000],
    ['active', 'Hiển thị', 'boolean'],
  ],
  classes: [
    ['title', 'Tên lớp', 'text', 2, 100],
    ['category', 'Bộ môn (Yoga, Strength, HIIT…)', 'text', 2, 60],
    ['trainer_id', 'Huấn luyện viên', 'trainer'],
    ['starts_at', 'Ngày giờ bắt đầu (giờ Việt Nam)', 'datetime-local'],
    ['duration_minutes', 'Thời lượng (phút)', 'number', 15, 240],
    ['capacity', 'Sức chứa', 'number', 1, 200],
    ['room', 'Phòng tập', 'text', 2, 80],
    ['level', 'Trình độ', 'text', 2, 80],
    ['description', 'Mô tả (không bắt buộc)', 'textarea', 0, 1000],
  ],
  posts: [
    ['title', 'Tiêu đề', 'text', 5, 180],
    ['category', 'Chuyên mục', 'text', 2, 60],
    ['image', 'URL ảnh HTTPS (không bắt buộc)', 'image'],
    ['excerpt', 'Tóm tắt', 'textarea', 10, 500],
    ['content', 'Nội dung — văn bản thuần, xuống dòng để chia đoạn', 'textarea', 20, 20000],
    ['published', 'Xuất bản', 'boolean'],
  ],
}

function downloadCSV(items, resource) {
  const columns =
    {
      users: ['id', 'name', 'email', 'phone', 'role', 'active', 'created_at'],
      orders: [
        'id',
        'user_name',
        'email',
        'plan_name',
        'amount',
        'payment_method',
        'status',
        'created_at',
        'paid_at',
      ],
      bookings: ['id', 'user_name', 'email', 'title', 'starts_at', 'status'],
      contacts: ['id', 'name', 'email', 'phone', 'topic', 'message', 'status', 'created_at'],
    }[resource] || Object.keys(items[0] || {})
  const encode = (value) => {
    let cell = Array.isArray(value) ? value.join(' | ') : String(value ?? '')
    if (/^[\s]*[=+@-]/.test(cell)) cell = `'${cell}`
    return `"${cell.replaceAll('"', '""')}"`
  }
  const content = [columns, ...items.map((item) => columns.map((key) => item[key]))]
    .map((row) => row.map(encode).join(','))
    .join('\r\n')
  const url = URL.createObjectURL(
    new Blob(['\uFEFF', content], { type: 'text/csv;charset=utf-8;' }),
  )
  const link = document.createElement('a')
  link.href = url
  link.download = `gym-tn-${resource}.csv`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function Editor({ resource, item, trainers, onSave, busy, failure }) {
  const submit = (event) => {
    event.preventDefault()
    const body = Object.fromEntries(new FormData(event.currentTarget))
    for (const [key, , type] of fields[resource]) {
      if (['number', 'boolean', 'trainer'].includes(type)) body[key] = Number(body[key])
    }
    if (resource === 'plans')
      body.features = body.features
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
    if (resource === 'classes') body.starts_at = `${body.starts_at}:00+07:00`
    onSave(body)
  }
  return (
    <form className="form-stack" onSubmit={submit}>
      {fields[resource].map(([key, label, type, min, max]) => {
        let value = item?.[key] ?? (type === 'boolean' ? (key === 'popular' ? 0 : 1) : '')
        if (key === 'features') value = Array.isArray(value) ? value.join('\n') : value
        if (type === 'datetime-local') value = value.slice(0, 16)
        if (type === 'boolean')
          return (
            <Field key={key} label={label} name={key} as="select" defaultValue={value}>
              <option value="1">Có</option>
              <option value="0">Không</option>
            </Field>
          )
        if (type === 'trainer')
          return (
            <Field key={key} label={label} name={key} as="select" required defaultValue={value}>
              <option value="" disabled>
                Chọn huấn luyện viên
              </option>
              {trainers
                .filter((t) => t.active)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
            </Field>
          )
        return (
          <Field
            key={key}
            label={label}
            name={key}
            type={type === 'image' ? 'text' : type}
            as={type === 'textarea' ? 'textarea' : 'input'}
            rows={key === 'content' ? 10 : 3}
            required={type === 'number' || (type !== 'image' && min !== 0)}
            min={type === 'number' ? min : undefined}
            max={type === 'number' ? max : undefined}
            minLength={['text', 'textarea'].includes(type) ? min : undefined}
            maxLength={
              type === 'image' ? 500 : ['text', 'textarea'].includes(type) ? max : undefined
            }
            defaultValue={value}
          />
        )
      })}
      {resource === 'classes' && (
        <p className="muted text-sm">
          Lớp đã có người đặt không được thay đổi giờ hoặc huấn luyện viên. Hãy hủy lớp cũ và tạo
          lớp mới nếu cần.
        </p>
      )}
      {failure && (
        <p className="form-error" role="alert">
          {failure}
        </p>
      )}
      <Button type="submit" busy={busy}>
        Lưu thông tin <Check size={17} />
      </Button>
    </form>
  )
}

function ResourceTable({ resource, items, edit, remove, confirm, detail }) {
  if (!items.length) return <Empty title="Chưa có dữ liệu phù hợp" />
  const headers = {
    plans: ['Gói tập', 'Giá', 'Thời hạn', 'Hiển thị', 'Thao tác'],
    trainers: ['Huấn luyện viên', 'Chuyên môn', 'Kinh nghiệm', 'Hiển thị', 'Thao tác'],
    classes: ['Lớp tập', 'Thời gian', 'Số chỗ', 'Trạng thái', 'Thao tác'],
    posts: ['Bài viết', 'Chuyên mục', 'Ngày đăng', 'Xuất bản', 'Thao tác'],
    users: ['Tài khoản', 'Liên hệ', 'Vai trò', 'Trạng thái', 'Thao tác'],
    orders: ['Đơn / hội viên', 'Gói tập', 'Tổng tiền', 'Trạng thái', 'Thao tác'],
    bookings: ['Hội viên', 'Lớp tập', 'Thời gian', 'Trạng thái', 'Thao tác'],
    contacts: ['Người gửi', 'Chủ đề', 'Ngày gửi', 'Trạng thái', 'Thao tác'],
  }[resource]
  const crud = ['plans', 'trainers', 'classes', 'posts'].includes(resource)
  const visibility = (active) => (
    <Badge status={active ? 'confirmed' : 'cancelled'}>{active ? 'Đang hiển thị' : 'Đã ẩn'}</Badge>
  )
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              {resource === 'plans' && (
                <>
                  <td>
                    <strong>{item.name}</strong>
                    <small>{item.tagline}</small>
                  </td>
                  <td>{money(item.price)}</td>
                  <td>{item.duration_days} ngày</td>
                  <td>{visibility(item.active)}</td>
                </>
              )}
              {resource === 'trainers' && (
                <>
                  <td>
                    <strong>{item.name}</strong>
                    <small>{item.account_email || 'Chưa có tài khoản đăng nhập'}</small>
                  </td>
                  <td>{item.specialty}</td>
                  <td>{item.experience} năm</td>
                  <td>{visibility(item.active)}</td>
                </>
              )}
              {resource === 'classes' && (
                <>
                  <td>
                    <strong>{item.title}</strong>
                    <small>
                      {item.trainer_name} · {item.room}
                    </small>
                  </td>
                  <td>
                    {dateLabel(item.starts_at)}
                    <small>
                      {timeLabel(item.starts_at)} · {item.duration_minutes} phút
                    </small>
                  </td>
                  <td>
                    {item.booked}/{item.capacity}
                  </td>
                  <td>
                    <Badge status={item.status} />
                  </td>
                </>
              )}
              {resource === 'posts' && (
                <>
                  <td>
                    <strong>{item.title}</strong>
                  </td>
                  <td>{item.category}</td>
                  <td>{dateLabel(item.created_at)}</td>
                  <td>{visibility(item.published)}</td>
                </>
              )}
              {resource === 'users' && (
                <>
                  <td>
                    <strong>{item.name}</strong>
                    <small>
                      #{item.id} · {dateLabel(item.created_at)}
                    </small>
                  </td>
                  <td>
                    {item.email}
                    <small>{item.phone || 'Chưa có điện thoại'}</small>
                  </td>
                  <td>{item.role === 'admin' ? 'Quản trị viên' : 'Hội viên'}</td>
                  <td>
                    <Badge status={item.active ? 'confirmed' : 'cancelled'}>
                      {item.active ? 'Hoạt động' : 'Đã khóa'}
                    </Badge>
                  </td>
                </>
              )}
              {resource === 'orders' && (
                <>
                  <td>
                    <strong>
                      #{item.id} · {item.user_name}
                    </strong>
                    <small>{item.email}</small>
                  </td>
                  <td>
                    {item.plan_name}
                    <small>
                      {item.duration_days} ngày ·{' '}
                      {item.payment_method === 'demo' ? 'Mô phỏng' : 'Tại quầy'}
                    </small>
                  </td>
                  <td>
                    {money(item.amount)}
                    <small>{dateLabel(item.created_at)}</small>
                  </td>
                  <td>
                    <Badge status={item.status} />
                  </td>
                </>
              )}
              {resource === 'bookings' && (
                <>
                  <td>
                    <strong>{item.user_name}</strong>
                    <small>{item.email}</small>
                  </td>
                  <td>{item.title}</td>
                  <td>
                    {dateLabel(item.starts_at)}
                    <small>{timeLabel(item.starts_at)}</small>
                  </td>
                  <td>
                    <Badge status={item.status} />
                  </td>
                </>
              )}
              {resource === 'contacts' && (
                <>
                  <td>
                    <strong>{item.name}</strong>
                    <small>{item.email}</small>
                  </td>
                  <td>{item.topic}</td>
                  <td>{dateLabel(item.created_at)}</td>
                  <td>
                    <Badge status={item.status} />
                  </td>
                </>
              )}
              <td>
                <div className="table-actions">
                  {crud && (
                    <>
                      <button
                        className="icon-button"
                        title="Chỉnh sửa"
                        aria-label={`Sửa ${item.name || item.title}`}
                        onClick={() => edit(item)}
                      >
                        <Edit3 size={16} />
                      </button>
                      {(item.active || item.published || item.status === 'scheduled') && (
                        <button
                          className="icon-button danger-text"
                          title={resource === 'classes' ? 'Hủy lớp' : 'Ẩn'}
                          aria-label={`Ẩn hoặc hủy ${item.name || item.title}`}
                          onClick={() => remove(item)}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </>
                  )}
                  {resource === 'users' && (
                    <Button variant="outline" onClick={() => edit(item)}>
                      Quản lý
                    </Button>
                  )}
                  {resource === 'trainers' && (
                    <Link
                      className="text-link"
                      to={
                        item.user_id
                          ? `/quan-tri?tab=users&q=${encodeURIComponent(item.account_email)}`
                          : `/quan-tri?tab=users&trainer=${item.id}`
                      }
                    >
                      {item.user_id ? 'Tài khoản' : 'Tạo tài khoản'}
                      <ArrowUpRight size={14} />
                    </Link>
                  )}
                  {resource === 'contacts' && (
                    <Button variant="outline" onClick={() => detail(item)}>
                      <Eye size={15} />
                      Xem & xử lý
                    </Button>
                  )}
                  {resource === 'orders' && item.status === 'pending' && (
                    <Button variant="dark" onClick={() => confirm(item)}>
                      Xác nhận thu tiền
                    </Button>
                  )}
                  {resource === 'bookings' &&
                    item.status !== 'cancelled' &&
                    item.class_status !== 'cancelled' &&
                    new Date(item.starts_at) <= new Date() && (
                      <Button variant="outline" onClick={() => confirm(item)}>
                        {item.status === 'attended' ? 'Bỏ điểm danh' : 'Điểm danh'}
                      </Button>
                    )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function Admin() {
  const [params, setParams] = useSearchParams()
  const tab = tabs.some(([key]) => key === params.get('tab')) ? params.get('tab') : 'overview'
  return (
    <ManagementShell tabs={tabs} active={tab} onSelect={(key) => setParams({ tab: key })}>
      {tab === 'users' ? (
        <Accounts />
      ) : tab === 'account' ? (
        <AccountSettings />
      ) : (
        <AdminContent key={tab} resource={tab} />
      )}
    </ManagementShell>
  )
}

function AdminContent({ resource }) {
  const { data, loading, error, reload } = useResource(`/admin/${resource}`)
  const trainers = useResource('/admin/trainers')
  const notify = useToast()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [editor, setEditor] = useState(null)
  const [confirmation, setConfirmation] = useState(null)
  const [contact, setContact] = useState(null)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState('')
  const title = tabs.find(([key]) => key === resource)[1]
  const run = async (path, method, body) => {
    setBusy(true)
    setFailure('')
    try {
      const result = await api(path, { method, body })
      notify(result.message)
      reload()
      trainers.reload()
      setEditor(null)
      setConfirmation(null)
      setContact(null)
    } catch (error) {
      setFailure(error.message)
      setConfirmation((previous) => (previous ? { ...previous, error: error.message } : previous))
      notify(error.message, 'error')
    } finally {
      setBusy(false)
    }
  }
  const openEditor = (item) => {
    setFailure('')
    setEditor({ item })
  }
  const remove = (item) =>
    setConfirmation({
      title: resource === 'classes' ? 'Hủy lớp tập?' : 'Ẩn mục này?',
      text: `${item.name || item.title}. ${resource === 'classes' ? 'Các lượt đặt đang xác nhận sẽ được hủy và hiển thị trong tài khoản hội viên.' : 'Thông tin và lịch sử liên quan được giữ lại. Có thể bật hiển thị trong mục chỉnh sửa.'}`,
      path: `/admin/${resource}/${item.id}`,
      method: 'DELETE',
    })
  const confirm = (item) =>
    setConfirmation(
      resource === 'orders'
        ? {
            title: 'Xác nhận đã nhận tiền?',
            text: `Đơn #${item.id} của ${item.user_name}: ${money(item.amount)}. Xác nhận sẽ kích hoạt gói và ghi nhận doanh thu.`,
            path: `/admin/orders/${item.id}/confirm`,
            method: 'POST',
          }
        : {
            title: item.status === 'attended' ? 'Bỏ điểm danh?' : 'Xác nhận hội viên có mặt?',
            text: `${item.user_name} · ${item.title} · ${dateLabel(item.starts_at)}`,
            path: `/admin/bookings/${item.id}`,
            method: 'PATCH',
            body: { status: item.status === 'attended' ? 'confirmed' : 'attended' },
          },
    )
  const filtered = (data?.items || []).filter(
    (item) =>
      JSON.stringify(item).toLowerCase().includes(query.toLowerCase()) &&
      (filter === 'all' || item.status === filter),
  )
  const totalPages = Math.max(1, Math.ceil(filtered.length / 10))
  const currentPage = Math.min(page, totalPages)
  const currentItems = filtered.slice((currentPage - 1) * 10, currentPage * 10)
  return (
    <div className="workspace-content">
      <div className="workspace-heading">
        <div>
          <p className="eyebrow">CONTROL CENTER</p>
          <h1>{title}</h1>
        </div>
        {fields[resource] && (
          <Button onClick={() => openEditor(null)}>
            <Plus size={18} />
            Thêm mới
          </Button>
        )}
      </div>
      {loading && !data ? (
        <Loading />
      ) : error ? (
        <ErrorBox error={error} retry={reload} />
      ) : (
        data &&
        (resource === 'overview' ? (
          <>
            <div className="admin-overview-intro">
              <div>
                <p className="eyebrow">GYM TN · TRUNG TÂM ĐIỀU HÀNH</p>
                <h2>
                  Phòng tập của bạn,
                  <br />
                  trong tầm quản lý.
                </h2>
                <p>Quản lý thành viên, theo dõi lịch tập và xử lý các yêu cầu mỗi ngày.</p>
              </div>
              <ShieldCheck size={95} strokeWidth={1.3} />
            </div>
            <div className="stats-grid">
              <Stat
                icon={Users}
                label="Tổng hội viên"
                value={data.stats.members}
                detail={`${data.stats.active_members} hội viên có gói hiệu lực`}
              />
              <Stat
                icon={Wallet}
                label="Doanh thu đã xác nhận"
                value={money(data.stats.revenue)}
                detail="Bao gồm đơn mô phỏng trong bản demo"
              />
              <Stat
                icon={CreditCard}
                label="Đơn chờ thanh toán"
                value={data.stats.pending_orders}
              />
              <Stat icon={Mail} label="Yêu cầu tư vấn mới" value={data.stats.new_contacts} />
            </div>
            <div className="admin-quick-links">
              {[
                ['trainers', 'Huấn luyện viên', data.stats.trainers, UserRound],
                ['plans', 'Gói tập đang mở', data.stats.plans, CreditCard],
                ['classes', 'Lớp sắp diễn ra', data.stats.upcoming_classes, CalendarDays],
              ].map(([key, label, value, Icon]) => (
                <Link to={`/quan-tri?tab=${key}`} key={key}>
                  <span className="quick-link-icon">
                    <Icon size={21} />
                  </span>
                  <div>
                    <strong>{value}</strong>
                    <span>{label}</span>
                  </div>
                  <ArrowUpRight size={18} />
                </Link>
              ))}
            </div>
            <div className="panel">
              <div className="panel-heading">
                <h2>Doanh thu theo tháng</h2>
                <span className="muted text-sm">Tối đa 6 tháng có giao dịch gần nhất</span>
              </div>
              {data.revenue.length ? (
                <div className="revenue-bars">
                  {data.revenue
                    .slice()
                    .reverse()
                    .map((row) => (
                      <div key={row.month}>
                        <span>{row.month}</span>
                        <div>
                          <i
                            style={{
                              width: `${Math.max(2, (row.amount / Math.max(...data.revenue.map((r) => r.amount), 1)) * 100)}%`,
                            }}
                          />
                        </div>
                        <strong>{money(row.amount)}</strong>
                      </div>
                    ))}
                </div>
              ) : (
                <Empty title="Chưa có giao dịch đã xác nhận" />
              )}
            </div>
            <div className="panel">
              <div className="panel-heading">
                <h2>Đơn hàng gần đây</h2>
                <Link to="/quan-tri?tab=orders" className="text-link">
                  Xem tất cả <ArrowUpRight size={16} />
                </Link>
              </div>
              <ResourceTable resource="orders" items={data.recent_orders} confirm={confirm} />
            </div>
          </>
        ) : (
          <div className="panel">
            <div className="admin-toolbar">
              <label className="search-field">
                <Search size={18} />
                <input
                  aria-label="Tìm kiếm dữ liệu"
                  placeholder="Tìm tên, email, mã số…"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value)
                    setPage(1)
                  }}
                />
              </label>
              {['orders', 'bookings', 'contacts', 'classes'].includes(resource) && (
                <select
                  aria-label="Lọc theo trạng thái"
                  className="filter-select"
                  value={filter}
                  onChange={(e) => {
                    setFilter(e.target.value)
                    setPage(1)
                  }}
                >
                  <option value="all">Tất cả trạng thái</option>
                  {[...new Set(data.items.map((i) => i.status))].map((s) => (
                    <option key={s} value={s}>
                      {statusLabels[s]}
                    </option>
                  ))}
                </select>
              )}
              <Button
                variant="outline"
                disabled={!filtered.length}
                onClick={() => downloadCSV(filtered, resource)}
              >
                <Download size={16} />
                Xuất CSV
              </Button>
            </div>
            <ResourceTable
              resource={resource}
              items={currentItems}
              edit={openEditor}
              remove={remove}
              confirm={confirm}
              detail={(item) => {
                setFailure('')
                setContact(item)
              }}
            />
            <div className="pagination">
              <p>
                {filtered.length} bản ghi · Trang {currentPage}/{totalPages}
              </p>
              <div>
                <Button
                  variant="outline"
                  disabled={currentPage <= 1}
                  onClick={() => setPage(currentPage - 1)}
                >
                  Trước
                </Button>
                <Button
                  variant="outline"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage(currentPage + 1)}
                >
                  Sau
                </Button>
              </div>
            </div>
          </div>
        ))
      )}
      {editor && (
        <Modal
          title={`${editor.item ? 'Chỉnh sửa' : 'Thêm mới'} · ${title}`}
          onClose={() => {
            if (!busy) setEditor(null)
          }}
        >
          <Editor
            resource={resource}
            item={editor.item}
            trainers={trainers.data?.items || []}
            busy={busy}
            failure={failure}
            onSave={(body) =>
              run(
                `/admin/${resource}${editor.item ? `/${editor.item.id}` : ''}`,
                editor.item ? 'PUT' : 'POST',
                body,
              )
            }
          />
        </Modal>
      )}
      {confirmation && (
        <Modal
          title={confirmation.title}
          onClose={() => {
            if (!busy) setConfirmation(null)
          }}
        >
          <p className="muted mb-6">{confirmation.text}</p>
          {confirmation.error && (
            <p className="form-error mb-5" role="alert">
              {confirmation.error}
            </p>
          )}
          <div className="flex gap-3 justify-end">
            <Button variant="outline" disabled={busy} onClick={() => setConfirmation(null)}>
              Quay lại
            </Button>
            <Button
              busy={busy}
              onClick={() => run(confirmation.path, confirmation.method, confirmation.body)}
            >
              Xác nhận
            </Button>
          </div>
        </Modal>
      )}
      {contact && (
        <Modal
          title="Chi tiết yêu cầu tư vấn"
          onClose={() => {
            if (!busy) setContact(null)
          }}
        >
          <div className="contact-message">
            <h3>{contact.name}</h3>
            <p>
              {contact.email} · {contact.phone || 'Chưa có điện thoại'}
            </p>
            <p className="muted">
              {contact.topic} · {dateLabel(contact.created_at)}
            </p>
            <blockquote>{contact.message}</blockquote>
          </div>
          <form
            className="form-stack"
            onSubmit={(event) => {
              event.preventDefault()
              run(
                `/admin/contacts/${contact.id}`,
                'PATCH',
                Object.fromEntries(new FormData(event.currentTarget)),
              )
            }}
          >
            <Field label="Trạng thái xử lý" name="status" as="select" defaultValue={contact.status}>
              <option value="new">Chưa xử lý</option>
              <option value="contacted">Đã liên hệ</option>
              <option value="closed">Hoàn tất</option>
            </Field>
            {failure && (
              <p className="form-error" role="alert">
                {failure}
              </p>
            )}
            <Button busy={busy} type="submit">
              Cập nhật trạng thái
            </Button>
          </form>
        </Modal>
      )}
    </div>
  )
}
