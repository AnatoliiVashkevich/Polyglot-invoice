"""numbering.py - invoice / estimate numbers (product-decisions.md §7).

    Default: INV-0001, INV-0002…  (estimates EST-0001…)
    The next number continues the user's own format, from the number they used last:
        "2026-045" -> "2026-046"    "A-17" -> "A-18"    "INV-0099" -> "INV-0100"
    A number that is already used is refused, with the next free one offered instead.
"""
import re

PREFIX = {"invoice": "INV-", "estimate": "EST-"}
_TRAILING_DIGITS = re.compile(r"^(.*?)(\d+)(\D*)$")


def default_first(kind: str) -> str:
    return f"{PREFIX[kind]}0001"


def increment(number: str) -> str | None:
    """The number after this one, keeping its format and zero padding. None if it has no digits."""
    m = _TRAILING_DIGITS.match((number or "").strip())
    if not m:
        return None
    head, digits, tail = m.groups()
    return f"{head}{str(int(digits) + 1).zfill(len(digits))}{tail}"


def next_free(start: str, used: set[str]) -> str:
    """start, or the first number after it that is not used yet."""
    used_lower = {u.strip().lower() for u in used}
    number = start
    while number.strip().lower() in used_lower:
        number = increment(number) or f"{number}-2"
    return number


def next_number(kind: str, last: str | None, used: set[str]) -> str:
    """The number to offer for a new invoice/estimate. last = the user's most recent one (or None)."""
    start = (increment(last) if last else None) or default_first(kind)
    return next_free(start, used)
