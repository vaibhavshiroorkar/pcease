"""Regression tests for security fixes."""
from fastapi.testclient import TestClient
from app.main import app
from app.database import get_db
from tests.conftest import FakeSupabase


def _client():
    app.dependency_overrides[get_db] = lambda: FakeSupabase(tables={"users": []})
    return TestClient(app)


def test_insecure_reset_password_endpoint_is_gone():
    client = _client()
    r = client.post("/api/auth/reset-password",
                    json={"username": "a", "email": "b@c.com", "new_password": "x"})
    assert r.status_code == 404  # endpoint removed (account-takeover vector)
    app.dependency_overrides.clear()
