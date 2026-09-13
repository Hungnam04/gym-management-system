import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CalendarDays, Users, Clock, UserRound, MapPin, Check } from 'lucide-react'
import { api, dateLabel, timeLabel } from '../api'
import { useResource } from '../context'
import { Badge, Button, Empty, ErrorBox, Loading, Modal, Stat } from '../components/UI'
import ManagementShell from '../components/ManagementShell'
import AccountSettings from '../components/AccountSettings'

const tabs = [
  ['schedule', 'Lịch dạy của tôi', CalendarDays],
  ['account', 'Tài khoản của tôi', UserRound],
]

export default function Trainer() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'account' ? 'account' : 'schedule'
  return (
    <ManagementShell tabs={tabs} active={tab} onSelect={(key) => setParams({ tab: key })}>
      {tab === 'account' ? <AccountSettings /> : <TrainerSchedule />}
    </ManagementShell>
  )
}

function TrainerSchedule() {
  const { data, loading, error, reload } = useResource('/trainer/dashboard')
  const [filter, setFilter] = useState('upcoming')
  const [selected, setSelected] = useState(null)
  const [busy, setBusy] = useState(null)
  const [failure, setFailure] = useState('')
  const upcoming =
    data?.classes.filter(
      (cls) => cls.status === 'scheduled' && new Date(cls.starts_at) > new Date(),
    ) || []
  const classes =
    data?.classes.filter(
      (cls) =>
        filter === 'all' ||
        (filter === 'upcoming'
          ? cls.status === 'scheduled' && new Date(cls.starts_at) > new Date()
          : new Date(cls.starts_at) <= new Date()),
    ) || []
  const selectedClass = data?.classes.find((cls) => cls.id === selected)
  const bookings = data?.bookings.filter((booking) => booking.class_id === selected) || []
  const mark = async (booking) => {
    setBusy(booking.id)
    setFailure('')
    try {
      await api(`/trainer/bookings/${booking.id}`, {
        method: 'PATCH',
        body: { status: booking.status === 'attended' ? 'confirmed' : 'attended' },
      })
      reload()
    } catch (error) {
      setFailure(error.message)
    } finally {
      setBusy(null)
    }
  }
  return (
    <div className="workspace-content">
      <div className="workspace-heading">
        <div>
          <p className="eyebrow">GYM TN COACHING</p>
          <h1>Lịch dạy của tôi</h1>
          <p className="muted text-sm mt-2">Theo dõi lớp được phân công và điểm danh hội viên.</p>
        </div>
      </div>
      {loading && !data ? (
        <Loading />
      ) : error ? (
        <ErrorBox error={error} retry={reload} />
      ) : (
        data && (
          <>
            <div className="stats-grid">
              <Stat
                icon={UserRound}
                label="Hồ sơ huấn luyện viên"
                value={data.profile.name}
                detail={data.profile.specialty}
              />
              <Stat icon={CalendarDays} label="Lớp sắp dạy" value={upcoming.length} />
              <Stat
                icon={Users}
                label="Lượt đăng ký"
                value={data.bookings.filter((b) => b.status !== 'cancelled').length}
              />
              <Stat
                icon={Check}
                label="Lượt đã điểm danh"
                value={data.bookings.filter((b) => b.status === 'attended').length}
              />
            </div>
            <div className="filter-tabs mb-6">
              {[
                ['upcoming', 'Sắp diễn ra'],
                ['past', 'Đã bắt đầu'],
                ['all', 'Tất cả lớp'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  className={filter === value ? 'active' : ''}
                  onClick={() => setFilter(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            {classes.length ? (
              <div className="class-grid">
                {classes
                  .slice()
                  .sort((a, b) =>
                    filter === 'upcoming'
                      ? a.starts_at.localeCompare(b.starts_at)
                      : b.starts_at.localeCompare(a.starts_at),
                  )
                  .map((cls) => (
                    <article className="class-card" key={cls.id}>
                      <div className="flex justify-between gap-3">
                        <span className="class-category">{cls.category}</span>
                      <Badge status={cls.status}>{cls.status === 'cancelled' ? 'Đã hủy' : new Date(cls.starts_at) <= new Date() ? 'Đã bắt đầu' : 'Sắp diễn ra'}</Badge>
                      </div>
                      <h2>{cls.title}</h2>
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
                          {cls.booked}/{cls.capacity} hội viên
                        </span>
                      </div>
                      <Button
                        className="w-full mt-6"
                        variant="dark"
                        onClick={() => {
                          setSelected(cls.id)
                          setFailure('')
                        }}
                      >
                        Danh sách hội viên
                      </Button>
                    </article>
                  ))}
              </div>
            ) : (
              <div className="panel">
                <Empty
                  title="Chưa có lớp trong mục này"
                  text="Quản trị viên có thể phân công lịch dạy cho bạn từ mục Lịch lớp."
                />
              </div>
            )}
          </>
        )
      )}
      {selectedClass && (
        <Modal
          title={`Hội viên · ${selectedClass.title}`}
          onClose={() => {
            if (!busy) setSelected(null)
          }}
        >
          <p className="muted text-sm mb-5">
            {dateLabel(selectedClass.starts_at)} · {timeLabel(selectedClass.starts_at)} ·{' '}
            {selectedClass.room}
          </p>
          {failure && (
            <p className="form-error mb-4" role="alert">
              {failure}
            </p>
          )}
          {bookings.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Hội viên</th>
                    <th>Trạng thái</th>
                    <th>Điểm danh</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((booking) => (
                    <tr key={booking.id}>
                      <td>
                        <strong>{booking.user_name}</strong>
                        <small>{booking.email}</small>
                        <small>{booking.phone}</small>
                      </td>
                      <td>
                        <Badge status={booking.status} />
                      </td>
                      <td>
                        {booking.status !== 'cancelled' &&
                        selectedClass.status !== 'cancelled' &&
                        new Date(selectedClass.starts_at) <= new Date() ? (
                          <Button
                            variant="outline"
                            busy={busy === booking.id}
                            disabled={busy !== null}
                            onClick={() => mark(booking)}
                          >
                            {booking.status === 'attended' ? 'Bỏ điểm danh' : 'Có mặt'}
                          </Button>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty title="Chưa có hội viên đăng ký" />
          )}
          <p className="muted text-xs mt-5">Điểm danh được mở khi lớp bắt đầu.</p>
        </Modal>
      )}
    </div>
  )
}
