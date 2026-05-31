"""In-memory dummy database for local testing without Supabase.

Mimics the subset of the supabase-py query-builder the app uses
(select/insert/update/delete + eq/ilike/in_/order/range/limit/single/maybe_single,
count="exact", and JSONB `col->>key` filters). Enable with USE_FAKE_DB=true.

State is per-process and resets on restart — perfect for demos and local dev.
"""
from datetime import datetime, timezone


# ----------------------------- query builder -----------------------------
class FakeResult:
    def __init__(self, data, count=None):
        self.data = data
        self.count = count


class FakeQuery:
    def __init__(self, table_rows):
        self._table = table_rows           # live list (writes mutate this)
        self._op = "select"
        self._payload = None
        self._filters = []                 # list of (kind, field, value)
        self._single = False
        self._maybe = False
        self._count = False
        self._order = None
        self._range = None
        self._limit = None

    # -- builder verbs --
    def select(self, *_a, **kw):
        self._op = "select"
        if kw.get("count"):
            self._count = True
        return self

    def insert(self, payload):
        self._op = "insert"
        self._payload = payload
        return self

    def update(self, payload):
        self._op = "update"
        self._payload = payload
        return self

    def delete(self):
        self._op = "delete"
        return self

    # -- filters --
    def eq(self, field, value):
        self._filters.append(("eq", field, value))
        return self

    def ilike(self, field, pattern):
        self._filters.append(("ilike", field, pattern))
        return self

    def in_(self, field, values):
        self._filters.append(("in", field, list(values)))
        return self

    def order(self, field, **_kw):
        self._order = field
        return self

    def range(self, start, end):
        self._range = (start, end)
        return self

    def limit(self, n):
        self._limit = n
        return self

    def single(self):
        self._single = True
        return self

    def maybe_single(self):
        self._maybe = True
        return self

    # -- evaluation --
    @staticmethod
    def _get(row, field):
        # Support JSONB arrow access: "build_data->>short_id"
        if "->>" in field:
            col, key = field.split("->>")
            col, key = col.strip(), key.strip().strip("'\"")
            sub = row.get(col) or {}
            return sub.get(key) if isinstance(sub, dict) else None
        return row.get(field)

    def _match(self, row):
        for kind, field, value in self._filters:
            cell = self._get(row, field)
            if kind == "eq":
                if str(cell) != str(value):
                    return False
            elif kind == "ilike":
                needle = str(value).strip("%").lower()
                if needle not in str(cell or "").lower():
                    return False
            elif kind == "in":
                if str(cell) not in {str(v) for v in value}:
                    return False
        return True

    def execute(self):
        if self._op == "insert":
            rows = self._payload if isinstance(self._payload, list) else [self._payload]
            inserted = []
            for r in rows:
                row = dict(r)
                row.setdefault("id", (max([x.get("id", 0) for x in self._table], default=0) or 0) + 1)
                row.setdefault("created_at", datetime.now(timezone.utc).isoformat())
                self._table.append(row)
                inserted.append(row)
            return FakeResult(inserted)

        if self._op == "update":
            updated = []
            for row in self._table:
                if self._match(row):
                    row.update(self._payload)
                    updated.append(row)
            return FakeResult(updated)

        if self._op == "delete":
            kept, removed = [], []
            for row in self._table:
                (removed if self._match(row) else kept).append(row)
            self._table[:] = kept
            return FakeResult(removed)

        # select
        rows = [r for r in self._table if self._match(r)]
        if self._order:
            try:
                rows = sorted(rows, key=lambda r: (r.get(self._order) is None, r.get(self._order)))
            except TypeError:
                pass
        if self._range:
            rows = rows[self._range[0]:self._range[1] + 1]
        if self._limit is not None:
            rows = rows[:self._limit]
        if self._single or self._maybe:
            return FakeResult(rows[0] if rows else None)
        return FakeResult(rows, count=len(rows) if self._count else None)


class FakeSupabase:
    def __init__(self, tables):
        self.tables = tables

    def table(self, name):
        return FakeQuery(self.tables.setdefault(name, []))


# ----------------------------- seed data -----------------------------
_CATEGORIES = [
    (1, "cpu", "Processor"), (2, "gpu", "Graphics Card"), (3, "motherboard", "Motherboard"),
    (4, "ram", "Memory"), (5, "storage", "Storage"), (6, "psu", "Power Supply"),
    (7, "case", "Case"), (8, "cooler", "CPU Cooler"),
]
_VENDORS = ["MDComputers", "PrimeABGB", "Amazon.in", "Flipkart", "Vedant Computers", "PC Studio"]


def _comp(cid, cat_id, name, brand, specs, prices):
    cat = next(c for c in _CATEGORIES if c[0] == cat_id)
    price_rows = [
        {"id": cid * 100 + i, "component_id": cid, "price": str(p), "currency": "INR",
         "in_stock": True, "url": "https://example.com/buy",
         "vendor": {"id": _VENDORS.index(v) + 1, "name": v, "slug": v.lower().replace(" ", "")}}
        for i, (v, p) in enumerate(prices)
    ]
    return {
        "id": cid, "category_id": cat_id, "name": name, "brand": brand,
        "specifications": specs, "image_url": None,
        "category": {"id": cat[0], "slug": cat[1], "name": cat[2]},
        "prices": price_rows,
    }


_COMPONENTS = [
    # CPUs
    _comp(101, 1, "AMD Ryzen 5 7600", "AMD", {"cores": 6, "socket": "AM5", "boost_clock": "5.1 GHz", "tdp": "65W"}, [("MDComputers", 20999), ("PrimeABGB", 21500)]),
    _comp(102, 1, "AMD Ryzen 7 7800X3D", "AMD", {"cores": 8, "socket": "AM5", "boost_clock": "5.0 GHz", "tdp": "120W"}, [("PrimeABGB", 37990), ("Amazon.in", 38990)]),
    _comp(103, 1, "Intel Core i5-14400F", "Intel", {"cores": 10, "socket": "LGA1700", "boost_clock": "4.7 GHz", "tdp": "65W"}, [("Flipkart", 18499), ("MDComputers", 18999)]),
    # GPUs
    _comp(201, 2, "NVIDIA RTX 4060", "NVIDIA", {"memory": "8GB", "boost_clock": "2.4 GHz", "tdp": "115W"}, [("Amazon.in", 28999), ("PC Studio", 29999)]),
    _comp(202, 2, "NVIDIA RTX 4070 SUPER", "NVIDIA", {"memory": "12GB", "boost_clock": "2.5 GHz", "tdp": "220W"}, [("MDComputers", 62999), ("PrimeABGB", 64500)]),
    _comp(203, 2, "AMD RX 7600", "AMD", {"memory": "8GB", "boost_clock": "2.6 GHz", "tdp": "165W"}, [("Flipkart", 27499)]),
    # Motherboards
    _comp(301, 3, "MSI B650 Tomahawk WiFi", "MSI", {"socket": "AM5", "ram_type": "DDR5", "form_factor": "ATX", "chipset": "B650", "wifi": True, "ram_slots": 4}, [("MDComputers", 17999)]),
    _comp(302, 3, "Gigabyte B760 Gaming X", "Gigabyte", {"socket": "LGA1700", "ram_type": "DDR4", "form_factor": "ATX", "chipset": "B760", "ram_slots": 4}, [("PrimeABGB", 13999)]),
    # RAM
    _comp(401, 4, "Corsair Vengeance 32GB DDR5", "Corsair", {"capacity": "32GB", "type": "DDR5", "speed": "6000MHz"}, [("Amazon.in", 8999)]),
    _comp(402, 4, "G.Skill Ripjaws 16GB DDR4", "G.Skill", {"capacity": "16GB", "type": "DDR4", "speed": "3200MHz"}, [("MDComputers", 3299)]),
    # Storage
    _comp(501, 5, "Samsung 980 1TB NVMe", "Samsung", {"capacity": "1TB", "type": "NVMe SSD"}, [("Amazon.in", 6499)]),
    _comp(502, 5, "Crucial P3 500GB NVMe", "Crucial", {"capacity": "500GB", "type": "NVMe SSD"}, [("Flipkart", 3199)]),
    # PSUs
    _comp(601, 6, "Corsair RM750e 750W Gold", "Corsair", {"wattage": "750W", "efficiency": "80+ Gold"}, [("MDComputers", 7499)]),
    _comp(602, 6, "Antec CSK 650W Bronze", "Antec", {"wattage": "650W", "efficiency": "80+ Bronze"}, [("PrimeABGB", 4299)]),
    # Cases
    _comp(701, 7, "NZXT H5 Flow", "NZXT", {"form_factor": "ATX", "fans_included": 2, "supported_form_factors": ["ATX", "Micro-ATX", "Mini-ITX"]}, [("Amazon.in", 7999)]),
    _comp(702, 7, "Ant Esports ICE-300", "Ant Esports", {"form_factor": "ATX", "fans_included": 3, "supported_form_factors": ["ATX", "Micro-ATX", "Mini-ITX"]}, [("Flipkart", 3499)]),
    # Coolers
    _comp(801, 8, "DeepCool AK400", "DeepCool", {"type": "Air", "tdp_rating": "220W"}, [("MDComputers", 2499)]),
    _comp(802, 8, "Cooler Master ML240L", "Cooler Master", {"type": "AIO Liquid", "tdp_rating": "250W"}, [("PrimeABGB", 6499)]),
]


def seed_data():
    """Fresh dict of seeded tables for the in-memory dummy DB."""
    categories = [{"id": i, "slug": s, "name": n, "description": None, "icon": None} for i, s, n in _CATEGORIES]
    vendors = [{"id": i + 1, "slug": v.lower().replace(" ", ""), "name": v, "url": "#", "logo_url": None}
               for i, v in enumerate(_VENDORS)]
    component_prices = [
        {"id": p["id"], "component_id": p["component_id"], "price": p["price"],
         "vendor_id": p["vendor"]["id"], "in_stock": True}
        for comp in _COMPONENTS for p in comp["prices"]
    ]
    return {
        "categories": categories,
        "vendors": vendors,
        "components": [dict(c) for c in _COMPONENTS],
        "component_prices": component_prices,
        "users": [],
        "builds": [],
        "shared_builds": [],
        "forum_threads": [],
        "forum_replies": [],
        "forum_votes": [],
    }


def get_fake_db():
    return FakeSupabase(seed_data())
