import sqlite3
from pathlib import Path
from datetime import timedelta

import pytest

from app import create_app, db, one, now, stamp
from conftest import login, mutate, register
from migrations import migrate_database


def new_account(admin, email='created@example.com', **changes):
    return mutate(admin, '/api/admin/users', {'name': 'New Account', 'email': email, 'password': 'NewPassword123', 'phone': '0901234567', 'role': 'member', 'active': 1, **changes})


def account_login(client, email):
    return mutate(client, '/api/auth/login', {'email': email, 'password': 'NewPassword123'})


def test_admin_login_rejects_member_without_changing_existing_session(client):
    login(client)
    response = mutate(client, '/api/auth/admin-login', {'email': 'member@gymtn.vn', 'password': 'Member@12345'})
    assert response.status_code == 403
    assert client.get('/api/auth/session').json['user']['role'] == 'member'
    response = mutate(client, '/api/auth/admin-login', {'email': 'admin@gymtn.vn', 'password': 'Admin@12345'})
    assert response.status_code == 200
    assert client.get('/api/admin/overview').status_code == 200


def test_account_management_requires_admin(client, app):
    assert new_account(client).status_code == 401
    register(client)
    assert new_account(client, 'blocked@example.com').status_code == 403
    assert mutate(client, '/api/admin/users/1', {'role': 'member', 'active': 0}, method='patch').status_code == 403
    fresh = app.test_client()
    response = mutate(fresh, '/api/auth/register', {'name': 'Self appointed', 'email': 'fake@example.com', 'password': 'Password123', 'role': 'trainer', 'trainer_id': 1})
    assert response.json['user']['role'] == 'member'


def test_admin_creates_edits_and_resets_member_credentials(client, app):
    login(client, True)
    response = new_account(client)
    assert response.status_code == 201
    uid = response.json['id']
    member = app.test_client()
    assert account_login(member, 'created@example.com').status_code == 200
    response = mutate(client, f'/api/admin/users/{uid}', {'name': 'Updated Member', 'email': 'updated@example.com', 'phone': '0912345678', 'role': 'member', 'active': 1, 'password': 'ResetPassword123'}, method='patch')
    assert response.status_code == 200
    assert member.get('/api/me/dashboard').status_code == 401
    assert account_login(member, 'created@example.com').status_code == 401
    assert mutate(member, '/api/auth/login', {'email': 'updated@example.com', 'password': 'ResetPassword123'}).status_code == 200
    user = member.get('/api/auth/session').json['user']
    assert user['name'] == 'Updated Member' and user['phone'] == '0912345678'
    assert 'password_hash' not in str(client.get('/api/admin/users').json)


def test_duplicate_email_rolls_back_edit_and_preserves_password(client, app):
    login(client, True)
    uid = new_account(client).json['id']
    assert mutate(client, f'/api/admin/users/{uid}', {'name': 'Should not save', 'email': 'MEMBER@gymtn.vn'}, method='patch').status_code == 409
    member = app.test_client()
    assert account_login(member, 'created@example.com').status_code == 200
    assert member.get('/api/auth/session').json['user']['name'] == 'New Account'


def test_trainer_requires_unique_existing_profile(client, app):
    login(client, True)
    assert new_account(client, role='trainer').status_code == 400
    assert new_account(client, role='trainer', trainer_id=9999).status_code == 404
    assert new_account(client, role='trainer', trainer_id=1).status_code == 201
    assert new_account(client, 'duplicate@example.com', role='trainer', trainer_id=1).status_code == 409
    with app.app_context():
        assert one('SELECT COUNT(*) total FROM users')['total'] == 3
        assert one('SELECT user_id FROM trainers WHERE id=1')['user_id'] == 3
    public = client.get('/api/trainers').json['trainers'][0]
    assert 'user_id' not in public and 'account_email' not in public
    admin_profile = next(t for t in client.get('/api/admin/trainers').json['items'] if t['id'] == 1)
    assert admin_profile['account_email'] == 'created@example.com'


def test_trainer_sees_only_own_classes_and_cannot_access_admin(client, app):
    login(client, True)
    new_account(client, role='trainer', trainer_id=1)
    trainer = app.test_client(); account_login(trainer, 'created@example.com')
    dashboard = trainer.get('/api/trainer/dashboard')
    assert dashboard.status_code == 200 and len(dashboard.json['classes']) == 14
    assert {cls['trainer_id'] for cls in dashboard.json['classes']} == {1}
    assert trainer.get('/api/admin/users').status_code == 403
    assert trainer.get('/api/admin/orders').status_code == 403
    assert mutate(trainer, '/api/auth/admin-login', {'email': 'created@example.com', 'password': 'NewPassword123'}).status_code == 403
    assert client.get('/api/trainer/dashboard').status_code == 403


def test_trainer_attendance_is_scoped_and_cannot_be_early(client, app):
    login(client, True)
    new_account(client, 'teacher-a@example.com', role='trainer', trainer_id=1)
    new_account(client, 'teacher-b@example.com', role='trainer', trainer_id=2)
    member = app.test_client(); login(member)
    cls = next(c for c in member.get('/api/classes').json['classes'] if c['trainer_id'] == 1)
    assert mutate(member, '/api/bookings', {'class_id': cls['id']}).status_code == 201
    booking_id = member.get('/api/me/dashboard').json['bookings'][0]['id']
    teacher_a = app.test_client(); account_login(teacher_a, 'teacher-a@example.com')
    teacher_b = app.test_client(); account_login(teacher_b, 'teacher-b@example.com')
    assert teacher_b.get('/api/trainer/dashboard').json['bookings'] == []
    endpoint = f'/api/trainer/bookings/{booking_id}'
    assert mutate(teacher_b, endpoint, {'status': 'attended'}, method='patch').status_code == 404
    assert mutate(teacher_a, endpoint, {'status': 'attended'}, method='patch').status_code == 409
    with app.app_context():
        db().execute('UPDATE classes SET starts_at=? WHERE id=?', (stamp(now() - timedelta(minutes=5)), cls['id']))
    assert mutate(teacher_a, endpoint, {'status': 'attended'}, method='patch').status_code == 200
    assert member.get('/api/me/dashboard').json['bookings'][0]['status'] == 'attended'


def test_role_changes_unlink_trainer_and_revoke_session(client, app):
    login(client, True)
    uid = new_account(client, role='trainer', trainer_id=1).json['id']
    trainer = app.test_client(); account_login(trainer, 'created@example.com')
    assert mutate(client, f'/api/admin/users/{uid}', {'role': 'member', 'active': 1}, method='patch').status_code == 200
    assert trainer.get('/api/trainer/dashboard').status_code == 401
    with app.app_context():
        assert one('SELECT user_id FROM trainers WHERE id=1')['user_id'] is None
    account_login(trainer, 'created@example.com')
    assert trainer.get('/api/trainer/dashboard').status_code == 403


def test_lock_trainer_preserves_profile_and_blocks_login(client, app):
    login(client, True)
    uid = new_account(client, role='trainer', trainer_id=1).json['id']
    trainer = app.test_client(); account_login(trainer, 'created@example.com')
    assert mutate(client, f'/api/admin/users/{uid}', {'active': 0}, method='patch').status_code == 200
    assert trainer.get('/api/trainer/dashboard').status_code == 401
    assert account_login(trainer, 'created@example.com').status_code == 401
    with app.app_context():
        assert one('SELECT user_id FROM trainers WHERE id=1')['user_id'] == uid


def test_existing_database_migration_preserves_records_and_ids(app, tmp_path):
    legacy = tmp_path / 'legacy.db'
    schema = (Path(__file__).resolve().parents[1] / 'schema.sql').read_text(encoding='utf-8')
    schema = schema.replace("('member','trainer','admin')", "('member','admin')").replace(',\n user_id INTEGER UNIQUE REFERENCES users(id)', '')
    target = sqlite3.connect(legacy, isolation_level=None)
    target.executescript(schema)
    tables = ['users', 'plans', 'trainers', 'classes', 'orders', 'memberships', 'bookings', 'progress', 'workouts', 'posts']
    expected = {}
    with app.app_context():
        db().execute("INSERT INTO bookings(user_id,class_id,status,created_at) VALUES (2,1,'confirmed',?)", (stamp(),))
        for table in tables:
            columns = [r[1] for r in target.execute(f'PRAGMA table_info({table})')]
            records = db().execute(f"SELECT {','.join(columns)} FROM {table} ORDER BY id").fetchall()
            expected[table] = [tuple(record) for record in records]
            target.executemany(f"INSERT INTO {table}({','.join(columns)}) VALUES ({','.join('?' for _ in columns)})", expected[table])
    target.execute("UPDATE sqlite_sequence SET seq=50 WHERE name='users'")
    target.execute('CREATE INDEX custom_users_phone ON users(phone)')
    target.close()
    upgraded = create_app({'TESTING': True, 'DATABASE': str(legacy), 'SECRET_KEY': 'migration-test', 'SESSION_COOKIE_SECURE': False})
    with upgraded.app_context():
        for table in tables:
            columns = [r[1] for r in db().execute(f'PRAGMA table_info({table})') if not (table == 'trainers' and r[1] == 'user_id')]
            actual = [tuple(row) for row in db().execute(f"SELECT {','.join(columns)} FROM {table} ORDER BY id")]
            assert actual == expected[table]
        assert db().execute('PRAGMA foreign_key_check').fetchall() == []
        assert db().execute('PRAGMA foreign_keys').fetchone()[0] == 1
        assert one("SELECT name FROM sqlite_master WHERE name='custom_users_phone'")
        migrate_database(db())
        assert one('SELECT COUNT(*) total FROM schema_migrations')['total'] == 1
    migrated_client = upgraded.test_client()
    assert login(migrated_client).status_code == 200
    assert register(migrated_client, 'post-upgrade@example.com').json['user']['id'] == 51


def test_migration_rolls_back_on_broken_foreign_key(tmp_path):
    connection = sqlite3.connect(tmp_path / 'broken.db', isolation_level=None)
    connection.executescript("""CREATE TABLE users(id INTEGER PRIMARY KEY AUTOINCREMENT, role TEXT CHECK(role IN ('member','admin')));
        CREATE TABLE trainers(id INTEGER PRIMARY KEY);
        CREATE TABLE broken(user_id INTEGER REFERENCES users(id));
        INSERT INTO users(role) VALUES ('member'); INSERT INTO broken VALUES (999);""")
    original = connection.execute("SELECT sql FROM sqlite_master WHERE name='users'").fetchone()[0]
    with pytest.raises(RuntimeError, match='Foreign key check'):
        migrate_database(connection)
    assert connection.execute("SELECT sql FROM sqlite_master WHERE name='users'").fetchone()[0] == original
    assert 'user_id' not in [r[1] for r in connection.execute('PRAGMA table_info(trainers)')]
    assert connection.execute('PRAGMA foreign_keys').fetchone()[0] == 1
    connection.close()
