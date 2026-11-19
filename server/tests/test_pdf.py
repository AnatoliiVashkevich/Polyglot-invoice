"""The PDF itself: labels in each language, Cyrillic, tax lines, file names."""
from invoice_pdf import build_pdf, date_text, file_name

ITEM = {"kind": "invoice", "status": "created", "number": "INV-0012", "date": "2026-11-19", "due_date": "2026-12-04",
        "lines": [{"text": "Установка двери", "qty": 2, "price": 200, "kind": "work"},
                  {"text": "Materials", "qty": 1, "price": 64.5, "kind": "material"}],
        "subtotal": 464.5, "tax": 4.52, "tax_rate": 7, "total": 469.02, "terms": "1-year warranty on labor"}


def test_pdf_builds_in_every_language():
    for lang in ("en", "es", "pt", "ru", "uk"):
        pdf = build_pdf(ITEM, {"name": "Ann Lee", "address": "5 Oak St"}, {"name": "Fix-It Pro", "payment_info": "Zelle"}, lang)
        assert pdf.startswith(b"%PDF") and len(pdf) > 1500


def test_paid_and_estimate_versions():
    assert build_pdf({**ITEM, "status": "paid", "paid_date": "2026-11-20"}, {}, {}, "en").startswith(b"%PDF")
    assert build_pdf({**ITEM, "kind": "estimate", "number": "EST-0001"}, {}, {}, "es").startswith(b"%PDF")
    assert build_pdf({**ITEM, "lines": []}, {}, {}, "en").startswith(b"%PDF")


def test_file_names_and_dates():
    assert file_name(ITEM, "es") == "INV-0012-ES.pdf"
    assert file_name({"number": "2026/045"}, "en") == "2026-045-EN.pdf"
    assert date_text("2026-11-19", "en") == "11/19/2026"
    assert date_text("2026-11-19", "ru") == "19.11.2026"
    assert date_text("2026-11-19", "es") == "19/11/2026"
