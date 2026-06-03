-- Support tickets (2026-06-04). Submit + track + admin manage.
-- Safe to run more than once.

create table if not exists tickets (
    id          bigint generated always as identity primary key,
    reference   text not null unique,
    user_id     bigint references users(id) on delete set null,  -- null for guests; kept if account is deleted
    name        text,
    email       text not null,
    subject     text not null,
    category    text not null default 'General',
    message     text not null,
    status      text not null default 'open',   -- open | in_progress | closed
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

create index if not exists idx_tickets_user on tickets(user_id);
create index if not exists idx_tickets_reference on tickets(reference);
create index if not exists idx_tickets_status on tickets(status);
