"""Support-ticket flow against the in-memory fake DB."""
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


def make_admin(username="alishbuilds"):
    for u in database.supabase.tables["users"]:
        if u["username"] == username:
            u["is_admin"] = True
    return auth(username)


def test_guest_can_create_and_track_ticket():
    r = client.post("/api/tickets", json={
        "subject": "Site is great", "message": "Just saying hi", "email": "guest@x.io", "name": "Guest", "category": "General",
    })
    assert r.status_code == 201, r.text
    ref = r.json()["reference"]
    assert ref.startswith("PCE-")
    assert r.json()["status"] == "open"

    # Track with the right reference + email.
    ok = client.get("/api/tickets/lookup", params={"reference": ref, "email": "guest@x.io"})
    assert ok.status_code == 200
    assert ok.json()["subject"] == "Site is great"

    # Wrong email is rejected (not an open lookup).
    bad = client.get("/api/tickets/lookup", params={"reference": ref, "email": "someone@else.io"})
    assert bad.status_code == 404


def test_validation_requires_core_fields():
    r = client.post("/api/tickets", json={"subject": "", "message": "", "email": ""})
    assert r.status_code == 400


def test_user_ticket_links_to_account_and_lists_in_me():
    h = auth("alishbuilds")
    r = client.post("/api/tickets", headers=h, json={"subject": "Bug", "message": "Found a bug", "email": "ignored@x.io", "category": "Bug"})
    assert r.status_code == 201
    mine = client.get("/api/tickets/me", headers=h)
    assert mine.status_code == 200
    subjects = [t["subject"] for t in mine.json()]
    assert "Bug" in subjects
    # Logged-in tickets use the account email, not whatever was typed.
    assert all(t["email"] == "alish@demo.pcease" for t in mine.json())


def test_admin_lists_and_updates_status():
    client.post("/api/tickets", json={"subject": "X", "message": "Y", "email": "g@x.io"})
    h = make_admin("alishbuilds")
    listing = client.get("/api/tickets/admin", headers=h)
    assert listing.status_code == 200 and len(listing.json()) >= 1
    tid = listing.json()[0]["id"]

    upd = client.patch(f"/api/tickets/admin/{tid}", headers=h, json={"status": "closed"})
    assert upd.status_code == 200 and upd.json()["status"] == "closed"

    bad = client.patch(f"/api/tickets/admin/{tid}", headers=h, json={"status": "banana"})
    assert bad.status_code == 400


def test_admin_endpoints_require_admin():
    h = auth("rajrenders")  # not an admin
    assert client.get("/api/tickets/admin", headers=h).status_code == 403
