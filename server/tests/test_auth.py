"""Sign up, sign in, refresh, "who is calling?", delete account — with a fake Supabase Auth (no network)."""
from types import SimpleNamespace as NS

import pytest
from fastapi.testclient import TestClient

import auth
import main
from tests.test_api import fake  # noqa: F401  (pytest fixture)

SESSION = NS(access_token="acc", refresh_token="ref", expires_at=123)


class FakeAdmin:
    def __init__(self):
        self.users, self.deleted, self.fail = {}, [], ""

    def create_user(self, data):
        if self.fail:
            raise RuntimeError(self.fail)
        if data["email"] in self.users:
            raise RuntimeError("A user with this email address has already been registered")
        uid = f"user{len(self.users) + 1}"
        self.users[data["email"]] = (uid, data["password"])
        return NS(user=NS(id=uid))

    def delete_user(self, uid):
        self.deleted.append(uid)


class FakeAuth:
    def __init__(self, admin):
        self.admin = admin

    def get_user(self, token):
        return NS(user=NS(id="user1")) if token == "good" else None

    def sign_in_with_password(self, creds):
        hit = self.admin.users.get(creds["email"])
        if not hit or hit[1] != creds["password"]:
            raise RuntimeError("Invalid login credentials")
        return NS(user=NS(id=hit[0], email=creds["email"]), session=SESSION)

    def refresh_session(self, token):
        if token != "ref":
            raise RuntimeError("expired")
        return NS(session=SESSION)


@pytest.fixture
def sb(fake, monkeypatch):
    admin = FakeAdmin()
    fake.supabase = NS(auth=FakeAuth(admin))
    monkeypatch.setattr(auth, "_login_client", lambda: NS(auth=FakeAuth(admin)))
    auth._cache.clear()
    main.app.dependency_overrides.clear()
    return admin


@pytest.fixture
def web(sb):
    return TestClient(main.app)


def test_signup_makes_the_login_and_the_business_row_then_signs_in(web, sb, fake):
    r = web.post("/api/auth/signup", json={"email": "  Ann@Example.com ", "password": "longenough"})
    assert r.status_code == 200 and r.json() == {"access_token": "acc", "refresh_token": "ref", "expires_at": 123}
    assert fake.businesses["user1"]["email"] == "ann@example.com"


def test_signup_twice_says_sign_in_instead(web):
    web.post("/api/auth/signup", json={"email": "a@b.co", "password": "longenough"})
    r = web.post("/api/auth/signup", json={"email": "a@b.co", "password": "longenough"})
    assert r.status_code == 400 and "already exists" in r.json()["detail"]


def test_signup_never_leaves_a_login_without_its_business(web, sb, fake, monkeypatch):
    monkeypatch.setattr(fake, "create_business", lambda *a: (_ for _ in ()).throw(RuntimeError("db down")))
    assert web.post("/api/auth/signup", json={"email": "a@b.co", "password": "longenough"}).status_code == 500
    assert sb.deleted == ["user1"]
    sb.fail = "network"
    assert web.post("/api/auth/signup", json={"email": "c@d.co", "password": "longenough"}).status_code == 400


def test_login_wrong_password_and_a_missing_business_row_is_made(web, sb, fake):
    sb.users["x@y.co"] = ("user9", "longenough")    # a login made outside the app
    assert web.post("/api/auth/login", json={"email": "x@y.co", "password": "nope"}).status_code == 401
    assert web.post("/api/auth/login", json={"email": "X@y.co", "password": "longenough"}).status_code == 200
    assert fake.businesses["user9"]["email"] == "x@y.co"


def test_refresh_gives_a_new_session_or_asks_to_sign_in(web):
    assert web.post("/api/auth/refresh", json={"refresh_token": "ref"}).json()["access_token"] == "acc"
    assert web.post("/api/auth/refresh", json={"refresh_token": "old"}).status_code == 401


def test_who_is_calling(web):
    assert web.get("/api/items").status_code == 401                                         # no token
    assert web.get("/api/items", headers={"Authorization": "Bearer bad"}).status_code == 401  # expired
    assert web.get("/api/items", headers={"Authorization": "Bearer good"}).status_code == 200
    assert auth._cache["good"][1] == "user1"                                                 # remembered for 60 s
    assert web.get("/api/items", headers={"Authorization": "Bearer good"}).status_code == 200


def test_delete_account(web, sb):
    r = web.delete("/api/account", headers={"Authorization": "Bearer good"})
    assert r.status_code == 200 and sb.deleted == ["user1"] and "good" not in auth._cache
