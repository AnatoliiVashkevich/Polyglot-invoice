"""Invoice numbers continue the user's own format; used numbers are refused with the next free one."""
from numbering import increment, next_free, next_number


def test_default_first_numbers():
    assert next_number("invoice", None, set()) == "INV-0001"
    assert next_number("estimate", None, set()) == "EST-0001"


def test_continues_the_users_format():
    assert increment("INV-0001") == "INV-0002"
    assert increment("2026-045") == "2026-046"
    assert increment("A-17") == "A-18"
    assert increment("INV-0099") == "INV-0100"
    assert increment("9999") == "10000"
    assert increment("#12a") == "#13a"   # digits followed by letters: the digits count up


def test_number_without_digits_falls_back_to_default():
    assert increment("ABC") is None
    assert next_number("invoice", "ABC", {"ABC"}) == "INV-0001"


def test_skips_used_numbers():
    assert next_free("INV-0003", {"INV-0003", "inv-0004"}) == "INV-0005"
    assert next_number("invoice", "A-17", {"A-17", "A-18"}) == "A-19"
