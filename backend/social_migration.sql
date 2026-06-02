-- PCease Social Layer migration
-- Run after supabase_migration.sql. Adds build visibility, profiles, likes,
-- favourites, and following. Safe to re-run (IF NOT EXISTS / IF EXISTS guards).

-- Profiles ------------------------------------------------------------------
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS favorites_public boolean NOT NULL DEFAULT false;

-- Builds --------------------------------------------------------------------
ALTER TABLE builds ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;
ALTER TABLE builds ADD COLUMN IF NOT EXISTS slug text;
ALTER TABLE builds ADD COLUMN IF NOT EXISTS likes_count integer NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX IF NOT EXISTS builds_slug_key ON builds (slug);
CREATE INDEX IF NOT EXISTS builds_public_idx ON builds (is_public, created_at DESC);

-- Likes (public heart) ------------------------------------------------------
CREATE TABLE IF NOT EXISTS build_likes (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    build_id bigint NOT NULL REFERENCES builds (id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, build_id)
);

-- Favourites (private bookmark) ---------------------------------------------
CREATE TABLE IF NOT EXISTS build_favorites (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    build_id bigint NOT NULL REFERENCES builds (id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, build_id)
);

-- Following -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_follows (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    follower_id bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    following_id bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (follower_id, following_id),
    CHECK (follower_id <> following_id)
);
