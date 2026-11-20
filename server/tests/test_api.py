"""API rules with an in-memory fake database. Two users: ME ("u1") and OTHER ("u2") must never see each other's rows."""
import itertools

import pytest
from fastapi.testclient import TestClient

import auth
import main

ME, OTHER = "u1", "u2"


class FakeDB:
    """Just enough of database.py; refuses owner-table queries without an owner, like the real one."""
    OWNER_TABLES = {"clients", "items", "expenses"}

    def __init__(self):
        self.ids = itertools.count(1)
        self.tables = {"clients": {}, "items": {}, "expenses": {}}
        self.businesses = {}

    def _rows(self, table, owner):
        assert table in self.OWNER_TABLES and owner, f"query on {table} without an owner"
        return [r for r in self.tables[table].values() if r["owner_id"] == owner]

    def list_rows(self, table, owner, order="created_at", gte=None, lte=None, **eq):
        rows = [dict(r) for r in self._rows(table, owner) if all(r.get(k) == v for k, v in eq.items())]
        rows = [r for r in rows if all(str(r.get(k)) >= v for k, v in (gte or {}).items())]
        rows = [r for r in rows if all(str(r.get(k)) <= v for k, v in (lte or {}).items())]
        return sorted(rows, key=lambda r: str(r.get(order)))

    def get_row(self, table, row_id, owner):
        row = next((r for r in self._rows(table, owner) if r["id"] == row_id), None)
        return dict(row) if row else None

    def insert_row(self, table, data, owner):
        n = next(self.ids)
        row = {"id": f"{table[:3]}{n}", "created_at": f"2026-11-19T00:{n:02d}:00", **data, "owner_id": owner}
        self.tables[table][row["id"]] = row
        return dict(row)

    def update_row(self, table, row_id, data, owner):
        if not self.get_row(table, row_id, owner):
            return None
        self.tables[table][row_id].update({k: v for k, v in data.items() if k not in ("id", "owner_id")})
        return dict(self.tables[table][row_id])

    def delete_row(self, table, row_id, owner):
        if self.get_row(table, row_id, owner):
            self.tables[table].pop(row_id)

    def get_business(self, uid):
        return dict(self.businesses[uid]) if uid in self.businesses else None

    def create_business(self, uid, data):
        self.businesses[uid] = {"id": uid, "name": "", "tax_rate": 0, "tax_applies_to": "materials",
                                "due_days": 0, "invoice_terms": "", **data}
        return dict(self.businesses[uid])

    def update_business(self, uid, data):
        self.businesses[uid].update(data)
        return dict(self.businesses[uid])

    def today_local(self):
        return "2026-11-19"


@pytest.fixture
def fake(monkeypatch):
    f = FakeDB()
    monkeypatch.setattr(main, "db", f)
    monkeypatch.setattr(auth, "db", f)
    return f


def client_as(uid):
    main.app.dependency_overrides[auth.current_user] = lambda: uid
    return TestClient(main.app)


@pytest.fixture
def api(fake):
    yield client_as(ME)
    main.app.dependency_overrides.clear()


def new_client(api, name="Ann Lee"):
    r = api.post("/api/clients", json={"name": name, "phone": "555-0100"})
    assert r.status_code == 201, r.text
    return r.json()


def new_invoice(api, client_id, **extra):
    body = {"kind": "invoice", "client_id": client_id, "date": "2026-11-19", "title": "Installed 3 doors",
            "lines": [{"text": "Door", "qty": 2, "price": 200}, {"text": "Materials", "price": 64.5, "kind": "material"}],
            **extra}
    r = api.post("/api/items", json=body)
    assert r.status_code == 201, r.text
    return r.json()


# ---------- sign in ----------
def test_routes_need_sign_in(fake):
    main.app.dependency_overrides.clear()
    r = TestClient(main.app).get("/api/items")
    assert r.status_code == 401


def test_signup_checks_email_and_password(fake):
    c = TestClient(main.app)
    assert c.post("/api/auth/signup", json={"email": "bad", "password": "12345678"}).status_code == 400
    assert c.post("/api/auth/signup", json={"email": "a@b.co", "password": "short"}).status_code == 400


# ---------- settings ----------
def test_settings_are_created_and_saved(api):
    assert api.get("/api/settings").json()["tax_rate"] == 0   # sales tax off by default
    r = api.patch("/api/settings", json={"name": "Fix-It Pro", "tax_rate": 7, "due_days": 15})
    assert r.status_code == 200 and r.json()["name"] == "Fix-It Pro"
    assert api.patch("/api/settings", json={"due_days": 10}).status_code == 422   # only Now / 7 / 15 / 30


# ---------- clients ----------
def test_client_needs_a_name(api):
    assert api.post("/api/clients", json={"name": "  "}).status_code == 400


def test_users_never_see_each_others_clients(api, fake):
    mine = new_client(api)
    other = client_as(OTHER)
    assert other.get("/api/clients").json() == []
    assert other.get(f"/api/clients/{mine['id']}").status_code == 404
    assert other.patch(f"/api/clients/{mine['id']}", json={"name": "X"}).status_code == 404
    assert other.delete(f"/api/clients/{mine['id']}").status_code == 404
    assert fake.tables["clients"][mine["id"]]["name"] == "Ann Lee"


# ---------- items ----------
def test_invoice_totals_are_computed_by_the_server(api):
    inv = new_invoice(api, new_client(api)["id"])
    assert (inv["subtotal"], inv["tax"], inv["total"]) == (464.5, 0, 464.5)
    assert inv["client_name"] == "Ann Lee" and inv["status"] == "created"


def test_invoice_uses_settings_for_tax_due_date_and_terms(api):
    api.patch("/api/settings", json={"tax_rate": 7, "tax_applies_to": "materials", "due_days": 15,
                                     "invoice_terms": "1-year warranty on labor"})
    inv = new_invoice(api, new_client(api)["id"])
    assert inv["tax"] == 4.52 and inv["total"] == 469.02
    assert inv["due_date"] == "2026-12-04" and inv["terms"] == "1-year warranty on labor"


def test_invoice_estimate_and_task_need_a_client_a_note_has_none(api):
    """§6g: a task always has a client; anything without one is a note."""
    for kind in ("invoice", "estimate", "task"):
        assert api.post("/api/items", json={"kind": kind, "title": "x"}).status_code == 400
    cid = new_client(api)["id"]
    r = api.post("/api/items", json={"kind": "note", "title": "Pick up tile", "date": "2026-11-20", "time": "16:30",
                                     "reminder_minutes": 60, "client_id": cid})
    assert r.status_code == 201 and r.json()["client_id"] is None and r.json()["client_name"] == ""


def test_status_must_fit_the_kind(api):
    inv = new_invoice(api, new_client(api)["id"])
    assert api.patch(f"/api/items/{inv['id']}", json={"status": "done"}).status_code == 400
    assert api.post("/api/items", json={"kind": "task", "status": "paid"}).status_code == 400


def test_bad_date_and_time_are_refused(api):
    assert api.post("/api/items", json={"kind": "task", "date": "2026-13-40"}).status_code == 422
    assert api.post("/api/items", json={"kind": "task", "time": "25:00"}).status_code == 422


def test_paid_invoice_is_locked_until_payment_is_undone(api):
    inv = new_invoice(api, new_client(api)["id"])
    r = api.patch(f"/api/items/{inv['id']}", json={"status": "paid", "payment_method": "Zelle"})
    assert r.json()["status"] == "paid" and r.json()["paid_date"] == "2026-11-19"
    assert api.patch(f"/api/items/{inv['id']}", json={"title": "changed"}).status_code == 409
    r = api.patch(f"/api/items/{inv['id']}", json={"status": "requested"})   # Undo payment
    assert r.json()["paid_date"] is None and r.json()["payment_method"] == ""
    assert api.patch(f"/api/items/{inv['id']}", json={"title": "changed"}).status_code == 200


def test_editing_lines_recomputes_totals(api):
    inv = new_invoice(api, new_client(api)["id"])
    r = api.patch(f"/api/items/{inv['id']}", json={"lines": [{"text": "Fan", "qty": 1, "price": 150}]})
    assert r.json()["total"] == 150


def test_calendar_range_and_privacy(api):
    cid = new_client(api)["id"]
    new_invoice(api, cid, date="2026-11-03")
    new_invoice(api, cid, date="2026-12-01")
    nov = api.get("/api/items", params={"start": "2026-11-01", "end": "2026-11-30"}).json()
    assert [i["date"] for i in nov] == ["2026-11-03"]
    assert client_as(OTHER).get("/api/items").json() == []


def test_cannot_link_another_users_client(api):
    theirs = client_as(OTHER).post("/api/clients", json={"name": "Xena"}).json()
    main.app.dependency_overrides[auth.current_user] = lambda: ME
    assert api.post("/api/items", json={"kind": "invoice", "client_id": theirs["id"]}).status_code == 404


# ---------- expenses ----------
def test_expenses_default_to_today_and_stay_private(api):
    r = api.post("/api/expenses", json={"store": "Home Depot", "amount": 64.5})
    assert r.status_code == 201 and r.json()["date"] == "2026-11-19"
    assert client_as(OTHER).get("/api/expenses").json() == []


# ---------- step 3: numbering, contacts, expenses on the invoice ----------
def test_invoices_get_numbers_that_continue_the_users_format(api):
    cid = new_client(api)["id"]
    assert new_invoice(api, cid)["number"] == "INV-0001"
    assert api.get("/api/next-number").json()["number"] == "INV-0002"
    assert new_invoice(api, cid, number="2026-045")["number"] == "2026-045"
    assert api.get("/api/next-number").json()["number"] == "2026-046"
    assert api.get("/api/next-number", params={"kind": "estimate"}).json()["number"] == "EST-0001"


def test_used_number_is_refused_with_the_next_free_one(api):
    cid = new_client(api)["id"]
    new_invoice(api, cid, number="A-17")
    new_invoice(api, cid, number="A-18")
    r = api.post("/api/items", json={"kind": "invoice", "client_id": cid, "number": "A-17",
                                     "lines": [{"text": "x", "price": 1}]})
    assert r.status_code == 409 and r.json()["detail"]["next"] == "A-19"


def test_invoice_needs_work_and_prices(api):
    cid = new_client(api)["id"]
    assert api.post("/api/items", json={"kind": "invoice", "client_id": cid}).status_code == 400


def test_phone_contact_reuses_the_same_client(api, fake):
    ann = new_client(api)   # phone 555-0100
    api.patch(f"/api/clients/{ann['id']}", json={"phone": "+1 (561) 555-0101", "email": "ann@example.com"})
    r = api.post("/api/clients", json={"name": "Ann L.", "phone": "561-555-0101", "use_existing": True})
    assert r.status_code == 200 and r.json()["id"] == ann["id"]
    r = api.post("/api/clients", json={"name": "Ann", "email": "ANN@example.com", "use_existing": True})
    assert r.json()["id"] == ann["id"]
    r = api.post("/api/clients", json={"name": "Bob", "phone": "305-555-0199", "use_existing": True})
    assert r.status_code == 201 and len(fake.tables["clients"]) == 2


def test_recent_clients_have_last_used(api):
    ann, bob = new_client(api, "Ann Lee"), new_client(api, "Bob Ray")
    new_invoice(api, bob["id"])
    rows = {c["name"]: c["last_used"] for c in api.get("/api/clients").json()}
    assert rows["Bob Ray"] and rows["Ann Lee"] == ""


def test_expenses_are_saved_and_added_to_the_invoice_when_asked(api, fake):
    cid = new_client(api)["id"]
    inv = new_invoice(api, cid, lines=[{"text": "Doors", "qty": 2, "price": 200}],
                      expenses=[{"description": "Materials", "amount": 64.5, "add_to_invoice": True},
                                {"description": "Drill bits", "amount": 12, "add_to_invoice": False}])
    assert inv["total"] == 464.5 and inv["lines"][-1] == {"text": "Materials", "qty": 1, "price": 64.5, "kind": "material"}
    saved = sorted(fake.tables["expenses"].values(), key=lambda e: e["amount"])
    assert [(e["amount"], e["item_id"], e["client_id"]) for e in saved] == [(12, inv["id"], cid), (64.5, inv["id"], cid)]


# ---------- step 4: the PDF ----------
def test_invoice_pdf_in_the_document_language(api):
    api.patch("/api/settings", json={"name": "Fix-It Pro", "doc_language": "es", "tax_rate": 7})
    inv = new_invoice(api, new_client(api)["id"])
    r = api.get(f"/api/items/{inv['id']}/pdf")
    assert r.status_code == 200 and r.headers["content-type"] == "application/pdf"
    assert r.content.startswith(b"%PDF") and 'filename="INV-0001-ES.pdf"' in r.headers["content-disposition"]
    r = api.get(f"/api/items/{inv['id']}/pdf", params={"lang": "ru"})
    assert 'INV-0001-RU.pdf' in r.headers["content-disposition"]


def test_paid_invoice_pdf_and_no_pdf_for_tasks(api):
    inv = new_invoice(api, new_client(api)["id"])
    api.patch(f"/api/items/{inv['id']}", json={"status": "paid", "payment_method": "Zelle"})
    assert api.get(f"/api/items/{inv['id']}/pdf").status_code == 200
    task = api.post("/api/items", json={"kind": "task", "title": "Look at the deck", "client_id": inv["client_id"]}).json()
    assert api.get(f"/api/items/{task['id']}/pdf").status_code == 400
    note = api.post("/api/items", json={"kind": "note", "title": "Call the supplier"}).json()
    assert api.get(f"/api/items/{note['id']}/pdf").status_code == 400
    assert client_as(OTHER).get(f"/api/items/{inv['id']}/pdf").status_code == 404


# ---------- step 6: clients ----------
def test_clients_list_shows_paid_and_owes(api):
    ann, bob = new_client(api, "Ann Lee"), new_client(api, "Bob Ray")
    api.post("/api/items", json={"kind": "invoice", "client_id": ann["id"], "lines": [{"text": "a", "price": 100.10}], "status": "paid"})
    api.post("/api/items", json={"kind": "invoice", "client_id": ann["id"], "lines": [{"text": "b", "price": 200.20}], "status": "paid"})
    api.post("/api/items", json={"kind": "invoice", "client_id": ann["id"], "lines": [{"text": "c", "price": 50}], "status": "requested"})
    api.post("/api/items", json={"kind": "invoice", "client_id": ann["id"], "lines": [{"text": "not sent", "price": 999}]})
    api.post("/api/items", json={"kind": "estimate", "client_id": ann["id"], "lines": [{"text": "e", "price": 777}], "status": "sent"})
    rows = {c["name"]: (c["paid"], c["owes"]) for c in api.get("/api/clients").json()}
    assert rows == {"Ann Lee": (300.30, 50), "Bob Ray": (0, 0)}


def test_client_page_jobs_edit_and_delete_keeps_the_money_records(api):
    cid = new_client(api, "Ann Lee")["id"]
    inv = api.post("/api/items", json={"kind": "invoice", "client_id": cid, "lines": [{"text": "a", "price": 100}]}).json()
    api.post("/api/items", json={"kind": "task", "client_id": cid, "title": "Visit"})
    assert {i["kind"] for i in api.get("/api/items", params={"client_id": cid}).json()} == {"invoice", "task"}
    r = api.patch(f"/api/clients/{cid}", json={"notes": "Gate code 1234", "preferred_language": "es"})
    assert (r.json()["notes"], r.json()["preferred_language"]) == ("Gate code 1234", "es")
    assert api.patch(f"/api/clients/{cid}", json={"name": "  "}).status_code == 400
    assert api.delete(f"/api/clients/{cid}").status_code == 204
    assert api.get(f"/api/items/{inv['id']}").status_code == 200        # the invoice stays


def test_a_client_can_have_several_addresses_and_a_job_at_one_of_them(api):
    cid = new_client(api, "Ann Lee")["id"]
    other = [{"label": "Rental", "address": "5 Oak Ave, Delray Beach FL"}, {"label": "", "address": "9 Elm St"}]
    r = api.patch(f"/api/clients/{cid}", json={"addresses": other})
    assert r.status_code == 200 and r.json()["addresses"] == other
    assert api.patch(f"/api/clients/{cid}", json={"addresses": [{"label": "x", "address": ""}]}).status_code == 422
    assert api.patch(f"/api/clients/{cid}", json={"addresses": [{"address": "a"}] * 21}).status_code == 422
    made = api.post("/api/clients", json={"name": "Bob", "addresses": [{"label": "Office", "address": "1 Main St"}]}).json()
    assert made["addresses"] == [{"label": "Office", "address": "1 Main St"}]
    inv = api.post("/api/items", json={"kind": "invoice", "client_id": cid, "address": other[0]["address"],
                                       "lines": [{"text": "Fix fence", "price": 300}]}).json()
    assert inv["address"] == "5 Oak Ave, Delray Beach FL"
