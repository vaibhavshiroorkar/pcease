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
            yield _sse("error", {"message": str(e)})
            yield _sse("done", {})

    return StreamingResponse(gen(), media_type="text/event-stream")
