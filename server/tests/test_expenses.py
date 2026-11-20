"""Expenses (what the user paid): saved from an invoice's materials now, the Money screen later (step 8)."""
from tests.test_api import api, client_as, fake, new_client, new_invoice, OTHER  # noqa: F401  (pytest fixtures)


def test_add_list_change_and_delete_an_expense(api):
    cid = new_client(api)["id"]
    inv = new_invoice(api, cid)
    r = api.post("/api/expenses", json={"description": "Tile", "amount": 120.5, "client_id": cid, "item_id": inv["id"]})
    assert r.status_code == 201 and r.json()["date"] == "2026-11-19"
    eid = r.json()["id"]
    api.post("/api/expenses", json={"description": "Gas", "amount": 40, "date": "2026-10-02"})
    assert [e["description"] for e in api.get("/api/expenses", params={"start": "2026-11-01", "end": "2026-11-30"}).json()] == ["Tile"]
    assert api.patch(f"/api/expenses/{eid}", json={"amount": 99}).json()["amount"] == 99
    assert api.delete(f"/api/expenses/{eid}").status_code == 204
    assert api.patch(f"/api/expenses/{eid}", json={"amount": 1}).status_code == 404


def test_expenses_check_their_links_amounts_and_owner(api):
    assert api.post("/api/expenses", json={"amount": 5, "item_id": "nope"}).status_code == 404
    assert api.post("/api/expenses", json={"amount": 5, "client_id": "nope"}).status_code == 404
    assert api.post("/api/expenses", json={"amount": -5}).status_code == 422
    eid = api.post("/api/expenses", json={"amount": 5}).json()["id"]
    assert api.patch(f"/api/expenses/{eid}", json={"item_id": "nope"}).status_code == 404
    assert client_as(OTHER).delete(f"/api/expenses/{eid}").status_code == 404
    assert client_as(OTHER).get("/api/expenses").json() == []
