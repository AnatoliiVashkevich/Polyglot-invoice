"""Build step 5: one job, three stages (product-decisions.md §4). Task -> estimate -> invoice."""
from tests.test_api import api, client_as, fake, new_client, OTHER  # noqa: F401  (pytest fixtures)

LINES = [{"text": "Replace deck boards", "qty": 1, "price": 1800}]


def test_estimate_created_sent_then_invoice_from_it(api):
    cid = new_client(api)["id"]
    est = api.post("/api/items", json={"kind": "estimate", "client_id": cid, "lines": LINES}).json()
    assert (est["number"], est["status"], est["total"]) == ("EST-0001", "created", 1800)
    assert api.patch(f"/api/items/{est['id']}", json={"status": "sent"}).json()["status"] == "sent"
    # there is no "Accepted": scheduling or invoicing means the customer said yes
    assert api.patch(f"/api/items/{est['id']}", json={"status": "accepted"}).status_code == 422
    inv = api.post("/api/items", json={"kind": "invoice", "client_id": cid, "lines": LINES, "from_item_id": est["id"]}).json()
    assert inv["number"] == "INV-0001" and inv["from_item_id"] == est["id"]
    assert api.get(f"/api/items/{est['id']}").json()["status"] == "sent"   # the estimate stays as it was


def test_schedule_the_job_from_an_estimate(api):
    cid = new_client(api)["id"]
    est = api.post("/api/items", json={"kind": "estimate", "client_id": cid, "lines": LINES, "status": "sent"}).json()
    task = api.post("/api/items", json={"kind": "task", "client_id": cid, "title": "Replace deck boards",
                                        "date": "2026-11-25", "time": "09:00", "reminder_minutes": 60,
                                        "from_item_id": est["id"]})
    assert task.status_code == 201
    t = task.json()
    assert (t["kind"], t["status"], t["time"], t["reminder_minutes"], t.get("number", "")) == ("task", "created", "09:00", 60, "")


def test_job_done_create_invoice_marks_the_task_done(api):
    cid = new_client(api)["id"]
    task = api.post("/api/items", json={"kind": "task", "client_id": cid, "title": "Mount TV", "time": "14:00"}).json()
    inv = api.post("/api/items", json={"kind": "invoice", "client_id": cid, "from_item_id": task["id"],
                                       "lines": [{"text": "Mount TV, hide cables", "price": 250}]}).json()
    assert inv["status"] == "created"
    assert api.get(f"/api/items/{task['id']}").json()["status"] == "done"


def test_a_note_and_its_reminder_choices(api):
    r = api.post("/api/items", json={"kind": "note", "title": "Pick up tile", "date": "2026-11-20", "time": "16:30"})
    assert r.status_code == 201 and r.json().get("client_id") is None and r.json().get("reminder_minutes") is None
    tid = r.json()["id"]
    for minutes in (30, 60, 1440):
        assert api.patch(f"/api/items/{tid}", json={"reminder_minutes": minutes}).status_code == 200
    assert api.patch(f"/api/items/{tid}", json={"reminder_minutes": 45}).status_code == 422
    assert api.patch(f"/api/items/{tid}", json={"reminder_minutes": None}).json()["reminder_minutes"] is None
    assert api.patch(f"/api/items/{tid}", json={"status": "done"}).json()["status"] == "done"


def test_delete_jobs_but_never_a_paid_invoice(api):
    cid = new_client(api)["id"]
    task = api.post("/api/items", json={"kind": "task", "title": "x", "client_id": cid}).json()
    assert api.delete(f"/api/items/{task['id']}").status_code == 204
    inv = api.post("/api/items", json={"kind": "invoice", "client_id": cid, "lines": LINES, "status": "paid"}).json()
    assert api.delete(f"/api/items/{inv['id']}").status_code == 409
    api.patch(f"/api/items/{inv['id']}", json={"status": "requested"})
    assert api.delete(f"/api/items/{inv['id']}").status_code == 204
    assert client_as(OTHER).delete(f"/api/items/{task['id']}").status_code == 404


def test_task_from_an_estimate_keeps_its_prices_for_the_invoice(api):
    """Estimate -> task -> invoice: the prices travel along (the owner lost them on the iPhone)."""
    cid = new_client(api)["id"]
    lines = LINES + [{"text": "Deck screws", "qty": 2, "price": 45, "kind": "material"}]
    est = api.post("/api/items", json={"kind": "estimate", "client_id": cid, "lines": lines}).json()
    task = api.post("/api/items", json={"kind": "task", "client_id": cid, "title": "Replace deck boards",
                                        "from_item_id": est["id"]}).json()
    assert [l["text"] for l in task["lines"]] == [l["text"] for l in est["lines"]]
    assert task["total"] == est["total"] == 1890
    plain = api.post("/api/items", json={"kind": "task", "title": "Pick up tile", "client_id": cid}).json()
    assert plain.get("lines", []) == [] and plain.get("total", 0) == 0


def test_materials_on_the_invoice_and_what_the_user_paid_counted_once(api, fake):
    """No Expenses screen: materials are invoice lines; at Create the user may save what they paid (once)."""
    cid = new_client(api)["id"]
    lines = [{"text": "Install door", "qty": 1, "price": 300}, {"text": "Door", "qty": 1, "price": 250, "kind": "material"}]
    inv = api.post("/api/items", json={"kind": "invoice", "client_id": cid, "lines": lines,
                                       "expenses": [{"description": "Door", "amount": 180, "add_to_invoice": False}]}).json()
    assert inv["total"] == 550 and len(inv["lines"]) == 2          # the customer pays the line price
    saved = list(fake.tables["expenses"].values())
    assert [(e["amount"], e["item_id"]) for e in saved] == [(180, inv["id"])]   # the user paid 180, saved once
    later = api.post("/api/items", json={"kind": "invoice", "client_id": cid, "lines": lines}).json()   # "Later"
    assert later["total"] == 550 and len(fake.tables["expenses"]) == 1
