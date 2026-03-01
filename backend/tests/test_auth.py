"""
Tests for authentication endpoints:
  POST /api/auth/register
  POST /api/auth/login
  GET  /api/auth/me
  PUT  /api/auth/me
"""
import pytest
from tests.conftest import register_and_login


class TestRegister:
    def test_register_success(self, client):
        r = client.post("/api/auth/register", json={
            "email": "alice@example.com",
            "password": "secret123"
        })
        assert r.status_code == 200
        data = r.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

    def test_register_duplicate_email(self, client):
        client.post("/api/auth/register", json={"email": "dup@example.com", "password": "pw"})
        r = client.post("/api/auth/register", json={"email": "dup@example.com", "password": "pw"})
        assert r.status_code == 400
        assert "already registered" in r.json()["detail"].lower()

    def test_register_invalid_email(self, client):
        r = client.post("/api/auth/register", json={"email": "not-an-email", "password": "pw"})
        assert r.status_code == 422  # pydantic validation


class TestLogin:
    def test_login_success(self, client):
        client.post("/api/auth/register", json={"email": "bob@example.com", "password": "mypw"})
        r = client.post("/api/auth/login", json={"email": "bob@example.com", "password": "mypw"})
        assert r.status_code == 200
        assert "access_token" in r.json()

    def test_login_wrong_password(self, client):
        client.post("/api/auth/register", json={"email": "carol@example.com", "password": "correct"})
        r = client.post("/api/auth/login", json={"email": "carol@example.com", "password": "wrong"})
        assert r.status_code == 401

    def test_login_unknown_user(self, client):
        r = client.post("/api/auth/login", json={"email": "nobody@example.com", "password": "pw"})
        assert r.status_code == 401


class TestGetMe:
    def test_get_me(self, client):
        headers = register_and_login(client, "me@example.com")
        r = client.get("/api/auth/me", headers=headers)
        assert r.status_code == 200
        data = r.json()
        assert data["email"] == "me@example.com"
        assert "id" in data
        assert data["is_active"] is True

    def test_get_me_unauthenticated(self, client):
        r = client.get("/api/auth/me")
        assert r.status_code == 401


class TestUpdateMe:
    def test_update_profile(self, client):
        headers = register_and_login(client, "update@example.com")
        r = client.put("/api/auth/me", json={"weight": 80, "height": 175, "age": 30}, headers=headers)
        assert r.status_code == 200
        data = r.json()
        assert data["weight"] == 80
        assert data["height"] == 175
        assert data["age"] == 30

    def test_update_settings(self, client):
        headers = register_and_login(client, "settings@example.com")
        r = client.put("/api/auth/me", json={"settings": {"timer_mode": "timer", "language": "es"}}, headers=headers)
        assert r.status_code == 200
        assert r.json()["settings"]["timer_mode"] == "timer"
