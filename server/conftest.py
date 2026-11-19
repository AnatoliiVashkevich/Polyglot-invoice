r"""conftest.py - database.py connects to Supabase when imported; swap in a mock first so tests run offline.
Run the tests:   venv\Scripts\python -m pytest
"""
import os
from unittest.mock import MagicMock

os.environ.setdefault("SUPABASE_URL", "http://localhost")
os.environ.setdefault("SUPABASE_KEY", "test")

import supabase  # noqa: E402

supabase.create_client = lambda *a, **k: MagicMock()
