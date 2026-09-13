"""Administrator-managed accounts and scoped trainer access."""
from flask import g, jsonify
from werkzeug.security import generate_password_hash

from app import (ApiError, data, db, email_field, flag, number, one,
                 password_field, require_login, rows, stamp, text_field)


def save_account(body, user_id=None):
    if user_id == g.user['id']:
        raise ApiError('Hãy dùng mục Tài khoản của tôi để sửa hồ sơ hoặc đổi mật khẩu. Không thể tự thay đổi quyền hoặc khóa chính mình.')
    db().execute('BEGIN IMMEDIATE')
    if not one("SELECT id FROM users WHERE id=? AND role='admin' AND active=1 AND session_version=?", (g.user['id'], g.user['session_version'])):
        raise ApiError('Quyền quản trị của phiên này đã thay đổi. Vui lòng đăng nhập lại.', 403)
    old = one('SELECT * FROM users WHERE id=?', (user_id,)) if user_id else None
    if user_id and not old:
        raise ApiError('Không tìm thấy tài khoản.', 404)
    values = {**(old or {}), **body}
    name, email = text_field(values, 'name', 2, 80), email_field(values)
    phone = text_field(values, 'phone', 0, 20)
    role, active = values.get('role', 'member'), flag(values, 'active')
    if role not in ('member', 'trainer', 'admin'):
        raise ApiError('Vai trò không hợp lệ.')
    if one('SELECT id FROM users WHERE email=? AND id!=?', (email, user_id or 0)):
        raise ApiError('Email này đã được sử dụng.', 409)
    profile = None
    if role == 'trainer':
        linked = one('SELECT id FROM trainers WHERE user_id=?', (user_id,)) if user_id else None
        trainer_id = number({'trainer_id': body.get('trainer_id', linked['id'] if linked else None)}, 'trainer_id', 1, 2147483647)
        profile = one('SELECT * FROM trainers WHERE id=?', (trainer_id,))
        if not profile:
            raise ApiError('Hồ sơ huấn luyện viên không tồn tại.', 404)
        if profile['user_id'] and profile['user_id'] != user_id:
            raise ApiError('Hồ sơ HLV này đã gắn với một tài khoản khác.', 409)
    password = body.get('password', '')
    if not user_id or password:
        password = password_field(body)
    if user_id:
        db().execute('UPDATE users SET name=?,email=?,phone=?,role=?,active=?,session_version=session_version+1 WHERE id=?', (name, email, phone, role, active, user_id))
        if password:
            db().execute('UPDATE users SET password_hash=? WHERE id=?', (generate_password_hash(password), user_id))
        db().execute('UPDATE trainers SET user_id=NULL WHERE user_id=?', (user_id,))
    else:
        user_id = db().execute('INSERT INTO users(name,email,phone,role,active,password_hash,created_at) VALUES (?,?,?,?,?,?,?)', (name, email, phone, role, active, generate_password_hash(password), stamp())).lastrowid
    if profile:
        db().execute('UPDATE trainers SET user_id=? WHERE id=?', (user_id, profile['id']))
    db().commit()
    return jsonify(id=user_id, message='Đã cập nhật tài khoản. Các phiên cũ đã được đăng xuất.' if old else 'Đã tạo tài khoản. Bạn có thể cung cấp thông tin đăng nhập cho người dùng.'), 200 if old else 201


def trainer_profile():
    if g.user['role'] != 'trainer':
        raise ApiError('Khu vực này dành cho huấn luyện viên.', 403)
    profile = one('SELECT * FROM trainers WHERE user_id=?', (g.user['id'],))
    if not profile:
        raise ApiError('Tài khoản chưa được liên kết với hồ sơ huấn luyện viên.', 403)
    return profile


def register_accounts(app):
    @app.post('/api/admin/users')
    @require_login(admin=True)
    def create_account():
        return save_account(data())

    @app.get('/api/trainer/dashboard')
    @require_login()
    def trainer_dashboard():
        profile = trainer_profile()
        classes = rows('''SELECT c.*,
            (SELECT COUNT(*) FROM bookings b WHERE b.class_id=c.id AND b.status IN ('confirmed','attended')) booked
            FROM classes c WHERE c.trainer_id=? ORDER BY c.starts_at DESC''', (profile['id'],))
        bookings = rows('''SELECT b.id,b.class_id,b.status,u.name user_name,u.email,u.phone
            FROM bookings b JOIN classes c ON c.id=b.class_id JOIN users u ON u.id=b.user_id
            WHERE c.trainer_id=? ORDER BY b.id DESC''', (profile['id'],))
        return jsonify(profile=profile, classes=classes, bookings=bookings)

    @app.patch('/api/trainer/bookings/<int:booking_id>')
    @require_login()
    def trainer_attendance(booking_id):
        profile = trainer_profile()
        status = data().get('status')
        if status not in ('confirmed', 'attended'):
            raise ApiError('Trạng thái không hợp lệ.')
        db().execute('BEGIN IMMEDIATE')
        booking = one('''SELECT b.*,c.starts_at,c.status class_status FROM bookings b JOIN classes c ON c.id=b.class_id
            WHERE b.id=? AND c.trainer_id=?''', (booking_id, profile['id']))
        if not booking:
            raise ApiError('Không tìm thấy lượt đặt trong lớp của bạn.', 404)
        if booking['status'] == 'cancelled' or booking['class_status'] == 'cancelled':
            raise ApiError('Không thể điểm danh lớp hoặc lượt đặt đã hủy.', 409)
        if booking['starts_at'] > stamp():
            raise ApiError('Chỉ điểm danh khi lớp đã bắt đầu.', 409)
        db().execute('UPDATE bookings SET status=? WHERE id=?', (status, booking_id))
        db().commit()
        return jsonify(message='Đã cập nhật điểm danh.')
