"""Repeating tasks and notes (product-decisions.md §6g): the dates of a series.

A rule: every N days / weeks / months / years from the first date (start), optionally until a date.
Each visit is its own row, so it is done, reminded and invoiced on its own. With no end date the visits are made
about a year ahead (HORIZON_DAYS) and more are added as the calendar asks for later dates.
Months keep the start's day, or the month's last day when it is shorter (Jan 31 -> Feb 28 -> Mar 31).
"""
from calendar import monthrange
from datetime import date, timedelta

HORIZON_DAYS = 400        # with no end date: visits made this far ahead, more later
MAX_AHEAD_DAYS = 3 * 366  # never more than ~3 years ahead in one go
MAX_VISITS = 500          # a safety cap per call


def nth(start: date, unit: str, every: int, k: int) -> date:
    """The k-th visit after start (k=0 is start)."""
    n = every * k
    if unit == "day":
        return start + timedelta(days=n)
    if unit == "week":
        return start + timedelta(weeks=n)
    months = n if unit == "month" else 12 * n
    y, m = divmod(start.month - 1 + months, 12)
    y += start.year
    return date(y, m + 1, min(start.day, monthrange(y, m + 1)[1]))


def visits(rule: dict, after: date, through: date) -> list[date]:
    """The visit dates d with after < d <= through (and d <= rule's until), at most MAX_VISITS."""
    start = date.fromisoformat(rule["start"])
    until = date.fromisoformat(rule["until"]) if rule.get("until") else None
    last = min(through, until) if until else through
    out: list[date] = []
    k = 0
    while len(out) < MAX_VISITS:
        d = nth(start, rule["unit"], int(rule["every"]), k)
        if d > last:
            break
        if d > after:
            out.append(d)
        k += 1
    return out


def first_horizon(rule: dict, today: date) -> date:
    """How far the visits are made when the series is created."""
    start = date.fromisoformat(rule["start"])
    far = max(start, today) + timedelta(days=HORIZON_DAYS)
    if rule.get("until"):
        return min(date.fromisoformat(rule["until"]), today + timedelta(days=MAX_AHEAD_DAYS))
    return far
