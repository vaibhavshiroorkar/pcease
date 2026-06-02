# PCease Social Layer - Design

_2026-06-02_

Adds a social layer on top of PCease: public/private builds, a community feed, public
profiles, likes, private favourites, and following. Also polishes sign-in.

## Decisions (from brainstorming)

- **Scope:** full social layer (builds visibility + feed, public profiles, likes,
  favourites, following) plus sign-in polish.
- **Build visibility:** private by **default**; per-build toggle to publish.
- **Likes vs favourites:** separate. A **like** is a public heart + count on a build.
  A **favourite** is a private bookmark collection, with a per-user profile toggle
  (`favorites_public`) to expose it on the profile.
- **Profile:** add bio + avatar. Avatar is uploaded and stored as a small base64 data
  URL on `users.avatar_url` (client downscales to 256px) so it works in both Supabase
  and local fake-DB mode without extra storage infra. Colored-initial fallback when none.
- **Build model:** extend the existing `builds` table (single source of truth). Public
  builds render live (no snapshot). Legacy anonymous share links stay as-is.

## Schema

- `users`: + `bio` text, `avatar_url` text, `favorites_public` bool default false.
- `builds`: + `is_public` bool default false, `slug` text unique, `likes_count` int default 0.
- `build_likes` (id, user_id, build_id, created_at) unique(user_id, build_id).
- `build_favorites` (id, user_id, build_id, created_at) unique(user_id, build_id).
- `user_follows` (id, follower_id, following_id, created_at) unique(follower_id, following_id).

Migration SQL + matching `fake_db` updates, seeded with demo users and public builds.

## API

- Builds: `PATCH /builds/{id}` (rename + visibility), `GET /builds/{id}` (public or owner;
  includes owner, like_count, liked/favorited by me), `GET /builds/public?sort=recent|popular&scope=all|following&skip&limit`.
- Likes: `POST/DELETE /builds/{id}/like`.
- Favourites: `POST/DELETE /builds/{id}/favorite`, `GET /me/favorites`.
- Follows: `POST/DELETE /users/{username}/follow`.
- Profiles: `GET /users/{username}` (public fields only - never email; public builds, counts,
  is_following, favourites if public or self). Extend `PUT /auth/profile` for `bio`,
  `favorites_public`, `avatar_url`.

## Permissions

View public build = anyone; private = owner only. Edit/delete/visibility = owner. Like/
favourite/follow = any logged-in user (no self-follow). Profiles never expose email; the
favourites list is gated by `favorites_public` or self.

## Frontend

- Routes: `/builds` (Community feed: All / Following / Popular), `/build/:slug` (detail:
  components, total, owner link, like + favourite, Open in Builder), `/u/:username` (public
  profile).
- Nav: add **Community** -> `/builds`.
- Profile page: tabs **My Builds** (visibility toggle) + **Favourites**, bio + avatar edit,
  favorites_public switch.
- Builder: public/private toggle at save (default private).
- Clickable usernames (forum authors, build cards) -> `/u/:username`.
- Sign-in polish: remember-me, inline validation, clearer errors/loading. Password reset
  stays out (no email system).

## Phases

1. Build visibility + slug + detail + community feed + Builder toggle + Profile My Builds.
2. Bio/avatar + public profile + clickable usernames.
3. Likes + favourites + Favourites tab + favorites_public.
4. Following + Following feed tab.
5. Sign-in polish.

## Out of scope

Comments, notifications, password reset/email, user search, build forking.

## Testing

Backend pytest (visibility permissions, like/favourite/follow toggles, profile gating) on
the fake-DB fixture; frontend build green each phase.
