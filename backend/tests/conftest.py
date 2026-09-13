import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app import create_app
from seed import seed_database


@pytest.fixture
def app(tmp_path):
    application = create_app({'TESTING': True, 'DATABASE': str(tmp_path / 'test.db'), 'SECRET_KEY': 'test-key-only', 'DEMO_PAYMENTS': True, 'SESSION_COOKIE_SECURE': False})
    with application.app_context():
        seed_database()
    return application


@pytest.fixture
def client(app):
    return app.test_client()


def mutate(client, path, body=None, method='post'):
    token = client.get('/api/auth/session').get_json()['csrf_token']
    return getattr(client, method)(path, json=body, headers={'X-CSRF-Token': token})


def login(client, admin=False):
    return mutate(client, '/api/auth/login', {'email': 'admin@gymtn.vn' if admin else 'member@gymtn.vn', 'password': 'Admin@12345' if admin else 'Member@12345'})


def register(client, email='new@example.com'):
    return mutate(client, '/api/auth/register', {'name': 'New Member', 'email': email, 'password': 'Password@123', 'phone': ''})
