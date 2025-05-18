import os
import pytest
from backend import app as flask_app

@pytest.fixture
def client():
    flask_app.config['TESTING'] = True
    flask_app.config['SECRET_KEY'] = 'test'
    with flask_app.test_client() as client:
        yield client

def test_health_check(client):
    resp = client.get('/')
    assert resp.status_code == 200
    assert resp.get_json()['status'] == 'Server is running'

def test_login_success(client):
    resp = client.post('/login', json={
        'email': 'test@example.com',
        'password': 'password123'
    })
    assert resp.status_code == 200
    data = resp.get_json()
    assert data['user']['email'] == 'test@example.com'

def test_login_failure(client):
    resp = client.post('/login', json={
        'email': 'wrong@example.com',
        'password': 'wrongpass'
    })
    assert resp.status_code == 401
    data = resp.get_json()
    assert 'error' in data

def test_fetch_emails_unauthorized(client):
    resp = client.get('/fetch-emails')
    assert resp.status_code == 401
    data = resp.get_json()
    assert data['error'] == 'Unauthorized' 