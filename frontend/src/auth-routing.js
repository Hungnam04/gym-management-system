export const roleLabels = { admin: 'Quản trị viên', member: 'Hội viên', trainer: 'Huấn luyện viên' }

export function accountHome(user) {
  return user?.role === 'admin' ? '/quan-tri' : user?.role === 'trainer' ? '/hlv' : '/hoi-vien'
}

export function loginDestination(user, from) {
  if (
    typeof from !== 'string' ||
    !from.startsWith('/') ||
    from.startsWith('//') ||
    from.includes('\\')
  )
    return accountHome(user)
  const path = from.split(/[?#]/)[0]
  if (path === '/dang-nhap' || path === '/dang-ky' || path === '/quan-tri/dang-nhap')
    return accountHome(user)
  if ((path === '/quan-tri' || path.startsWith('/quan-tri/')) && user.role !== 'admin')
    return accountHome(user)
  if ((path === '/hlv' || path.startsWith('/hlv/')) && user.role !== 'trainer')
    return accountHome(user)
  return from
}
