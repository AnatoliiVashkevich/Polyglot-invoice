"""Repeating tasks and notes (product-decisions.md §6g): one row per visit, edit / delete one or all next."""
import pytest

import database
from tests.test_api import api, client_as, fake, new_client, OTHER  # noqa: F401  (pytest fixtures)


@pytest.fixture(autouse=True)
def today(monkeypatch):
    monkeypatch.setattr(database, "today_local", lambda: "2026-11-19")


def series_dates(api, start="2026-11-01", end="2027-02-28"):
    rows = api.get("/api/items", params={"start": start, "end": end}).json()
    return sorted((r["date"], r["status"], r["title"]) for r in rows if r.get("series_id"))


def weekly(api, **extra):
    cid = new_client(api)["id"]
    body = {"kind": "task", "client_id": cid, "title": "Pool cleaning", "date": "2026-11-20", "time": "09:00",
            "reminder_minutes": 60, "repeat": {"every": 1, "unit": "week", "until": "2026-12-11"}, **extra}
    r = api.post("/api/items", json=body)
    assert r.status_code == 201
    return r.json()


def test_a_weekly_task_until_a_date_makes_every_visit_with_its_own_reminder(api):
    first = weekly(api)
    assert first["repeat"]["start"] == "2026-11-20" and first["series_id"]
    rows = [r for r in api.get("/api/items", params={"start": "2026-11-01", "end": "2026-12-31"}).json()]
    assert [r["date"] for r in rows] == ["2026-11-20", "2026-11-27", "2026-12-04", "2026-12-11"]
    assert {(r["time"], r["reminder_minutes"], r["title"]) for r in rows} == {("09:00", 60, "Pool cleaning")}


def test_each_visit_is_done_on_its_own(api):
    weekly(api)
    second = [r for r in api.get("/api/items", params={"start": "2026-11-27", "end": "2026-11-27"}).json()][0]
    api.patch(f"/api/items/{second['id']}", json={"status": "done"})
    assert [s for _, s, _ in series_dates(api)] == ["created", "done", "created", "created"]


def test_change_only_this_one_or_this_and_all_next(api):
    weekly(api)
    rows = api.get("/api/items", params={"start": "2026-11-01", "end": "2026-12-31"}).json()
    api.patch(f"/api/items/{rows[1]['id']}", json={"title": "Pool + filter"})               # only this one
    api.patch(f"/api/items/{rows[2]['id']}?scope=following", json={"title": "Pool, new pump"})
    assert [t for _, _, t in series_dates(api)] == ["Pool cleaning", "Pool + filter", "Pool, new pump", "Pool, new pump"]


def test_delete_only_this_one_or_this_and_all_next(api):
    weekly(api)
    rows = api.get("/api/items", params={"start": "2026-11-01", "end": "2026-12-31"}).json()
    assert api.delete(f"/api/items/{rows[1]['id']}").status_code == 204
    assert [d for d, _, _ in series_dates(api)] == ["2026-11-20", "2026-12-04", "2026-12-11"]
    assert api.delete(f"/api/items/{rows[2]['id']}?scope=following").status_code == 204
    assert [d for d, _, _ in series_dates(api)] == ["2026-11-20"]


def test_a_new_rule_from_a_visit_restarts_the_series_from_there(api):
    weekly(api)
    rows = api.get("/api/items", params={"start": "2026-11-01", "end": "2026-12-31"}).json()
    r = api.patch(f"/api/items/{rows[1]['id']}?scope=following",
                  json={"repeat": {"every": 2, "unit": "week", "until": "2026-12-31"}})
    assert r.status_code == 200 and r.json()["series_id"] != rows[0]["series_id"]
    assert [d for d, _, _ in series_dates(api)] == ["2026-11-20", "2026-11-27", "2026-12-11", "2026-12-25"]
    api.patch(f"/api/items/{rows[1]['id']}?scope=following", json={"repeat": None})   # stop repeating
    assert [d for d, _, _ in series_dates(api)] == ["2026-11-20"]


def test_no_end_date_goes_about_a_year_ahead_and_more_as_the_calendar_asks(api):
    api.post("/api/items", json={"kind": "note", "title": "Pay the truck insurance", "date": "2026-11-25",
                                 "repeat": {"every": 1, "unit": "month"}})
    assert len(api.get("/api/items", params={"start": "2026-11-01", "end": "2027-12-31"}).json()) == 14   # Nov 2026 … Dec 2027
    far = api.get("/api/items", params={"start": "2028-06-01", "end": "2028-06-30"}).json()
    assert [r["date"] for r in far] == ["2028-06-25"]


def test_a_single_task_can_start_repeating_and_invoices_cannot_repeat(api):
    cid = new_client(api)["id"]
    task = api.post("/api/items", json={"kind": "task", "client_id": cid, "title": "Lawn", "date": "2026-11-20"}).json()
    api.patch(f"/api/items/{task['id']}", json={"repeat": {"every": 1, "unit": "week", "until": "2026-12-04"}})
    assert [d for d, _, _ in series_dates(api)] == ["2026-11-20", "2026-11-27", "2026-12-04"]
    r = api.post("/api/items", json={"kind": "invoice", "client_id": cid, "lines": [{"text": "a", "price": 1}],
                                     "repeat": {"every": 1, "unit": "month"}})
    assert r.status_code == 400


def test_series_belong_to_their_owner(api):
    first = weekly(api)
    assert client_as(OTHER).delete(f"/api/items/{first['id']}?scope=following").status_code == 404


def test_an_invoice_from_one_visit_marks_only_that_visit_done(api):
    first = weekly(api)
    rows = api.get("/api/items", params={"start": "2026-11-01", "end": "2026-12-31"}).json()
    inv = api.post("/api/items", json={"kind": "invoice", "client_id": first["client_id"], "from_item_id": rows[1]["id"],
                                       "lines": [{"text": "Pool cleaning", "price": 120}]}).json()
    assert [s for _, s, _ in series_dates(api)] == ["created", "done", "created", "created"]
    assert [r["kind"] for r in api.get(f"/api/items/{rows[1]['id']}/related").json()] == ["invoice"]
    assert api.get(f"/api/items/{rows[2]['id']}/related").json() == []
    assert inv["status"] == "created"


def test_a_new_date_for_this_and_all_next_moves_the_rest_of_the_series(api):
    weekly(api)
    rows = api.get("/api/items", params={"start": "2026-11-01", "end": "2026-12-31"}).json()
    api.patch(f"/api/items/{rows[1]['id']}?scope=following", json={"date": "2026-11-28"})   # Fridays -> Saturdays
    assert [d for d, _, _ in series_dates(api)] == ["2026-11-20", "2026-11-28", "2026-12-05"]


def test_only_this_one_moves_one_visit_and_keeps_the_rule(api):
    weekly(api)
    rows = api.get("/api/items", params={"start": "2026-11-01", "end": "2026-12-31"}).json()
    r = api.patch(f"/api/items/{rows[1]['id']}", json={"date": "2026-11-28", "repeat": {"every": 3, "unit": "day"}})
    assert r.status_code == 200 and r.json()["repeat"]["every"] == 1 and r.json()["series_id"] == rows[0]["series_id"]
    assert [d for d, _, _ in series_dates(api)] == ["2026-11-20", "2026-11-28", "2026-12-04", "2026-12-11"]


def test_done_visits_stay_when_the_rule_changes(api):
    weekly(api)
    rows = api.get("/api/items", params={"start": "2026-11-01", "end": "2026-12-31"}).json()
    api.patch(f"/api/items/{rows[2]['id']}", json={"status": "done"})
    api.patch(f"/api/items/{rows[1]['id']}?scope=following", json={"repeat": None})
    assert [(d, s) for d, s, _ in series_dates(api)] == [("2026-11-20", "created"), ("2026-12-04", "done")]


def test_a_series_until_a_date_is_not_extended(api):
    weekly(api)
    api.get("/api/items", params={"start": "2027-01-01", "end": "2027-12-31"})
    assert len(series_dates(api, "2026-01-01", "2028-01-01")) == 4


def test_a_note_cannot_get_a_client_and_tasks_need_one_when_edited(api):
    cid = new_client(api)["id"]
    note = api.post("/api/items", json={"kind": "note", "title": "Buy screws", "client_id": cid}).json()
    assert note["client_id"] is None
    inv = api.post("/api/items", json={"kind": "invoice", "client_id": cid, "lines": [{"text": "a", "price": 1}]}).json()
    assert api.patch(f"/api/items/{inv['id']}", json={"client_id": ""}).status_code == 400
    assert api.patch(f"/api/items/{inv['id']}", json={"repeat": {"every": 1, "unit": "week"}}).status_code == 400
    assert api.patch(f"/api/items/{inv['id']}", json={"lines": None}).json()["total"] == 0
