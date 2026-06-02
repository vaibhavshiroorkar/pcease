"""End-to-end tests for the social layer against the seeded in-memory fake DB."""
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
    """Re-seed the fake DB before each test so state doesn't leak between tests."""
    database.supabase = get_fake_db()
    yield


def auth(username="alishbuilds", password="demo1234"):
    r = client.post("/api/auth/login", data={"username": username, "password": password})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_login_and_me_round_trip():
    h = auth()
    me = client.get("/api/auth/me", headers=h).json()
    assert me["username"] == "alishbuilds"


def test_public_feed_returns_seeded_builds_with_owner_and_parts():
    d = client.get("/api/builds/public").json()
    assert d["total"] == 4
    top = d["items"][0]
    assert top["owner"]["username"]
    assert top["part_count"] > 0


def test_feed_popular_sort_orders_by_likes():
    items = client.get("/api/builds/public?sort=popular").json()["items"]
    likes = [b["likes_count"] for b in items]
    assert likes == sorted(likes, reverse=True)


def test_profile_hides_email_and_gates_private_favorites():
    # raj has favorites_public = False
    d = client.get("/api/users/rajrenders").json()
    assert "email" not in d["user"]
    assert d["favorites_visible"] is False
    assert d["favorites"] == []


def test_profile_owner_sees_own_favorites():
    h = auth("rajrenders")
    d = client.get("/api/users/rajrenders", headers=h).json()
    assert d["is_self"] is True
    assert d["favorites_visible"] is True


def test_like_then_unlike_updates_count():
    h = auth("rajrenders")  # raj likes alice's build #4
    liked = client.post("/api/builds/4/like", headers=h).json()
    assert liked["liked"] is True
    before = liked["likes_count"]
    again = client.post("/api/builds/4/like", headers=h).json()  # idempotent
    assert again["likes_count"] == before
    unliked = client.delete("/api/builds/4/like", headers=h).json()
    assert unliked["liked"] is False
    assert unliked["likes_count"] == before - 1


def test_favorite_toggle_and_listing():
    h = auth("miraITX")
    client.post("/api/builds/1/favorite", headers=h)
    favs = client.get("/api/me/favorites", headers=h).json()
    assert any(b["id"] == 1 for b in favs)
    client.delete("/api/builds/1/favorite", headers=h)
    favs = client.get("/api/me/favorites", headers=h).json()
    assert not any(b["id"] == 1 for b in favs)


def test_follow_changes_following_feed_and_blocks_self_follow():
    h = auth("rajrenders")
    assert client.post("/api/users/rajrenders/follow", headers=h).status_code == 400
    # raj follows nobody initially -> empty following feed
    assert client.get("/api/builds/public?scope=following", headers=h).json()["total"] == 0
    client.post("/api/users/alishbuilds/follow", headers=h)
    total = client.get("/api/builds/public?scope=following", headers=h).json()["total"]
    assert total == 2  # alice's two public builds


def test_visibility_toggle_and_private_access():
    h = auth("alishbuilds")
    # make build #1 private
    client.patch("/api/builds/1", headers=h, json={"is_public": False})
    # owner can still see it by slug
    assert client.get("/api/builds/slug/demo-bud1", headers=h).status_code == 200
    # anonymous cannot
    assert client.get("/api/builds/slug/demo-bud1").status_code == 403
    # and it drops out of the public feed
    assert client.get("/api/builds/public").json()["total"] == 3


def test_non_owner_cannot_patch_build():
    h = auth("rajrenders")
    assert client.patch("/api/builds/1", headers=h, json={"name": "hijack"}).status_code == 403


def test_profile_update_sets_bio_and_favorites_public():
    h = auth("rajrenders")
    client.put("/api/auth/profile", headers=h, json={"bio": "new bio", "favorites_public": True})
    d = client.get("/api/users/rajrenders").json()
    assert d["user"]["bio"] == "new bio"
    assert d["favorites_visible"] is True
