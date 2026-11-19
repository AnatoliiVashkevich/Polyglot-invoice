"""auth.py - sign up, sign in and "who is calling?".

    1. Sign up: email + password -> a Supabase login (already confirmed) + an empty businesses row.
    2. Sign in: Supabase Auth returns access_token (~1 hour) + refresh_token (gets a new access token).
    3. The app sends the access token with every request:  Authorization: Bearer <token>
    4. current_user() turns it into the user id. Every protected route asks:  uid: str = Depends(current_user)
Sign in with Apple comes in build step 10 (it needs a development build).
"""
import logging
import os
import time

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from supabase import ClientOptions, create_client

import database as db

log = logging.getLogger("polyglot")
router = APIRouter(prefix="/api")
MIN_PASSWORD = 8

_cache: dict[str, tuple[float, str]] = {}   # token -> (valid until, user id): saves a round trip per request
CACHE_SECONDS = 60


class Credentials(BaseModel):
    email: str = ""
    password: str = ""


class RefreshBody(BaseModel):
    refresh_token: str = ""


def _login_client():
    """A throw-away client for sign-in / refresh, so the shared client keeps its secret-key powers."""
    return create_client(os.getenv("SUPABASE_URL", ""), os.getenv("SUPABASE_KEY", ""),
                         options=ClientOptions(auto_refresh_token=False, persist_session=False))


def _session(session) -> dict:
    return {"access_token": session.access_token, "refresh_token": session.refresh_token,
            "expires_at": session.expires_at}


def clean_email(email: str) -> str:
    email = (email or "").strip().lower()
    if "@" not in email or "." not in email.split("@")[-1] or " " in email:
        raise HTTPException(400, "Please enter a valid email address.")
    return email


def check_password(password: str) -> str:
    if len(password or "") < MIN_PASSWORD:
        raise HTTPException(400, f"The password needs at least {MIN_PASSWORD} characters.")
    return password


def current_user(authorization: str | None = Header(None)) -> str:
    """Authorization header -> the user id. 401 = not signed in or the session expired."""
    token = (authorization or "").removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(401, "Please sign in.")
    hit = _cache.get(token)
    if hit and hit[0] > time.time():
        return hit[1]
    try:
        res = db.supabase.auth.get_user(token)
        user_id = res.user.id if res and res.user else None
    except Exception:
        user_id = None
    if not user_id:
        raise HTTPException(401, "Your session has expired. Please sign in again.")
    if len(_cache) > 1000:
        now = time.time()
        for k in [k for k, (until, _) in _cache.items() if until < now]:
            _cache.pop(k, None)
    _cache[token] = (time.time() + CACHE_SECONDS, user_id)
    return user_id


@router.post("/auth/signup")
def signup(body: Credentials):
    email, password = clean_email(body.email), check_password(body.password)
    try:
        user_id = db.supabase.auth.admin.create_user(
            {"email": email, "password": password, "email_confirm": True}).user.id
    except Exception as e:
        if "already" in str(e).lower() or "registered" in str(e).lower():
            raise HTTPException(400, "An account with this email already exists. Please sign in.")
        log.warning("Could not create login for %s", email, exc_info=True)
        raise HTTPException(400, "Could not create the account. Please try again.")
    try:
        db.create_business(user_id, {"email": email})
    except Exception:
        log.exception("Signup failed after the login was created")
        db.supabase.auth.admin.delete_user(user_id)   # never leave a login without its business row
        raise HTTPException(500, "Could not create the account. Please try again.")
    return login(Credentials(email=email, password=password))


@router.post("/auth/login")
def login(body: Credentials):
    try:
        res = _login_client().auth.sign_in_with_password(
            {"email": (body.email or "").strip().lower(), "password": body.password or ""})
    except Exception:
        raise HTTPException(401, "Wrong email or password.")
    if not db.get_business(res.user.id):   # e.g. a login made outside the app
        db.create_business(res.user.id, {"email": res.user.email or ""})
    return _session(res.session)


@router.post("/auth/refresh")
def refresh(body: RefreshBody):
    try:
        return _session(_login_client().auth.refresh_session(body.refresh_token).session)
    except Exception:
        raise HTTPException(401, "Your session has expired. Please sign in again.")


@router.delete("/account")
def delete_account(uid: str = Depends(current_user)):
    """Settings > Account > Delete account (App Store rule). The database removes all the user's rows (cascade)."""
    db.supabase.auth.admin.delete_user(uid)
    for k in [k for k, (_, u) in _cache.items() if u == uid]:
        _cache.pop(k, None)
    return {"status": "deleted"}
