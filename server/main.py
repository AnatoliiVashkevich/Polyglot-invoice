"""main.py - the Polyglot Invoice API (FastAPI). Run:  venv\\Scripts\\python -m uvicorn main:app --host 0.0.0.0

Every route below /api (except sign-in) needs the signed-in user (auth.current_user) and only sees that user's rows.
Product rules: docs/product-decisions.md.
"""
import logging
import uuid
from decimal import Decimal
from datetime import date, datetime, timedelta, timezone
from typing import Literal

from fastapi import Depends, FastAPI, HTTPException, Response
from pydantic import BaseModel, Field, field_validator

import ai
import auth
import database as db
import invoice_pdf
import repeat as rep
from money import totals
from numbering import next_free, next_number

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("polyglot")
app = FastAPI(title="Polyglot Invoice")
app.include_router(auth.router)

Lang = Literal["en", "es", "pt", "ru", "uk"]
Kind = Literal["task", "estimate", "invoice", "note"]
Status = Literal["created", "done", "sent", "requested", "paid"]
STATUSES: dict[str, set[str]] = {
    "task": {"created", "done"},
    "note": {"created", "done"},
    "estimate": {"created", "sent"},
    "invoice": {"created", "requested", "paid"},
}
# what may still change on a paid invoice: only undoing the payment (product-decisions.md §6)
PAID_EDITABLE = {"status", "paid_date", "payment_method"}


def _date(v):
    if v in (None, ""):
        return None
    return date.fromisoformat(str(v)[:10]).isoformat()   # raises ValueError -> 422 for a bad date


def _time(v):
    v = (v or "").strip()
    if v and (len(v) != 5 or v[2] != ":" or not (v[:2] + v[3:]).isdigit() or int(v[:2]) > 23 or int(v[3:]) > 59):
        raise ValueError("time must be HH:MM")
    return v


@app.get("/api/health")
def health():
    return {"status": "ok"}


# =====================================================================================================
# Settings (the businesses row)
# =====================================================================================================
class SettingsPatch(BaseModel):
    name: str | None = Field(None, max_length=200)
    logo_url: str | None = None
    phone: str | None = Field(None, max_length=50)
    email: str | None = Field(None, max_length=200)
    address: str | None = Field(None, max_length=500)
    payment_info: str | None = Field(None, max_length=1000)
    app_language: Lang | None = None
    doc_language: Lang | None = None
    tax_rate: float | None = Field(None, ge=0, le=30)
    tax_applies_to: Literal["materials", "everything"] | None = None
    due_days: Literal[0, 7, 15, 30] | None = None
    invoice_terms: str | None = Field(None, max_length=2000)
    tax_setaside_pct: float | None = Field(None, ge=0, le=60)


def _business(uid: str) -> dict:
    return db.get_business(uid) or db.create_business(uid, {})


@app.get("/api/settings")
def get_settings(uid: str = Depends(auth.current_user)):
    return _business(uid)


@app.patch("/api/settings")
def patch_settings(body: SettingsPatch, uid: str = Depends(auth.current_user)):
    _business(uid)
    return db.update_business(uid, body.model_dump(exclude_unset=True))


# =====================================================================================================
# Clients
# =====================================================================================================
class ClientAddress(BaseModel):
    """One more address of a client (a rental, an office…). The PDF shows it as JOB SITE."""
    label: str = Field("", max_length=60)
    address: str = Field(..., min_length=1, max_length=500)


class ClientIn(BaseModel):
    name: str = Field("", max_length=200)
    phone: str = Field("", max_length=50)
    email: str = Field("", max_length=200)
    address: str = Field("", max_length=500)
    notes: str = Field("", max_length=5000)
    preferred_language: Literal["", "en", "es", "pt", "ru", "uk"] = ""
    addresses: list[ClientAddress] | None = None   # other job addresses (the main `address` is the billing one)
    # from the phone contacts: if a client with the same phone or email exists, use it (no duplicate)
    use_existing: bool = False


class ClientPatch(BaseModel):
    name: str | None = Field(None, max_length=200)
    phone: str | None = Field(None, max_length=50)
    email: str | None = Field(None, max_length=200)
    address: str | None = Field(None, max_length=500)
    notes: str | None = Field(None, max_length=5000)
    preferred_language: Literal["", "en", "es", "pt", "ru", "uk"] | None = None
    addresses: list[ClientAddress] | None = Field(None, max_length=20)


def _client_or_404(client_id, uid) -> dict:
    row = db.get_row("clients", client_id, uid)
    if not row:
        raise HTTPException(404, "Client not found.")
    return row


def phone_key(phone: str) -> str:
    """Phone numbers compared by their last 10 digits: "+1 (561) 555-0101" == "561-555-0101"."""
    digits = "".join(ch for ch in phone or "" if ch.isdigit())
    return digits[-10:] if len(digits) >= 7 else ""


def find_same_client(clients: list[dict], phone: str, email: str) -> dict | None:
    p, e = phone_key(phone), (email or "").strip().lower()
    for c in clients:
        if (p and phone_key(c.get("phone", "")) == p) or (e and (c.get("email") or "").strip().lower() == e):
            return c
    return None


@app.get("/api/clients")
def list_clients(uid: str = Depends(auth.current_user)):
    """A-Z, each with last_used (when their newest job was created) so the app can show recent clients first,
    paid (all paid invoices) and owes (invoices sent and waiting for money) for the Clients tab."""
    last_used: dict[str, str] = {}
    paid: dict[str, Decimal] = {}
    owes: dict[str, Decimal] = {}
    for it in db.list_rows("items", uid):
        cid = it.get("client_id")
        if not cid:
            continue
        if str(it.get("created_at", "")) > last_used.get(cid, ""):
            last_used[cid] = str(it["created_at"])
        if it.get("kind") == "invoice" and it.get("status") in ("paid", "requested"):
            box = paid if it["status"] == "paid" else owes
            box[cid] = box.get(cid, Decimal(0)) + Decimal(str(it.get("total") or 0))
    rows = [{**c, "last_used": last_used.get(c["id"], ""), "paid": float(paid.get(c["id"], 0)),
             "owes": float(owes.get(c["id"], 0))} for c in db.list_rows("clients", uid)]
    return sorted(rows, key=lambda c: c["name"].lower())


@app.post("/api/clients", status_code=201)
def create_client(body: ClientIn, response: Response, uid: str = Depends(auth.current_user)):
    data = body.model_dump(exclude={"use_existing"}, exclude_none=True)
    data["name"] = data["name"].strip()
    if not data["name"]:
        raise HTTPException(400, "Please enter the client's name.")
    if body.use_existing:
        same = find_same_client(db.list_rows("clients", uid), data["phone"], data["email"])
        if same:
            response.status_code = 200
            return same
    return db.insert_row("clients", data, uid)


@app.get("/api/clients/{client_id}")
def get_client(client_id: str, uid: str = Depends(auth.current_user)):
    return _client_or_404(client_id, uid)


@app.patch("/api/clients/{client_id}")
def patch_client(client_id: str, body: ClientPatch, uid: str = Depends(auth.current_user)):
    _client_or_404(client_id, uid)
    data = body.model_dump(exclude_unset=True)
    if "name" in data:
        data["name"] = (data["name"] or "").strip()
        if not data["name"]:
            raise HTTPException(400, "Please enter the client's name.")
    return db.update_row("clients", client_id, data, uid)


@app.delete("/api/clients/{client_id}", status_code=204)
def delete_client(client_id: str, uid: str = Depends(auth.current_user)):
    """Their jobs and expenses stay (without the client), so no money record disappears."""
    _client_or_404(client_id, uid)
    db.delete_row("clients", client_id, uid)


# =====================================================================================================
# Items: task -> estimate -> invoice
# =====================================================================================================
class Line(BaseModel):
    text: str = Field("", max_length=500)
    qty: float = Field(1, ge=0, le=100000)
    price: float = Field(0, ge=-1000000, le=1000000)
    kind: Literal["work", "material"] = "work"
    # translations made for the PDFs: {"en": {"src": the text it was made from, "text": the translation}}
    tr: dict[str, dict[str, str]] | None = None


class Repeat(BaseModel):
    """Repeating tasks and notes (§6g): every N days / weeks / months / years, until a date or no end."""
    every: int = Field(1, ge=1, le=365)
    unit: Literal["day", "week", "month", "year"]
    until: str | None = None

    @field_validator("until")
    @classmethod
    def _until(cls, v):
        return _date(v)


class ItemFields(BaseModel):
    client_id: str | None = None
    status: Status | None = None
    date: str | None = None
    time: str | None = None
    reminder_minutes: Literal[30, 60, 1440] | None = None
    title: str | None = Field(None, max_length=500)
    address: str | None = Field(None, max_length=500)
    number: str | None = Field(None, max_length=40)
    lines: list[Line] | None = Field(None, max_length=200)
    tax_rate: float | None = Field(None, ge=0, le=30)
    tax_applies_to: Literal["materials", "everything"] | None = None
    due_date: str | None = None
    terms: str | None = Field(None, max_length=2000)
    paid_date: str | None = None
    payment_method: str | None = Field(None, max_length=50)
    from_item_id: str | None = None
    repeat: Repeat | None = None   # tasks and notes only; None in a PATCH = stop repeating

    @field_validator("date", "due_date", "paid_date")
    @classmethod
    def _dates(cls, v):
        return _date(v)

    @field_validator("time")
    @classmethod
    def _times(cls, v):
        return None if v is None else _time(v)


class NewExpense(BaseModel):
    """What the user paid for this job's materials, saved as their expense and linked to the invoice (asked at
    Create: "Add these materials to your expenses?"). add_to_invoice also adds it as a line (the app now sends the
    lines itself, so it sends False)."""
    description: str = Field("", max_length=500)
    amount: float = Field(0, ge=0, le=10000000)
    add_to_invoice: bool = True


class ItemIn(ItemFields):
    kind: Kind
    expenses: list[NewExpense] = Field([], max_length=50)


def _numbers_in_use(kind: str, uid: str, except_id: str | None = None) -> tuple[set[str], str | None]:
    """(every number used for this kind, the most recently created one)."""
    rows = [r for r in db.list_rows("items", uid, kind=kind) if r.get("number") and r["id"] != except_id]
    rows.sort(key=lambda r: str(r.get("created_at", "")))
    return {r["number"] for r in rows}, (rows[-1]["number"] if rows else None)


def _check_number(kind: str, number: str, uid: str, except_id: str | None = None) -> None:
    used, _ = _numbers_in_use(kind, uid, except_id)
    if number.strip().lower() in {u.strip().lower() for u in used}:
        raise HTTPException(409, {"message": f"{number} is already used.", "next": next_free(number, used)})


def _with_client_names(items: list[dict], uid: str) -> list[dict]:
    names = {c["id"]: c["name"] for c in db.list_rows("clients", uid)} if items else {}
    return [{**it, "client_name": names.get(it.get("client_id"), "")} for it in items]


def _item_or_404(item_id, uid) -> dict:
    row = db.get_row("items", item_id, uid)
    if not row:
        raise HTTPException(404, "Not found.")
    return row


def _check_links(data: dict, uid: str) -> None:
    if data.get("client_id"):
        _client_or_404(data["client_id"], uid)
    if data.get("from_item_id"):
        _item_or_404(data["from_item_id"], uid)


def _apply_totals(row: dict) -> dict:
    t = totals(row.get("lines") or [], row.get("tax_rate") or 0, row.get("tax_applies_to") or "materials")
    return {**row, **{k: float(v) for k, v in t.items()}}


@app.get("/api/items")
def list_items(start: str | None = None, end: str | None = None, client_id: str | None = None,
               uid: str = Depends(auth.current_user)):
    """The calendar asks for a date range (start / end, YYYY-MM-DD); the client page asks by client_id."""
    eq = {"client_id": client_id} if client_id else {}
    if end:
        _extend_series(uid, _date(end))
    rows = db.list_rows("items", uid, order="date",
                        gte={"date": _date(start)} if start else None,
                        lte={"date": _date(end)} if end else None, **eq)
    return _with_client_names(rows, uid)


@app.post("/api/items", status_code=201)
def create_item(body: ItemIn, uid: str = Depends(auth.current_user)):
    data = body.model_dump(exclude_none=True, exclude={"expenses"})
    kind = data["kind"]
    data.setdefault("status", "created")
    if data["status"] not in STATUSES[kind]:
        raise HTTPException(400, f"A {kind} can't be '{data['status']}'.")
    if kind == "note":
        data["client_id"] = None   # a note is not for a client
    elif not data.get("client_id"):
        raise HTTPException(400, "Please choose a client.")
    if data.get("repeat") and kind not in REPEATABLE:
        raise HTTPException(400, "Only tasks and notes can repeat.")
    _check_links(data, uid)
    data.setdefault("date", db.today_local())
    source = db.get_row("items", data["from_item_id"], uid) if data.get("from_item_id") else None
    # a task scheduled from an estimate keeps the estimate's work and prices, so the invoice gets them later
    if kind in REPEATABLE and data.get("repeat"):
        data["repeat"] = {**data["repeat"], "start": data["date"]}
        data["series_id"] = str(uuid.uuid4())
    # a task scheduled from an estimate (or from an invoice paid before the job) keeps its work and prices
    if kind == "task" and source and source["kind"] in ("estimate", "invoice") and not data.get("lines"):
        data["lines"] = source.get("lines") or []
        data.setdefault("tax_rate", float(source.get("tax_rate") or 0))
        data.setdefault("tax_applies_to", source.get("tax_applies_to") or "materials")
    if kind not in REPEATABLE:   # estimates and invoices: lines, number, tax, terms
        data["lines"] = data.get("lines", []) + [
            {"text": e.description.strip() or "Materials", "qty": 1, "price": e.amount, "kind": "material"}
            for e in body.expenses if e.add_to_invoice and e.amount > 0]
        if not any(line.get("text") or line.get("price") for line in data["lines"]):
            raise HTTPException(400, "Please add the work and prices.")
        number = (data.get("number") or "").strip()
        if number:
            _check_number(kind, number, uid)
        else:
            used, last = _numbers_in_use(kind, uid)
            number = next_number(kind, last, used)
        data["number"] = number   # invoices and estimates take their defaults from Settings
        biz = _business(uid)
        data.setdefault("tax_rate", float(biz.get("tax_rate") or 0))
        data.setdefault("tax_applies_to", biz.get("tax_applies_to") or "materials")
        data.setdefault("terms", biz.get("invoice_terms") or "")
        if kind == "invoice":
            data.setdefault("due_date", (date.fromisoformat(data["date"])
                                         + timedelta(days=int(biz.get("due_days") or 0))).isoformat())
    if data["status"] == "paid":
        data.setdefault("paid_date", db.today_local())
    row = db.insert_row("items", _apply_totals(data), uid)
    if row.get("series_id"):
        row = _make_visits(row, uid)
    for e in body.expenses:
        if e.amount > 0:
            db.insert_row("expenses", {"date": data["date"], "description": e.description.strip(), "amount": e.amount,
                                       "category": "Materials", "client_id": data.get("client_id"),
                                       "item_id": row["id"] if kind not in REPEATABLE else None}, uid)
    # "Job done -> Create invoice": the task it was made from is done now
    if source and source["kind"] == "task" and kind != "task" and source["status"] != "done":
        db.update_row("items", source["id"], {"status": "done"}, uid)
    return _with_client_names([row], uid)[0]


@app.get("/api/next-number")
def get_next_number(kind: Literal["invoice", "estimate"] = "invoice", uid: str = Depends(auth.current_user)):
    used, last = _numbers_in_use(kind, uid)
    return {"number": next_number(kind, last, used)}


@app.get("/api/items/{item_id}")
def get_item(item_id: str, uid: str = Depends(auth.current_user)):
    return _with_client_names([_item_or_404(item_id, uid)], uid)[0]


class LinesText(BaseModel):
    text: str = Field(..., min_length=1, max_length=4000)


@app.post("/api/ai/lines")
def ai_lines(body: LinesText, uid: str = Depends(auth.current_user)):
    """Step 7, part 1: "Describe the work and prices" -> clean lines the user then checks and edits.
    503 when the AI isn't available: the app keeps the text and the user types the lines."""
    try:
        return {"lines": ai.text_to_lines(body.text)}
    except ai.AiUnavailable as e:
        raise HTTPException(503, str(e))


@app.get("/api/items/{item_id}/related")
def related_items(item_id: str, uid: str = Depends(auth.current_user)):
    """The same job's other stages: what it was made from (estimate -> task -> invoice) and what was made from it,
    oldest first. The job card shows them behind "Linked" so the user can jump between them."""
    me = _item_or_404(item_id, uid)
    rows = {r["id"]: r for r in db.list_rows("items", uid)}
    children: dict[str, list[str]] = {}
    for r in rows.values():
        if r.get("from_item_id"):
            children.setdefault(r["from_item_id"], []).append(r["id"])
    root = me["id"]
    seen = {root}
    while rows.get(root, {}).get("from_item_id") in rows and rows[root]["from_item_id"] not in seen:
        root = rows[root]["from_item_id"]
        seen.add(root)
    found, todo = [], [root]
    done: set[str] = set()
    while todo:
        cur = todo.pop()
        if cur in done:
            continue
        done.add(cur)
        found.append(rows[cur])
        todo.extend(children.get(cur, []))
    others = sorted((r for r in found if r["id"] != me["id"]), key=lambda r: str(r.get("created_at", "")))
    return _with_client_names(others, uid)


@app.patch("/api/items/{item_id}")
def patch_item(item_id: str, body: ItemFields, scope: Literal["one", "following"] = "one",
               uid: str = Depends(auth.current_user)):
    """scope (repeating tasks and notes): "one" changes only this visit; "following" this and all next ones."""
    old = _item_or_404(item_id, uid)
    data = body.model_dump(exclude_unset=True)
    if "repeat" in data and old["kind"] not in REPEATABLE:
        raise HTTPException(400, "Only tasks and notes can repeat.")
    if old.get("series_id") and scope == "following":
        return _patch_following(old, data, uid)
    if "repeat" in data:
        if old.get("series_id"):
            data.pop("repeat")   # "only this one" keeps the series' rule
        elif data["repeat"]:     # a single task / note starts repeating from here
            return _patch_following(old, data, uid)
    if "lines" in data and data["lines"] is None:
        data["lines"] = []
    if data.get("lines"):
        data["lines"] = _carry_translations(old.get("lines") or [], data["lines"])
    if old["status"] == "paid" and data.get("status", "paid") == "paid" and set(data) - PAID_EDITABLE:
        raise HTTPException(409, "A paid invoice is locked. Undo the payment to edit it.")
    status = data.get("status") or old["status"]
    if status not in STATUSES[old["kind"]]:
        raise HTTPException(400, f"A {old['kind']} can't be '{status}'.")
    if old["kind"] in ("estimate", "invoice") and "client_id" in data and not data["client_id"]:
        raise HTTPException(400, "Please choose a client.")
    _check_links(data, uid)
    if (data.get("number") or "").strip() and data["number"].strip() != old.get("number") and old["kind"] != "task":
        _check_number(old["kind"], data["number"].strip(), uid, except_id=item_id)
    if status == "paid" and not (data.get("paid_date") or old.get("paid_date")):
        data["paid_date"] = db.today_local()
    if old["status"] == "paid" and status != "paid":   # Undo payment
        data.update(paid_date=None, payment_method="")
    if {"lines", "tax_rate", "tax_applies_to"} & set(data):
        data = {k: v for k, v in _apply_totals({**old, **data}).items() if k in data or k in ("subtotal", "tax", "total")}
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    row = db.update_row("items", item_id, data, uid)
    return _with_client_names([row], uid)[0]


def _carry_translations(old_lines: list[dict], new_lines: list[dict]) -> list[dict]:
    """An edited line list keeps the translations of lines whose text is the same (only changed lines are redone)."""
    known = {(line.get("text") or ""): line.get("tr") for line in old_lines if line.get("tr")}
    out = []
    for line in new_lines:
        line = {k: v for k, v in line.items() if v is not None}
        if not line.get("tr") and known.get(line.get("text") or ""):
            line["tr"] = known[line.get("text") or ""]
        out.append(line)
    return out


def _translated(item: dict, lang: str, uid: str) -> dict:
    """The item with its line texts in `lang` for the PDF (§9). Each line is translated once, in the trade sense
    (ai.CONTEXT), and remembered; a changed line is translated again. No AI -> the PDF keeps the user's words."""
    lines = [dict(line) for line in item.get("lines") or []]
    todo = [i for i, line in enumerate(lines)
            if line.get("text") and ((line.get("tr") or {}).get(lang) or {}).get("src") != line["text"]]
    if todo:
        try:
            done = ai.translate_texts([lines[i]["text"] for i in todo], lang)
            for i, text in zip(todo, done):
                lines[i]["tr"] = {**(lines[i].get("tr") or {}), lang: {"src": lines[i]["text"], "text": text}}
            db.update_row("items", item["id"], {"lines": lines}, uid)   # remembered (updated_at stays: not a user edit)
        except ai.AiUnavailable:
            log.warning("PDF without translation (%s)", lang)
    shown = [{**line, "text": ((line.get("tr") or {}).get(lang) or {}).get("text") or line.get("text", "")}
             if ((line.get("tr") or {}).get(lang) or {}).get("src") == line.get("text") else line for line in lines]
    return {**item, "lines": shown}


@app.get("/api/items/{item_id}/pdf")
def item_pdf(item_id: str, lang: Lang | None = None, uid: str = Depends(auth.current_user)):
    """The invoice / estimate as a PDF, in the document language (Settings) unless ?lang= is given
    ("Check in my language" asks for the user's language). The lines are translated into that language."""
    item = _item_or_404(item_id, uid)
    if item["kind"] in ("task", "note"):
        raise HTTPException(400, "A task has no PDF.")
    business = _business(uid)
    client = db.get_row("clients", item["client_id"], uid) if item.get("client_id") else None
    lang = lang or business.get("doc_language") or "en"
    pdf = invoice_pdf.build_pdf(_translated(item, lang, uid), client or {}, business, lang)
    name = invoice_pdf.file_name(item, lang)
    return Response(pdf, media_type="application/pdf", headers={"Content-Disposition": f'inline; filename="{name}"'})


@app.delete("/api/items/{item_id}", status_code=204)
def delete_item(item_id: str, scope: Literal["one", "following"] = "one", uid: str = Depends(auth.current_user)):
    row = _item_or_404(item_id, uid)
    if row["status"] == "paid":
        raise HTTPException(409, "A paid invoice is locked. Undo the payment to delete it.")
    if row.get("series_id") and scope == "following":   # this and all next visits
        for r in _series(row["series_id"], uid):
            if r["date"] >= row["date"]:
                db.delete_row("items", r["id"], uid)
        return
    db.delete_row("items", item_id, uid)


# ---------- repeating tasks and notes (§6g): every visit is its own row of one series ----------
REPEATABLE = ("task", "note")
VISIT_FIELDS = ("kind", "client_id", "time", "reminder_minutes", "title", "address", "lines", "tax_rate",
                "tax_applies_to", "subtotal", "tax", "total", "series_id", "repeat")


def _series(series_id: str, uid: str) -> list[dict]:
    return db.list_rows("items", uid, order="date", series_id=series_id)


def _make_visits(first: dict, uid: str, through: date | None = None) -> dict:
    """Adds the visits after `first` up to `through` (default: the first horizon) and remembers how far they go."""
    rule = first["repeat"]
    today = date.fromisoformat(db.today_local())
    through = through or rep.first_horizon(rule, today)
    after = date.fromisoformat(str(first["date"])[:10])
    rule = {**rule, "made_until": through.isoformat()}
    template = {k: first[k] for k in VISIT_FIELDS if k in first}
    for d in rep.visits(rule, after, through):
        db.insert_row("items", {**template, "repeat": rule, "date": d.isoformat(), "status": "created"}, uid)
    return db.update_row("items", first["id"], {"repeat": rule}, uid)


def _extend_series(uid: str, end: str) -> None:
    """The calendar asks for dates past what was made (no end date): make the visits up to there."""
    end_d = date.fromisoformat(end)
    cap = date.fromisoformat(db.today_local()) + timedelta(days=rep.MAX_AHEAD_DAYS)
    newest: dict[str, dict] = {}
    for r in db.list_rows("items", uid, order="date"):
        if r.get("series_id") and r.get("repeat"):
            newest[r["series_id"]] = r   # rows come by date: the last one wins
    for sid, last in newest.items():
        rule = last["repeat"]
        made = date.fromisoformat(rule.get("made_until") or str(last["date"])[:10])
        if made >= end_d or made >= cap or (rule.get("until") and date.fromisoformat(rule["until"]) <= made):
            continue
        through = min(end_d + timedelta(days=60), cap)
        rule = {**rule, "made_until": through.isoformat()}
        template = {k: last[k] for k in VISIT_FIELDS if k in last}
        for d in rep.visits(rule, made, through):
            db.insert_row("items", {**template, "repeat": rule, "date": d.isoformat(), "status": "created"}, uid)
        for r in _series(sid, uid):
            db.update_row("items", r["id"], {"repeat": rule}, uid)


def _patch_following(old: dict, data: dict, uid: str) -> dict:
    """Change this visit and all next ones. A new date or rule restarts the series from this visit."""
    data.pop("status", None) if old.get("series_id") else None   # done / not done is per visit
    _check_links(data, uid)
    stamp = datetime.now(timezone.utc).isoformat()
    later = [r for r in (_series(old["series_id"], uid) if old.get("series_id") else []) if r["date"] > old["date"]]
    if "repeat" in data or "date" in data:
        rule = data.pop("repeat") if "repeat" in data else old.get("repeat")
        for r in later:
            if r["status"] != "done":
                db.delete_row("items", r["id"], uid)
        fields = {**data, "updated_at": stamp}
        if rule:
            start = data.get("date") or str(old["date"])[:10]
            fields.update(series_id=str(uuid.uuid4()),
                          repeat={k: rule.get(k) for k in ("every", "unit", "until")} | {"start": start})
        else:
            fields.update(series_id=None, repeat=None)
        row = db.update_row("items", old["id"], fields, uid)
        if rule:
            row = _make_visits(row, uid)
        return _with_client_names([row], uid)[0]
    for r in later:
        db.update_row("items", r["id"], {**data, "updated_at": stamp}, uid)
    row = db.update_row("items", old["id"], {**data, "updated_at": stamp}, uid)
    return _with_client_names([row], uid)[0]


# =====================================================================================================
# Expenses
# =====================================================================================================
class ExpenseFields(BaseModel):
    client_id: str | None = None
    item_id: str | None = None
    date: str | None = None
    store: str | None = Field(None, max_length=200)
    category: str | None = Field(None, max_length=100)
    description: str | None = Field(None, max_length=1000)
    amount: float | None = Field(None, ge=0, le=10000000)
    photo_url: str | None = None

    @field_validator("date")
    @classmethod
    def _dates(cls, v):
        return _date(v)


def _expense_or_404(expense_id, uid) -> dict:
    row = db.get_row("expenses", expense_id, uid)
    if not row:
        raise HTTPException(404, "Expense not found.")
    return row


@app.get("/api/expenses")
def list_expenses(start: str | None = None, end: str | None = None, uid: str = Depends(auth.current_user)):
    return db.list_rows("expenses", uid, order="date",
                        gte={"date": _date(start)} if start else None,
                        lte={"date": _date(end)} if end else None)


@app.post("/api/expenses", status_code=201)
def create_expense(body: ExpenseFields, uid: str = Depends(auth.current_user)):
    data = body.model_dump(exclude_none=True)
    _check_links(data, uid)
    if data.get("item_id"):
        _item_or_404(data["item_id"], uid)
    data.setdefault("date", db.today_local())
    return db.insert_row("expenses", data, uid)


@app.patch("/api/expenses/{expense_id}")
def patch_expense(expense_id: str, body: ExpenseFields, uid: str = Depends(auth.current_user)):
    _expense_or_404(expense_id, uid)
    data = body.model_dump(exclude_unset=True)
    _check_links(data, uid)
    if data.get("item_id"):
        _item_or_404(data["item_id"], uid)
    return db.update_row("expenses", expense_id, data, uid)


@app.delete("/api/expenses/{expense_id}", status_code=204)
def delete_expense(expense_id: str, uid: str = Depends(auth.current_user)):
    _expense_or_404(expense_id, uid)
    db.delete_row("expenses", expense_id, uid)
