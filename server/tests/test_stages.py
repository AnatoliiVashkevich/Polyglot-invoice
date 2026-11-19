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


def test_task_without_customer_and_its_reminder_choices(api):
    r = api.post("/api/items", json={"kind": "task", "title": "Pick up tile", "date": "2026-11-20", "time": "16:30"})
    assert r.status_code == 201 and r.json().get("client_id") is None and r.json().get("reminder_minutes") is None
    tid = r.json()["id"]
    for minutes in (30, 60, 1440):
        assert api.patch(f"/api/items/{tid}", json={"reminder_minutes": minutes}).status_code == 200
    assert api.patch(f"/api/items/{tid}", json={"reminder_minutes": 45}).status_code == 422
    assert api.patch(f"/api/items/{tid}", json={"reminder_minutes": None}).json()["reminder_minutes"] is None
    assert api.patch(f"/api/items/{tid}", json={"status": "done"}).json()["status"] == "done"


def test_delete_jobs_but_never_a_paid_invoice(api):
    cid = new_client(api)["id"]
    task = api.post("/api/items", json={"kind": "task", "title": "x"}).json()
    assert api.delete(f"/api/items/{task['id']}").status_code == 204
    inv = api.post("/api/items", json={"kind": "invoice", "client_id": cid, "lines": LINES, "status": "paid"}).json()
    assert api.delete(f"/api/items/{inv['id']}").status_code == 409
    api.patch(f"/api/items/{inv['id']}", json={"status": "requested"})
    assert api.delete(f"/api/items/{inv['id']}").status_code == 204
    assert client_as(OTHER).delete(f"/api/items/{task['id']}").status_code == 404
