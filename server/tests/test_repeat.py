"""The dates of repeating tasks and notes (repeat.py)."""
from datetime import date

from repeat import first_horizon, nth, visits


def rule(unit, every=1, start="2026-01-31", until=None):
    return {"unit": unit, "every": every, "start": start, "until": until}


def test_every_week_and_every_two_weeks():
    assert visits(rule("week", start="2026-11-20"), date(2026, 11, 20), date(2026, 12, 11)) == [
        date(2026, 11, 27), date(2026, 12, 4), date(2026, 12, 11)]
    assert visits(rule("week", 2, start="2026-11-20"), date(2026, 11, 20), date(2026, 12, 31)) == [
        date(2026, 12, 4), date(2026, 12, 18)]


def test_months_keep_the_day_or_the_last_day_of_a_shorter_month():
    assert [nth(date(2026, 1, 31), "month", 1, k) for k in range(4)] == [
        date(2026, 1, 31), date(2026, 2, 28), date(2026, 3, 31), date(2026, 4, 30)]
    assert nth(date(2028, 2, 29), "year", 1, 1) == date(2029, 2, 28)


def test_until_is_the_last_possible_day():
    assert visits(rule("day", 3, start="2026-11-01", until="2026-11-10"), date(2026, 11, 1), date(2027, 1, 1)) == [
        date(2026, 11, 4), date(2026, 11, 7), date(2026, 11, 10)]


def test_no_end_date_is_made_about_a_year_ahead_until_date_fully():
    today = date(2026, 11, 19)
    assert (first_horizon(rule("week", start="2026-11-20"), today) - today).days == 401
    assert first_horizon(rule("month", start="2026-11-20", until="2027-03-01"), today) == date(2027, 3, 1)
