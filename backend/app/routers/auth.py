from datetime import timedelta
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from supabase import Client
from ..database import get_db
from ..schemas.user import UserCreate, UserResponse, Token
from ..utils.auth import verify_password, get_password_hash, create_access_token, get_current_user
from ..utils.ratelimit import rate_limit
from ..config import settings

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

# Pre-computed dummy hash so login does a bcrypt verify even when the user is
# not found - removes the timing side-channel that leaks username existence.
_DUMMY_HASH = get_password_hash("timing-equalizer-not-a-real-password")


class ProfileUpdate(BaseModel):
    username: str | None = None
    email: str | None = None
    bio: str | None = None
    avatar_url: str | None = None
    favorites_public: bool | None = None


class PasswordChange(BaseModel):
    current_password: str
    new_password: str


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(
    user: UserCreate,
    db: Client = Depends(get_db),
    _rl: None = Depends(rate_limit(max_requests=5, window_seconds=300, scope="register")),
):
    """Register a new user"""
    existing = db.table("users").select("id").eq("email", user.email).execute()
    if existing.data:
        raise HTTPException(status_code=400, detail="Email already registered")

    existing = db.table("users").select("id").eq("username", user.username).execute()
    if existing.data:
        raise HTTPException(status_code=400, detail="Username already taken")

    new_user = db.table("users").insert({
        "email": user.email,
        "username": user.username,
        "hashed_password": get_password_hash(user.password),
        "is_active": True,
        "is_admin": False,
    }).execute()

    if not new_user.data:
        raise HTTPException(status_code=500, detail="Failed to create user")

    return new_user.data[0]


@router.post("/login", response_model=Token)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Client = Depends(get_db),
    _rl: None = Depends(rate_limit(max_requests=10, window_seconds=300, scope="login")),
):
    """Login with username and password"""
    # Try username first, then email as fallback
    result = db.table("users").select("*").eq("username", form_data.username).maybe_single().execute()
    if not result or not result.data:
        result = db.table("users").select("*").eq("email", form_data.username).maybe_single().execute()

    user = result.data if result and result.data else None
    # Always run a bcrypt verify (real or dummy) so response timing does not
    # reveal whether the account exists. Tombstoned (deleted) accounts use the
    # dummy hash so they can never authenticate and never hit a malformed hash.
    active = user and not user.get("is_deleted")
    hashed = user["hashed_password"] if active else _DUMMY_HASH
    if not verify_password(form_data.password, hashed) or not active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token(
        # JWT `sub` must be a string (python-jose rejects non-string subjects on decode)
        data={"sub": str(user["id"])},
        expires_delta=timedelta(minutes=settings.access_token_expire_minutes),
    )
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    """Get current authenticated user"""
    return current_user


@router.put("/profile", response_model=UserResponse)
async def update_profile(update: ProfileUpdate, current_user: dict = Depends(get_current_user), db: Client = Depends(get_db)):
    """Update user profile (username/email)"""
    changes = {}
    if update.username and update.username != current_user.get("username"):
        existing = db.table("users").select("id").eq("username", update.username).execute()
        if existing.data:
            raise HTTPException(status_code=400, detail="Username already taken")
        changes["username"] = update.username
    if update.email and update.email != current_user.get("email"):
        existing = db.table("users").select("id").eq("email", update.email).execute()
        if existing.data:
            raise HTTPException(status_code=400, detail="Email already registered")
        changes["email"] = update.email
    # Profile fields (no uniqueness checks). None means "not provided".
    if update.bio is not None:
        changes["bio"] = update.bio.strip()[:280]
    if update.avatar_url is not None:
        changes["avatar_url"] = update.avatar_url or None
    if update.favorites_public is not None:
        changes["favorites_public"] = update.favorites_public
    if not changes:
        raise HTTPException(status_code=400, detail="No changes provided")
    result = db.table("users").update(changes).eq("id", current_user["id"]).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to update profile")
    return result.data[0]


@router.put("/password")
async def change_password(data: PasswordChange, current_user: dict = Depends(get_current_user), db: Client = Depends(get_db)):
    """Change password (requires current password)"""
    if not verify_password(data.current_password, current_user["hashed_password"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    db.table("users").update({"hashed_password": get_password_hash(data.new_password)}).eq("id", current_user["id"]).execute()
    return {"detail": "Password changed successfully"}


@router.delete("/account")
async def delete_account(current_user: dict = Depends(get_current_user), db: Client = Depends(get_db)):
    """Delete current user account.

    Reddit-style: the account's content (threads, replies, builds) is KEPT so
    conversations stay intact, but the author is anonymized to [deleted] and the
    personal data is scrubbed.
    """
    uid = current_user["id"]
    _anonymize_user(db, uid)
    return {"detail": "Account deleted"}


def _anonymize_user(db: Client, uid: int) -> None:
    """Tombstone a user: scrub identity and remove personal/relational data, but
    leave their posts and builds in place (shown as [deleted]).

    The `is_deleted` flag drives the [deleted] display; the username is also made
    unique-but-scrubbed so it never collides and never leaks the old name.
    """
    # Personal/relational actions are removed (these are this user's own actions).
    db.table("build_likes").delete().eq("user_id", uid).execute()
    db.table("build_favorites").delete().eq("user_id", uid).execute()
    db.table("user_follows").delete().eq("follower_id", uid).execute()
    db.table("user_follows").delete().eq("following_id", uid).execute()
    # Scrub identity. Threads, replies and builds are intentionally left intact.
    db.table("users").update({
        "username": f"deleted_user_{uid}",
        "email": f"deleted+{uid}@deleted.invalid",
        "hashed_password": "!",            # unusable hash; login can never match
        "is_deleted": True,
        "avatar_url": None,
        "bio": None,
    }).eq("id", uid).execute()


# ==================== Admin Endpoints ====================

def require_admin(current_user: dict = Depends(get_current_user)):
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


@router.get("/admin/users", response_model=List[UserResponse])
async def admin_list_users(admin: dict = Depends(require_admin), db: Client = Depends(get_db)):
    result = db.table("users").select("*").order("created_at", desc=True).execute()
    return result.data or []


@router.get("/admin/stats")
async def admin_stats(admin: dict = Depends(require_admin), db: Client = Depends(get_db)):
    users = db.table("users").select("id", count="exact").execute()
    threads = db.table("forum_threads").select("id", count="exact").execute()
    replies = db.table("forum_replies").select("id", count="exact").execute()
    builds = db.table("builds").select("id", count="exact").execute()
    components = db.table("components").select("id", count="exact").execute()
    return {
        "users": users.count or 0,
        "threads": threads.count or 0,
        "replies": replies.count or 0,
        "builds": builds.count or 0,
        "components": components.count or 0,
    }


@router.delete("/admin/users/{user_id}")
async def admin_delete_user(user_id: int, admin: dict = Depends(require_admin), db: Client = Depends(get_db)):
    if user_id == admin["id"]:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    _anonymize_user(db, user_id)
    return {"detail": "User deleted"}


@router.delete("/admin/threads/{thread_id}")
async def admin_delete_thread(thread_id: int, admin: dict = Depends(require_admin), db: Client = Depends(get_db)):
    db.table("forum_replies").delete().eq("thread_id", thread_id).execute()
    db.table("forum_threads").delete().eq("id", thread_id).execute()
    return {"detail": "Thread deleted"}
