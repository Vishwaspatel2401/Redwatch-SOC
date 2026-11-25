"""Tests for /api/auth — registration, login, and JWT-protected access."""
from app.models import User


class TestRegister:
    def test_creates_user_and_returns_token(self, client):
        res = client.post(
            "/api/auth/register",
            json={"username": "alice", "email": "alice@example.com", "password": "pw-123456"},
        )
        assert res.status_code == 201
        body = res.get_json()
        assert body["access_token"]
        assert body["user"]["username"] == "alice"
        assert body["user"]["email"] == "alice@example.com"

    def test_never_returns_or_stores_plaintext_password(self, app, client):
        res = client.post(
            "/api/auth/register",
            json={"username": "bob", "email": "bob@example.com", "password": "plain-text-pw"},
        )
        assert "password" not in res.get_json()["user"]
        assert "password_hash" not in res.get_json()["user"]
        with app.app_context():
            user = User.query.filter_by(username="bob").first()
            assert user.password_hash != "plain-text-pw"

    def test_missing_fields_rejected(self, client):
        res = client.post("/api/auth/register", json={"username": "carol"})
        assert res.status_code == 400

    def test_empty_body_rejected(self, client):
        res = client.post("/api/auth/register", json={})
        assert res.status_code == 400

    def test_duplicate_username_rejected(self, client, register):
        register(username="dup", email="first@example.com")
        res = client.post(
            "/api/auth/register",
            json={"username": "dup", "email": "second@example.com", "password": "pw-123456"},
        )
        assert res.status_code == 409

    def test_duplicate_email_rejected(self, client, register):
        register(username="first", email="same@example.com")
        res = client.post(
            "/api/auth/register",
            json={"username": "second", "email": "same@example.com", "password": "pw-123456"},
        )
        assert res.status_code == 409


class TestLogin:
    def test_login_with_username(self, client, register):
        register(username="dave", email="dave@example.com", password="right-pw")
        res = client.post("/api/auth/login", json={"username": "dave", "password": "right-pw"})
        assert res.status_code == 200
        assert res.get_json()["access_token"]

    def test_login_with_email_case_insensitive(self, client, register):
        register(username="erin", email="erin@example.com", password="right-pw")
        res = client.post("/api/auth/login", json={"username": "ERIN@Example.com", "password": "right-pw"})
        assert res.status_code == 200

    def test_wrong_password_rejected(self, client, register):
        register(username="frank", email="frank@example.com", password="right-pw")
        res = client.post("/api/auth/login", json={"username": "frank", "password": "wrong-pw"})
        assert res.status_code == 401

    def test_unknown_user_rejected(self, client):
        res = client.post("/api/auth/login", json={"username": "nobody", "password": "x"})
        assert res.status_code == 401

    def test_missing_fields_rejected(self, client):
        res = client.post("/api/auth/login", json={"username": "frank"})
        assert res.status_code == 400


class TestProtectedRoutes:
    def test_me_requires_token(self, client):
        assert client.get("/api/auth/me").status_code == 401

    def test_me_rejects_invalid_token(self, client):
        res = client.get("/api/auth/me", headers={"Authorization": "Bearer not-a-real-token"})
        assert res.status_code == 422

    def test_me_returns_current_user(self, client, register):
        headers, user = register(username="gina", email="gina@example.com")
        res = client.get("/api/auth/me", headers=headers)
        assert res.status_code == 200
        assert res.get_json()["user"]["id"] == user["id"]

    def test_logout(self, client, auth_headers):
        assert client.post("/api/auth/logout", headers=auth_headers).status_code == 200
