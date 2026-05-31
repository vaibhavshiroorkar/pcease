import pytest
from langchain_core.messages import AIMessageChunk
from fastapi.testclient import TestClient
from app.main import app
from app.routers import agent as agent_router
from app.database import get_db
from tests.conftest import FakeSupabase


class FakeModel:
    def __init__(self, turns):
        self._turns = turns; self._i = 0

    async def astream(self, messages):
        text, tool_calls = self._turns[self._i]; self._i += 1
        if text:
            yield AIMessageChunk(content=text)
        if tool_calls:
            yield AIMessageChunk(content="", tool_calls=tool_calls)


@pytest.fixture
def client(monkeypatch):
    db = FakeSupabase(tables={"categories": [{"id": 1, "slug": "cpu"}],
                              "components": [], "users": []})
    app.dependency_overrides[get_db] = lambda: db
    model = FakeModel(turns=[("Hello from agent.", None)])
    monkeypatch.setattr(agent_router, "get_chat_model_override", lambda: model, raising=False)
    monkeypatch.setattr(agent_router, "_test_model", model, raising=False)
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_chat_streams_sse_events(client):
    with client.stream("POST", "/api/agent/chat",
                       json={"messages": [{"role": "user", "content": "hi"}]}) as r:
        assert r.status_code == 200
        assert "text/event-stream" in r.headers["content-type"]
        body = "".join(chunk for chunk in r.iter_text())
    assert "event: token" in body
    assert "event: done" in body
    assert "Hello from agent." in body
