from ..config import settings
from .tools import TOOLS


def _resolve_provider() -> str:
    """Honor settings.llm_provider, but fall back to the provider whose key exists."""
    p = settings.llm_provider
    if p == "claude" and not settings.anthropic_api_key and settings.gemini_api_key:
        return "gemini"
    if p == "gemini" and not settings.gemini_api_key and settings.anthropic_api_key:
        return "claude"
    return p


def get_chat_model():
    """Return a tool-bound LangChain chat model for the active provider."""
    provider = _resolve_provider()
    if provider == "claude":
        if not settings.anthropic_api_key:
            raise RuntimeError("ANTHROPIC_API_KEY is not set")
        from langchain_anthropic import ChatAnthropic
        model = ChatAnthropic(
            model=settings.claude_model,
            api_key=settings.anthropic_api_key,
            max_tokens=2048,
        )
    elif provider == "gemini":
        if not settings.gemini_api_key:
            raise RuntimeError("GEMINI_API_KEY is not set")
        from langchain_google_genai import ChatGoogleGenerativeAI
        model = ChatGoogleGenerativeAI(
            model=settings.gemini_model,
            google_api_key=settings.gemini_api_key,
        )
    else:
        raise RuntimeError(f"Unknown llm_provider: {provider}")
    return model.bind_tools(TOOLS)
