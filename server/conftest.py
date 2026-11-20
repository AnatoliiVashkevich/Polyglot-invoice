r"""conftest.py - database.py connects to Supabase when imported; swap in a mock first so tests run offline.
The real AI is never called from tests (no cost, no network): ai._client fails unless a test fakes it.
Run the tests:   venv\Scripts\python -m pytest
"""
import os
from unittest.mock import MagicMock

os.environ.setdefault("SUPABASE_URL", "http://localhost")
os.environ.setdefault("SUPABASE_KEY", "test")

import pytest  # noqa: E402
import supabase  # noqa: E402

supabase.create_client = lambda *a, **k: MagicMock()


@pytest.fixture(autouse=True)
def no_real_ai(monkeypatch):
    import ai

    def offline():
        raise ai.AiUnavailable("No AI in tests.")
    monkeypatch.setattr(ai, "_client", offline)
