import json
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from supabase import Client
from ..database import get_db
from ..utils.auth import get_current_user_optional
from ..agent.loop import run_agent

router = APIRouter(prefix="/api/agent", tags=["Agent"])

# Test seam: tests set this to inject a scripted model; None -> real provider.
_test_model = None


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, default=str)}\n\n"


@router.post("/chat")
async def chat(
    body: dict,
    db: Client = Depends(get_db),
    user: dict | None = Depends(get_current_user_optional),
):
    history = body.get("messages", [])
    build_context = body.get("build_context")

    async def gen():
        try:
            async for event, data in run_agent(
                history, db=db, user=user,
                build_context=build_context, model=_test_model,
            ):
                yield _sse(event, data)
        except Exception as e:  # config error (missing keys) or provider failure
            raw = str(e)
            if "API_KEY" in raw or "api key" in raw.lower() or "not set" in raw.lower():
                msg = ("The AI agent is offline right now - no model is configured. "
                       "Try the Presets or Manual tabs for grounded build suggestions.")
            else:
                msg = "The AI agent hit an error. Please try again in a moment."
            yield _sse("error", {"message": msg})
            yield _sse("done", {})

    return StreamingResponse(gen(), media_type="text/event-stream")
