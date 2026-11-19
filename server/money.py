"""money.py - invoice math with exact cents (Decimal, never float).

Lines: [{text, qty, price, kind: "work" | "material"}]
    subtotal = sum(qty x price)
    tax      = taxable x rate%   where taxable = materials only, or everything (Settings), 0 when the rate is 0
    total    = subtotal + tax
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


def totals(lines: list[dict], tax_rate=0, tax_applies_to: str = "materials") -> dict:
    """{"subtotal", "tax", "total"} as Decimals rounded to cents."""
    subtotal = sum((line_amount(x) for x in lines), ZERO)
    if tax_applies_to == "everything":
        taxable = subtotal
    else:
        taxable = sum((line_amount(x) for x in lines if x.get("kind") == "material"), ZERO)
    tax = cents(taxable * dec(tax_rate) / 100)
    return {"subtotal": cents(subtotal), "tax": tax, "total": cents(subtotal + tax)}
