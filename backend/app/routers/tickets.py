"""Support tickets: submit (guest or user), track, and admin manage."""
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Query
from supabase import Client
from ..database import get_db
from ..utils.auth import get_current_user, get_current_user_optional
from .auth import require_admin

router = APIRouter(prefix="/api/tickets", tags=["Tickets"])

STATUSES = {"open", "in_progress", "closed"}
CATEGORIES = {"General", "Bug", "Feature", "Account", "Other"}


def _make_reference() -> str:
    return "PCE-" + uuid.uuid4().hex[:6].upper()


@router.post("", status_code=status.HTTP_201_CREATED)
def create_ticket(body: dict, current_user: dict = Depends(get_current_user_optional), db: Client = Depends(get_db)):
    """Create a ticket. Works for guests; links to the account when logged in."""
    subject = (body.get("subject") or "").strip()
    message = (body.get("message") or "").strip()
    email = (body.get("email") or "").strip()
    name = (body.get("name") or "").strip()
    category = body.get("category") or "General"

    if not subject or not message or not email:
        raise HTTPException(status_code=400, detail="Subject, message and email are required")
    if category not in CATEGORIES:
        category = "Other"

    # Prefer the authenticated account's identity when available.
    if current_user:
        name = name or current_user.get("username") or name
        email = current_user.get("email") or email

    now = datetime.now(timezone.utc).isoformat()
    row = {
        "reference": _make_reference(),
        "user_id": current_user["id"] if current_user else None,
        "name": name or "Anonymous",
        "email": email,
        "subject": subject,
        "category": category,
        "message": message,
        "status": "open",
        "updated_at": now,
    }
    result = db.table("tickets").insert(row).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create ticket")
    t = result.data[0]
    return {"id": t["id"], "reference": t["reference"], "status": t["status"]}


@router.get("/me")
def my_tickets(current_user: dict = Depends(get_current_user), db: Client = Depends(get_db)):
    """Tickets owned by the logged-in user, newest first."""
    result = (
        db.table("tickets")
        .select("*")
        .eq("user_id", current_user["id"])
        .order("created_at", desc=True)
        .execute()
    )
    rows = result.data or []
    rows.sort(key=lambda r: r.get("created_at") or "", reverse=True)
    return rows


@router.get("/lookup")
def lookup_ticket(
    reference: str = Query(...),
    email: str = Query(...),
    db: Client = Depends(get_db),
):
    """Guest tracking: a ticket is returned only when reference AND email match."""
    result = db.table("tickets").select("*").eq("reference", reference.strip()).maybe_single().execute()
    t = result.data if result else None
    if not t or (t.get("email") or "").lower() != email.strip().lower():
        raise HTTPException(status_code=404, detail="No ticket found for that reference and email")
    return t


@router.get("/admin")
def admin_list_tickets(admin: dict = Depends(require_admin), db: Client = Depends(get_db)):
    """All tickets for the admin queue, newest first."""
    result = db.table("tickets").select("*").order("created_at", desc=True).execute()
    rows = result.data or []
    rows.sort(key=lambda r: r.get("created_at") or "", reverse=True)
    return rows


@router.patch("/admin/{ticket_id}")
def admin_update_ticket(ticket_id: int, body: dict, admin: dict = Depends(require_admin), db: Client = Depends(get_db)):
    """Update a ticket's status."""
    new_status = body.get("status")
    if new_status not in STATUSES:
        raise HTTPException(status_code=400, detail=f"status must be one of {sorted(STATUSES)}")
    result = (
        db.table("tickets")
        .update({"status": new_status, "updated_at": datetime.now(timezone.utc).isoformat()})
        .eq("id", ticket_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return result.data[0]
