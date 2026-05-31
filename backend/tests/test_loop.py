import pytest
from langchain_core.messages import AIMessageChunk
from app.agent import loop


class FakeModel:
    """Scripted chat model. `turns` is a list of (text, tool_calls) per astream() call."""
    def __init__(self, turns):
        self._turns = turns
        self._i = 0

    async def astream(self, messages):
        text, tool_calls = self._turns[self._i]
        self._i += 1
        if text:
            yield AIMessageChunk(content=text)
        if tool_calls:
            yield AIMessageChunk(content="", tool_calls=tool_calls)


async def _collect(gen):
    return [ev async for ev in gen]


@pytest.mark.asyncio
async def test_loop_streams_tokens_then_runs_tool_then_finishes(fake_db):
    model = FakeModel(turns=[
        ("Let me search. ", [{"name": "search_components",
                              "args": {"category": "cpu", "max_price": 25000},
                              "id": "t1"}]),
        ("Here is a CPU.", None),
    ])
    events = await _collect(loop.run_agent(
        [{"role": "user", "content": "cheap cpu?"}],
        db=fake_db, user=None, model=model,
    ))
    kinds = [e[0] for e in events]
    assert "token" in kinds
    assert "tool_start" in kinds
    assert "tool_end" in kinds
    assert kinds[-1] == "done"


@pytest.mark.asyncio
async def test_loop_emits_build_event_for_assemble_build(fake_db):
    model = FakeModel(turns=[
        ("", [{"name": "assemble_build",
               "args": {"title": "Test", "items": [{"slot": "cpu", "component_id": 10}]},
               "id": "b1"}]),
        ("Done.", None),
    ])
    events = await _collect(loop.run_agent(
        [{"role": "user", "content": "build me a pc"}],
        db=fake_db, user=None, model=model,
    ))
    build_events = [d for (e, d) in events if e == "build"]
    assert len(build_events) == 1
    assert build_events[0]["title"] == "Test"


@pytest.mark.asyncio
async def test_loop_respects_max_iterations(fake_db, monkeypatch):
    monkeypatch.setattr(loop.settings, "agent_max_iterations", 2, raising=False)
    looping = [("", [{"name": "get_component", "args": {"component_id": 10}, "id": "x"}])] * 5
    model = FakeModel(turns=looping)
    events = await _collect(loop.run_agent(
        [{"role": "user", "content": "loop"}], db=fake_db, user=None, model=model))
    # Stops at the cap and still emits done
    assert events[-1][0] == "done"
