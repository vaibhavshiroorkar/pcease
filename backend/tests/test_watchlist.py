"""End-to-end tests for the watchlist + builders directory against the fake DB."""
import os

os.environ["USE_FAKE_DB"] = "true"
os.environ.setdefault("SUPABASE_URL", "https://fake.supabase.co")
os.environ.setdefault("SUPABASE_KEY", "fakekey")

import pytest
from fastapi.testclient import TestClient

from app import database
from app.fake_db import get_fake_db
from app.main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def fresh_db():
    database.supabase = get_fake_db()
    yield


def auth(username="alishbuilds", password="demo1234"):
    r = client.post("/api/auth/login", data={"username": username, "password": password})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def _a_component_id():
    return client.get("/api/components?limit=1").json()[0]["id"]


def test_watchlist_requires_auth():
    assert client.get("/api/watchlist").status_code == 401


def test_add_list_and_remove_round_trip():
    h = auth()
    cid = _a_component_id()
    assert client.get("/api/watchlist", headers=h).json() == []

    added = client.post(f"/api/watchlist/{cid}", headers=h).json()
    assert added["saved"] is True

    items = client.get("/api/watchlist", headers=h).json()
    assert len(items) == 1
    assert items[0]["id"] == cid
    assert "prices" in items[0]  # enriched

    # idempotent
    client.post(f"/api/watchlist/{cid}", headers=h)
    assert len(client.get("/api/watchlist", headers=h).json()) == 1

    client.delete(f"/api/watchlist/{cid}", headers=h)
    assert client.get("/api/watchlist", headers=h).json() == []


def test_add_unknown_component_404s():
    h = auth()
    assert client.post("/api/watchlist/99999999", headers=h).status_code == 404


def test_merge_adds_local_ids_and_dedupes():
    h = auth()
    comps = client.get("/api/components?limit=3").json()
    ids = [c["id"] for c in comps]
    client.post(f"/api/watchlist/{ids[0]}", headers=h)  # already saved
    merged = client.post("/api/watchlist/merge", headers=h, json={"ids": ids}).json()
    assert {c["id"] for c in merged} == set(ids)
    # merging again keeps the same set
    again = client.post("/api/watchlist/merge", headers=h, json={"ids": ids}).json()
    assert len(again) == len(ids)


def test_watchlist_is_per_user():
    ha = auth("alishbuilds")
    hb = auth("rajrenders")
    cid = _a_component_id()
    client.post(f"/api/watchlist/{cid}", headers=ha)
    assert len(client.get("/api/watchlist", headers=ha).json()) == 1
    assert client.get("/api/watchlist", headers=hb).json() == []


# ----------------------------- builders directory -----------------------------
def test_builders_directory_lists_users_with_build_counts():
    d = client.get("/api/users").json()
    assert d["total"] == 4  # 3 builder accounts + the "demo" try-it account
    names = {u["username"] for u in d["items"]}
    assert {"alishbuilds", "rajrenders", "miraITX", "demo"} <= names
    assert all("email" not in u for u in d["items"])
    alish = next(u for u in d["items"] if u["username"] == "alishbuilds")
    assert alish["public_builds"] == 2  # seeded two public builds
    demo = next(u for u in d["items"] if u["username"] == "demo")
    assert demo["public_builds"] == 0  # demo account ships with no builds


def test_builders_directory_search():
    d = client.get("/api/users?q=mira").json()
    assert d["total"] == 1
    assert d["items"][0]["username"] == "miraITX"
