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
    assert "small service business (any trade)" in call["instructions"]       # no trade chosen yet: neutral


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


# ---------- step 7 part 2: the PDF in the document language ----------
class FakeTranslator:
    """Answers like the AI: one translation per line, in order. Counts the lines it was asked to translate."""
    WORDS = {"Перестилка пола на кухне": "Kitchen floor reinstallation", "Поездка в магазин": "Trip to the store",
             "Замена плинтуса": "Baseboard replacement"}

    def __init__(self):
        self.asked = []

    def parse(self, **kw):
        texts = [t.split(". ", 1)[1] for t in kw["input"].split("\n")]
        self.asked += texts
        into = kw["instructions"].split("into ", 1)[1].split(" for ", 1)[0]

        def one(t):
            return self.WORDS.get(t, t) if into.startswith("English") else f"ES:{t}" if into.startswith("Spanish") else t
        return NS(output_parsed=ai.AiTexts(texts=[f"{i + 1}. {one(t)}" for i, t in enumerate(texts)]))


def ru_invoice(api):
    cid = api.post("/api/clients", json={"name": "Ann Lee"}).json()["id"]
    return api.post("/api/items", json={"kind": "invoice", "client_id": cid, "date": "2026-11-19", "lines": [
        {"text": "Перестилка пола на кухне", "qty": 1, "price": 1200}, {"text": "Поездка в магазин", "price": 50}]}).json()


def test_lines_written_in_russian_come_out_in_english_and_are_remembered(api, monkeypatch, fake):
    from tests.test_invoice_flow import pdf_text
    tr = FakeTranslator()
    monkeypatch.setattr(ai, "_client", lambda: NS(responses=tr))
    inv = ru_invoice(api)
    text = pdf_text(api, inv["id"])
    assert "Kitchen floor reinstallation" in text and "Trip to the store" in text and "Перестилка" not in text
    assert len(tr.asked) == 2
    pdf_text(api, inv["id"])
    assert len(tr.asked) == 2                                    # remembered: not translated again
    stored = api.get(f"/api/items/{inv['id']}").json()["lines"]
    assert stored[0]["text"] == "Перестилка пола на кухне"       # the user's own words stay in the app
    assert stored[0]["tr"]["en"] == {"src": "Перестилка пола на кухне", "text": "Kitchen floor reinstallation"}


def test_only_a_changed_line_is_translated_again(api, monkeypatch):
    from tests.test_invoice_flow import pdf_text
    tr = FakeTranslator()
    monkeypatch.setattr(ai, "_client", lambda: NS(responses=tr))
    inv = ru_invoice(api)
    pdf_text(api, inv["id"])
    api.patch(f"/api/items/{inv['id']}", json={"lines": [{"text": "Перестилка пола на кухне", "price": 1200},
                                                          {"text": "Замена плинтуса", "price": 90}]})
    text = pdf_text(api, inv["id"])
    assert "Baseboard replacement" in text and tr.asked[2:] == ["Замена плинтуса"]


def test_check_in_my_language_and_the_clients_language(api, monkeypatch):
    from tests.test_invoice_flow import pdf_text
    tr = FakeTranslator()
    monkeypatch.setattr(ai, "_client", lambda: NS(responses=tr))
    inv = ru_invoice(api)
    assert "Перестилка пола на кухне" in pdf_text(api, inv["id"], lang="ru")   # the user's own words
    assert "ES:Перестилка пола на кухне" in pdf_text(api, inv["id"], lang="es")


def test_without_the_ai_the_pdf_still_works_with_the_users_words(api):
    from tests.test_invoice_flow import pdf_text
    inv = ru_invoice(api)                       # conftest: the AI is offline
    assert "Перестилка пола на кухне" in pdf_text(api, inv["id"])
    assert "tr" not in api.get(f"/api/items/{inv['id']}").json()["lines"][0]


def test_the_translation_rules_carry_the_trade_context():
    assert "{language}" in ai.TRANSLATE_RULES and "Поездка в магазин за материалами" in ai.LINES_RULES
    assert "never gender" in ai.context()
    assert "whose work is: Hair salon, coloring" in ai.context("Hair salon, coloring")


def test_the_users_trade_from_settings_reaches_the_ai(api, monkeypatch):
    fake_ai = use_fake(monkeypatch, answer=ai.AiLines(lines=[ai.AiLine(text="Стрижка", qty=1, price=40, kind="work")]))
    assert api.patch("/api/settings", json={"trade": "Hair salon"}).json()["trade"] == "Hair salon"
    api.post("/api/ai/lines", json={"text": "стрижка 40"})
    assert "whose work is: Hair salon" in fake_ai.calls[0]["instructions"]
    assert api.patch("/api/settings", json={"trade": "x" * 301}).status_code == 422
