"""In-memory dummy database for local testing without Supabase.

Mimics the subset of the supabase-py query-builder the app uses
(select/insert/update/delete + eq/ilike/in_/order/range/limit/single/maybe_single,
count="exact", and JSONB `col->>key` filters). Enable with USE_FAKE_DB=true.

State is per-process and resets on restart - perfect for demos and local dev.

The catalog is generated deterministically (fixed RNG seed) so prices and IDs are
stable across restarts. Tweak the brand/spec tables below to grow or shrink it.
"""
import random
from datetime import datetime, timezone
from functools import lru_cache


@lru_cache(maxsize=1)
def _demo_password_hash():
    """bcrypt hash of the shared demo password. passlib only, to avoid importing
    utils.auth here (which would create an import cycle through database.py)."""
    from passlib.context import CryptContext
    return CryptContext(schemes=["bcrypt"], deprecated="auto").hash("demo1234")


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
_VENDORS = ["MDComputers", "PrimeABGB", "Amazon.in", "Flipkart", "Vedant Computers",
            "PC Studio", "The IT Depot", "Compify", "Clarion"]

_RNG = random.Random(1729)   # fixed seed -> stable catalog across restarts


def _money(base):
    """Jitter a base price a little and round to the nearest 50 (INR-looking)."""
    return int(round(base * (1 + _RNG.uniform(-0.03, 0.06)) / 50.0)) * 50


def _prices(base):
    """1-3 random vendors, each with a slightly different price."""
    n = _RNG.randint(1, 3)
    return [(v, _money(base)) for v in _RNG.sample(_VENDORS, n)]


def _take(combos, target):
    combos = list(combos)
    return combos if len(combos) <= target else _RNG.sample(combos, target)


def _cap(gb):
    return f"{gb // 1000}TB" if gb >= 1000 else f"{gb}GB"


_IDS = {}


def _cid(cat):
    _IDS[cat] = _IDS.get(cat, cat * 1000) + 1
    return _IDS[cat]


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


# ---- CPUs (real model lists; tokens chosen so the bottleneck tiering recognizes them) ----
_CPUS = [
    # name, brand, cores, socket, boost, tdp, base price
    ("AMD Ryzen 3 4100", "AMD", 4, "AM4", "4.0 GHz", "65W", 6000),
    ("AMD Ryzen 5 5500", "AMD", 6, "AM4", "4.2 GHz", "65W", 8500),
    ("AMD Ryzen 5 5600", "AMD", 6, "AM4", "4.4 GHz", "65W", 11500),
    ("AMD Ryzen 5 5600X", "AMD", 6, "AM4", "4.6 GHz", "65W", 14500),
    ("AMD Ryzen 7 5700X", "AMD", 8, "AM4", "4.6 GHz", "65W", 16999),
    ("AMD Ryzen 7 5800X3D", "AMD", 8, "AM4", "4.5 GHz", "105W", 28999),
    ("AMD Ryzen 9 5900X", "AMD", 12, "AM4", "4.8 GHz", "105W", 27999),
    ("AMD Ryzen 9 5950X", "AMD", 16, "AM4", "4.9 GHz", "105W", 36999),
    ("AMD Ryzen 5 7500F", "AMD", 6, "AM5", "5.0 GHz", "65W", 15999),
    ("AMD Ryzen 5 7600", "AMD", 6, "AM5", "5.1 GHz", "65W", 20999),
    ("AMD Ryzen 5 7600X", "AMD", 6, "AM5", "5.3 GHz", "105W", 23999),
    ("AMD Ryzen 7 7700", "AMD", 8, "AM5", "5.3 GHz", "65W", 28999),
    ("AMD Ryzen 7 7700X", "AMD", 8, "AM5", "5.4 GHz", "105W", 31999),
    ("AMD Ryzen 7 7800X3D", "AMD", 8, "AM5", "5.0 GHz", "120W", 37990),
    ("AMD Ryzen 9 7900", "AMD", 12, "AM5", "5.4 GHz", "65W", 38999),
    ("AMD Ryzen 9 7900X", "AMD", 12, "AM5", "5.6 GHz", "170W", 41999),
    ("AMD Ryzen 9 7950X", "AMD", 16, "AM5", "5.7 GHz", "170W", 52999),
    ("AMD Ryzen 9 7950X3D", "AMD", 16, "AM5", "5.7 GHz", "120W", 58999),
    ("AMD Ryzen 5 9600X", "AMD", 6, "AM5", "5.4 GHz", "65W", 25999),
    ("AMD Ryzen 7 9700X", "AMD", 8, "AM5", "5.5 GHz", "65W", 33999),
    ("AMD Ryzen 9 9900X", "AMD", 12, "AM5", "5.6 GHz", "120W", 44999),
    ("AMD Ryzen 9 9950X", "AMD", 16, "AM5", "5.7 GHz", "170W", 64999),
    ("Intel Core i3-12100F", "Intel", 4, "LGA1700", "4.3 GHz", "58W", 7499),
    ("Intel Core i3-13100F", "Intel", 4, "LGA1700", "4.5 GHz", "58W", 9499),
    ("Intel Core i5-12400F", "Intel", 6, "LGA1700", "4.4 GHz", "65W", 12999),
    ("Intel Core i5-12600K", "Intel", 10, "LGA1700", "4.9 GHz", "125W", 19999),
    ("Intel Core i5-13400F", "Intel", 10, "LGA1700", "4.6 GHz", "65W", 17999),
    ("Intel Core i5-13600K", "Intel", 14, "LGA1700", "5.1 GHz", "125W", 27999),
    ("Intel Core i5-14400F", "Intel", 10, "LGA1700", "4.7 GHz", "65W", 18499),
    ("Intel Core i5-14600K", "Intel", 14, "LGA1700", "5.3 GHz", "125W", 28999),
    ("Intel Core i7-12700K", "Intel", 12, "LGA1700", "5.0 GHz", "125W", 29999),
    ("Intel Core i7-13700K", "Intel", 16, "LGA1700", "5.4 GHz", "125W", 36999),
    ("Intel Core i7-14700K", "Intel", 20, "LGA1700", "5.6 GHz", "125W", 38999),
    ("Intel Core i9-13900K", "Intel", 24, "LGA1700", "5.8 GHz", "125W", 49999),
    ("Intel Core i9-14900K", "Intel", 24, "LGA1700", "6.0 GHz", "125W", 56999),
    ("Intel Core i9-14900KS", "Intel", 24, "LGA1700", "6.2 GHz", "150W", 64999),
]

# ---- GPUs ----
_GPUS = [
    # name, brand, memory, boost, tdp, base price
    ("NVIDIA RTX 3050", "NVIDIA", "8GB", "1.8 GHz", "130W", 19999),
    ("NVIDIA RTX 3060", "NVIDIA", "12GB", "1.8 GHz", "170W", 27999),
    ("NVIDIA RTX 3060 Ti", "NVIDIA", "8GB", "1.7 GHz", "200W", 32999),
    ("NVIDIA RTX 3070", "NVIDIA", "8GB", "1.7 GHz", "220W", 41999),
    ("NVIDIA RTX 3070 Ti", "NVIDIA", "8GB", "1.8 GHz", "290W", 47999),
    ("NVIDIA RTX 3080", "NVIDIA", "10GB", "1.7 GHz", "320W", 62999),
    ("NVIDIA RTX 3090", "NVIDIA", "24GB", "1.7 GHz", "350W", 99999),
    ("NVIDIA RTX 4060", "NVIDIA", "8GB", "2.4 GHz", "115W", 28999),
    ("NVIDIA RTX 4060 Ti", "NVIDIA", "8GB", "2.5 GHz", "160W", 39999),
    ("NVIDIA RTX 4070", "NVIDIA", "12GB", "2.4 GHz", "200W", 51999),
    ("NVIDIA RTX 4070 SUPER", "NVIDIA", "12GB", "2.5 GHz", "220W", 62999),
    ("NVIDIA RTX 4070 Ti", "NVIDIA", "12GB", "2.6 GHz", "285W", 72999),
    ("NVIDIA RTX 4070 Ti SUPER", "NVIDIA", "16GB", "2.6 GHz", "285W", 79999),
    ("NVIDIA RTX 4080", "NVIDIA", "16GB", "2.5 GHz", "320W", 99999),
    ("NVIDIA RTX 4080 SUPER", "NVIDIA", "16GB", "2.6 GHz", "320W", 104999),
    ("NVIDIA RTX 4090", "NVIDIA", "24GB", "2.5 GHz", "450W", 169999),
    ("AMD RX 6600", "AMD", "8GB", "2.4 GHz", "132W", 19999),
    ("AMD RX 6600 XT", "AMD", "8GB", "2.6 GHz", "160W", 24999),
    ("AMD RX 6650 XT", "AMD", "8GB", "2.6 GHz", "176W", 25999),
    ("AMD RX 6700 XT", "AMD", "12GB", "2.6 GHz", "230W", 31999),
    ("AMD RX 6750 XT", "AMD", "12GB", "2.6 GHz", "250W", 35999),
    ("AMD RX 6800", "AMD", "16GB", "2.1 GHz", "250W", 41999),
    ("AMD RX 6800 XT", "AMD", "16GB", "2.3 GHz", "300W", 49999),
    ("AMD RX 6900 XT", "AMD", "16GB", "2.3 GHz", "300W", 58999),
    ("AMD RX 7600", "AMD", "8GB", "2.6 GHz", "165W", 27499),
    ("AMD RX 7700 XT", "AMD", "12GB", "2.5 GHz", "245W", 41999),
    ("AMD RX 7800 XT", "AMD", "16GB", "2.4 GHz", "263W", 48999),
    ("AMD RX 7900 GRE", "AMD", "16GB", "2.2 GHz", "260W", 56999),
    ("AMD RX 7900 XT", "AMD", "20GB", "2.4 GHz", "315W", 69999),
    ("AMD RX 7900 XTX", "AMD", "24GB", "2.5 GHz", "355W", 89999),
    ("Intel Arc A750", "Intel", "8GB", "2.4 GHz", "225W", 19999),
    ("Intel Arc A770", "Intel", "16GB", "2.4 GHz", "225W", 28999),
]

# ---- Motherboard generation ----
_MB_PLATFORMS = [
    # socket, ram_type, chipset, base
    ("AM5", "DDR5", "A620", 9000), ("AM5", "DDR5", "B650", 17000), ("AM5", "DDR5", "B650E", 22000),
    ("AM5", "DDR5", "X670", 30000), ("AM5", "DDR5", "X670E", 39000),
    ("AM4", "DDR4", "A520", 6000), ("AM4", "DDR4", "B550", 12000), ("AM4", "DDR4", "X570", 18000),
    ("LGA1700", "DDR4", "H610", 7000), ("LGA1700", "DDR4", "B660", 12000),
    ("LGA1700", "DDR5", "B760", 15000), ("LGA1700", "DDR5", "Z690", 26000), ("LGA1700", "DDR5", "Z790", 34000),
]
_MB_BRAND_SERIES = {
    "ASUS": [("PRIME", 1.0, False), ("TUF Gaming", 1.18, True), ("ROG Strix", 1.55, True)],
    "MSI": [("PRO", 1.0, False), ("MAG", 1.18, True), ("MPG", 1.5, True)],
    "Gigabyte": [("UD", 1.0, False), ("GAMING X", 1.15, True), ("AORUS ELITE", 1.4, True)],
    "ASRock": [("PG Lightning", 1.05, False), ("Steel Legend", 1.2, True), ("Phantom Gaming", 1.35, True)],
}
_FF = ["ATX", "Micro-ATX", "Mini-ITX"]
_FF_TAG = {"ATX": "", "Micro-ATX": "M", "Mini-ITX": "I"}

# ---- RAM generation ----
_RAM_BRAND_SERIES = {
    "Corsair": ["Vengeance", "Vengeance RGB", "Dominator Platinum"],
    "G.Skill": ["Ripjaws S5", "Trident Z", "Trident Z5 RGB"],
    "Kingston": ["Fury Beast", "Fury Renegade"],
    "Crucial": ["Pro", "Ballistix"],
    "ADATA": ["XPG Lancer", "XPG Gammix D45"],
    "TeamGroup": ["T-Force Vulcan", "T-Force Delta RGB"],
}
_RAM_SPECS = [  # type, speed, price-multiplier
    ("DDR4", 3200, 1.0), ("DDR4", 3600, 1.12),
    ("DDR5", 5200, 1.3), ("DDR5", 5600, 1.45), ("DDR5", 6000, 1.6), ("DDR5", 6400, 1.85),
]
_RAM_CAPS = [8, 16, 32, 64]

# ---- Storage generation ----
_ST_FAMILY = {
    "Samsung": {"NVMe SSD": "990 Pro", "SATA SSD": "870 EVO", "HDD": None},
    "Western Digital": {"NVMe SSD": "Black SN770", "SATA SSD": "Blue 3D", "HDD": "Blue"},
    "Crucial": {"NVMe SSD": "P3 Plus", "SATA SSD": "MX500", "HDD": None},
    "Kingston": {"NVMe SSD": "NV2", "SATA SSD": "A400", "HDD": None},
    "Seagate": {"NVMe SSD": "FireCuda 530", "SATA SSD": None, "HDD": "Barracuda"},
    "ADATA": {"NVMe SSD": "Legend 800", "SATA SSD": "SU800", "HDD": None},
    "SK Hynix": {"NVMe SSD": "Platinum P41", "SATA SSD": None, "HDD": None},
}
_ST_CAPS = {"NVMe SSD": [500, 1000, 2000, 4000], "SATA SSD": [500, 1000, 2000], "HDD": [1000, 2000, 4000, 8000]}
_ST_RATE = {"NVMe SSD": 6.5, "SATA SSD": 4.5, "HDD": 1.6}  # INR per GB-ish

# ---- PSU generation ----
_PSU_BRAND_SERIES = {
    "Corsair": "RM", "Cooler Master": "MWE", "MSI": "MAG", "Antec": "CSK",
    "Seasonic": "Focus GX", "Deepcool": "PN", "Gigabyte": "P", "Thermaltake": "Smart BX1",
}
_PSU_WATTS = [450, 550, 650, 750, 850, 1000, 1200]

# ---- Cases (name, brand, own form factor, fans included, base) ----
_CASES = [
    ("NZXT H5 Flow", "NZXT", "ATX", 2, 7999), ("NZXT H7 Flow", "NZXT", "ATX", 2, 9999),
    ("NZXT H9 Elite", "NZXT", "ATX", 3, 16999), ("Corsair 4000D Airflow", "Corsair", "ATX", 2, 7499),
    ("Corsair 5000D Airflow", "Corsair", "ATX", 3, 13999), ("Corsair iCUE 4000X", "Corsair", "ATX", 3, 9999),
    ("Lian Li Lancool 216", "Lian Li", "ATX", 3, 7299), ("Lian Li O11 Dynamic EVO", "Lian Li", "ATX", 0, 13999),
    ("Fractal Design Pop Air", "Fractal Design", "ATX", 3, 6999), ("Fractal Design Meshify 2", "Fractal Design", "ATX", 3, 13499),
    ("Fractal Design North", "Fractal Design", "ATX", 2, 12499), ("DeepCool CC560", "DeepCool", "ATX", 4, 4499),
    ("DeepCool CH560", "DeepCool", "ATX", 4, 6999), ("Cooler Master TD500 Mesh", "Cooler Master", "ATX", 3, 8499),
    ("Cooler Master MB511", "Cooler Master", "ATX", 1, 4999), ("Ant Esports ICE-300", "Ant Esports", "ATX", 3, 3499),
    ("Ant Esports 511 Air", "Ant Esports", "ATX", 4, 4299), ("MSI MAG Forge 100R", "MSI", "ATX", 4, 4999),
    ("Phanteks Eclipse G360A", "Phanteks", "ATX", 3, 8999), ("Montech AIR 903 MAX", "Montech", "ATX", 4, 6499),
    ("Cooler Master Q300L", "Cooler Master", "Micro-ATX", 1, 3999), ("NZXT H210", "NZXT", "Mini-ITX", 2, 6999),
    ("Cooler Master NR200P", "Cooler Master", "Mini-ITX", 2, 8999), ("Lian Li Q58", "Lian Li", "Mini-ITX", 0, 12999),
]
_CASE_SUPPORT = {
    "ATX": ["ATX", "Micro-ATX", "Mini-ITX"],
    "Micro-ATX": ["Micro-ATX", "Mini-ITX"],
    "Mini-ITX": ["Mini-ITX"],
}

# ---- Coolers (name, brand, type, tdp rating, base) ----
_COOLERS = [
    ("DeepCool AK400", "DeepCool", "Air", "220W", 2499), ("DeepCool AK620", "DeepCool", "Air", "260W", 4999),
    ("Cooler Master Hyper 212 Black", "Cooler Master", "Air", "150W", 1999), ("Cooler Master Hyper 212 Halo", "Cooler Master", "Air", "180W", 2999),
    ("Noctua NH-D15", "Noctua", "Air", "250W", 9499), ("Noctua NH-U12S Redux", "Noctua", "Air", "160W", 4499),
    ("Noctua NH-L9i", "Noctua", "Air", "95W", 3999), ("Thermalright Peerless Assassin 120 SE", "Thermalright", "Air", "245W", 3299),
    ("Thermalright Phantom Spirit 120 SE", "Thermalright", "Air", "265W", 3799), ("be quiet! Dark Rock 4", "be quiet!", "Air", "200W", 7499),
    ("be quiet! Pure Rock 2", "be quiet!", "Air", "150W", 3499), ("ID-Cooling SE-224-XT", "ID-Cooling", "Air", "180W", 2299),
    ("Cooler Master ML240L V2", "Cooler Master", "AIO Liquid", "250W", 6499), ("Cooler Master ML360L V2", "Cooler Master", "AIO Liquid", "300W", 8999),
    ("DeepCool LE520", "DeepCool", "AIO Liquid", "260W", 5499), ("DeepCool LE720", "DeepCool", "AIO Liquid", "300W", 7499),
    ("DeepCool LS520", "DeepCool", "AIO Liquid", "270W", 7999), ("Arctic Liquid Freezer III 240", "Arctic", "AIO Liquid", "300W", 8999),
    ("Arctic Liquid Freezer III 360", "Arctic", "AIO Liquid", "350W", 11499), ("NZXT Kraken 240", "NZXT", "AIO Liquid", "280W", 11999),
    ("Corsair iCUE H100i Elite", "Corsair", "AIO Liquid", "300W", 13999), ("Corsair iCUE H150i Elite", "Corsair", "AIO Liquid", "350W", 17999),
    ("Lian Li Galahad II 360", "Lian Li", "AIO Liquid", "350W", 14999), ("Thermaltake TH240 V2", "Thermaltake", "AIO Liquid", "250W", 6999),
]


def _build_components():
    out = []

    for name, brand, cores, sock, boost, tdp, base in _CPUS:
        out.append(_comp(_cid(1), 1, name, brand,
                         {"cores": cores, "socket": sock, "boost_clock": boost, "tdp": tdp},
                         _prices(base)))

    for name, brand, mem, boost, tdp, base in _GPUS:
        out.append(_comp(_cid(2), 2, name, brand,
                         {"memory": mem, "boost_clock": boost, "tdp": tdp},
                         _prices(base)))

    # Motherboards: brand x series x platform, one random form factor each
    mb_combos = []
    for sock, ram, chip, base in _MB_PLATFORMS:
        for brand, series_list in _MB_BRAND_SERIES.items():
            for series, mult, premium in series_list:
                mb_combos.append((sock, ram, chip, base, brand, series, mult, premium))
    for sock, ram, chip, base, brand, series, mult, premium in _take(mb_combos, 120):
        ff = _RNG.choice(_FF)
        wifi = premium or _RNG.random() < 0.4
        name = f"{brand} {series} {chip}{_FF_TAG[ff]}" + (" WiFi" if wifi else "")
        specs = {"socket": sock, "ram_type": ram, "form_factor": ff, "chipset": chip,
                 "wifi": wifi, "ram_slots": 2 if ff == "Mini-ITX" else 4}
        out.append(_comp(_cid(3), 3, name, brand, specs, _prices(int(base * mult))))

    # RAM
    ram_combos = []
    for brand, series_list in _RAM_BRAND_SERIES.items():
        for series in series_list:
            for typ, speed, sm in _RAM_SPECS:
                for cap in _RAM_CAPS:
                    if cap == 8 and typ == "DDR5":
                        continue
                    ram_combos.append((brand, series, typ, speed, sm, cap))
    for brand, series, typ, speed, sm, cap in _take(ram_combos, 80):
        name = f"{brand} {series} {cap}GB {typ}-{speed}"
        base = (190 if typ == "DDR4" else 320) * (cap / 8) * sm
        out.append(_comp(_cid(4), 4, name, brand,
                         {"capacity": f"{cap}GB", "type": typ, "speed": f"{speed}MHz"},
                         _prices(int(base))))

    # Storage
    st_combos = []
    for brand, fam in _ST_FAMILY.items():
        for typ, model in fam.items():
            if not model:
                continue
            for cap in _ST_CAPS[typ]:
                st_combos.append((brand, typ, model, cap))
    for brand, typ, model, cap in _take(st_combos, 70):
        gen = ""
        if typ == "NVMe SSD":
            gen = " Gen4" if cap >= 1000 else " Gen3"
        name = f"{brand} {model} {_cap(cap)}{gen}"
        out.append(_comp(_cid(5), 5, name, brand,
                         {"capacity": _cap(cap), "type": typ + gen.strip()},
                         _prices(int(cap * _ST_RATE[typ]))))

    # PSUs
    psu_combos = []
    for brand, series in _PSU_BRAND_SERIES.items():
        for w in _PSU_WATTS:
            psu_combos.append((brand, series, w))
    for brand, series, w in _take(psu_combos, 60):
        if w <= 550:
            eff, em = "80+ Bronze", 1.0
        elif w <= 850:
            eff, em = ("80+ Gold", 1.35) if _RNG.random() < 0.6 else ("80+ Bronze", 1.0)
        else:
            eff, em = ("80+ Platinum", 1.7) if _RNG.random() < 0.5 else ("80+ Gold", 1.4)
        name = f"{brand} {series} {w}W {eff.split()[-1]}"
        base = (3.2 * w) * em
        out.append(_comp(_cid(6), 6, name, brand,
                         {"wattage": f"{w}W", "efficiency": eff},
                         _prices(int(base))))

    # Cases
    for name, brand, ff, fans, base in _CASES:
        out.append(_comp(_cid(7), 7, name, brand,
                         {"form_factor": ff, "fans_included": fans,
                          "supported_form_factors": _CASE_SUPPORT[ff]},
                         _prices(base)))

    # Coolers
    for name, brand, typ, rating, base in _COOLERS:
        out.append(_comp(_cid(8), 8, name, brand,
                         {"type": typ, "tdp_rating": rating},
                         _prices(base)))

    return out


_COMPONENTS = _build_components()


# Cheapest price per component id, for seeding demo build totals
_MIN_PRICE = {c["id"]: min((int(p["price"]) for p in c["prices"]), default=0) for c in _COMPONENTS}
_BY_CAT = {}
for _c in _COMPONENTS:
    _BY_CAT.setdefault(_c["category_id"], []).append(_c["id"])


def _pick(cat, i):
    ids = _BY_CAT.get(cat, [])
    return ids[i % len(ids)] if ids else None


def _demo_build(bid, uid, name, slug, picks, likes, created):
    comps = {slot: cid for slot, cid in picks.items() if cid}
    total = sum(_MIN_PRICE.get(cid, 0) for cid in comps.values())
    return {
        "id": bid, "user_id": uid, "name": name, "components": comps,
        "total_price": total, "is_public": True, "slug": slug,
        "likes_count": likes, "created_at": created,
    }


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

    # Demo social data so the community feed and profiles aren't empty locally.
    # Every demo account shares the password "demo1234" so you can sign in to
    # exercise the social features. Use "demo" / "demo1234" for a quick try.
    # (Local fake-DB only.)
    demo_pw = _demo_password_hash()
    users = [
        {"id": 4, "username": "demo", "email": "demo@demo.pcease", "hashed_password": demo_pw,
         "is_active": True, "is_admin": False, "created_at": "2026-04-01T10:00:00+00:00",
         "bio": "Demo account - take PCease for a spin.", "avatar_url": None, "favorites_public": True},
        {"id": 1, "username": "alishbuilds", "email": "alish@demo.pcease", "hashed_password": demo_pw,
         "is_active": True, "is_admin": False, "created_at": "2026-04-02T10:00:00+00:00",
         "bio": "Budget 1080p gaming builds, value-first.", "avatar_url": None, "favorites_public": True},
        {"id": 2, "username": "rajrenders", "email": "raj@demo.pcease", "hashed_password": demo_pw,
         "is_active": True, "is_admin": False, "created_at": "2026-04-10T10:00:00+00:00",
         "bio": "Content creation and workstation rigs.", "avatar_url": None, "favorites_public": False},
        {"id": 3, "username": "miraITX", "email": "mira@demo.pcease", "hashed_password": demo_pw,
         "is_active": True, "is_admin": False, "created_at": "2026-05-01T10:00:00+00:00",
         "bio": "Small-form-factor ITX enthusiast.", "avatar_url": None, "favorites_public": True},
    ]
    builds = [
        _demo_build(1, 1, "Budget 1080p Gaming", "demo-bud1",
                    {"cpu": _pick(1, 9), "gpu": _pick(2, 7), "motherboard": _pick(3, 0),
                     "ram": _pick(4, 0), "storage": _pick(5, 0), "psu": _pick(6, 0),
                     "case": _pick(7, 0), "cooler": _pick(8, 0)}, 2, "2026-05-20T10:00:00+00:00"),
        _demo_build(2, 2, "Creator Workstation", "demo-crt1",
                    {"cpu": _pick(1, 20), "gpu": _pick(2, 10), "motherboard": _pick(3, 3),
                     "ram": _pick(4, 5), "storage": _pick(5, 3), "psu": _pick(6, 4),
                     "case": _pick(7, 2), "cooler": _pick(8, 12)}, 3, "2026-05-24T10:00:00+00:00"),
        _demo_build(3, 3, "ITX Compact 1440p", "demo-itx1",
                    {"cpu": _pick(1, 11), "gpu": _pick(2, 9), "motherboard": _pick(3, 6),
                     "ram": _pick(4, 2), "storage": _pick(5, 1), "psu": _pick(6, 1),
                     "case": _pick(7, 21), "cooler": _pick(8, 6)}, 1, "2026-05-28T10:00:00+00:00"),
        _demo_build(4, 1, "High-End 1440p", "demo-hi1",
                    {"cpu": _pick(1, 31), "gpu": _pick(2, 13), "motherboard": _pick(3, 4),
                     "ram": _pick(4, 4), "storage": _pick(5, 2), "psu": _pick(6, 5),
                     "case": _pick(7, 5), "cooler": _pick(8, 18)}, 2, "2026-05-30T10:00:00+00:00"),
    ]
    build_likes = [
        {"id": 1, "user_id": 2, "build_id": 1, "created_at": "2026-05-21T10:00:00+00:00"},
        {"id": 2, "user_id": 3, "build_id": 1, "created_at": "2026-05-22T10:00:00+00:00"},
        {"id": 3, "user_id": 1, "build_id": 2, "created_at": "2026-05-25T10:00:00+00:00"},
        {"id": 4, "user_id": 3, "build_id": 2, "created_at": "2026-05-25T11:00:00+00:00"},
        {"id": 5, "user_id": 2, "build_id": 2, "created_at": "2026-05-26T10:00:00+00:00"},
        {"id": 6, "user_id": 1, "build_id": 3, "created_at": "2026-05-29T10:00:00+00:00"},
        {"id": 7, "user_id": 2, "build_id": 4, "created_at": "2026-05-31T10:00:00+00:00"},
        {"id": 8, "user_id": 3, "build_id": 4, "created_at": "2026-05-31T11:00:00+00:00"},
    ]
    build_favorites = [
        {"id": 1, "user_id": 1, "build_id": 2, "created_at": "2026-05-25T10:00:00+00:00"},
        {"id": 2, "user_id": 1, "build_id": 3, "created_at": "2026-05-29T10:00:00+00:00"},
        {"id": 3, "user_id": 3, "build_id": 4, "created_at": "2026-05-31T10:00:00+00:00"},
    ]
    user_follows = [
        {"id": 1, "follower_id": 1, "following_id": 2, "created_at": "2026-05-10T10:00:00+00:00"},
        {"id": 2, "follower_id": 1, "following_id": 3, "created_at": "2026-05-11T10:00:00+00:00"},
        {"id": 3, "follower_id": 3, "following_id": 1, "created_at": "2026-05-12T10:00:00+00:00"},
    ]

    return {
        "categories": categories,
        "vendors": vendors,
        "components": [dict(c) for c in _COMPONENTS],
        "component_prices": component_prices,
        "users": users,
        "builds": builds,
        "shared_builds": [],
        "forum_threads": [],
        "forum_replies": [],
        "forum_votes": [],
        "build_likes": build_likes,
        "build_favorites": build_favorites,
        "user_follows": user_follows,
        "watchlist": [],
        "tickets": [],
    }


def get_fake_db():
    return FakeSupabase(seed_data())
