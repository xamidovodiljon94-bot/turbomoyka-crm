import os
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://cleancar-pro-2.preview.emergentagent.com').rstrip('/')


@pytest.fixture(scope='session')
def base_url():
    return BASE_URL


def _login(session: requests.Session, email: str, password: str):
    r = session.post(f"{BASE_URL}/api/auth/login", json={'email': email, 'password': password})
    return r


@pytest.fixture(scope='session')
def admin_session():
    s = requests.Session()
    r = _login(s, 'admin@avtomoyka.uz', 'Admin123!')
    if r.status_code != 200:
        pytest.skip(f"Admin login failed: {r.status_code} {r.text}")
    return s


@pytest.fixture(scope='session')
def kassir_session(admin_session):
    # Ensure kassir exists
    admin_session.post(f"{BASE_URL}/api/auth/register", json={
        'email': 'kassir@avtomoyka.uz',
        'password': 'Kassir123!',
        'name': 'Test Kassir',
        'role': 'kassir'
    })
    s = requests.Session()
    r = _login(s, 'kassir@avtomoyka.uz', 'Kassir123!')
    if r.status_code != 200:
        pytest.skip(f"Kassir login failed: {r.status_code} {r.text}")
    return s


@pytest.fixture(scope='session')
def hodim_session(admin_session):
    admin_session.post(f"{BASE_URL}/api/auth/register", json={
        'email': 'hodim@avtomoyka.uz',
        'password': 'Hodim123!',
        'name': 'Test Hodim',
        'role': 'hodim'
    })
    s = requests.Session()
    r = _login(s, 'hodim@avtomoyka.uz', 'Hodim123!')
    if r.status_code != 200:
        pytest.skip(f"Hodim login failed: {r.status_code} {r.text}")
    return s


@pytest.fixture(scope='session')
def hodim_user_id(admin_session):
    r = admin_session.get(f"{BASE_URL}/api/users")
    for u in r.json():
        if u.get('email') == 'hodim@avtomoyka.uz':
            return u['id']
    return None
