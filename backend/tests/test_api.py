from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta

import pytest

from app import db, now, one, stamp
from conftest import login, mutate, register


def first_class(client):
    return client.get('/api/classes').get_json()['classes'][0]


def create_order(client, plan_id=1, method='demo', **extras):
    return mutate(client, '/api/orders', {'plan_id': plan_id, 'payment_method': method, **extras})


def pay(client, order_id):
    return mutate(client, f'/api/orders/{order_id}/pay-demo')


def test_public_catalog_and_api_404(client):
    for path, key, minimum in [('plans', 'plans', 3), ('trainers', 'trainers', 3), ('classes', 'classes', 42), ('posts', 'posts', 3)]:
        response = client.get(f'/api/{path}')
        assert response.status_code == 200
        assert len(response.json[key]) >= minimum
    assert client.get('/api/posts/1').json['post']['content']
    assert client.get('/api/missing').status_code == 404
    assert client.get('/api/missing').is_json
    assert client.get('/api/posts/9999').status_code == 404


def test_csrf_required_including_anonymous(client):
    response = client.post('/api/auth/register', json={'name': 'No token'})
    assert response.status_code == 403
    assert response.json['code'] == 'csrf_expired'
    assert client.post('/api/contacts', json={}).status_code == 403
    token = client.get('/api/auth/session').json['csrf_token']
    assert len(token) == 64
    assert client.post('/api/auth/login', json={}, headers={'X-CSRF-Token': 'bad'}).status_code == 403


def test_registration_login_logout_and_case_insensitive_email(client):
    assert register(client, 'New@Example.com').status_code == 201
    assert client.get('/api/auth/session').json['user']['role'] == 'member'
    assert 'password_hash' not in client.get('/api/auth/session').json['user']
    mutate(client, '/api/auth/logout')
    assert client.get('/api/me/dashboard').status_code == 401
    assert mutate(client, '/api/auth/login', {'email': 'new@example.com', 'password': 'Password@123'}).status_code == 200
    assert register(client, 'NEW@example.com').status_code == 409


@pytest.mark.parametrize('body', [None, [], {'email': 'invalid', 'name': 'XX', 'password': 'Password123'}, {'email': 'ok@test.com', 'name': 'XX', 'password': 'short'}])
def test_registration_validation(client, body):
    assert mutate(client, '/api/auth/register', body).status_code == 400


def test_member_cannot_access_admin_or_assign_role(client):
    assert mutate(client, '/api/auth/register', {'name': 'Attacker', 'email': 'attack@example.com', 'password': 'Password123', 'role': 'admin'}).status_code == 201
    assert client.get('/api/auth/session').json['user']['role'] == 'member'
    assert client.get('/api/admin/overview').status_code == 403
    assert mutate(client, '/api/admin/plans', {}, method='post').status_code == 403
    assert mutate(client, '/api/admin/users/1', {'role': 'admin', 'active': 1}, method='patch').status_code == 403


def test_order_price_snapshot_and_pending_duplicate(client, app):
    login(client)
    response = create_order(client, amount=1, duration_days=9999, status='paid')
    assert response.status_code == 201
    order = response.json['order']
    assert order['amount'] == 399000 and order['duration_days'] == 30 and order['status'] == 'pending'
    assert create_order(client).status_code == 409
    with app.app_context():
        db().execute('UPDATE plans SET price=999999 WHERE id=1')
    assert pay(client, order['id']).status_code == 200
    assert client.get('/api/me/dashboard').json['orders'][0]['amount'] == 399000


def test_payment_replay_does_not_extend_twice(client):
    login(client)
    order = create_order(client).json['order']
    assert pay(client, order['id']).status_code == 200
    before = client.get('/api/me/dashboard').json['memberships']
    assert pay(client, order['id']).status_code == 409
    assert client.get('/api/me/dashboard').json['memberships'] == before


def test_membership_renewal_is_stacked(client):
    login(client)
    old = client.get('/api/me/dashboard').json['memberships'][0]
    order = create_order(client, plan_id=2).json['order']
    pay(client, order['id'])
    membership = client.get('/api/me/dashboard').json['memberships'][0]
    assert membership['starts_at'] == old['ends_at']
    from datetime import datetime
    assert datetime.fromisoformat(membership['ends_at']) - datetime.fromisoformat(membership['starts_at']) == timedelta(days=90)


def test_cash_requires_admin_confirmation_and_demo_switch(client, app):
    login(client)
    order = create_order(client, method='cash').json['order']
    assert pay(client, order['id']).status_code == 400
    assert mutate(client, f"/api/admin/orders/{order['id']}/confirm").status_code == 403
    admin = app.test_client(); login(admin, True)
    assert mutate(admin, f"/api/admin/orders/{order['id']}/confirm").status_code == 200
    assert mutate(admin, f"/api/admin/orders/{order['id']}/confirm").status_code == 409
    app.config['DEMO_PAYMENTS'] = False
    assert create_order(client).status_code == 400
    assert pay(client, order['id']).status_code == 403


def test_cancelled_orders_cannot_be_paid(client):
    login(client)
    order = create_order(client).json['order']
    assert mutate(client, f"/api/orders/{order['id']}/cancel").status_code == 200
    assert pay(client, order['id']).status_code == 409


def test_order_ownership(client, app):
    login(client)
    order = create_order(client).json['order']
    other = app.test_client(); register(other)
    assert pay(other, order['id']).status_code == 404
    assert mutate(other, f"/api/orders/{order['id']}/cancel").status_code == 409
    assert other.get('/api/me/dashboard').json['orders'] == []


def test_booking_requires_membership_at_class_time(client, app):
    register(client)
    cls = first_class(client)
    assert mutate(client, '/api/bookings', {'class_id': cls['id']}).status_code == 403
    order = create_order(client).json['order']; pay(client, order['id'])
    with app.app_context():
        db().execute('UPDATE memberships SET ends_at=? WHERE user_id=3', (stamp(now() + timedelta(hours=1)),))
    assert mutate(client, '/api/bookings', {'class_id': cls['id']}).status_code == 403


def test_booking_duplicate_cancel_rebook_and_overlap(client, app):
    login(client)
    cls = first_class(client)
    assert mutate(client, '/api/bookings', {'class_id': cls['id']}).status_code == 201
    assert mutate(client, '/api/bookings', {'class_id': cls['id']}).status_code == 409
    with app.app_context():
        overlap_id = db().execute('INSERT INTO classes(title,category,trainer_id,starts_at,duration_minutes,capacity,room,level) VALUES (?,?,?,?,?,?,?,?)', ('Overlap', 'Yoga', cls['trainer_id'], cls['starts_at'], 60, 10, 'Other room', 'All')).lastrowid
    assert mutate(client, '/api/bookings', {'class_id': overlap_id}).status_code == 409
    booking = client.get('/api/me/dashboard').json['bookings'][0]
    assert mutate(client, f"/api/bookings/{booking['id']}/cancel").status_code == 200
    assert mutate(client, '/api/bookings', {'class_id': cls['id']}).status_code == 201
    assert len(client.get('/api/me/dashboard').json['bookings']) == 1


def test_capacity_transaction_under_concurrent_requests(client, app):
    login(client)
    other = app.test_client(); register(other)
    order = create_order(other).json['order']; pay(other, order['id'])
    cls = first_class(client)
    with app.app_context():
        db().execute('UPDATE classes SET capacity=1 WHERE id=?', (cls['id'],))
    token1 = client.get('/api/auth/session').json['csrf_token']
    token2 = other.get('/api/auth/session').json['csrf_token']
    def book(pair):
        actor, token = pair
        return actor.post('/api/bookings', json={'class_id': cls['id']}, headers={'X-CSRF-Token': token}).status_code
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(book, [(client, token1), (other, token2)]))
    assert sorted(results) == [201, 409]
    with app.app_context():
        assert one("SELECT COUNT(*) total FROM bookings WHERE class_id=? AND status='confirmed'", (cls['id'],))['total'] == 1


def test_cancelled_class_updates_member_booking(client, app):
    login(client); cls = first_class(client)
    mutate(client, '/api/bookings', {'class_id': cls['id']})
    admin = app.test_client(); login(admin, True)
    assert mutate(admin, f"/api/admin/classes/{cls['id']}", method='delete').status_code == 200
    assert client.get('/api/me/dashboard').json['bookings'][0]['status'] == 'cancelled'
    assert mutate(client, '/api/bookings', {'class_id': cls['id']}).status_code == 409


def test_admin_cannot_move_booked_class_or_reduce_capacity(client, app):
    login(client); cls = first_class(client)
    mutate(client, '/api/bookings', {'class_id': cls['id']})
    other = app.test_client(); register(other)
    pay(other, create_order(other).json['order']['id'])
    mutate(other, '/api/bookings', {'class_id': cls['id']})
    admin = app.test_client(); login(admin, True)
    assert mutate(admin, f"/api/admin/classes/{cls['id']}", {**cls, 'capacity': 1}, method='put').status_code == 400
    assert mutate(admin, f"/api/admin/classes/{cls['id']}", {**cls, 'starts_at': stamp(now() + timedelta(days=10))}, method='put').status_code == 409
    assert mutate(admin, f"/api/admin/classes/{cls['id']}", {**cls, 'capacity': 25}, method='put').status_code == 200


def test_progress_upsert_validation_and_ownership(client, app):
    login(client)
    body = {'recorded_on': now().date().isoformat(), 'weight': 70, 'height': 170, 'note': 'Test'}
    assert mutate(client, '/api/me/progress', body).status_code == 201
    assert mutate(client, '/api/me/progress', {**body, 'weight': 71}).status_code == 201
    result = client.get('/api/me/dashboard').json['progress']
    assert len(result) == 4 and result[-1]['weight'] == 71
    assert mutate(client, '/api/me/progress', {**body, 'weight': float('nan')}).status_code == 400
    assert mutate(client, '/api/me/progress', {**body, 'weight': 2}).status_code == 400
    assert mutate(client, '/api/me/progress', {**body, 'recorded_on': '2099-01-01'}).status_code == 400
    other = app.test_client(); register(other)
    assert mutate(other, f"/api/me/progress/{result[-1]['id']}", method='delete').status_code == 404
    assert mutate(client, f"/api/me/progress/{result[-1]['id']}", method='delete').status_code == 200


def test_workout_crud(client):
    login(client)
    assert mutate(client, '/api/me/workouts', {'title': 'Leg day', 'recorded_on': now().date().isoformat(), 'duration_minutes': 60, 'note': 'Squats'}).status_code == 201
    item = client.get('/api/me/dashboard').json['workouts'][0]
    assert item['title'] == 'Leg day'
    assert mutate(client, f"/api/me/workouts/{item['id']}", method='delete').status_code == 200


def test_password_change_invalidates_other_sessions(client, app):
    login(client)
    second = app.test_client(); login(second)
    assert mutate(client, '/api/me/password', {'current_password': 'wrong', 'new_password': 'NewPassword123'}, method='put').status_code == 400
    assert mutate(client, '/api/me/password', {'current_password': 'Member@12345', 'new_password': 'NewPassword123'}, method='put').status_code == 200
    assert client.get('/api/me/dashboard').status_code == 200
    assert second.get('/api/me/dashboard').status_code == 401
    assert login(second).status_code == 401


def test_admin_lock_revokes_sessions_and_self_change_is_blocked(client, app):
    login(client)
    admin = app.test_client(); login(admin, True)
    assert mutate(admin, '/api/admin/users/1', {'active': 0, 'role': 'member'}, method='patch').status_code == 400
    assert mutate(admin, '/api/admin/users/2', {'active': 0, 'role': 'member'}, method='patch').status_code == 200
    assert client.get('/api/me/dashboard').status_code == 401
    assert login(client).status_code == 401


def test_admin_catalog_crud_and_publication(client):
    login(client, True)
    body = {'name': 'Test plan', 'tagline': 'Test description', 'price': 123000, 'duration_days': 15, 'features': ['Gym'], 'active': 1, 'popular': 0}
    response = mutate(client, '/api/admin/plans', body)
    assert response.status_code == 201
    pid = response.json['id']
    assert mutate(client, f'/api/admin/plans/{pid}', {**body, 'price': 234000}, method='put').status_code == 200
    assert mutate(client, f'/api/admin/plans/{pid}', method='delete').status_code == 200
    assert pid not in [p['id'] for p in client.get('/api/plans').json['plans']]
    post = {'title': 'A useful draft', 'category': 'Test', 'excerpt': 'Test excerpt here', 'content': 'Content of the unpublished article.', 'image': '', 'published': 0}
    response = mutate(client, '/api/admin/posts', post)
    assert response.status_code == 201
    assert client.get(f"/api/posts/{response.json['id']}").status_code == 404
    assert mutate(client, '/api/admin/users', {'name': 'incomplete account'}).status_code == 400
    assert mutate(client, '/api/admin/trainers', {'name': 'Test trainer', 'specialty': 'Yoga', 'bio': 'Long enough biography.', 'experience': 5, 'image': 'javascript:alert(1)', 'active': 1}).status_code == 400


def test_contacts_and_admin_processing(client, app):
    body = {'name': 'Test Contact', 'email': 'hello@example.com', 'phone': '', 'topic': 'PT', 'message': 'Please help with a training plan.'}
    assert mutate(client, '/api/contacts', body).status_code == 201
    assert client.get('/api/admin/contacts').status_code == 401
    admin = app.test_client(); login(admin, True)
    item = admin.get('/api/admin/contacts').json['items'][0]
    assert mutate(admin, f"/api/admin/contacts/{item['id']}", {'status': 'contacted'}, method='patch').status_code == 200
    assert admin.get('/api/admin/contacts').json['items'][0]['status'] == 'contacted'


def test_attendance_cannot_be_marked_early(client, app):
    login(client); cls = first_class(client)
    mutate(client, '/api/bookings', {'class_id': cls['id']})
    booking = client.get('/api/me/dashboard').json['bookings'][0]
    admin = app.test_client(); login(admin, True)
    assert mutate(admin, f"/api/admin/bookings/{booking['id']}", {'status': 'attended'}, method='patch').status_code == 409
    with app.app_context():
        db().execute('UPDATE classes SET starts_at=? WHERE id=?', (stamp(now() - timedelta(minutes=15)), cls['id']))
    assert mutate(admin, f"/api/admin/bookings/{booking['id']}", {'status': 'attended'}, method='patch').status_code == 200
    assert mutate(client, f"/api/bookings/{booking['id']}/cancel").status_code == 409


def test_security_headers_and_rate_limiter(client, app):
    response = client.get('/api/auth/session')
    assert response.headers['Cache-Control'] == 'no-store'
    assert response.headers['X-Content-Type-Options'] == 'nosniff'
    assert 'HttpOnly' in response.headers['Set-Cookie']
    app.config['TESTING'] = False
    for _ in range(20):
        assert mutate(client, '/api/auth/login', {'email': 'none@example.com', 'password': 'wrong'}).status_code == 401
    assert mutate(client, '/api/auth/login', {'email': 'none@example.com', 'password': 'wrong'}).status_code == 429


def test_seed_is_idempotent_and_retains_edits(client, app):
    from seed import seed_database
    with app.app_context():
        db().execute("UPDATE plans SET name='Edited plan' WHERE id=1")
        seed_database()
        assert one('SELECT COUNT(*) total FROM users')['total'] == 2
        assert one('SELECT COUNT(*) total FROM classes')['total'] == 42
        assert one('SELECT COUNT(*) total FROM memberships')['total'] == 1
        assert one('SELECT name FROM plans WHERE id=1')['name'] == 'Edited plan'


def test_password_whitespace_is_preserved(client):
    body = {'name': 'Space User', 'email': 'space@example.com', 'password': ' Password123 '}
    assert mutate(client, '/api/auth/register', body).status_code == 201
    mutate(client, '/api/auth/logout')
    assert mutate(client, '/api/auth/login', {'email': body['email'], 'password': 'Password123'}).status_code == 401
    assert mutate(client, '/api/auth/login', body).status_code == 200
    assert mutate(client, '/api/me/password', {'current_password': body['password'], 'new_password': ' Another123 '}, method='put').status_code == 200


def test_admin_prevents_trainer_and_room_schedule_collisions(client):
    login(client, True)
    cls = first_class(client)
    assert mutate(client, '/api/admin/classes', cls).status_code == 409
    assert mutate(client, '/api/admin/classes', {**cls, 'room': 'Different room'}).status_code == 409
    assert mutate(client, '/api/admin/classes', {**cls, 'trainer_id': 1 if cls['trainer_id'] != 1 else 2}).status_code == 409
    assert mutate(client, '/api/admin/classes', {**cls, 'trainer_id': 1 if cls['trainer_id'] != 1 else 2, 'room': 'Different room'}).status_code == 201
