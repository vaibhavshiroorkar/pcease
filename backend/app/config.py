from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    # Supabase
    supabase_url: str = ""
    supabase_key: str = ""  # anon/public key
    supabase_service_key: str = ""  # service role key (server-side only)

    # JWT
    secret_key: str = "your-super-secret-key-change-this-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440  # 24 hours

    # Google Gemini AI
    gemini_api_key: str = ""

    # Anthropic Claude
    anthropic_api_key: str = ""

    # Agent
    llm_provider: str = "claude"  # "claude" | "gemini"
    claude_model: str = "claude-haiku-4-5-20251001"
    gemini_model: str = "gemini-1.5-flash"
    agent_max_iterations: int = 8

    # App
    debug: bool = True
    frontend_url: str = "http://localhost:5173"
    use_fake_db: bool = False  # in-memory seeded DB for local testing (no Supabase)

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


@lru_cache()
def get_settings():
    return Settings()


settings = get_settings()
