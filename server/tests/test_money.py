"""Invoice math: exact cents, sales tax on materials only or on everything."""
from decimal import Decimal as D

from money import totals

LINES = [
    {"text": "Single swing door", "qty": 2, "price": 200, "kind": "work"},
    {"text": "Double swing door", "qty": 1, "price": 300, "kind": "work"},
    {"text": "Materials", "qty": 1, "price": 64.50, "kind": "material"},
]


def test_no_tax_by_default():
    assert totals(LINES) == {"subtotal": D("764.50"), "tax": D("0.00"), "total": D("764.50")}


def test_tax_on_materials_only():
    # the decisions' example: "Sales tax 7% (materials) $4.52"
    t = totals(LINES, 7, "materials")
    assert t["tax"] == D("4.52") and t["total"] == D("769.02")


def test_tax_on_everything():
    t = totals(LINES, 7, "everything")
    assert t["tax"] == D("53.52") and t["total"] == D("818.02")


def test_cents_are_exact():
    # 3 x 0.10 must be 0.30, not 0.30000000000000004
    assert totals([{"qty": 3, "price": 0.1}])["total"] == D("0.30")
    assert totals([{"qty": 1, "price": 10}], 6.5, "everything")["tax"] == D("0.65")


def test_empty_and_odd_values():
    assert totals([])["total"] == D("0.00")
    assert totals([{"qty": "", "price": None}])["total"] == D("0.00")
    assert totals([{"price": 50}])["total"] == D("50.00")   # qty defaults to 1
