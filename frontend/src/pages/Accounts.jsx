import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Download,
  KeyRound,
  Plus,
  Search,
  ShieldCheck,
  Users,
  UserRound,
  LockKeyhole,
  ArrowUpRight,
} from 'lucide-react'
import { api, dateLabel } from '../api'
import { roleLabels } from '../auth-routing'
import { useAuth, useResource, useToast } from '../context'
import { Badge, Button, Empty, ErrorBox, Field, Loading, Modal, Stat } from '../components/UI'

function AccountForm({ item, trainerId, trainers, onSave, busy, error }) {
  const [role, setRole] = useState(item?.role || (trainerId ? 'trainer' : 'member'))
  const submit = (event) => {
    event.preventDefault()
    const body = Object.fromEntries(new FormData(event.currentTarget))
    body.active = Number(body.active)
    if (role === 'trainer') body.trainer_id = Number(body.trainer_id)
    if (item && !body.password) delete body.password
    onSave(body)
  }
  return (
    <form className="form-stack" onSubmit={submit}>
      <div className="form-row">
        <Field
          label="Họ và tên"
          name="name"
          required
          minLength={2}
          maxLength={80}
          defaultValue={item?.name || trainers.find((t) => t.id === Number(trainerId))?.name || ''}
        />
        <Field
          label="Số điện thoại"
          name="phone"
          type="tel"
          maxLength={20}
          defaultValue={item?.phone || ''}
        />
      </div>
      <Field
        label="Email đăng nhập"
        name="email"
        type="email"
        required
        maxLength={254}
        autoComplete="off"
        defaultValue={item?.email || ''}
      />
      <div className="form-row">
        <Field
          label="Vai trò"
          name="role"
          as="select"
          value={role}
          onChange={(event) => setRole(event.target.value)}
        >
          {Object.entries(roleLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Field>
        <Field
          label="Trạng thái tài khoản"
          name="active"
          as="select"
          defaultValue={item?.active ?? 1}
        >
          <option value="1">Đang hoạt động</option>
          <option value="0">Khóa đăng nhập</option>
        </Field>
      </div>
      {role === 'trainer' && (
        <>
          <Field
            label="Liên kết hồ sơ huấn luyện viên"
            name="trainer_id"
            as="select"
            required
            defaultValue={item?.trainer_id || trainerId || ''}
          >
            <option value="" disabled>
              Chọn hồ sơ HLV
            </option>
            {trainers.map((trainer) => (
              <option
                value={trainer.id}
                key={trainer.id}
                disabled={!!trainer.user_id && trainer.user_id !== item?.id}
              >
                {trainer.name}
                {trainer.user_id && trainer.user_id !== item?.id ? ' — đã có tài khoản' : ''}
              </option>
            ))}
          </Field>
          <p className="muted text-sm">
            HLV chỉ xem lịch và điểm danh các lớp thuộc hồ sơ này. Chưa có hồ sơ?{' '}
            <Link className="underline" to="/quan-tri?tab=trainers">
              Thêm hồ sơ HLV trước
            </Link>
            .
          </p>
        </>
      )}
      <Field
        label={item ? 'Mật khẩu mới (bỏ trống để giữ mật khẩu hiện tại)' : 'Mật khẩu khởi tạo'}
        name="password"
        type="password"
        required={!item}
        minLength={8}
        maxLength={128}
        autoComplete="new-password"
        placeholder="Ít nhất 8 ký tự"
      />
      {item ? (
        <p className="account-form-note">
          <KeyRound size={17} />
          Lưu thay đổi sẽ đăng xuất các phiên hiện có của tài khoản này.
        </p>
      ) : (
        <p className="muted text-sm">
          Cung cấp email và mật khẩu khởi tạo cho người dùng. Họ có thể đổi mật khẩu trong tài khoản
          của mình.
        </p>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" busy={busy}>
        {item ? 'Lưu tài khoản' : 'Tạo tài khoản'}
      </Button>
    </form>
  )
}

export default function Accounts() {
  const resource = useResource('/admin/users')
  const trainers = useResource('/admin/trainers')
  const { user } = useAuth()
  const [params] = useSearchParams()
  const notify = useToast()
  const [query, setQuery] = useState(() => params.get('q') || '')
  const [role, setRole] = useState('all')
  const [active, setActive] = useState('all')
  const [page, setPage] = useState(1)
  const [editor, setEditor] = useState(() =>
    params.get('trainer') ? { item: null, trainerId: params.get('trainer') } : null,
  )
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const items = resource.data?.items || []
  const filtered = items.filter(
    (item) =>
      (role === 'all' || item.role === role) &&
      (active === 'all' || String(item.active) === active) &&
      `${item.id} ${item.name} ${item.email} ${item.phone}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  )
  const totalPages = Math.max(1, Math.ceil(filtered.length / 10))
  const currentPage = Math.min(page, totalPages)
  const openEditor = (item) => {
    setError('')
    setEditor({ item })
  }
  const save = async (body) => {
    setBusy(true)
    setError('')
    try {
      const result = await api(editor.item ? `/admin/users/${editor.item.id}` : '/admin/users', {
        method: editor.item ? 'PATCH' : 'POST',
        body,
      })
      notify(result.message)
      setEditor(null)
      resource.reload()
      trainers.reload()
    } catch (error) {
      setError(error.message)
    } finally {
      setBusy(false)
    }
  }
  const exportCSV = () => {
    const escape = (value) => {
      let text = String(value ?? '')
      if (/^\s*[=+@-]/.test(text)) text = `'${text}`
      return `"${text.replaceAll('"', '""')}"`
    }
    const lines = [
      ['ID', 'Họ tên', 'Email', 'Điện thoại', 'Vai trò', 'Trạng thái'],
      ...filtered.map((item) => [
        item.id,
        item.name,
        item.email,
        item.phone,
        roleLabels[item.role],
        item.active ? 'Hoạt động' : 'Đã khóa',
      ]),
    ]
    const url = URL.createObjectURL(
      new Blob(['\uFEFF', lines.map((row) => row.map(escape).join(',')).join('\r\n')], {
        type: 'text/csv;charset=utf-8;',
      }),
    )
    const link = document.createElement('a')
    link.href = url
    link.download = 'gym-tn-tai-khoan.csv'
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return (
    <div className="workspace-content">
      <div className="workspace-heading">
        <div>
          <p className="eyebrow">CON NGƯỜI TẠI GYM TN</p>
          <h1>Quản lý tài khoản</h1>
          <p className="muted text-sm mt-2">
            Hội viên, huấn luyện viên và đội ngũ quản trị trong một danh sách.
          </p>
        </div>
        <Button onClick={() => openEditor(null)}>
          <Plus size={18} />
          Tạo tài khoản
        </Button>
      </div>
      {resource.loading && !resource.data ? (
        <Loading />
      ) : resource.error ? (
        <ErrorBox error={resource.error} retry={resource.reload} />
      ) : (
        <>
          <div className="stats-grid">
            <Stat
              icon={Users}
              label="Hội viên"
              value={items.filter((item) => item.role === 'member').length}
            />
            <Stat
              icon={UserRound}
              label="Tài khoản HLV"
              value={items.filter((item) => item.role === 'trainer').length}
            />
            <Stat
              icon={ShieldCheck}
              label="Quản trị viên"
              value={items.filter((item) => item.role === 'admin').length}
            />
            <Stat
              icon={LockKeyhole}
              label="Tài khoản bị khóa"
              value={items.filter((item) => !item.active).length}
            />
          </div>
          <div className="panel">
            <div className="filter-tabs mb-5">
              {[['all', 'Tất cả'], ...Object.entries(roleLabels)].map(([value, label]) => (
                <button
                  key={value}
                  className={role === value ? 'active' : ''}
                  onClick={() => {
                    setRole(value)
                    setPage(1)
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="admin-toolbar">
              <label className="search-field">
                <Search size={18} />
                <input
                  aria-label="Tìm tài khoản"
                  placeholder="Tìm họ tên, email, số điện thoại…"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value)
                    setPage(1)
                  }}
                />
              </label>
              <select
                className="filter-select"
                aria-label="Trạng thái tài khoản"
                value={active}
                onChange={(event) => {
                  setActive(event.target.value)
                  setPage(1)
                }}
              >
                <option value="all">Mọi trạng thái</option>
                <option value="1">Đang hoạt động</option>
                <option value="0">Đã khóa</option>
              </select>
              <Button variant="outline" onClick={exportCSV} disabled={!filtered.length}>
                <Download size={16} />
                Xuất CSV
              </Button>
            </div>
            {filtered.length ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Tài khoản</th>
                      <th>Liên hệ</th>
                      <th>Vai trò / liên kết</th>
                      <th>Trạng thái</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.slice((currentPage - 1) * 10, currentPage * 10).map((item) => (
                      <tr key={item.id}>
                        <td>
                          <div className="account-name">
                            <span className={`account-avatar role-${item.role}`}>
                              {item.name.slice(0, 1)}
                            </span>
                            <div>
                              <strong>
                                {item.name}
                                {item.id === user.id && ' (bạn)'}
                              </strong>
                              <small>
                                #{item.id} · Tạo {dateLabel(item.created_at)}
                              </small>
                            </div>
                          </div>
                        </td>
                        <td>
                          {item.email}
                          <small>{item.phone || 'Chưa có số điện thoại'}</small>
                        </td>
                        <td>
                          <span className={`role-pill role-${item.role}`}>
                            {roleLabels[item.role]}
                          </span>
                          {item.trainer_name && <small>HLV: {item.trainer_name}</small>}
                          {item.role === 'member' && (
                            <small>
                              {item.membership_ends_at
                                ? `Gói đến ${dateLabel(item.membership_ends_at)}`
                                : 'Chưa có gói tập'}
                            </small>
                          )}
                        </td>
                        <td>
                          <Badge status={item.active ? 'confirmed' : 'cancelled'}>
                            {item.active ? 'Hoạt động' : 'Đã khóa'}
                          </Badge>
                        </td>
                        <td>
                          {item.id === user.id ? (
                            <Link className="text-link" to="/quan-tri?tab=account">
                              Hồ sơ của tôi <ArrowUpRight size={15} />
                            </Link>
                          ) : (
                            <Button variant="outline" onClick={() => openEditor(item)}>
                              Quản lý
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty
                title="Không tìm thấy tài khoản"
                text="Thử thay đổi bộ lọc hoặc tạo tài khoản mới."
              />
            )}
            <div className="pagination">
              <p>
                {filtered.length} tài khoản · Trang {currentPage}/{totalPages}
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
        </>
      )}
      {editor && (
        <Modal
          title={editor.item ? `Quản lý · ${editor.item.name}` : 'Tạo tài khoản mới'}
          onClose={() => {
            if (!busy) setEditor(null)
          }}
        >
          {trainers.loading && !trainers.data ? (
            <Loading />
          ) : trainers.error ? (
            <ErrorBox error={trainers.error} retry={trainers.reload} />
          ) : (
            <AccountForm
              item={editor.item}
              trainerId={editor.trainerId}
              trainers={trainers.data?.items || []}
              busy={busy}
              error={error}
              onSave={save}
            />
          )}
        </Modal>
      )}
    </div>
  )
}
