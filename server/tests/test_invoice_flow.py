"""Build step 4 end to end: one invoice through its whole life, and what its PDF really says.
If any of these break, something the owner tested on the iPhone has changed."""
from io import BytesIO

from pypdf import PdfReader

from tests.test_api import api, client_as, fake, new_client, OTHER  # noqa: F401  (pytest fixtures)


def pdf_text(api, item_id, **params) -> str:
    r = api.get(f"/api/items/{item_id}/pdf", params=params)
    assert r.status_code == 200, r.text
    return "\n".join(page.extract_text() for page in PdfReader(BytesIO(r.content)).pages)


def setup_business(api, **extra):
    api.patch("/api/settings", json={"name": "Fix-It Pro", "phone": "(561) 555-0100", "address": "1 Main St, Boca Raton",
                                     "payment_info": "Zelle (561) 555-0100", **extra})


def make_invoice(api, **extra):
    cid = api.post("/api/clients", json={"name": "Ann Lee", "phone": "(561) 555-0101", "email": "ann@example.com",
                                         "address": "5 Oak St, Boca Raton, FL 33432"}).json()["id"]
    body = {"kind": "invoice", "client_id": cid, "date": "2026-11-19", "due_date": "2026-12-04",
            "title": "Installed doors",
            "lines": [{"text": "Installed 2 single swing doors", "qty": 2, "price": 200}],
            "expenses": [{"description": "Materials", "amount": 64.5, "add_to_invoice": True}], **extra}
    r = api.post("/api/items", json=body)
    assert r.status_code == 201, r.text
    return r.json()


def test_whole_invoice_life(api):
    inv = make_invoice(api)
    url = f"/api/items/{inv['id']}"
    assert inv["status"] == "created" and inv["number"] == "INV-0001" and inv["total"] == 464.5

    # Send: the share sheet closed -> Requested
    assert api.patch(url, json={"status": "requested"}).json()["status"] == "requested"
    # Edit after sending is allowed (the app then offers to send the update)
    r = api.patch(url, json={"lines": [{"text": "Installed 3 doors", "qty": 3, "price": 200}]})
    assert r.status_code == 200 and r.json()["total"] == 600
    # Mark Paid with method and date
    r = api.patch(url, json={"status": "paid", "payment_method": "Zelle", "paid_date": "2026-11-20"}).json()
    assert (r["status"], r["payment_method"], r["paid_date"]) == ("paid", "Zelle", "2026-11-20")
    # Paid = locked
    assert api.patch(url, json={"lines": []}).status_code == 409
    assert api.patch(url, json={"date": "2026-11-21"}).status_code == 409
    # Undo payment -> Requested, method and date cleared, editable again
    r = api.patch(url, json={"status": "requested"}).json()
    assert (r["status"], r["payment_method"], r["paid_date"]) == ("requested", "", None)
    assert api.patch(url, json={"title": "Doors"}).status_code == 200


def test_edit_cannot_take_a_used_number(api):
    first, second = make_invoice(api), make_invoice(api)
    r = api.patch(f"/api/items/{second['id']}", json={"number": first["number"]})
    # the next free number for THIS invoice is its own current one
    assert r.status_code == 409 and r.json()["detail"]["next"] == "INV-0002"
    # keeping its own number is fine
    assert api.patch(f"/api/items/{second['id']}", json={"number": second["number"]}).status_code == 200


def test_turning_tax_off_for_one_invoice(api):
    setup_business(api, tax_rate=7, tax_applies_to="materials")
    with_tax, without = make_invoice(api), make_invoice(api, tax_rate=0)
    assert (with_tax["tax"], with_tax["total"]) == (4.52, 469.02)
    assert (without["tax"], without["total"]) == (0, 464.5)


def test_pdf_shows_everything_from_the_review_screen(api):
    setup_business(api, tax_rate=7, invoice_terms="1-year warranty on labor")
    inv = make_invoice(api)
    text = pdf_text(api, inv["id"])
    for expected in ["Fix-It Pro", "1 Main St, Boca Raton", "(561) 555-0100",          # FROM
                     "BILL TO", "Ann Lee", "5 Oak St, Boca Raton, FL 33432", "ann@example.com",   # client together
                     "INVOICE", "INV-0001", "11/19/2026", "Due: 12/04/2026",
                     "Installed 2 single swing doors", "$400.00", "Materials", "$64.50",
                     "Subtotal", "$464.50", "Sales tax 7%", "$4.52", "TOTAL DUE", "$469.02",
                     "PAYMENT DETAILS", "Zelle (561) 555-0100", "TERMS", "1-year warranty on labor"]:
        assert expected in text, f"missing on the PDF: {expected!r}"
    assert "JOB SITE" not in text   # same address as the client: shown once, under BILL TO


def test_pdf_labels_follow_the_document_language(api):
    inv = make_invoice(api)
    es = pdf_text(api, inv["id"], lang="es")
    assert "FACTURA" in es and "FACTURAR A" in es and "TOTAL A PAGAR" in es and "19/11/2026" in es
    ru = pdf_text(api, inv["id"], lang="ru")
    assert "СЧЁТ" in ru and "ИТОГО К ОПЛАТЕ" in ru and "19.11.2026" in ru   # Cyrillic really printed


def test_paid_pdf_says_paid_and_hides_payment_details(api):
    setup_business(api)
    inv = make_invoice(api)
    api.patch(f"/api/items/{inv['id']}", json={"status": "paid", "payment_method": "Cash", "paid_date": "2026-11-20"})
    text = pdf_text(api, inv["id"])
    assert "PAID on 11/20/2026" in text and "TOTAL PAID" in text
    assert "PAYMENT DETAILS" not in text and "Due:" not in text


def test_job_site_only_when_elsewhere(api):
    inv = make_invoice(api, address="77 Beach Rd, Delray Beach")
    assert "JOB SITE" in pdf_text(api, inv["id"]) and "77 Beach Rd" in pdf_text(api, inv["id"])
