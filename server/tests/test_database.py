"""database.py with a fake Supabase query builder: every query is filtered by the owner, a missing owner is
refused, a row never changes hands, and long lists are read page by page."""
from types import SimpleNamespace as NS

import pytest

import database


class Query:
    """Records the calls; filters an in-memory table like PostgREST would."""

    def __init__(self, store, table):
        self.store, self.table, self.filters, self.op, self.payload, self.window = store, table, [], "select", None, None

    def select(self, _):
        return self

    def insert(self, data):
        self.op, self.payload = "insert", data
        return self

    def update(self, data):
        self.op, self.payload = "update", data
        return self

    def delete(self):
        self.op = "delete"
        return self

    def eq(self, k, v):
        self.filters.append(lambda r, k=k, v=v: r.get(k) == v)
        self.store.calls.append(("eq", self.table, k, v))
        return self

    def gte(self, k, v):
        self.filters.append(lambda r, k=k, v=v: str(r.get(k)) >= v)
        return self

    def lte(self, k, v):
        self.filters.append(lambda r, k=k, v=v: str(r.get(k)) <= v)
        return self

    def order(self, _):
        return self

    def range(self, a, b):
        self.window = (a, b)
        return self

    def execute(self):
        rows = self.store.tables.setdefault(self.table, [])
        hit = [r for r in rows if all(f(r) for f in self.filters)]
        if self.op == "insert":
            rows.append(dict(self.payload))
            return NS(data=[dict(self.payload)])
        if self.op == "update":
            for r in hit:
                r.update(self.payload)
            return NS(data=hit)
        if self.op == "delete":
            self.store.tables[self.table] = [r for r in rows if r not in hit]
            return NS(data=hit)
        if self.window:
            hit = hit[self.window[0]: self.window[1] + 1]
        return NS(data=[dict(r) for r in hit])


class Store:
    def __init__(self):
        self.tables, self.calls = {}, []

    def table(self, name):
        return Query(self, name)


@pytest.fixture
def store(monkeypatch):
    s = Store()
    monkeypatch.setattr(database, "supabase", s)
    return s


def test_a_query_without_an_owner_or_on_an_unknown_table_is_refused(store):
    with pytest.raises(RuntimeError, match="without an owner"):
        database.list_rows("items", None)
    with pytest.raises(RuntimeError, match="Unknown table"):
        database.get_row("businesses", "x", "u1")


def test_rows_are_always_the_owners_and_never_change_hands(store):
    database.insert_row("clients", {"id": "c1", "name": "Ann", "owner_id": "u2"}, "u1")   # owner_id can't be forced
    database.insert_row("clients", {"id": "c2", "name": "Bob"}, "u2")
    assert [r["name"] for r in database.list_rows("clients", "u1")] == ["Ann"]
    assert database.get_row("clients", "c2", "u1") is None
    row = database.update_row("clients", "c1", {"name": "Ann Lee", "owner_id": "u2", "id": "zzz"}, "u1")
    assert row == {"id": "c1", "name": "Ann Lee", "owner_id": "u1"}
    database.delete_row("clients", "c2", "u1")                                           # not mine: stays
    assert database.get_row("clients", "c2", "u2")["name"] == "Bob"
    assert all(call[2] != "owner_id" or call[3] in ("u1", "u2") for call in store.calls)


def test_long_lists_are_read_page_by_page_with_filters(store, monkeypatch):
    monkeypatch.setattr(database, "PAGE", 2)
    for i in range(5):
        database.insert_row("items", {"id": f"i{i}", "kind": "task", "date": f"2026-11-0{i + 1}"}, "u1")
    assert len(database.list_rows("items", "u1")) == 5
    got = database.list_rows("items", "u1", gte={"date": "2026-11-02"}, lte={"date": "2026-11-04"}, kind="task")
    assert [r["id"] for r in got] == ["i1", "i2", "i3"]


def test_the_business_row(store):
    database.create_business("u1", {"name": "Fix-It", "id": "hack"})
    assert database.get_business("u1")["id"] == "u1"
    assert database.update_business("u1", {"name": "Fix-It LLC", "id": "x"})["name"] == "Fix-It LLC"
    assert database.update_business("u1", {})["name"] == "Fix-It LLC"
    assert database.get_business("nobody") is None
    assert len(database.today_local()) == 10
