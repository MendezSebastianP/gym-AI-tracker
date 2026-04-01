from sqlalchemy.orm import sessionmaker

from app.models.user import User
from tests.conftest import register_and_login


def _promote_user(db_engine, email: str) -> None:
    Session = sessionmaker(autocommit=False, autoflush=False, bind=db_engine)
    with Session() as db:
        user = db.query(User).filter(User.email == email).first()
        assert user is not None
        user.is_admin = True
        db.commit()


def test_non_admin_is_blocked_from_admin_routes(client):
    headers = register_and_login(client)

    assert client.get("/api/admin/users", headers=headers).status_code == 403
    assert client.get("/api/admin/ai/report", headers=headers).status_code == 403
    assert client.post(
        "/api/admin/exercises",
        json={"name": "Forbidden Exercise"},
        headers=headers,
    ).status_code == 403


def test_admin_can_access_admin_routes(client, db_engine):
    email = "admin@example.com"
    headers = register_and_login(client, email=email)
    _promote_user(db_engine, email)

    users_resp = client.get("/api/admin/users", headers=headers)
    assert users_resp.status_code == 200
    assert any(user["email"] == email for user in users_resp.json())

    report_resp = client.get("/api/admin/ai/report", headers=headers)
    assert report_resp.status_code == 200


def test_admin_email_allowlist_promotes_user_on_auth_me(client, monkeypatch):
    monkeypatch.setenv("ADMIN_EMAILS", "owner@example.com")
    headers = register_and_login(client, email="owner@example.com")

    response = client.get("/api/auth/me", headers=headers)

    assert response.status_code == 200
    assert response.json()["is_admin"] is True
