# Support Tickets - Design

_Date: 2026-06-04_

Replace the dummy Contact form with a real, persisted **support ticket** system:
submit + track + admin. Open to guests and logged-in users.

## Data

`tickets` table:
- `id` (pk), `reference` (short human code, e.g. `PCE-A1B2C3`)
- `user_id` (nullable - null for guests)
- `name`, `email` (contact details; for a logged-in user these default to their account)
- `subject`, `category` (General | Bug | Feature | Account | Other), `message`
- `status` (`open` | `in_progress` | `closed`, default `open`)
- `created_at`, `updated_at`

## API (`/api/tickets`)

- `POST /api/tickets` (optional auth): create. Attaches `user_id` if authenticated.
  Returns `{ id, reference, status }`.
- `GET /api/tickets/me` (auth): the caller's tickets, newest first.
- `GET /api/tickets/lookup?reference=&email=`: guest tracking - returns the ticket
  only when reference + email match (so it isn't an open enumeration).
- `GET /api/tickets/admin` (admin): all tickets.
- `PATCH /api/tickets/admin/{id}` (admin): update `status`.

Validation: subject/message/email required; status restricted to the three values.

## Frontend

- **Contact page** becomes "Support": a ticket form (subject, category, name, email
  prefilled when logged in, message). On submit, show the reference + status.
- Logged-in users see **Your tickets** (status badges) below the form.
- Guests get a **Track a ticket** lookup (reference + email).
- **Admin** gets a Tickets tab: list with status dropdown to advance/close.

## Non-goals

- No threaded replies/conversation (separate future step).
- No email notifications.

## Migration

`backend/support_tickets_migration.sql` creates the `tickets` table on Supabase.
The fake DB auto-creates the table; seed adds an empty `tickets: []`.

## Testing

Backend: create as guest + as user, `me` listing, lookup (match + mismatch),
admin list + status update + status validation.
