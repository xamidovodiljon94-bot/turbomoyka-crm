"""Avtomoyka backend integration tests - covers auth, users, services, orders, dashboard, reports."""
import os
import requests
import pytest

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://cleancar-pro-2.preview.emergentagent.com').rstrip('/')


# ==================== Auth ====================
class TestAuth:
    def test_login_admin_success(self):
        s = requests.Session()
        r = s.post(f"{BASE_URL}/api/auth/login", json={'email': 'admin@avtomoyka.uz', 'password': 'Admin123!'})
        assert r.status_code == 200
        data = r.json()
        assert data['email'] == 'admin@avtomoyka.uz'
        assert data['role'] == 'super_admin'
        # httpOnly cookie set
        assert 'access_token' in s.cookies.get_dict()

    def test_login_invalid_credentials(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={'email': 'admin@avtomoyka.uz', 'password': 'wrongpass'})
        assert r.status_code == 401

    def test_me_endpoint(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 200
        assert r.json()['role'] == 'super_admin'

    def test_me_unauthenticated(self):
        r = requests.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 401


# ==================== Users ====================
class TestUsers:
    def test_create_kassir_user(self, admin_session):
        # Cleanup if exists
        users = admin_session.get(f"{BASE_URL}/api/users").json()
        for u in users:
            if u.get('email') == 'kassir@avtomoyka.uz':
                admin_session.delete(f"{BASE_URL}/api/users/{u['id']}")
        r = admin_session.post(f"{BASE_URL}/api/auth/register", json={
            'email': 'kassir@avtomoyka.uz', 'password': 'Kassir123!',
            'name': 'Test Kassir', 'role': 'kassir'
        })
        assert r.status_code == 200, r.text
        assert r.json()['role'] == 'kassir'

    def test_create_hodim_user(self, admin_session):
        users = admin_session.get(f"{BASE_URL}/api/users").json()
        for u in users:
            if u.get('email') == 'hodim@avtomoyka.uz':
                admin_session.delete(f"{BASE_URL}/api/users/{u['id']}")
        r = admin_session.post(f"{BASE_URL}/api/auth/register", json={
            'email': 'hodim@avtomoyka.uz', 'password': 'Hodim123!',
            'name': 'Test Hodim', 'role': 'hodim'
        })
        assert r.status_code == 200, r.text

    def test_list_users_admin(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/users")
        assert r.status_code == 200
        emails = [u['email'] for u in r.json()]
        assert 'admin@avtomoyka.uz' in emails

    def test_list_users_forbidden_for_kassir(self, kassir_session):
        r = kassir_session.get(f"{BASE_URL}/api/users")
        assert r.status_code == 403


# ==================== Services ====================
class TestServices:
    def test_list_default_services(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/services")
        assert r.status_code == 200
        names = [s['name'] for s in r.json()]
        assert 'Oddiy yuvish' in names
        assert 'Kompleks yuvish' in names

    def test_create_service(self, admin_session):
        r = admin_session.post(f"{BASE_URL}/api/services", json={
            'name': 'TEST_Premium yuvish', 'price': 99000, 'duration': 45
        })
        assert r.status_code == 200, r.text
        sid = r.json()['id']
        # Cleanup
        admin_session.delete(f"{BASE_URL}/api/services/{sid}")

    def test_create_service_forbidden_for_hodim(self, hodim_session):
        r = hodim_session.post(f"{BASE_URL}/api/services", json={
            'name': 'TEST_x', 'price': 1, 'duration': 1
        })
        assert r.status_code == 403


# ==================== Orders Full Workflow ====================
class TestOrdersWorkflow:
    @pytest.fixture(scope='class')
    def service_id(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/services")
        return r.json()[0]['id']

    @pytest.fixture(scope='class')
    def order_id(self, admin_session, service_id, hodim_user_id):
        r = admin_session.post(f"{BASE_URL}/api/orders", json={
            'license_plate': 'TEST123AA',
            'brand': 'Chevrolet',
            'model': 'Nexia',
            'body_type': 'Sedan',
            'color': 'Oq',
            'service_id': service_id,
            'assigned_to': hodim_user_id,
            'notes': 'test order'
        })
        assert r.status_code == 200, r.text
        data = r.json()
        assert data['status'] == 'navbatda'
        assert data['payment_status'] == 'kutilmoqda'
        assert data['license_plate'] == 'TEST123AA'
        return data['id']

    def test_order_created_in_navbatda(self, admin_session, order_id):
        r = admin_session.get(f"{BASE_URL}/api/orders?status=navbatda")
        assert r.status_code == 200
        assert any(o['id'] == order_id for o in r.json())

    def test_hodim_sees_only_assigned_orders(self, hodim_session, order_id):
        r = hodim_session.get(f"{BASE_URL}/api/orders")
        assert r.status_code == 200
        ids = [o['id'] for o in r.json()]
        assert order_id in ids

    def test_hodim_start_washing(self, hodim_session, order_id):
        r = hodim_session.patch(f"{BASE_URL}/api/orders/{order_id}/status", json={'status': 'yuvilmoqda'})
        assert r.status_code == 200
        assert r.json()['status'] == 'yuvilmoqda'

    def test_hodim_complete_washing(self, hodim_session, order_id):
        r = hodim_session.patch(f"{BASE_URL}/api/orders/{order_id}/status", json={'status': 'tugallandi'})
        assert r.status_code == 200
        assert r.json()['status'] == 'tugallandi'

    def test_kassir_sees_completed_orders(self, kassir_session, order_id):
        r = kassir_session.get(f"{BASE_URL}/api/orders")
        assert r.status_code == 200
        ids = [o['id'] for o in r.json()]
        assert order_id in ids

    def test_kassir_process_payment_naqd(self, kassir_session, order_id):
        r = kassir_session.patch(f"{BASE_URL}/api/orders/{order_id}/payment", json={'payment_method': 'naqd'})
        assert r.status_code == 200
        data = r.json()
        assert data['payment_status'] == 'tolandi'
        assert data['payment_method'] == 'naqd'

    def test_payment_methods_accepted(self, admin_session, service_id, hodim_user_id):
        for method in ['karta', 'click', 'payme']:
            r = admin_session.post(f"{BASE_URL}/api/orders", json={
                'license_plate': f'TEST{method.upper()}',
                'brand': 'Test', 'model': 'X', 'body_type': 'Sedan', 'color': 'q',
                'service_id': service_id, 'assigned_to': hodim_user_id
            })
            oid = r.json()['id']
            admin_session.patch(f"{BASE_URL}/api/orders/{oid}/status", json={'status': 'tugallandi'})
            pr = admin_session.patch(f"{BASE_URL}/api/orders/{oid}/payment", json={'payment_method': method})
            assert pr.status_code == 200
            assert pr.json()['payment_method'] == method


# ==================== Permission Checks ====================
class TestRoleAccess:
    def test_hodim_cannot_access_reports(self, hodim_session):
        r = hodim_session.get(f"{BASE_URL}/api/reports/today")
        assert r.status_code == 403

    def test_hodim_cannot_close_day(self, hodim_session):
        r = hodim_session.post(f"{BASE_URL}/api/reports/close-day")
        assert r.status_code == 403

    def test_kassir_cannot_close_day(self, kassir_session):
        r = kassir_session.post(f"{BASE_URL}/api/reports/close-day")
        assert r.status_code == 403


# ==================== Dashboard ====================
class TestDashboard:
    def test_admin_dashboard(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/dashboard/stats")
        assert r.status_code == 200
        data = r.json()
        for key in ['today_orders', 'today_revenue', 'weekly_revenue', 'monthly_revenue',
                    'unpaid_orders', 'completed_orders', 'waiting_orders', 'washing_orders', 'employee_stats']:
            assert key in data

    def test_kassir_dashboard(self, kassir_session):
        r = kassir_session.get(f"{BASE_URL}/api/dashboard/stats")
        assert r.status_code == 200
        data = r.json()
        assert 'today_orders' in data
        assert 'today_revenue' in data
        assert 'pending_payment' in data

    def test_hodim_dashboard(self, hodim_session):
        r = hodim_session.get(f"{BASE_URL}/api/dashboard/stats")
        assert r.status_code == 200
        data = r.json()
        assert 'today_cars' in data
        assert 'today_earnings' in data


# ==================== Reports ====================
class TestReports:
    def test_today_report(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/reports/today")
        assert r.status_code == 200
        data = r.json()
        for key in ['date', 'total_cars', 'total_revenue', 'cash', 'card', 'click', 'payme', 'employee_stats']:
            assert key in data

    def test_kassir_can_view_report(self, kassir_session):
        r = kassir_session.get(f"{BASE_URL}/api/reports/today")
        assert r.status_code == 200

    def test_excel_export(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/reports/export/excel")
        assert r.status_code == 200
        assert 'spreadsheetml' in r.headers.get('content-type', '')
        assert len(r.content) > 100

    def test_close_day(self, admin_session):
        r = admin_session.post(f"{BASE_URL}/api/reports/close-day")
        # Could be 200 or 400 if already closed
        assert r.status_code in [200, 400]


# ==================== Logout ====================
class TestLogout:
    def test_logout(self):
        s = requests.Session()
        s.post(f"{BASE_URL}/api/auth/login", json={'email': 'admin@avtomoyka.uz', 'password': 'Admin123!'})
        r = s.post(f"{BASE_URL}/api/auth/logout")
        assert r.status_code == 200
        # Verify cookie cleared / session invalid
        r2 = s.get(f"{BASE_URL}/api/auth/me")
        assert r2.status_code == 401
