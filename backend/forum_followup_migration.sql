-- Community follow-up migration (2026-06-03)
-- 1) Reddit-style threaded replies: a reply can point at a parent reply.
-- 2) Account deletion keeps posts but anonymizes the author: is_deleted flag.
--
-- Safe to run more than once (IF NOT EXISTS / IF EXISTS guards).

-- Threaded replies: self-referential parent. Deleting a parent removes its
-- descendants (a deleted account is anonymized, not row-deleted, so this only
-- fires on explicit reply deletion).
alter table if exists forum_replies
    add column if not exists parent_reply_id bigint
    references forum_replies(id) on delete cascade;

create index if not exists idx_forum_replies_parent
    on forum_replies(parent_reply_id);

-- Tombstone flag for anonymized (deleted) accounts. Their threads/replies/builds
-- stay; the app shows the author as [deleted] when this is true.
alter table if exists users
    add column if not exists is_deleted boolean not null default false;
