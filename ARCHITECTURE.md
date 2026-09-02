# bsBB — Architecture Document

This document translates the project specification (CLAUDE.md) and all collected design decisions into a concrete, implementable architecture. It defines directory structure, schema, routing, module boundaries, and phasing. Implementation plans are derived from this document — not from CLAUDE.md directly.

---

## Table of Contents

1. [Stack Decisions — Finalized](#1-stack-decisions--finalized)
2. [Directory Structure](#2-directory-structure)
3. [Database Schema — Full](#3-database-schema--full)
4. [URL & Routing Structure](#4-url--routing-structure)
5. [Permission Model](#5-permission-model)
6. [Authentication Architecture](#6-authentication-architecture)
7. [Content Pipeline](#7-content-pipeline)
8. [Notification System](#8-notification-system)
9. [Session Architecture](#9-session-architecture)
10. [Admin & Moderation Tooling](#10-admin--moderation-tooling)
11. [Setup & First-Run Flow](#11-setup--first-run-flow)
12. [Infrastructure & Deployment](#12-infrastructure--deployment)
13. [Anti-Abuse, Rate Limiting & Spam Prevention](#13-anti-abuse-rate-limiting--spam-prevention)
14. [Implementation Status](#14-implementation-status)

---

## Status — All Phases Complete (1–13) — v1.0 Launch Ready ✅

**See CLAUDE.md for complete feature list. See ROADMAP.md for phase-by-phase breakdown.**

---

## 1. Stack Decisions — Finalized

| Concern | Choice | Notes |
|---|---|---|
| Framework | SvelteKit | `adapter-node` for Docker deployment |
| TypeScript | `strict: true` | Throughout |
| CSS | Tailwind CSS v4 | Utility-first with CSS custom properties for theming |
| Testing | Vitest | Natural SvelteKit fit; unit + integration only in v1 |
| E2E testing | Playwright | Deferred to post-v1 |
| Database | PostgreSQL 17 (latest stable) | |
| ORM | Drizzle | Migration-file workflow throughout (no `drizzle-kit push` in any env) |
| Sessions | Custom (roll-your-own) | 32-byte random token, SHA-256 hashed in DB, Postgres-backed, no external session library. Simple, proven, and secure |
| ATproto auth | `@atproto/oauth-client-node` | Official SDK; handles DPoP/PAR/token refresh |
| Markdown pipeline | `unified` + `remark-parse` + `remark-rehype` + `rehype-sanitize` + `rehype-stringify` | Server-side for sanitization before storage |
| Markdown editor | `markdown-it` + `DOMPurify` | Plain `<textarea>` with live client-side preview on keystroke |
| Client-side markdown | `markdown-it` | Renders preview in real-time; `/api/preview` endpoint available but not used by UI |
| OG/link metadata | `open-graph-scraper` | Server-side at post submit; triggered only for bare URLs on their own line |
| Email | Nodemailer over SMTP | Provider-agnostic via env vars |
| Reverse proxy | Caddy | Automatic TLS; proxies `client-metadata.json` (and everything else) through to the app |
| Containerization | Docker Compose | Production: `app` + `worker` + `db` + `caddy`; Dev: `db` only |

---

## 2. Directory Structure

```
bsBB/
├── src/
│   ├── app.html                          # SvelteKit shell
│   ├── app.d.ts                          # Ambient type declarations (Locals, Session, etc.)
│   ├── hooks.server.ts                   # Rate limiting, session hydration, CSP headers
│   │
│   ├── lib/
│   │   ├── db/
│   │   │   ├── index.ts                  # Single Drizzle pool instance — only import point
│   │   │   ├── schema.ts                 # All table definitions
│   │   │   └── migrations/               # Drizzle-generated SQL migration files
│   │   │
│   │   ├── auth/
│   │   │   ├── atproto.ts                # @atproto/oauth-client-node init + OAuth callback handler
│   │   │   ├── session.ts                # Custom session management (create, validate, invalidate, cookie ops)
│   │   │   ├── user.ts                   # User upsert, first-admin claim, DID resolution
│   │   │   └── profile-sync.ts           # Lazy DID profile re-sync logic
│   │   │
│   │   ├── permissions/
│   │   │   ├── index.ts                  # canRead() + canPost() — permission resolution with parent chain walk
│   │   │   └── index.test.ts             # Permission tests (requires DATABASE_URL)
│   │   │
│   │   ├── markdown/
│   │   │   ├── index.ts                  # renderMarkdown() — unified pipeline: parse → rehype → sanitize → stringify
│   │   │   ├── client.ts                 # renderMarkdownClient() — markdown-it + DOMPurify for live preview
│   │   │   ├── og.ts                     # fetchLinkMetadata() — OG metadata fetch (bare-URL-on-own-line only)
│   │   │   └── slug.ts                   # generateSlug() — Title → URL slug with uniqueness retry
│   │   │
│   │   │   ├── notifications.ts              # writeInboxNotification, enqueueDmNotification, enqueueProfileSync, etc.
│   │   ├── email.ts                      # sendEmail() — Nodemailer wrapper
│   │   │
│   │   ├── abuse/
│   │   │   └── index.ts                  # checkAbuse() — rate limiting via atomic PostgreSQL upserts
│   │   ├── settings.ts                   # getSetting() / getSettings() — instance_settings helpers
│   │   └── utils/
│   │       ├── time.ts                   # formatTime/formatDate/formatAbsoluteTime/formatTimeDisplay
│   │       └── (other utilities)
│   │
│   └── routes/
│       ├── +layout.server.ts             # Global session/user hydration
│       ├── +layout.svelte                # Nav, footer shell
│       │
│       ├── (auth)/
│       │   ├── login/+page.svelte        # Handle input → ATproto OAuth redirect
│       │   ├── callback/+server.ts       # OAuth callback handler
│       │   └── logout/+server.ts         # GET — invalidates session, redirects to /
│       │
│       ├── +page.svelte                  # Forum index — list of top-level forums
│       ├── search/                       # Full-text search
│       ├── notifications/                # In-app notification inbox
│       ├── settings/                     # User settings (notifications, timezone, profile sync)
│       ├── user/[handle]/                # Public user profile
│       ├── user/[handle]/manage-posts/   # User's own post management
│       ├── dev/login/                    # Dev-only bypass login (DEV_AUTH_ENABLED=true only)
│       │
│       ├── f/
│       │   └── [forumSlug]/
│       │       ├── +page.svelte              # Thread list for forum
│       │       ├── new/                      # New thread form (markdown editor + live preview)
│       │       └── t/[threadId]/
│       │           ├── +page.svelte           # Thread view — flat post list + inline reply form
│       │           └── post/[postId]/revisions/  # Post revision history
│       │
│       ├── mod/
│       │   ├── queue/                    # Flagged content queue
│       │   ├── log/                      # Mod action log (read-only)
│       │   └── pii-requests/             # PII removal request queue
│       │
│       ├── admin/
│       │   ├── forums/                   # Create/edit/delete forums, set permissions
│       │   ├── users/                    # Role assignment, ban management
│       │   ├── roles/                    # Custom role management
│       │   ├── posts/                    # Post management
│       │   ├── threads/                  # Thread management
│       │   ├── approval-queue/           # New-account post approval queue
│       │   ├── notifications/            # Notification worker debug log
│       │   ├── query/                    # Direct DB query tool
│       │   ├── mod-log/                  # Mod log (alias for /mod/log)
│       │   └── settings/                 # Instance-level settings
│       │
│       ├── banned/                       # Ban page shown to banned users
│       ├── client-metadata.json/         # Dynamic ATproto client metadata (dev and prod)
│       └── api/preview/                  # POST: render markdown server-side for editor
│
├── scripts/
│   ├── setup.sh                          # First-run setup (keypair, .env)
│   ├── migrate.sh                        # Wrapper: runs drizzle-kit migrate inside WSL/container
│   ├── dev.sh                            # Start DB + migrate + seed + dev server
│   ├── seed.ts / seed-dev-users.ts       # DB seeding scripts
│   ├── docker-rebuild.sh                 # Build before stopping to minimize downtime
│   ├── docker-restart.sh / docker-stop.sh
│   ├── start-prod.sh                     # Start production compose stack
│   ├── gen-keypair.js                    # Generate P-256 JWK keypair
│   ├── test-integration.sh               # Run tests requiring DATABASE_URL
│   └── verify-tests.sh                   # Verification checklist (type, build, tests, routes)
│
├── docker/
│   ├── docker-compose.yml                # Dev compose (DB only)
│   └── Caddyfile                         # Dev Caddy config
│
├── Dockerfile.prod                       # Multi-stage production image
├── docker-compose.prod.yml               # Production compose (app + worker + db + caddy)
├── Caddyfile.prod                        # Production Caddy config
├── drizzle.config.ts
├── svelte.config.js
├── vite.config.ts
├── tsconfig.json
├── .env.example
└── logs/                                 # gitignored; dev log output
```

---

## 3. Database Schema — Full

All changes from the logical schema in CLAUDE.md incorporated.

### `users`

```sql
did                     TEXT PRIMARY KEY          -- ATproto DID, permanent
handle                  TEXT NOT NULL             -- cached, mutable
display_name            TEXT
avatar_url              TEXT
last_profile_sync       TIMESTAMPTZ NOT NULL
global_role             TEXT NOT NULL DEFAULT 'member'
                        -- enum: 'admin' | 'moderator' | 'member' | 'banned'
                        -- 'moderator' here = global moderator (access to all mod tools + admin panel)
                        -- per-forum moderators are in user_forum_roles
notify_via_bluesky      BOOLEAN NOT NULL DEFAULT false
notification_type       TEXT NOT NULL DEFAULT 'both'      -- 'replies' | 'quotes' | 'both'
notification_frequency  TEXT NOT NULL DEFAULT 'immediate' -- 'immediate' | 'hourly' | 'daily'
timezone                TEXT NOT NULL DEFAULT 'America/New_York'  -- IANA identifier
created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
```

> `global_role` values: `admin` (full access), `moderator` (global mod — access to all mod tools and admin panel), `member` (default), `banned` (denied everywhere). Per-forum moderator assignments additionally live in `user_forum_roles`.

### `forums`

```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
parent_id   UUID REFERENCES forums(id)            -- null = top-level
name        TEXT NOT NULL
description TEXT NOT NULL DEFAULT ''
slug        TEXT NOT NULL UNIQUE
sort_order            INTEGER NOT NULL DEFAULT 0
require_approval_days INTEGER NOT NULL DEFAULT 0  -- 0 = disabled; N = require approval for accounts < N days old
created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
```

### `threads`

```sql
id           UUID PRIMARY KEY DEFAULT gen_random_uuid()
forum_id     UUID NOT NULL REFERENCES forums(id)
author_did   TEXT NOT NULL REFERENCES users(did)
title        TEXT NOT NULL
slug         TEXT NOT NULL                        -- generated from title at creation
is_locked    BOOLEAN NOT NULL DEFAULT false
is_pinned    BOOLEAN NOT NULL DEFAULT false
created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
last_post_at TIMESTAMPTZ NOT NULL DEFAULT now()  -- updated on each new post

UNIQUE(forum_id, slug)                           -- slugs are unique per forum, not globally
```

### `posts`

```sql
id               UUID PRIMARY KEY DEFAULT gen_random_uuid()
thread_id        UUID NOT NULL REFERENCES threads(id)
author_did       TEXT NOT NULL REFERENCES users(did)
body_markdown    TEXT NOT NULL
body_html        TEXT NOT NULL                   -- sanitized; generated server-side at submit
reply_to_post_id UUID REFERENCES posts(id)      -- flat model; for quote links only
link_metadata    JSONB                           -- OG data for first bare URL, or null
status           TEXT NOT NULL DEFAULT 'active'  -- 'active' | 'hidden' | 'archived' | 'deleted'
is_deleted       BOOLEAN NOT NULL DEFAULT false  -- DEPRECATED: use status column instead
is_approved      BOOLEAN NOT NULL DEFAULT true   -- false for posts requiring mod approval
rejection_reason TEXT                            -- set by moderator on reject; triggers DM to author
created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
edited_at        TIMESTAMPTZ                     -- null if never edited

-- Full-text search index
body_tsv  TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', body_markdown)) STORED
```

```sql
CREATE INDEX posts_body_tsv_idx ON posts USING GIN (body_tsv);
```

> **Status values:**
> - `'active'` — post is visible (default)
> - `'hidden'` — post hidden by author or moderator (marked with "[post hidden by author]" or "[post hidden by moderator]")
> - `'archived'` — post archived (not visible in listings, but accessible directly)
> - `'deleted'` — post content permanently deleted (stub remains for quote integrity)

### `post_revisions`

```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
post_id         UUID NOT NULL REFERENCES posts(id)
revision_number INTEGER NOT NULL
body_markdown   TEXT NOT NULL                   -- full snapshot
body_html       TEXT NOT NULL                   -- full snapshot, sanitized
edited_by_did   TEXT NOT NULL REFERENCES users(did)
created_at      TIMESTAMPTZ NOT NULL DEFAULT now()

UNIQUE(post_id, revision_number)
```

> Revisions are append-only. The current version lives in `posts`. Revision 1 is the
> original body captured at the moment of first edit. Accessible at `/f/.../t/.../post-id/revisions`.

### `forum_permissions`

```sql
id           UUID PRIMARY KEY DEFAULT gen_random_uuid()
forum_id     UUID NOT NULL REFERENCES forums(id)
role         TEXT NOT NULL
             -- 'guest' | 'member' | 'moderator' | 'admin'
             -- 'guest' = unauthenticated visitors
can_read     BOOLEAN NOT NULL DEFAULT false
can_post     BOOLEAN NOT NULL DEFAULT false
can_moderate BOOLEAN NOT NULL DEFAULT false

UNIQUE(forum_id, role)
```

> Inheritance: if no explicit row exists for a child forum, inherit from parent, walking
> up until a row is found or the top-level default applies.
>
> **Default visibility** is an instance-level setting stored in `instance_settings`:
> - `public`: guest `can_read = true` for forums with no explicit row
> - `members-only`: guest `can_read = false`, member `can_read = true` for forums with no explicit row

### `user_forum_roles`

```sql
user_did    TEXT NOT NULL REFERENCES users(did)
forum_id    UUID NOT NULL REFERENCES forums(id)
role        TEXT NOT NULL
            -- currently: 'moderator' (only per-forum role below admin)
assigned_by TEXT NOT NULL REFERENCES users(did)
assigned_at TIMESTAMPTZ NOT NULL DEFAULT now()

PRIMARY KEY (user_did, forum_id)
```

> Global `admin`, `moderator`, and `banned` on `users.global_role` always take precedence over this table.
> Permission resolution order: banned → admin/moderator (global) → user_forum_roles → forum_permissions by role.

### `roles` (Admin-defined custom roles)

```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
name        TEXT NOT NULL UNIQUE
description TEXT                                 -- optional role description
color       TEXT                                 -- optional hex color (e.g. '#e11d48')
created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
```

> Admins can create custom roles (e.g., "Moderator", "Contributor", "VIP") and assign them globally to users.
> Role badges are displayed on user profiles and in forum threads using the color if provided.

### `user_roles` (Global custom role assignments)

```sql
user_did    TEXT NOT NULL REFERENCES users(did)
role_id     UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE
assigned_by TEXT NOT NULL REFERENCES users(did)
assigned_at TIMESTAMPTZ NOT NULL DEFAULT now()

PRIMARY KEY (user_did, role_id)
```

> Many-to-many relationship: users can have multiple global custom roles.
> Distinguished from per-forum moderator assignments (`user_forum_roles`).

### `notification_queue`

```sql
id             UUID PRIMARY KEY DEFAULT gen_random_uuid()
recipient_did  TEXT NOT NULL REFERENCES users(did)
type           TEXT NOT NULL
               -- 'reply_to_thread' | 'quote' | 'new_reply_in_thread' | 'mod_action'
payload        JSONB NOT NULL
status         TEXT NOT NULL DEFAULT 'pending'
               -- 'pending' | 'sent' | 'failed'
created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
sent_at        TIMESTAMPTZ
error          TEXT                          -- last error message if status = 'failed'
retry_count    INTEGER NOT NULL DEFAULT 0
```

### `worker_log`

```sql
id         UUID PRIMARY KEY DEFAULT gen_random_uuid()
level      TEXT NOT NULL                      -- 'info' | 'warn' | 'error'
message    TEXT NOT NULL
context    JSONB
created_at TIMESTAMPTZ NOT NULL DEFAULT now()
```

> Persisted log for notification worker activity. Exposed in `/admin/notifications` for debugging delivery failures.

### `user_notifications`

```sql
id            UUID PRIMARY KEY DEFAULT gen_random_uuid()
recipient_did TEXT NOT NULL REFERENCES users(did) ON DELETE CASCADE
type          TEXT NOT NULL
              -- 'reply' | 'quote' | 'new_reply_in_thread' | 'post_rejected'
payload       JSONB NOT NULL
is_read       BOOLEAN NOT NULL DEFAULT false
created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
```

> Always written on qualifying events, independent of Bluesky DM opt-in. Powers the in-app notification inbox. Recipients see notifications even without a Bluesky account connected.

### `mod_log`

```sql
id               UUID PRIMARY KEY DEFAULT gen_random_uuid()
moderator_did    TEXT NOT NULL REFERENCES users(did)
action           TEXT NOT NULL
                 -- Thread ops: 'lock_thread' | 'unlock_thread' | 'pin_thread' | 'unpin_thread'
                 -- Post ops: 'hide_post' | 'hide_own_post' | 'delete_post' | 'delete_own_post' | 'restore_post' | 'permanently_delete_post' | 'pii_wipe_post' | 'dismiss_pii_request'
                 -- User ops: 'ban' | 'unban' | 'promote_admin' | 'demote_admin' | 'delete_account' | 'delete_all_posts'
                 -- Role ops: 'create_role' | 'edit_role' | 'delete_role' | 'assign_custom_role' | 'remove_custom_role'
                 -- Forum ops: 'reorder_forum' | 'assign_forum_mod' | 'remove_forum_mod' | 'update_forum_permission'
target_did       TEXT REFERENCES users(did)
target_post_id   UUID REFERENCES posts(id)
target_thread_id UUID REFERENCES threads(id)
target_forum_id  UUID REFERENCES forums(id)
reason           TEXT                            -- optional reason/context (role name, etc)
created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
```

> Append-only audit trail. No update or delete routes exist anywhere in the codebase.
> Distinguishes user-initiated actions (hide_own_post, delete_own_post) from moderator actions (hide_post, delete_post).

### `sessions` (Custom roll-your-own)

```sql
id         TEXT PRIMARY KEY
user_did   TEXT NOT NULL REFERENCES users(did)
expires_at TIMESTAMPTZ NOT NULL
```

### `instance_settings`

```sql
key    TEXT PRIMARY KEY
value  TEXT NOT NULL
```

> Seed rows at setup:
> - `default_forum_visibility` = `'public'` or `'members-only'` (deployer chooses during setup)
> - `setup_complete` = `'true'`
> - `first_admin_claimed` = `'false'` → set to `'true'` after first login promotes admin
> - `og_fetch_enabled` = `'true'`
> - `new_account_cooldown_hours` = `'24'`
> - Rate limit thresholds (all tunable by admin): `rl_post_submit_per_min`, `rl_post_submit_per_hour`, `rl_thread_create_per_10min`, `rl_thread_create_per_hour`, `rl_login_attempt_per_10min`, `rl_preview_per_min`, `rl_flag_per_10min`

### `pii_removal_requests`

```sql
id               UUID PRIMARY KEY DEFAULT gen_random_uuid()
post_id          UUID NOT NULL REFERENCES posts(id)
requester_did    TEXT NOT NULL REFERENCES users(did)
reason           TEXT NOT NULL                        -- requester's description of the PII
status           TEXT NOT NULL DEFAULT 'pending'      -- 'pending' | 'wiped' | 'dismissed'
resolved_by_did  TEXT REFERENCES users(did)
resolved_at      TIMESTAMPTZ
dismiss_reason   TEXT                                 -- set when status = 'dismissed'
created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
```

> Never expires from the queue — pending requests remain until a moderator or admin acts on them.
> Indexes on `post_id` and `status` for fast pending-request lookups.

### `rate_limit_buckets`

```sql
key          TEXT PRIMARY KEY    -- "{context_type}:{scope_type}:{identifier}"
                                 -- e.g. "post_submit:did:did:plc:xxxx"
                                 --      "login_attempt:ip:1.2.3.4"
count        INTEGER NOT NULL DEFAULT 0
window_start TIMESTAMPTZ NOT NULL DEFAULT now()
```

> Fixed-window counters. Expired rows purged by the notification worker loop.
> Used exclusively by `src/lib/abuse/index.ts` — no other module touches this table.

---

## 4. URL & Routing Structure

```
/                                      Forum index (top-level forum list)
/f/[forumSlug]/                        Thread list for forum (paginated)
/f/[forumSlug]/page/[n]/               Thread list page n
/f/[forumSlug]/new/                    New thread form (auth required)
/f/[forumSlug]/t/[threadId]/           Thread view, page 1 (canonical)
/f/[forumSlug]/t/[threadId]/[slug]/    Cosmetic redirect → canonical (301)
/f/[forumSlug]/t/[threadId]/page/[n]/  Thread view, page n (25 posts/page)

/f/[forumSlug]/t/[threadId]/post/[postId]/revisions/   Post revision history (public)

/search/                               Full-text search across posts
/notifications/                        In-app notification inbox (auth required)
/settings/                             User settings: notifications, timezone, profile sync (auth required)
/user/[handle]/                        Public user profile
/user/[handle]/manage-posts/           User's own post management (auth required)

/mod/queue/                            Flagged content (moderator+ required)
/mod/log/                              Mod action log (moderator+ required) — also at /admin/mod-log
/mod/pii-requests/                     PII removal request queue (mods + admins)

/admin/forums/                         Forum management (admin required)
/admin/users/                          User/role management (admin required)
/admin/roles/                          Custom role management (admin required)
/admin/posts/                          Post management (admin required)
/admin/threads/                        Thread management (admin required)
/admin/approval-queue/                 New-account post approval queue (admin required)
/admin/notifications/                  Notification worker debug log (admin required)
/admin/query/                          Direct DB query tool (admin required)
/admin/settings/                       Instance settings (admin required)

/login/                                ATproto OAuth initiation
/callback/                             OAuth callback (handled server-side)
/logout/                               GET — invalidates session and redirects
/banned/                               Ban page (shown to banned users)
/dev/login/                            Dev-only login (requires DEV_AUTH_ENABLED=true)

/api/preview/                          POST: server-side markdown render for editor
/client-metadata.json                  SvelteKit dynamic route (dev and prod); Caddy proxies through to the app
```

**Thread URL rules:**
- `[threadId]` is the UUID (first 8 chars displayed, full UUID used internally).
- `[slug]` is cosmetic only — the router uses only `threadId`. If slug is wrong/missing, redirect 301 to canonical URL with correct slug. This keeps URLs human-readable but ensures links never break if a title is edited.
- Pagination is in the path (`/page/2`) not query string, for clean indexing.

---

## 5. Permission Model

### Resolution Order (highest precedence first)

1. `users.global_role = 'banned'` → deny everything, redirect to `/banned/`
2. `users.global_role = 'admin'` → allow everything
3. `user_forum_roles` row exists for `(user_did, forum_id)` → apply that role's permissions
4. `forum_permissions` row exists for `(forum_id, user's effective role)` → apply it
5. Walk up `forums.parent_id` chain, repeat steps 3–4
6. Apply instance default (`instance_settings.default_forum_visibility`)

### Permission Levels for Forum Visibility

Each forum can have explicit `forum_permissions` rows for these roles:

| Role key | Who it applies to |
|---|---|
| `guest` | Unauthenticated visitors |
| `member` | Any authenticated user with no forum-specific role |
| `moderator` | Users with a `user_forum_roles` row for this forum |
| `admin` | Global admins (mostly covered by rule 2 above) |

This allows patterns like:
- Public forum: `guest can_read=true, member can_read=true, member can_post=true`
- Members-only forum: `guest can_read=false, member can_read=true, member can_post=true`
- Mod-only forum: `guest can_read=false, member can_read=false, moderator can_read=true`
- Admin-only forum: only admins can read (via global_role rule)

### Implementation Location

All permission resolution lives in `src/lib/permissions/index.ts`. Both `canRead` and `canPost` functions:
- Async (DB queries needed for parent chain walk)
- Take: `db`, `forumId`, `user` (SessionUser | null)
- Return: `boolean`
- Walk parent forum chain looking for explicit `forum_permissions` rows
- Fall back to instance default (`default_forum_visibility`)
- Admin always allowed, banned always denied, guest cannot post (ever)

```typescript
// src/lib/permissions/index.ts
export async function canRead(db, forumId: string, user: SessionUser | null): Promise<boolean>
export async function canPost(db, forumId: string, user: SessionUser | null): Promise<boolean>

// Both internally use:
async function getParentChain(db, forumId: string): Promise<string[]>
```

Queries flow:
- Load user's per-forum role from `user_forum_roles` (if authenticated)
- Walk `forums.parent_id` chain up to root
- For each forum, check `forum_permissions` row for effective role
- If no explicit row: check parent (inherit)
- If no matches anywhere: use instance default from `instance_settings`

---

## 6. Authentication Architecture

### ATproto OAuth Flow

1. User submits their handle on `/login/`
2. Server resolves handle → DID via PLC Directory, discovers PDS authorization server
3. `@atproto/oauth-client-node` initiates PAR + DPoP flow, redirects user to their PDS
4. User authorizes; PDS redirects to `/callback/`
5. SDK completes token exchange; DID extracted from `sub` field (cryptographically verified)
6. Custom session created: 32-byte random token → SHA-256 hash stored in DB, raw token in cookie (`SameSite=Lax`, `HttpOnly`, `Secure`) — Lax is required so the OAuth redirect back from the user's PDS carries the cookie
   - Implementation: `src/lib/auth/session.ts` — `createSession()`
   - Cookie TTL: 30 days rolling; refreshed if < 15 days remain
   - Probabilistic cleanup: 1% of requests fire async DELETE of expired sessions (no separate cron job)
7. `users` row upserted: create on first login, update `handle`/`display_name`/`avatar_url`/`last_profile_sync` on every login
8. If `instance_settings.first_admin_claimed = 'false'`: promote this user to `global_role = 'admin'`, set `first_admin_claimed = 'true'`, write `mod_log` entry. Show one-time notice.
   - Implementation: `src/lib/auth/user.ts` — `claimFirstAdmin()`

### DM Notifications Opt-In

- User navigates to `/settings/`, enables "Notify me via Bluesky DM"
- No additional OAuth scope is requested — DMs are sent by the forum service account using its App Password, not the user's own tokens
- Setting stored in `users.notify_via_bluesky` (boolean)

### Lazy Profile Sync

- On every post submission, check `users.last_profile_sync`
- If > 24 hours: enqueue a background task (simple async fire-and-forget inside the server action, not a queue) to re-fetch profile from PLC Directory and update `handle`/`display_name`/`avatar_url`
- Post submission is never blocked by sync

### Session Hydration

`hooks.server.ts` validates the custom session on every request and populates `locals.user` with:
```typescript
{
  did: string,
  handle: string,
  displayName: string | null,
  avatarUrl: string | null,
  globalRole: 'admin' | 'moderator' | 'member' | 'banned'
}
```
If `globalRole === 'banned'`: redirect to `/banned/` immediately (except `/banned/` itself and `/logout/`).

---

## 7. Content Pipeline

### Post/Thread Submission Flow

1. Server action receives `body_markdown` from form
2. Validate: title (1-300 chars) + body (1-50,000 chars)
3. Run abuse check: `checkAbuse({ type: 'thread_create' | 'post_submit', ... })`
4. Render markdown pipeline → `body_html`:
   ```
   body_markdown
     → remark-parse (parse to mdast)
     → remark-rehype (convert to hast)
     → rehype-sanitize (strip disallowed tags/attrs)
     → rehype-stringify (serialize to HTML string)
   ```
   Implementation: `src/lib/markdown/index.ts` — `renderMarkdown()`
5. Scan `body_markdown` for bare URLs (first line matching `/^https?:\/\/\S+$/`):
   - If found: fetch OG metadata via `open-graph-scraper` (timeout: 5s)
   - Store in `link_metadata` JSONB, or `null` on any error/timeout (never blocks submission)
   - Implementation: `src/lib/markdown/og.ts` — `fetchLinkMetadata()`
6. **For new threads only:**
   - Generate slug from title: `src/lib/markdown/slug.ts` — `generateSlug()`
   - Retry with numeric suffix on uniqueness conflict (max 5 retries)
7. DB transaction (atomic):
   - For threads: `INSERT threads`, then `INSERT posts` (first post), then `UPDATE threads.last_post_at`
   - For replies: `INSERT posts`, then `UPDATE threads.last_post_at`
8. Enqueue notification records to `notification_queue`
9. Trigger lazy profile sync if needed (async, non-blocking)

### New Thread Form

Route: `POST /f/[forumSlug]/new`
- Displays form with title input + markdown body textarea
- Preview toggle: POSTs to `POST /api/preview/`, renders server-side HTML in read-only div
- On submit: validates, generates slug, creates thread + first post atomically
- On error: returns form data + error message for repopulation
- Post-creation: 303 redirect to `/f/[forumSlug]/t/[threadId]`

### Reply Form

Route: `POST /f/[forumSlug]/t/[threadId]?/reply`
- Inline form on thread detail page
- Quote button per post: sets hidden `replyToPostId` field
- On submit: validates body, creates post, updates `threads.last_post_at`
- Disabled if thread is locked or user lacks permission
- Same validation + markdown + OG pipeline as new threads

### Editor Preview Endpoint

Route: `POST /api/preview/`
- Input: FormData with `body` (markdown text)
- Output: JSON with `{ html: "..." }`
- Runs same markdown pipeline as post submission
- No authentication required (safe to preview)
- Not used by the UI (live preview uses `renderMarkdownClient` on the client); available for external tooling

### OG Link Detection Rule

```
Bare URL = first line in markdown matching: /^https?:\/\/\S+$/
```

Only one URL per post. If inside code block or inline in a sentence, not detected (by design — prevents noise from example URLs in prose). Errors are silent (5s timeout, network failure, malformed response) — never blocks post submission.

---

## 8. Notification System

### Worker

`worker/worker.py` — Python 3.12 process running as its own Docker container (`worker/Dockerfile`). Not embedded in the web tier. Dependencies: `psycopg[binary]` (PostgreSQL), `httpx` (HTTP); everything else is Python stdlib.

Worker loop (every 60 seconds):
1. Query `notification_queue WHERE status = 'pending' ORDER BY created_at LIMIT 10` with `FOR UPDATE SKIP LOCKED`
2. For each: check per-recipient frequency window (immediate=10m, hourly=1h, daily=24h)
3. Dispatch by type: `dm_notification` → Bluesky DM via App Password; `moderator_alert` → SMTP email; `welcome_dm` → Bluesky DM; `profile_sync` → ATproto public API → update `users`
4. Mark `sent` or `failed` with `sent_at` and `error`; increment `retry_count` on failure
5. Write warn/error entries to `worker_log` table (accessible at `/admin/notifications`)

Periodic tasks also run in the same loop: auto-approve stale posts every 10 minutes; delete expired sessions every hour.

> **Schema dependency** — `worker/worker.py` queries these tables directly with raw SQL (no ORM). If any of the following tables or columns change, check `worker/worker.py` for required updates:
>
> | Table | Columns used |
> |---|---|
> | `notification_queue` | `id`, `recipient_did`, `type`, `payload`, `status`, `created_at`, `sent_at`, `error`, `retry_count` |
> | `users` | `did`, `handle`, `notify_via_bluesky`, `notification_type`, `notification_frequency`, `display_name`, `avatar_url`, `last_profile_sync` |
> | `posts` | `id`, `thread_id`, `is_approved`, `status`, `created_at` |
> | `threads` | `id`, `last_post_at` |
> | `mod_log` | `moderator_did`, `action`, `target_post_id`, `reason` |
> | `sessions` | `id`, `expires_at` |
> | `worker_log` | `level`, `message`, `context`, `created_at` |
> | `instance_settings` | `key`, `value` |

### Email (admin/mod alerts only)

`src/lib/email.ts` exports exactly one function:
```typescript
export async function sendEmail(to: string, subject: string, body: string): Promise<void>
```
All SMTP config from env vars. Application code never references a provider name.

---

## 9. Session Architecture

Custom session implementation with no external session library. Session storage: `sessions` table in PostgreSQL (see schema above).

### Token Design

- Session token = 32 random bytes (via `crypto.getRandomValues`) encoded as hex — this is the cookie value
- Stored token = SHA-256 hash of the raw token — only the hash goes in the DB, never the raw token
- Verification: hash the cookie value, compare to stored hash in `sessions` table
- This means a DB breach does not expose valid session tokens (same principle as password hashing)

### Session Lifecycle

- **Create:** generate token → hash → insert `sessions` row with `expires_at = now() + 30 days` → set cookie
- **Validate (every request):** read cookie → hash → look up in `sessions` → if found and not expired, extend by 30 days if < 15 days remaining → populate `locals.user` and `locals.session`
- **Invalidate (logout):** delete `sessions` row → clear cookie
- Cookie attributes: `SameSite=Lax`, `HttpOnly`, `Secure` (in production) — Lax allows the OAuth redirect from the PDS to complete

### Implementation Location

`src/lib/auth/session.ts` — exports `createSession`, `validateSession`, `invalidateSession`, `setSessionCookie`, `deleteSessionCookie`.

`hooks.server.ts` calls `validateSession` on every request and populates `locals`.

- No Redis; all session state in Postgres
- No external session library

---

## 10. Admin & Moderation Tooling

### Moderation Queue

`/mod/queue/` — accessible to forum moderators (for their forums) and all admins.

Flagging flow:
1. Any authenticated user can flag a post
2. Flag creates a `notification_queue` entry of type `mod_alert` to all moderators of that forum + all global admins
3. Queue shows flagged posts; mods can: delete post, dismiss flag, ban user

### PII Removal Queue

`/mod/pii-requests/` — accessible to forum moderators (any forum) and global admins. Never auto-expires.

PII removal flow:
1. Any authenticated user clicks "Report PII" on any post and submits a reason
2. A `pii_removal_requests` row is created with `status = 'pending'`
3. Only one pending request per post is allowed — duplicates are rejected
4. Moderators see the request in `/mod/pii-requests` with a preview of the post content
5. **PII Wipe**: deletes all `post_revisions` rows, clears `body_markdown`/`body_html`/`link_metadata`, sets `status = 'deleted'` on the post, marks request `wiped`, logs `pii_wipe_post` to `mod_log`
6. **Dismiss**: marks request `dismissed` with a required reason, logs `dismiss_pii_request` to `mod_log`

The post stub (id, author_did, thread_id, timestamps) is preserved so quotes and links remain intact. Only content and edit history are erased.

The admin "Permanently Delete" action on `/admin/posts` also purges revision history (same wipe behaviour, no request required).

### Mod Log

`/mod/log/` — read-only, append-only. Accessible to moderators and admins.
`mod_log` table has no delete route anywhere in the codebase. Ever.

### Breakglass Admin Promotion

`scripts/admin-promote.sh` — runs via `docker exec` on the server. Requires SSH access to the host machine (that is the safeguard — no web UI, no token, no endpoint).

```bash
# Usage (from host, SSH'd into server):
docker exec forum-app node scripts/admin-promote.js --did did:plc:xxxx
# or by handle (resolves to DID first):
docker exec forum-app node scripts/admin-promote.js --handle user.bsky.social
```

The script:
1. Resolves DID if handle given
2. Verifies user exists in DB
3. Sets `users.global_role = 'admin'`
4. Writes a `mod_log` entry with `action = 'promote_admin'` and `reason = 'breakglass'`
5. Prints confirmation including the DID and timestamp
6. Cannot be triggered via any HTTP endpoint

---

## 11. Setup & First-Run Flow

### `scripts/setup.sh`

Bash for the critical early steps (no Node runtime needed yet):

1. Check prerequisites: `node`, `docker`, `openssl` available
2. Generate P-256 JWK keypair via Node one-liner:
   ```bash
   node -e "require('./scripts/gen-keypair.js')"
   ```
   (`gen-keypair.js` is a small Node script called by the shell script — clean separation)
3. Prompt for `PUBLIC_BASE_URL` (e.g. `https://yourforum.com`)
4. Write `ATPROTO_CLIENT_ID` / `ATPROTO_PUBLIC_KEY` to `.env` — `client-metadata.json` (public key + redirect URIs + scopes) is rendered dynamically from these at request time, not generated as a file
5. Prompt for `ATPROTO_SERVICE_HANDLE` + `ATPROTO_SERVICE_APP_PASSWORD`; validate via test API call
6. Prompt for SMTP credentials; send test email
7. Prompt: default forum visibility — `public` or `members-only`
8. Write `.env` (never overwrites existing — prompts to confirm)
9. Write `SETUP_COMPLETE=true` to `.env`
10. All output also written to `logs/setup.log`

### First Admin

- `instance_settings.first_admin_claimed` starts as `'false'`
- On the first successful OAuth login after setup: promote to admin, set `'true'`, show one-time banner: *"You are the first user to log in. Your account has been promoted to admin. This can only happen once."*
- After `first_admin_claimed = 'true'`: this code path is permanently inert
- Breakglass path documented in README for recovery

### Database Seeding at Setup

After first `docker compose up`:
- `migrate.sh` runs Drizzle migrations
- Seed script creates:
  - `instance_settings` rows (default_forum_visibility, setup_complete, first_admin_claimed)
  - One forum: `{ name: 'General', slug: 'general', description: 'General discussion' }`

---

## 12. Infrastructure & Deployment

### Docker Compose Services

**Stateless, horizontally-scalable architecture:**

```
app    — SvelteKit Node container (×N); internal network only; PORT=3000
         Stateless: config from env vars only, no local files
         Serves web requests + OAuth callbacks + /client-metadata.json (dynamic)
         
worker — Python 3.12 process; internal network only; runs worker/worker.py
         Executes background tasks via PostgreSQL FOR UPDATE SKIP LOCKED
         Scales independently of web tier; no shared state
         
db     — postgres:17; named volume forum_data; internal network only
         Central state store; notification_queue uses row locking for safe concurrent access
         
caddy  — ports 80/443; reverse proxies everything, including /client-metadata.json, to app:3000
```

### Caddy Config (key excerpts)

```
yourforum.com {
  # client-metadata.json is now dynamic — route to the web app
  reverse_proxy /client-metadata.json app:3000
  
  # All other requests
  reverse_proxy app:3000
  
  header {
    Content-Security-Policy "default-src 'self'; ..."
    X-Frame-Options "SAMEORIGIN"
    X-Content-Type-Options "nosniff"
  }
}
```

### Dev Environment

- **Host:** Windows 11
- **All dev commands:** run inside WSL2 (never PowerShell)
- **Project files:** live inside WSL filesystem (`~/projects/bsBB`), not on `/mnt/e/`
- **Editor:** VS Code with Remote - WSL extension
- **Dev server:** `wsl -- npm run dev 2>&1 | tee logs/dev.log`
- **Docker:** Docker Desktop with WSL2 backend; all `docker compose` commands run from WSL

---

## 13. Anti-Abuse, Rate Limiting & Spam Prevention

This section describes the architecture for abuse prevention. All rate-limit and anti-spam checks go through a single module, allowing the implementation to evolve without touching call sites.

### Design Principle

All rate-limit and abuse checks go through a single module: `src/lib/abuse/index.ts`.
No inline checks anywhere else. Callers ask the module; the module decides.
This means the implementation can evolve (in-memory → DB-backed → Redis) without touching call sites.

### Module Interface

```typescript
// src/lib/abuse/index.ts

export type AbuseContext =
  | { type: 'post_submit';    did: string;  ip: string }
  | { type: 'thread_create';  did: string;  ip: string }
  | { type: 'login_attempt';  ip: string }
  | { type: 'preview_request'; did: string | null; ip: string }
  | { type: 'flag_submit';    did: string;  ip: string }
  | { type: 'og_fetch';       ip: string }

export type AbuseVerdict =
  | { allowed: true }
  | { allowed: false; reason: string; retryAfterSeconds?: number }

// The one function all call sites use:
export async function checkAbuse(ctx: AbuseContext): Promise<AbuseVerdict>
```

Call sites are written once and never change. The implementation is in `src/lib/abuse/index.ts` using atomic PostgreSQL upserts.

### Call Sites

| Location | Context type | Notes |
|---|---|---|
| `hooks.server.ts` | `login_attempt` | Pre-auth; IP only |
| `hooks.server.ts` | `post_submit` | Post-auth; DID + IP |
| `routes/.../new/+page.server.ts` | `thread_create` | Stricter limit than replies |
| `routes/.../+page.server.ts` (reply) | `post_submit` | Same as above |
| `routes/api/preview/+server.ts` | `preview_request` | Prevent pipeline abuse |
| `routes/.../flag/+server.ts` | `flag_submit` | Prevent flag spam |
| `src/lib/og/index.ts` | `og_fetch` | Prevent SSRF/fetch abuse |

### Rate Limit Tiers

| Context | Limit | Window | Scope |
|---|---|---|---|
| `login_attempt` | 10 attempts | 10 min | Per IP |
| `post_submit` | 10 posts | 1 min | Per DID |
| `post_submit` | 60 posts | 1 hour | Per DID |
| `thread_create` | 3 threads | 10 min | Per DID |
| `thread_create` | 10 threads | 1 hour | Per DID |
| `preview_request` | 10 requests | 1 min | Per session/IP |
| `flag_submit` | 5 flags | 10 min | Per DID |
| `og_fetch` | 20 fetches | 1 min | Per IP |

Limits are stored in `instance_settings` so admins can tune them without redeploying.

### Storage Backend

**Current Implementation:** PostgreSQL-backed using a `rate_limit_buckets` table with **atomic upserts**:

```sql
CREATE TABLE rate_limit_buckets (
  key           TEXT NOT NULL,
  count         INTEGER NOT NULL DEFAULT 0,
  window_start  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (key)
);

-- Atomic increment (no race conditions in multi-instance web tier):
INSERT INTO rate_limit_buckets (key, count, window_start)
VALUES ($key, 1, NOW())
ON CONFLICT (key) 
DO UPDATE SET count = rate_limit_buckets.count + 1;
```

This `INSERT ... ON CONFLICT` pattern is safe for concurrent requests across multiple web instances. No separate read-then-write logic.

Expired rows cleaned up by a periodic `DELETE WHERE window_start < now() - interval '1 hour'` in the worker process.

The abstraction allows swapping the backend to Redis or in-memory cache without changing call sites — only `src/lib/abuse/index.ts` implementation would change.

### Additional Spam Vectors & Mitigations

**New account flooding**
- Track `users.created_at`; apply stricter `thread_create` limits to accounts < 24h old
- Configurable in `instance_settings` (`new_account_cooldown_hours`)
- Stub: `AbuseContext` includes optional `accountAgeHours` field; stub ignores it

**Content-level spam detection (deferred, v2)**
- Repeated identical posts: hash `body_markdown`, check last N posts by same DID
- URL density: flag posts where >50% of lines are bare URLs
- These checks belong in `checkAbuse` under a new context type `post_content`
- Schema already supports it: no changes needed

**SSRF via OG fetch**
- `src/lib/og/index.ts` rejects requests to RFC 1918 private address ranges and loopback before fetching
- `isPrivateAddress(url)` guard prevents SSRF attacks

**ATproto identity abuse**
- DIDs are verified cryptographically by `@atproto/oauth-client-node` — cannot be spoofed
- Handle changes are benign (DID is the key); profile sync updates the cache
- No additional mitigation needed

### `rate_limit_buckets` Schema

In `src/lib/db/schema.ts`:

```typescript
export const rateLimitBuckets = pgTable('rate_limit_buckets', {
  key:         text('key').primaryKey(),
  count:       integer('count').notNull().default(0),
  windowStart: timestamp('window_start', { withTimezone: true }).notNull().defaultNow(),
});
```

### Directory

```
src/lib/abuse/
└── index.ts    # checkAbuse() — rate limiting implementation
```

---

## 14. Implementation Status

**All phases complete (1–13). v1.0 launch ready.**

- ✅ **Phases 1–13 Complete** — Full feature set: auth, forums, posts, moderation, search, notifications, custom roles, user post management, unread tracking, thread subscriptions, timezone support, approval queue, accessibility, and deployment/ops documentation
- See **ROADMAP.md** for completed phase details and post-launch backlog
- See **FUTURE_IMPROVEMENTS.md** for prioritized post-v1.0 features
