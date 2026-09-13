"""Gym TN: same-origin Flask JSON API and compiled React application."""
import hashlib
import hmac
import json
import math
import os
import re
import secrets
import sqlite3
import time
from datetime import datetime, timedelta, timezone
from functools import wraps
from pathlib import Path

import click
from dotenv import load_dotenv
from flask import Flask, g, jsonify, request, send_from_directory, session
from werkzeug.exceptions import HTTPException
from werkzeug.security import check_password_hash, generate_password_hash

BASE = Path(__file__).resolve().parent
TZ = timezone(timedelta(hours=7))


def now():
    return datetime.now(TZ)


def stamp(value=None):
    return (value or now()).isoformat(timespec='seconds')


class ApiError(Exception):
    def __init__(self, message, status=400, code=None):
        self.message, self.status, self.code = message, status, code


def db():
    if 'db' not in g:
        from flask import current_app
        g.db = sqlite3.connect(current_app.config['DATABASE'], timeout=15, isolation_level=None)
        g.db.row_factory = sqlite3.Row
        g.db.execute('PRAGMA foreign_keys=ON')
        g.db.execute('PRAGMA journal_mode=WAL')
    return g.db


def rows(sql, params=()):
    return [dict(row) for row in db().execute(sql, params).fetchall()]


def one(sql, params=()):
    row = db().execute(sql, params).fetchone()
    return dict(row) if row else None


def data():
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        raise ApiError('Dữ liệu gửi lên phải là một đối tượng JSON.')
    return body


def text_field(body, key, minimum=1, maximum=200):
    value = body.get(key, '')
    if not isinstance(value, str) or not minimum <= len(value.strip()) <= maximum:
        raise ApiError(f'Trường {key} cần từ {minimum} đến {maximum} ký tự.')
    return value.strip()


def number(body, key, minimum, maximum, integer=True):
    value = body.get(key)
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        raise ApiError(f'Trường {key} phải là số hợp lệ.')
    if not minimum <= value <= maximum or (integer and value != int(value)):
        raise ApiError(f'Trường {key} phải nằm trong khoảng {minimum}–{maximum}.')
    return int(value) if integer else float(value)


def flag(body, key, default=1):
    value = body.get(key, default)
    if value not in (0, 1, False, True):
        raise ApiError(f'Trường {key} chỉ chấp nhận 0 hoặc 1.')
    return int(value)


def email_field(body):
    value = text_field(body, 'email', 5, 254).lower()
    if not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', value):
        raise ApiError('Email không hợp lệ.')
    return value


def password_field(body, key='password', minimum=8):
    value = body.get(key, '')
    if not isinstance(value, str) or not minimum <= len(value) <= 128:
        raise ApiError('Mật khẩu cần từ 8 đến 128 ký tự.')
    return value


def date_field(body, key):
    try:
        value = datetime.strptime(text_field(body, key, 10, 10), '%Y-%m-%d').date()
    except ValueError:
        raise ApiError('Ngày không hợp lệ.')
    if value > now().date() or value.year < 2000:
        raise ApiError('Ngày ghi nhận phải từ năm 2000 đến hôm nay.')
    return value.isoformat()


def image_field(body):
    value = text_field(body, 'image', 0, 500)
    if value and not (value.startswith('https://') or (value.startswith('/images/') and '..' not in value)):
        raise ApiError('Ảnh phải dùng địa chỉ HTTPS hoặc đường dẫn /images/.')
    return value


def require_login(admin=False):
    def decorator(fn):
        @wraps(fn)
        def wrapped(*args, **kwargs):
            if not g.user:
                raise ApiError('Vui lòng đăng nhập để tiếp tục.', 401)
            if admin and g.user['role'] != 'admin':
                raise ApiError('Bạn không có quyền quản trị.', 403)
            return fn(*args, **kwargs)
        return wrapped
    return decorator


def rate_limit(kind, limit, seconds):
    from flask import current_app
    if current_app.config.get('TESTING'):
        return
    epoch = int(time.time())
    bucket = hashlib.sha256(f'{kind}:{request.remote_addr}'.encode()).hexdigest()
    db().execute('DELETE FROM rate_limits WHERE resets_at < ?', (epoch,))
    result = db().execute('''INSERT INTO rate_limits(bucket,hits,resets_at) VALUES (?,1,?)
        ON CONFLICT(bucket) DO UPDATE SET hits=hits+1 RETURNING hits''', (bucket, epoch + seconds)).fetchone()
    if result['hits'] > limit:
        raise ApiError('Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút.', 429)


def plans_data(admin=False):
    result = rows('SELECT * FROM plans' + ('' if admin else ' WHERE active=1') + ' ORDER BY price')
    for row in result:
        row['features'] = json.loads(row['features'])
    return result


def classes_data(admin=False):
    sql = '''SELECT c.*,t.name trainer_name,
        (SELECT COUNT(*) FROM bookings b WHERE b.class_id=c.id AND b.status IN ('confirmed','attended')) booked,
        (SELECT b.status FROM bookings b WHERE b.class_id=c.id AND b.user_id=?) my_status
        FROM classes c JOIN trainers t ON t.id=c.trainer_id'''
    params = [g.user['id'] if g.user else 0]
    if not admin:
        sql += " WHERE c.status='scheduled' AND c.starts_at>=?"
        params.append(stamp())
    return rows(sql + ' ORDER BY c.starts_at', params)


def complete_order(order):
    if order['status'] != 'pending':
        raise ApiError('Đơn hàng đã được xử lý.', 409)
    latest = one('SELECT MAX(ends_at) ends_at FROM memberships WHERE user_id=?', (order['user_id'],))
    start = now()
    if latest['ends_at'] and datetime.fromisoformat(latest['ends_at']) > start:
        start = datetime.fromisoformat(latest['ends_at'])
    end = start + timedelta(days=order['duration_days'])
    db().execute("UPDATE orders SET status='paid',paid_at=? WHERE id=?", (stamp(), order['id']))
    db().execute('''INSERT INTO memberships(user_id,order_id,plan_name,starts_at,ends_at,created_at)
        VALUES (?,?,?,?,?,?)''', (order['user_id'], order['id'], order['plan_name'], stamp(start), stamp(end), stamp()))


def create_app(test_config=None):
    load_dotenv(BASE / '.env')
    app = Flask(__name__, static_folder=None)
    production = os.getenv('APP_ENV') == 'production'
    instance = BASE / 'instance'
    instance.mkdir(exist_ok=True)
    secret = os.getenv('SECRET_KEY')
    if not secret and not production:
        secret_file = instance / '.secret_key'
        if not secret_file.exists():
            secret_file.write_text(secrets.token_hex(32), encoding='utf-8')
        secret = secret_file.read_text(encoding='utf-8').strip()
    if production and (not secret or len(secret) < 32):
        raise RuntimeError('Production requires SECRET_KEY of at least 32 characters.')
    db_path = Path(os.getenv('DATABASE_PATH', 'instance/gymtn.db'))
    if not db_path.is_absolute():
        db_path = BASE / db_path
    app.config.update(SECRET_KEY=secret, DATABASE=str(db_path),
        SESSION_COOKIE_HTTPONLY=True, SESSION_COOKIE_SAMESITE='Lax',
        SESSION_COOKIE_SECURE=os.getenv('SESSION_COOKIE_SECURE', str(production)).lower() == 'true',
        PERMANENT_SESSION_LIFETIME=timedelta(hours=12), MAX_CONTENT_LENGTH=128 * 1024,
        DEMO_PAYMENTS=os.getenv('DEMO_PAYMENTS', 'false' if production else 'true').lower() == 'true')
    if test_config:
        app.config.update(test_config)
    Path(app.config['DATABASE']).parent.mkdir(parents=True, exist_ok=True)

    @app.teardown_appcontext
    def close_db(_error=None):
        connection = g.pop('db', None)
        if connection is not None:
            connection.close()

    with app.app_context():
        db().executescript((BASE / 'schema.sql').read_text(encoding='utf-8'))
        from migrations import migrate_database
        migrate_database(db())

    @app.errorhandler(ApiError)
    def api_error(error):
        if 'db' in g and db().in_transaction:
            db().rollback()
        return jsonify(error=error.message, code=error.code), error.status

    @app.errorhandler(sqlite3.IntegrityError)
    def integrity_error(_error):
        if db().in_transaction:
            db().rollback()
        return jsonify(error='Dữ liệu đã tồn tại hoặc có liên kết đang được sử dụng.'), 409

    @app.errorhandler(HTTPException)
    def http_error(error):
        return jsonify(error='Không tìm thấy tài nguyên.' if error.code == 404 else error.description), error.code

    @app.errorhandler(Exception)
    def unexpected(error):
        if 'db' in g and db().in_transaction:
            db().rollback()
        app.logger.exception('Unhandled request error')
        return jsonify(error='Hệ thống gặp lỗi. Vui lòng thử lại sau.'), 500

    @app.before_request
    def security():
        g.user = None
        if not request.path.startswith('/api/'):
            return
        if session.get('user_id'):
            g.user = one('SELECT id,name,email,phone,role,active,created_at,session_version FROM users WHERE id=? AND active=1', (session['user_id'],))
            if not g.user or session.get('version') != g.user['session_version']:
                session.clear()
                g.user = None
        if request.method in ('POST', 'PUT', 'PATCH', 'DELETE'):
            token = request.headers.get('X-CSRF-Token', '')
            if not token or not hmac.compare_digest(token, session.get('csrf_token', '')):
                raise ApiError('Phiên làm việc hết hạn. Vui lòng tải lại trang.', 403, 'csrf_expired')

    @app.after_request
    def headers(response):
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'SAMEORIGIN'
        response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        if request.path.startswith('/api/'):
            response.headers['Cache-Control'] = 'no-store'
        else:
            response.headers['Content-Security-Policy'] = "default-src 'self'; img-src 'self' https: data:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self'; connect-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'"
        return response

    def auth_response(user):
        session.clear()
        session.permanent = True
        session.update(user_id=user['id'], version=user['session_version'], csrf_token=secrets.token_hex(32))
        return jsonify(user={k: v for k, v in user.items() if k not in ('password_hash', 'session_version')}, csrf_token=session['csrf_token'])

    @app.get('/api/health')
    def health():
        db().execute('SELECT 1')
        return jsonify(status='ok', service='Gym TN')

    @app.get('/api/auth/session')
    def auth_session():
        if 'csrf_token' not in session:
            session['csrf_token'] = secrets.token_hex(32)
        return jsonify(user=g.user, csrf_token=session['csrf_token'], demo_payments=app.config['DEMO_PAYMENTS'])

    @app.post('/api/auth/register')
    def register():
        rate_limit('register', 10, 3600)
        body = data()
        name, email, password = text_field(body, 'name', 2, 80), email_field(body), password_field(body)
        phone = text_field(body, 'phone', 0, 20)
        if one('SELECT id FROM users WHERE email=?', (email,)):
            raise ApiError('Email này đã được đăng ký.', 409)
        cursor = db().execute('INSERT INTO users(name,email,password_hash,phone,created_at) VALUES (?,?,?,?,?)', (name, email, generate_password_hash(password), phone, stamp()))
        return auth_response(one('SELECT * FROM users WHERE id=?', (cursor.lastrowid,))), 201

    @app.post('/api/auth/login')
    @app.post('/api/auth/admin-login')
    def login():
        rate_limit('login', 20, 900)
        body = data()
        email, password = email_field(body), password_field(body, minimum=1)
        user = one('SELECT * FROM users WHERE email=?', (email,))
        if not user or not check_password_hash(user['password_hash'], password) or not user['active']:
            raise ApiError('Email hoặc mật khẩu không chính xác, hoặc tài khoản đã bị khóa.', 401)
        if request.path.endswith('/admin-login') and user['role'] != 'admin':
            raise ApiError('Cổng đăng nhập này chỉ dành cho tài khoản quản trị viên.', 403)
        return auth_response(user)

    @app.post('/api/auth/logout')
    def logout():
        session.clear()
        session['csrf_token'] = secrets.token_hex(32)
        return jsonify(message='Đã đăng xuất.', csrf_token=session['csrf_token'])

    @app.put('/api/me')
    @require_login()
    def profile():
        body = data()
        db().execute('UPDATE users SET name=?,phone=? WHERE id=?', (text_field(body, 'name', 2, 80), text_field(body, 'phone', 0, 20), g.user['id']))
        return jsonify(message='Đã cập nhật hồ sơ.')

    @app.put('/api/me/password')
    @require_login()
    def change_password():
        rate_limit('password', 10, 900)
        body = data()
        user = one('SELECT * FROM users WHERE id=?', (g.user['id'],))
        if not check_password_hash(user['password_hash'], password_field(body, 'current_password', minimum=1)):
            raise ApiError('Mật khẩu hiện tại không đúng.')
        db().execute('UPDATE users SET password_hash=?,session_version=session_version+1 WHERE id=?', (generate_password_hash(password_field(body, 'new_password')), user['id']))
        session['version'] = user['session_version'] + 1
        return jsonify(message='Đã đổi mật khẩu và đăng xuất các phiên khác.')

    @app.get('/api/plans')
    def plans():
        return jsonify(plans=plans_data())

    @app.get('/api/trainers')
    def trainers():
        return jsonify(trainers=rows('SELECT id,name,specialty,bio,experience,image,active FROM trainers WHERE active=1 ORDER BY id'))

    @app.get('/api/classes')
    def classes():
        return jsonify(classes=classes_data())

    @app.get('/api/posts')
    def posts():
        return jsonify(posts=rows('SELECT id,title,category,excerpt,image,created_at FROM posts WHERE published=1 ORDER BY created_at DESC'))

    @app.get('/api/posts/<int:post_id>')
    def post(post_id):
        item = one('SELECT * FROM posts WHERE id=? AND published=1', (post_id,))
        if not item:
            raise ApiError('Bài viết không tồn tại.', 404)
        return jsonify(post=item)

    @app.post('/api/contacts')
    def contact():
        rate_limit('contact', 10, 3600)
        body = data()
        db().execute('INSERT INTO contacts(name,email,phone,topic,message,created_at) VALUES (?,?,?,?,?,?)', (text_field(body, 'name', 2, 80), email_field(body), text_field(body, 'phone', 0, 20), text_field(body, 'topic', 2, 100), text_field(body, 'message', 10, 3000), stamp()))
        return jsonify(message='Đã nhận yêu cầu. Đội ngũ Gym TN sẽ liên hệ với bạn.'), 201

    @app.get('/api/me/dashboard')
    @require_login()
    def dashboard():
        uid = g.user['id']
        return jsonify(
            memberships=rows('SELECT * FROM memberships WHERE user_id=? ORDER BY ends_at DESC', (uid,)),
            orders=rows('SELECT * FROM orders WHERE user_id=? ORDER BY id DESC', (uid,)),
            bookings=rows('''SELECT b.*,c.title,c.starts_at,c.duration_minutes,c.room,c.status class_status,t.name trainer_name
                FROM bookings b JOIN classes c ON c.id=b.class_id JOIN trainers t ON t.id=c.trainer_id WHERE b.user_id=? ORDER BY c.starts_at DESC''', (uid,)),
            progress=rows('SELECT * FROM progress WHERE user_id=? ORDER BY recorded_on', (uid,)),
            workouts=rows('SELECT * FROM workouts WHERE user_id=? ORDER BY recorded_on DESC,id DESC', (uid,)))

    @app.post('/api/orders')
    @require_login()
    def create_order():
        rate_limit('orders', 30, 3600)
        body = data()
        plan_id = number(body, 'plan_id', 1, 2147483647)
        method = body.get('payment_method', 'cash')
        if method not in ('cash', 'demo') or (method == 'demo' and not app.config['DEMO_PAYMENTS']):
            raise ApiError('Phương thức thanh toán không được hỗ trợ.')
        db().execute('BEGIN IMMEDIATE')
        plan = one('SELECT * FROM plans WHERE id=? AND active=1', (plan_id,))
        if not plan:
            raise ApiError('Gói tập không còn khả dụng.', 404)
        existing = one("SELECT id FROM orders WHERE user_id=? AND plan_id=? AND status='pending'", (g.user['id'], plan_id))
        if existing:
            raise ApiError('Bạn đã có đơn chờ thanh toán cho gói này. Xem tại trang hội viên.', 409)
        cursor = db().execute('''INSERT INTO orders(user_id,plan_id,plan_name,amount,duration_days,payment_method,created_at)
            VALUES (?,?,?,?,?,?,?)''', (g.user['id'], plan['id'], plan['name'], plan['price'], plan['duration_days'], method, stamp()))
        db().commit()
        return jsonify(order=one('SELECT * FROM orders WHERE id=?', (cursor.lastrowid,))), 201

    @app.post('/api/orders/<int:order_id>/pay-demo')
    @require_login()
    def demo_pay(order_id):
        if not app.config['DEMO_PAYMENTS']:
            raise ApiError('Thanh toán mô phỏng đã tắt.', 403)
        db().execute('BEGIN IMMEDIATE')
        order = one('SELECT * FROM orders WHERE id=? AND user_id=?', (order_id, g.user['id']))
        if not order:
            raise ApiError('Không tìm thấy đơn hàng.', 404)
        if order['payment_method'] != 'demo':
            raise ApiError('Đơn này cần thanh toán tại quầy.')
        complete_order(order)
        db().commit()
        return jsonify(message='Thanh toán mô phỏng thành công. Gói tập đã được kích hoạt.')

    @app.post('/api/orders/<int:order_id>/cancel')
    @require_login()
    def cancel_order(order_id):
        cursor = db().execute("UPDATE orders SET status='cancelled' WHERE id=? AND user_id=? AND status='pending'", (order_id, g.user['id']))
        if cursor.rowcount == 0:
            raise ApiError('Chỉ có thể hủy đơn của bạn đang chờ thanh toán.', 409)
        return jsonify(message='Đã hủy đơn hàng.')

    @app.post('/api/bookings')
    @require_login()
    def book():
        class_id = number(data(), 'class_id', 1, 2147483647)
        db().execute('BEGIN IMMEDIATE')
        cls = one("SELECT * FROM classes WHERE id=? AND status='scheduled'", (class_id,))
        if not cls or cls['starts_at'] <= stamp():
            raise ApiError('Lớp đã bắt đầu hoặc không còn khả dụng.', 409)
        existing = one('SELECT * FROM bookings WHERE user_id=? AND class_id=?', (g.user['id'], class_id))
        if existing and existing['status'] != 'cancelled':
            raise ApiError('Bạn đã đặt lớp này.', 409)
        if not one('SELECT id FROM memberships WHERE user_id=? AND starts_at<=? AND ends_at>?', (g.user['id'], cls['starts_at'], cls['starts_at'])):
            raise ApiError('Bạn cần gói tập còn hiệu lực tại thời điểm diễn ra lớp.', 403)
        count = one("SELECT COUNT(*) total FROM bookings WHERE class_id=? AND status IN ('confirmed','attended')", (class_id,))['total']
        if count >= cls['capacity']:
            raise ApiError('Lớp đã đủ chỗ.', 409)
        end = stamp(datetime.fromisoformat(cls['starts_at']) + timedelta(minutes=cls['duration_minutes']))
        conflicts = rows("SELECT c.* FROM bookings b JOIN classes c ON c.id=b.class_id WHERE b.user_id=? AND b.status='confirmed' AND c.status='scheduled' AND c.starts_at<?", (g.user['id'], end))
        if any(datetime.fromisoformat(c['starts_at']) + timedelta(minutes=c['duration_minutes']) > datetime.fromisoformat(cls['starts_at']) for c in conflicts):
            raise ApiError('Lớp này trùng với lịch bạn đã đặt.', 409)
        db().execute("INSERT INTO bookings(user_id,class_id,created_at) VALUES (?,?,?) ON CONFLICT(user_id,class_id) DO UPDATE SET status='confirmed',created_at=excluded.created_at", (g.user['id'], class_id, stamp()))
        db().commit()
        return jsonify(message='Đặt lớp thành công. Hẹn gặp bạn tại Gym TN!'), 201

    @app.post('/api/bookings/<int:booking_id>/cancel')
    @require_login()
    def cancel_booking(booking_id):
        db().execute('BEGIN IMMEDIATE')
        booking = one('SELECT b.*,c.starts_at FROM bookings b JOIN classes c ON c.id=b.class_id WHERE b.id=? AND b.user_id=?', (booking_id, g.user['id']))
        if not booking or booking['status'] != 'confirmed' or booking['starts_at'] <= stamp():
            raise ApiError('Chỉ có thể hủy lịch đã xác nhận trước khi lớp bắt đầu.', 409)
        db().execute("UPDATE bookings SET status='cancelled' WHERE id=?", (booking_id,))
        db().commit()
        return jsonify(message='Đã hủy đặt lớp.')

    @app.post('/api/me/progress')
    @require_login()
    def save_progress():
        body = data()
        db().execute('''INSERT INTO progress(user_id,recorded_on,weight,height,note) VALUES (?,?,?,?,?)
            ON CONFLICT(user_id,recorded_on) DO UPDATE SET weight=excluded.weight,height=excluded.height,note=excluded.note''',
            (g.user['id'], date_field(body, 'recorded_on'), number(body, 'weight', 20, 350, False), number(body, 'height', 80, 250, False), text_field(body, 'note', 0, 500)))
        return jsonify(message='Đã lưu chỉ số cơ thể.'), 201

    @app.post('/api/me/workouts')
    @require_login()
    def save_workout():
        body = data()
        db().execute('INSERT INTO workouts(user_id,title,recorded_on,duration_minutes,note) VALUES (?,?,?,?,?)',
            (g.user['id'], text_field(body, 'title', 2, 100), date_field(body, 'recorded_on'), number(body, 'duration_minutes', 1, 600), text_field(body, 'note', 0, 1000)))
        return jsonify(message='Đã lưu buổi tập.'), 201

    @app.delete('/api/me/<resource>/<int:item_id>')
    @require_login()
    def delete_log(resource, item_id):
        if resource not in ('progress', 'workouts'):
            raise ApiError('Không tìm thấy tài nguyên.', 404)
        cursor = db().execute(f'DELETE FROM {resource} WHERE id=? AND user_id=?', (item_id, g.user['id']))
        if not cursor.rowcount:
            raise ApiError('Không tìm thấy bản ghi.', 404)
        return jsonify(message='Đã xóa bản ghi.')

    register_admin(app)
    from accounts import register_accounts
    register_accounts(app)

    @app.cli.command('seed')
    def seed_command():
        """Create demo catalog, two demo accounts, and upcoming classes once."""
        from seed import seed_database
        seed_database()
        click.echo('Demo data ready: admin@gymtn.vn / Admin@12345; member@gymtn.vn / Member@12345')

    @app.cli.command('create-admin')
    @click.option('--email', prompt=True)
    @click.option('--name', prompt=True)
    @click.password_option(confirmation_prompt=True)
    def create_admin(email, name, password):
        email = email_field({'email': email})
        password_field({'password': password})
        name = text_field({'name': name}, 'name', 2, 80)
        db().execute("INSERT INTO users(name,email,password_hash,role,created_at) VALUES (?,?,?,'admin',?)", (name, email, generate_password_hash(password), stamp()))
        click.echo('Administrator created.')

    @app.get('/')
    @app.get('/<path:path>')
    def frontend(path=''):
        if path == 'api' or path.startswith('api/'):
            raise ApiError('Không tìm thấy API.', 404)
        dist = BASE.parent / 'frontend' / 'dist'
        target = (dist / path).resolve()
        if not target.is_relative_to(dist.resolve()):
            raise ApiError('Không tìm thấy tài nguyên.', 404)
        if path and target.is_file():
            return send_from_directory(dist, path)
        if path.startswith('assets/') or '.' in Path(path).name:
            raise ApiError('Không tìm thấy tệp.', 404)
        if (dist / 'index.html').exists():
            return send_from_directory(dist, 'index.html')
        return jsonify(message='Gym TN API đang chạy. Mở frontend tại http://localhost:5173 hoặc chạy npm run build.')

    return app


def register_admin(app):
    @app.get('/api/admin/overview')
    @require_login(admin=True)
    def overview():
        return jsonify(
            stats=one("""SELECT
            (SELECT COUNT(*) FROM users WHERE role='member') members,
            (SELECT COUNT(DISTINCT m.user_id) FROM memberships m JOIN users u ON u.id=m.user_id WHERE u.role='member' AND u.active=1 AND m.starts_at<=? AND m.ends_at>?) active_members,
            (SELECT COALESCE(SUM(amount),0) FROM orders WHERE status='paid') revenue,
            (SELECT COUNT(*) FROM orders WHERE status='pending') pending_orders,
            (SELECT COUNT(*) FROM contacts WHERE status='new') new_contacts,
            (SELECT COUNT(*) FROM trainers WHERE active=1) trainers,
            (SELECT COUNT(*) FROM plans WHERE active=1) plans,
            (SELECT COUNT(*) FROM classes WHERE status='scheduled' AND starts_at>=?) upcoming_classes""", (stamp(), stamp(), stamp())),
            revenue=rows("SELECT substr(paid_at,1,7) month,SUM(amount) amount FROM orders WHERE status='paid' GROUP BY month ORDER BY month DESC LIMIT 6"),
            recent_orders=rows('SELECT o.*,u.name user_name,u.email FROM orders o JOIN users u ON u.id=o.user_id ORDER BY o.id DESC LIMIT 8'))

    @app.get('/api/admin/<resource>')
    @require_login(admin=True)
    def admin_list(resource):
        if resource == 'plans':
            result = plans_data(True)
        elif resource == 'classes':
            result = classes_data(True)
        elif resource == 'trainers':
            result = rows('SELECT t.*,u.email account_email,u.active account_active FROM trainers t LEFT JOIN users u ON u.id=t.user_id ORDER BY t.id DESC')
        elif resource in ('posts', 'contacts'):
            result = rows(f'SELECT * FROM {resource} ORDER BY id DESC')
        elif resource == 'users':
            result = rows('''SELECT u.id,u.name,u.email,u.phone,u.role,u.active,u.created_at,
                t.id trainer_id,t.name trainer_name,
                (SELECT MAX(m.ends_at) FROM memberships m WHERE m.user_id=u.id) membership_ends_at
                FROM users u LEFT JOIN trainers t ON t.user_id=u.id ORDER BY u.id DESC''')
        elif resource == 'orders':
            result = rows('SELECT o.*,u.name user_name,u.email FROM orders o JOIN users u ON u.id=o.user_id ORDER BY o.id DESC')
        elif resource == 'bookings':
            result = rows('''SELECT b.*,u.name user_name,u.email,c.title,c.starts_at,c.status class_status FROM bookings b
                JOIN users u ON u.id=b.user_id JOIN classes c ON c.id=b.class_id ORDER BY c.starts_at DESC,b.id DESC''')
        else:
            raise ApiError('Không tìm thấy tài nguyên.', 404)
        return jsonify(items=result)

    def validate_resource(resource, body):
        if resource == 'plans':
            features = body.get('features')
            if not isinstance(features, list) or not 1 <= len(features) <= 15 or any(not isinstance(f, str) or not 1 <= len(f.strip()) <= 150 for f in features):
                raise ApiError('Gói tập cần 1–15 quyền lợi, mỗi quyền lợi tối đa 150 ký tự.')
            return dict(name=text_field(body, 'name', 2, 80), tagline=text_field(body, 'tagline', 2, 180), price=number(body, 'price', 0, 100000000), duration_days=number(body, 'duration_days', 1, 730), features=json.dumps([f.strip() for f in features], ensure_ascii=False), popular=flag(body, 'popular', 0), active=flag(body, 'active'))
        if resource == 'trainers':
            return dict(name=text_field(body, 'name', 2, 80), specialty=text_field(body, 'specialty', 2, 100), bio=text_field(body, 'bio', 10, 2000), experience=number(body, 'experience', 0, 60), image=image_field(body), active=flag(body, 'active'))
        if resource == 'posts':
            return dict(title=text_field(body, 'title', 5, 180), category=text_field(body, 'category', 2, 60), excerpt=text_field(body, 'excerpt', 10, 500), content=text_field(body, 'content', 20, 20000), image=image_field(body), published=flag(body, 'published'))
        if resource == 'classes':
            try:
                starts = datetime.fromisoformat(text_field(body, 'starts_at', 10, 40))
                if starts.tzinfo is None:
                    starts = starts.replace(tzinfo=TZ)
                starts = starts.astimezone(TZ)
            except ValueError:
                raise ApiError('Thời gian lớp không hợp lệ.')
            if starts <= now():
                raise ApiError('Thời gian lớp phải ở tương lai.')
            trainer_id = number(body, 'trainer_id', 1, 2147483647)
            if not one('SELECT id FROM trainers WHERE id=? AND active=1', (trainer_id,)):
                raise ApiError('Huấn luyện viên không khả dụng.')
            return dict(title=text_field(body, 'title', 2, 100), category=text_field(body, 'category', 2, 60), trainer_id=trainer_id, starts_at=stamp(starts), duration_minutes=number(body, 'duration_minutes', 15, 240), capacity=number(body, 'capacity', 1, 200), room=text_field(body, 'room', 2, 80), level=text_field(body, 'level', 2, 80), description=text_field(body, 'description', 0, 1000))
        raise ApiError('Không hỗ trợ thao tác.', 404)

    def check_class_slot(values, exclude_id=0):
        start = datetime.fromisoformat(values['starts_at'])
        end = stamp(start + timedelta(minutes=values['duration_minutes']))
        candidates = rows("SELECT * FROM classes WHERE status='scheduled' AND id!=? AND (trainer_id=? OR room=?) AND starts_at<?", (exclude_id, values['trainer_id'], values['room'], end))
        if any(datetime.fromisoformat(c['starts_at']) + timedelta(minutes=c['duration_minutes']) > start for c in candidates):
            raise ApiError('Huấn luyện viên hoặc phòng tập đã có lớp trùng khung giờ.', 409)

    @app.post('/api/admin/<resource>')
    @require_login(admin=True)
    def admin_create(resource):
        values = validate_resource(resource, data())
        db().execute('BEGIN IMMEDIATE')
        if resource == 'classes':
            check_class_slot(values)
        if resource == 'posts':
            values['created_at'] = stamp()
        keys = ','.join(values)
        placeholders = ','.join('?' for _ in values)
        cursor = db().execute(f'INSERT INTO {resource}({keys}) VALUES ({placeholders})', tuple(values.values()))
        db().commit()
        return jsonify(id=cursor.lastrowid, message='Đã tạo mới.'), 201

    @app.put('/api/admin/<resource>/<int:item_id>')
    @require_login(admin=True)
    def admin_update(resource, item_id):
        values = validate_resource(resource, data())
        db().execute('BEGIN IMMEDIATE')
        existing = one(f'SELECT * FROM {resource} WHERE id=?', (item_id,))
        if not existing:
            raise ApiError('Không tìm thấy bản ghi.', 404)
        if resource == 'classes':
            if existing['status'] == 'cancelled':
                raise ApiError('Lớp đã hủy. Hãy tạo lớp mới.', 409)
            booked = one("SELECT COUNT(*) total FROM bookings WHERE class_id=? AND status IN ('confirmed','attended')", (item_id,))['total']
            if values['capacity'] < booked:
                raise ApiError('Sức chứa không được nhỏ hơn số chỗ đã đặt.')
            if booked and any(values[k] != existing[k] for k in ('starts_at', 'duration_minutes', 'trainer_id')):
                raise ApiError('Lớp đã có người đăng ký. Hãy hủy lớp và tạo lịch mới nếu đổi giờ hoặc huấn luyện viên.', 409)
            check_class_slot(values, item_id)
        assignments = ','.join(f'{key}=?' for key in values)
        db().execute(f'UPDATE {resource} SET {assignments} WHERE id=?', (*values.values(), item_id))
        db().commit()
        return jsonify(message='Đã lưu thay đổi.')

    @app.delete('/api/admin/<resource>/<int:item_id>')
    @require_login(admin=True)
    def admin_delete(resource, item_id):
        columns = {'plans': 'active', 'trainers': 'active', 'posts': 'published'}
        db().execute('BEGIN IMMEDIATE')
        if resource == 'classes':
            cursor = db().execute("UPDATE classes SET status='cancelled' WHERE id=?", (item_id,))
            db().execute("UPDATE bookings SET status='cancelled' WHERE class_id=? AND status='confirmed'", (item_id,))
        elif resource in columns:
            cursor = db().execute(f'UPDATE {resource} SET {columns[resource]}=0 WHERE id=?', (item_id,))
        else:
            raise ApiError('Không hỗ trợ thao tác.', 404)
        if not cursor.rowcount:
            raise ApiError('Không tìm thấy bản ghi.', 404)
        db().commit()
        return jsonify(message='Đã ẩn hoặc hủy mục đã chọn.')

    @app.patch('/api/admin/users/<int:user_id>')
    @require_login(admin=True)
    def update_user(user_id):
        from accounts import save_account
        return save_account(data(), user_id)

    @app.post('/api/admin/orders/<int:order_id>/confirm')
    @require_login(admin=True)
    def confirm_order(order_id):
        db().execute('BEGIN IMMEDIATE')
        order = one('SELECT * FROM orders WHERE id=?', (order_id,))
        if not order:
            raise ApiError('Không tìm thấy đơn hàng.', 404)
        complete_order(order)
        db().commit()
        return jsonify(message='Đã xác nhận thanh toán và kích hoạt gói tập.')

    @app.patch('/api/admin/contacts/<int:contact_id>')
    @require_login(admin=True)
    def update_contact(contact_id):
        status = data().get('status')
        if status not in ('new', 'contacted', 'closed'):
            raise ApiError('Trạng thái không hợp lệ.')
        cursor = db().execute('UPDATE contacts SET status=? WHERE id=?', (status, contact_id))
        if not cursor.rowcount:
            raise ApiError('Không tìm thấy yêu cầu.', 404)
        return jsonify(message='Đã cập nhật yêu cầu.')

    @app.patch('/api/admin/bookings/<int:booking_id>')
    @require_login(admin=True)
    def attendance(booking_id):
        status = data().get('status')
        if status not in ('attended', 'confirmed'):
            raise ApiError('Trạng thái không hợp lệ.')
        db().execute('BEGIN IMMEDIATE')
        booking = one('SELECT b.*,c.starts_at,c.status class_status FROM bookings b JOIN classes c ON c.id=b.class_id WHERE b.id=?', (booking_id,))
        if not booking or booking['status'] == 'cancelled' or booking['class_status'] == 'cancelled':
            raise ApiError('Không thể điểm danh lịch đã hủy.', 409)
        if booking['starts_at'] > stamp():
            raise ApiError('Chỉ điểm danh khi lớp đã bắt đầu.', 409)
        db().execute('UPDATE bookings SET status=? WHERE id=?', (status, booking_id))
        db().commit()
        return jsonify(message='Đã cập nhật điểm danh.')


if __name__ == '__main__':
    create_app().run(host='127.0.0.1', port=int(os.getenv('PORT', '5000')), debug=False)
