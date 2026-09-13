import { useState } from 'react'
import { api } from '../api'
import { roleLabels } from '../auth-routing'
import { useAuth, useToast } from '../context'
import { Button, Field } from './UI'

export default function AccountSettings() {
  const { user, refresh } = useAuth()
  const notify = useToast()
  const [busy, setBusy] = useState(false)
  const save = async (event, password = false) => {
    event.preventDefault()
    const form = event.currentTarget
    const body = Object.fromEntries(new FormData(form))
    if (password && body.new_password !== body.confirm_password)
      return notify('Mật khẩu xác nhận chưa khớp.', 'error')
    setBusy(true)
    try {
      const result = await api(password ? '/me/password' : '/me', { method: 'PUT', body })
      await refresh()
      if (password) form.reset()
      notify(result.message)
    } catch (error) {
      notify(error.message, 'error')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="workspace-content">
      <div className="workspace-heading">
        <div>
          <p className="eyebrow">TÀI KHOẢN CỦA TÔI</p>
          <h1>Hồ sơ & bảo mật</h1>
        </div>
      </div>
      <div className="profile-grid">
        <div className="panel">
          <h2 className="mb-5">Thông tin {roleLabels[user.role].toLowerCase()}</h2>
          <form className="form-stack" onSubmit={save}>
            <Field
              label="Họ và tên"
              name="name"
              required
              minLength={2}
              maxLength={80}
              defaultValue={user.name}
            />
            <Field label="Email đăng nhập" value={user.email} disabled />
            <Field
              label="Số điện thoại"
              name="phone"
              type="tel"
              maxLength={20}
              defaultValue={user.phone}
            />
            <Button busy={busy} type="submit">
              Lưu thông tin
            </Button>
          </form>
        </div>
        <div className="panel">
          <h2 className="mb-5">Đổi mật khẩu</h2>
          <form className="form-stack" onSubmit={(event) => save(event, true)}>
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
              Ít nhất 8 ký tự. Các phiên đăng nhập khác sẽ được đăng xuất sau khi đổi mật khẩu.
            </p>
            <Button busy={busy} type="submit" variant="dark">
              Đổi mật khẩu
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
