-- PCease Watchlist migration
-- Run after supabase_migration.sql. Adds a persistent, per-user list of saved
-- components (replaces the old ephemeral "add to compare" selection).
-- Safe to re-run (IF NOT EXISTS guards).

CREATE TABLE IF NOT EXISTS watchlist (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    component_id bigint NOT NULL REFERENCES components (id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, component_id)
);

CREATE INDEX IF NOT EXISTS watchlist_user_idx ON watchlist (user_id, created_at DESC);
