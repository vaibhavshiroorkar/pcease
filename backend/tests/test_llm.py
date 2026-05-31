import pytest
from app.agent import llm
from app import config


@pytest.fixture
def patch_settings(monkeypatch):
    def _set(**kw):
        for k, v in kw.items():
            monkeypatch.setattr(config.settings, k, v, raising=False)
            monkeypatch.setattr(llm.settings, k, v, raising=False)
    return _set


def test_resolve_provider_falls_back_when_key_missing(patch_settings):
    patch_settings(llm_provider="claude", anthropic_api_key="", gemini_api_key="g")
    assert llm._resolve_provider() == "gemini"


def test_resolve_provider_keeps_choice_when_key_present(patch_settings):
    patch_settings(llm_provider="claude", anthropic_api_key="a", gemini_api_key="g")
    assert llm._resolve_provider() == "claude"


def test_get_chat_model_raises_without_any_key(patch_settings):
    patch_settings(llm_provider="claude", anthropic_api_key="", gemini_api_key="")
    with pytest.raises(RuntimeError):
        llm.get_chat_model()
