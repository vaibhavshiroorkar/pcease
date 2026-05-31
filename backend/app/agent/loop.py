"""Hand-rolled agentic loop. Async generator yielding (event_name, data) tuples.
LangChain owns the message/tool data structures; this loop owns control + streaming."""
import asyncio
import inspect
import json
from typing import AsyncIterator, Optional, Tuple
from langchain_core.messages import (
    SystemMessage, HumanMessage, AIMessage, ToolMessage,
)
from .llm import get_chat_model
from .tools import TOOL_MAP
from .prompts import SYSTEM_PROMPT
from ..config import settings

_LABELS = {
    "search_components": "Searching components",
    "get_component": "Looking up a part",
    "check_compatibility": "Checking compatibility",
    "estimate_wattage": "Estimating wattage",
    "check_bottleneck": "Checking CPU–GPU balance",
    "assemble_build": "Assembling the build",
    "save_build": "Saving the build",
    "create_share_link": "Creating a share link",
}


def _text_of(content) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "".join(
            b.get("text", "") for b in content if isinstance(b, dict) and b.get("type") == "text"
        )
    return ""


def _to_lc_messages(history, build_context):
    msgs = [SystemMessage(content=SYSTEM_PROMPT)]
    if build_context:
        msgs.append(SystemMessage(
            content=f"The user's current build (slot -> component_id): {json.dumps(build_context)}"))
    for m in history:
        role = m.get("role")
        content = m.get("content", "")
        if role == "user":
            msgs.append(HumanMessage(content=content))
        else:
            msgs.append(AIMessage(content=content))
    return msgs


def _summary(name: str, output) -> str:
    if isinstance(output, list):
        return f"{len(output)} result(s)"
    if isinstance(output, dict):
        if "error" in output:
            return f"error: {output['error']}"
        if "total" in output:
            return f"₹{output['total']:,}"
        if "recommended_psu" in output:
            return f"{output['recommended_psu']}W PSU"
        if "compatible" in output:
            return "compatible" if output["compatible"] else "issues found"
        if "status" in output:
            return output["status"]
        if "message" in output:
            return output["message"]
    return "done"


async def _run_tool(tool_call, *, db, user):
    tool = TOOL_MAP.get(tool_call["name"])
    if tool is None:
        return {"error": f"unknown tool {tool_call['name']}"}
    args = dict(tool_call.get("args") or {})
    params = inspect.signature(tool.func).parameters
    if "db" in params:
        args["db"] = db
    if "user" in params:
        args["user"] = user
    try:
        return await asyncio.to_thread(tool.invoke, args)
    except Exception as e:  # surfaced back to the model so it can self-correct
        return {"error": str(e)}


async def run_agent(
    history,
    *,
    db,
    user: Optional[dict] = None,
    build_context: Optional[dict] = None,
    model=None,
) -> AsyncIterator[Tuple[str, dict]]:
    model = model or get_chat_model()
    messages = _to_lc_messages(history, build_context)

    for _ in range(settings.agent_max_iterations):
        gathered = None
        async for chunk in model.astream(messages):
            text = _text_of(chunk.content)
            if text:
                yield ("token", text)
            gathered = chunk if gathered is None else gathered + chunk

        if gathered is None:
            break
        messages.append(gathered)
        tool_calls = getattr(gathered, "tool_calls", None) or []
        if not tool_calls:
            break

        for tc in tool_calls:
            yield ("tool_start", {"name": tc["name"],
                                  "label": _LABELS.get(tc["name"], tc["name"]),
                                  "args": tc.get("args", {})})
            output = await _run_tool(tc, db=db, user=user)
            if tc["name"] == "assemble_build" and isinstance(output, dict) and "error" not in output:
                yield ("build", output)
            messages.append(ToolMessage(content=json.dumps(output, default=str),
                                        tool_call_id=tc["id"]))
            yield ("tool_end", {"name": tc["name"], "summary": _summary(tc["name"], output)})

    yield ("done", {})
