"""database.py - the only file that talks to the Supabase tables (see schema.sql).

ONE LOGIN, ONE SET OF DATA: clients, items and expenses carry owner_id. Every helper REQUIRES `owner=` and always
filters by it, so one user can never read or change another user's rows. Forgetting it raises instead of leaking.
The businesses row has id = the login's user id.
"""
import os
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from dotenv import load_dotenv
from supabase import Client, create_client

load_dotenv(Path(__file__).with_name(".env"))   # SUPABASE_URL / SUPABASE_KEY (the SECRET key) / APP_TIMEZONE

supabase: Client = create_client(os.getenv("SUPABASE_URL", ""), os.getenv("SUPABASE_KEY", ""))
APP_TZ = ZoneInfo(os.getenv("APP_TIMEZONE", "America/New_York"))

OWNER_TABLES = {"clients", "items", "expenses"}
PAGE = 1000   # Supabase returns at most ~1000 rows per request


def today_local() -> str:
    return datetime.now(APP_TZ).strftime("%Y-%m-%d")


def _check(table: str, owner) -> None:
    if table not in OWNER_TABLES:
        raise RuntimeError(f"Unknown table '{table}'")
    if not owner:
        raise RuntimeError(f"Query on '{table}' without an owner - refused")


def list_rows(table: str, owner, order: str = "created_at", gte: dict | None = None, lte: dict | None = None,
              **eq) -> list[dict]:
    """All of this owner's rows, optionally filtered (eq: column == value, gte/lte: date ranges)."""
    _check(table, owner)
    rows, start = [], 0
    while True:
        q = supabase.table(table).select("*").eq("owner_id", owner)
        for k, v in eq.items():
            q = q.eq(k, v)
        for k, v in (gte or {}).items():
            q = q.gte(k, v)
        for k, v in (lte or {}).items():
            q = q.lte(k, v)
        chunk = q.order(order).order("id").range(start, start + PAGE - 1).execute().data or []
        rows += chunk
        if len(chunk) < PAGE:
            return rows
        start += PAGE


def get_row(table: str, row_id, owner) -> dict | None:
    _check(table, owner)
    rows = supabase.table(table).select("*").eq("owner_id", owner).eq("id", row_id).execute().data
    return rows[0] if rows else None


def insert_row(table: str, data: dict, owner) -> dict:
    _check(table, owner)
    return supabase.table(table).insert({**data, "owner_id": owner}).execute().data[0]


def update_row(table: str, row_id, data: dict, owner) -> dict | None:
    _check(table, owner)
    data = {k: v for k, v in data.items() if k not in ("id", "owner_id")}   # a row never changes hands
    if data:
        supabase.table(table).update(data).eq("owner_id", owner).eq("id", row_id).execute()
    return get_row(table, row_id, owner)


def delete_row(table: str, row_id, owner) -> None:
    _check(table, owner)
    supabase.table(table).delete().eq("owner_id", owner).eq("id", row_id).execute()


# ---------- the business / settings row ----------
def get_business(user_id) -> dict | None:
    rows = supabase.table("businesses").select("*").eq("id", user_id).execute().data
    return rows[0] if rows else None


def create_business(user_id, data: dict) -> dict:
    return supabase.table("businesses").insert({**data, "id": user_id}).execute().data[0]


def update_business(user_id, data: dict) -> dict | None:
    data = {k: v for k, v in data.items() if k != "id"}
    if data:
        supabase.table("businesses").update(data).eq("id", user_id).execute()
    return get_business(user_id)
