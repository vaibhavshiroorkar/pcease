from supabase import create_client, Client
from .config import settings

# Use the in-memory seeded dummy DB for local testing, otherwise real Supabase.
if settings.use_fake_db:
    from .fake_db import get_fake_db
    supabase = get_fake_db()
else:
    supabase = create_client(settings.supabase_url, settings.supabase_service_key or settings.supabase_key)


def get_db():
    """Dependency to get the database client (real Supabase or in-memory fake)."""
    return supabase
