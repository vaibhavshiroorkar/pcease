from app.config import Settings


def test_settings_have_agent_defaults():
    s = Settings()
    assert s.llm_provider in ("claude", "gemini")
    assert s.claude_model
    assert s.gemini_model
    assert s.agent_max_iterations >= 1
    assert hasattr(s, "anthropic_api_key")
