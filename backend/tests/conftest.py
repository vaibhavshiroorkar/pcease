"""In-memory fake Supabase client for deterministic tool tests."""
import os
import pytest

# Set dummy Supabase credentials before any app module is imported so that
# app.database (which calls create_client at module level) does not raise.
os.environ.setdefault("SUPABASE_URL", "https://fake.supabase.co")
os.environ.setdefault("SUPABASE_KEY", "fakekey")


class FakeResult:
    def __init__(self, data):
        self.data = data
        self.count = len(data) if isinstance(data, list) else None


class FakeQuery:
    def __init__(self, rows):
        self._rows = list(rows)
        self._single = False
        self._maybe = False

    def select(self, *_a, **_k):
        return self

    def eq(self, field, value):
        self._rows = [r for r in self._rows if str(r.get(field)) == str(value)]
        return self

    def ilike(self, field, pattern):
        needle = pattern.strip("%").lower()
        self._rows = [r for r in self._rows if needle in str(r.get(field, "")).lower()]
        return self

    def in_(self, field, values):
        vals = {str(v) for v in values}
        self._rows = [r for r in self._rows if str(r.get(field)) in vals]
        return self

    def order(self, *_a, **_k):
        return self

    def range(self, start, end):
        self._rows = self._rows[start:end + 1]
        return self

    def limit(self, n):
        self._rows = self._rows[:n]
        return self

    def single(self):
        self._single = True
        return self

    def maybe_single(self):
        self._maybe = True
        return self

    def insert(self, payload):
        row = dict(payload)
        row.setdefault("id", len(self._rows) + 1)
        self._rows = [row]
        return self

    def execute(self):
        if self._single or self._maybe:
            return FakeResult(self._rows[0] if self._rows else None)
        return FakeResult(self._rows)


class FakeSupabase:
    def __init__(self, tables=None):
        self.tables = tables or {}
        self.inserted = []

    def table(self, name):
        return FakeQuery(self.tables.get(name, []))


@pytest.fixture
def fake_db():
    """Supabase fake seeded with a tiny realistic catalog."""
    return FakeSupabase(tables={
        "categories": [
            {"id": 1, "slug": "cpu", "name": "Processor"},
            {"id": 2, "slug": "gpu", "name": "Graphics Card"},
            {"id": 3, "slug": "motherboard", "name": "Motherboard"},
        ],
        "components": [
            {"id": 10, "name": "Ryzen 5 7600", "brand": "AMD", "category_id": 1,
             "specifications": {"cores": 6, "socket": "AM5", "boost_clock": "5.1 GHz", "tdp": "65W"},
             "prices": [{"price": "21000", "vendor": {"name": "MDComputers"}}]},
            {"id": 11, "name": "Ryzen 7 7800X3D", "brand": "AMD", "category_id": 1,
             "specifications": {"cores": 8, "socket": "AM5", "boost_clock": "5.0 GHz", "tdp": "120W"},
             "prices": [{"price": "38000", "vendor": {"name": "PrimeABGB"}}]},
            {"id": 20, "name": "RTX 4060", "brand": "NVIDIA", "category_id": 2,
             "specifications": {"memory": "8GB", "tdp": "115W"},
             "prices": [{"price": "30000", "vendor": {"name": "Amazon.in"}}]},
            {"id": 30, "name": "MSI B650 Tomahawk", "brand": "MSI", "category_id": 3,
             "specifications": {"socket": "AM5", "ram_type": "DDR5", "form_factor": "ATX"},
             "prices": [{"price": "18000", "vendor": {"name": "MDComputers"}}]},
        ],
        "component_prices": [
            {"component_id": 10, "price": "21000"},
            {"component_id": 20, "price": "30000"},
            {"component_id": 30, "price": "18000"},
        ],
        "builds": [],
        "shared_builds": [],
    })
