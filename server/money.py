"""money.py - invoice math with exact cents (Decimal, never float).

Lines: [{text, qty, price, kind: "work" | "material" | "discount", pct?}]
    subtotal = sum(qty x price) of work and materials (before the discount)
    discount = a "discount" line (§6o): pct% of the subtotal, or a fixed amount; never more than the subtotal (<= 0)
    tax      = taxable x rate%   taxable = materials only, or everything (Settings), after the discount (shared
               proportionally), 0 when the rate is 0
    total    = subtotal + discount + tax
"""
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation

CENT = Decimal("0.01")
ZERO = Decimal("0")


def dec(value) -> Decimal:
    try:
        return Decimal(str(value if value not in (None, "") else 0))
    except InvalidOperation:
        return ZERO


def cents(value) -> Decimal:
    return dec(value).quantize(CENT, rounding=ROUND_HALF_UP)


def line_amount(line: dict) -> Decimal:
    return cents(dec(line.get("qty", 1)) * dec(line.get("price")))


def discount_amount(line: dict, subtotal: Decimal) -> Decimal:
    """A discount line -> its amount (<= 0): pct% of the subtotal, else its fixed amount."""
    if line.get("pct") not in (None, ""):
        return -cents(subtotal * dec(line["pct"]) / 100)
    return -abs(line_amount(line))


def totals(lines: list[dict], tax_rate=0, tax_applies_to: str = "materials") -> dict:
    """{"subtotal", "discount", "tax", "total"} as Decimals rounded to cents."""
    items = [x for x in lines if x.get("kind") != "discount"]
    subtotal = sum((line_amount(x) for x in items), ZERO)
    first = next((x for x in lines if x.get("kind") == "discount"), None)   # one discount per invoice
    discount = discount_amount(first, subtotal) if first else ZERO
    discount = max(discount, -max(subtotal, ZERO))   # never below zero in total
    if tax_applies_to == "everything":
        taxable = subtotal + discount
    else:
        materials = sum((line_amount(x) for x in items if x.get("kind") == "material"), ZERO)
        taxable = materials * (subtotal + discount) / subtotal if subtotal > 0 else materials
    tax = cents(taxable * dec(tax_rate) / 100)
    return {"subtotal": cents(subtotal), "discount": cents(discount), "tax": tax, "total": cents(subtotal + discount + tax)}
