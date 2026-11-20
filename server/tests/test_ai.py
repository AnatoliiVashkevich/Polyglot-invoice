"""Step 7 part 1: words -> invoice lines. The real AI is never called in tests (a fake client answers)."""
from types import SimpleNamespace as NS

import pytest

import ai
from tests.test_api import api, client_as, fake, OTHER  # noqa: F401  (pytest fixtures)


class FakeResponses:
    def __init__(self, answer=None, error=None):
        self.answer, self.error, self.calls = answer, error, []

    def parse(self, **kw):
        self.calls.append(kw)
        if self.error:
            raise self.error
        return NS(output_parsed=self.answer)


def use_fake(monkeypatch, **kw):
    fake_responses = FakeResponses(**kw)
    monkeypatch.setattr(ai, "_client", lambda: NS(responses=fake_responses))
    return fake_responses


def test_words_become_lines_the_user_can_check(api, monkeypatch):
    answer = ai.AiLines(lines=[ai.AiLine(text="Door installation", qty=1, price=300, kind="work"),
                               ai.AiLine(text="Double swing doors", qty=2, price=350, kind="work"),
                               ai.AiLine(text="Hinges", qty=3, price=12, kind="material")])
    fake_ai = use_fake(monkeypatch, answer=answer)
    r = api.post("/api/ai/lines", json={"text": "door installation 300, 2 double swing doors 700, hinges 3 at 12 each"})
    assert r.status_code == 200
    assert [(line["text"], line["qty"], line["price"], line["kind"]) for line in r.json()["lines"]] == [
        ("Door installation", 1, 300, "work"), ("Double swing doors", 2, 350, "work"), ("Hinges", 3, 12, "material")]
    call = fake_ai.calls[0]
    assert call["model"] == ai.TEXT_MODEL and "door installation 300" in call["input"] and "price = total / qty" in call["instructions"]


def test_the_ai_answer_is_kept_inside_the_invoice_limits():
    lines = ai.clean_lines([{"text": "  x ", "qty": 0, "price": 5_000_000, "kind": "work"},
                            {"text": "", "qty": 1, "price": 0, "kind": "work"},
                            {"text": "Tile", "qty": 2, "price": 10.555, "kind": "something"}])
    assert lines == [{"text": "x", "qty": 1, "price": 1_000_000, "kind": "work"},
                     {"text": "Tile", "qty": 2, "price": 10.56, "kind": "work"}]


def test_no_ai_says_so_and_the_app_keeps_the_text(api, monkeypatch):
    use_fake(monkeypatch, error=RuntimeError("quota"))
    r = api.post("/api/ai/lines", json={"text": "door 300"})
    assert r.status_code == 503 and "not available" in r.json()["detail"]
    use_fake(monkeypatch, answer=None)
    assert api.post("/api/ai/lines", json={"text": "door 300"}).status_code == 503
    monkeypatch.setattr(ai, "_client", ai._client.__wrapped__ if hasattr(ai._client, "__wrapped__") else ai._client)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    assert api.post("/api/ai/lines", json={"text": "door 300"}).status_code == 503


def test_empty_text_and_signed_out_are_refused(api):
    assert api.post("/api/ai/lines", json={"text": ""}).status_code == 422
