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
14. [Implementation Phases](#14-implementation-phases)

---

## 1. Stack Decisions — Finalized

| Concern | Choice | Notes |
|---|---|---|
| Framework | SvelteKit | `adapter-node` for Docker deployment |
| TypeScript | `strict: true` | Throughout |
| CSS | Tailwind CSS v4 | Most-documented utility framework; clean to edit |
| Component primitives | shadcn-svelte | Built on Tailwind; accessible; well-documented |
| Testing | Vitest | Natural SvelteKit fit; unit + integration only in v1 |
| E2E testing | Playwright | Deferred to post-v1 |
| Database | PostgreSQL 17 (latest stable) | |
| ORM | Drizzle | Migration-file workflow throughout (no `drizzle-kit push` in any env) |
| Sessions | Custom (roll-your-own) | Lucia v3 deprecated March 2025; rolling own is now the recommended approach — ~50 lines, crypto-secure token, Postgres-backed, no external session library |
| ATproto auth | `@atproto/oauth-client-node` | Official SDK; handles DPoP/PAR/token refresh |
| Markdown pipeline | `unified` + `remark-parse` + `remark-rehype` + `rehype-sanitize` + `rehype-stringify` | Server-side only |
| Markdown editor | CodeMirror 6 | With markdown mode; preview is button-toggled (not live) |
| Client-side markdown | None | Preview is server-rendered via a dedicated preview endpoint |
| OG/link metadata | `open-graph-scraper` | Server-side at post submit; triggered only for bare URLs on their own line |
| Email | Nodemailer over SMTP | Provider-agnostic via env vars |
| Reverse proxy | Caddy | Automatic TLS; serves `client-metadata.json` as static file |
| Containerization | Docker Compose (3 services) | `app` + `db` + `caddy` |

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
│   │   │   ├── atproto.ts                # @atproto/oauth-client-node init + session flow
│   │   │   ├── session.ts                # Lucia session management helpers
│   │   │   └── profile-sync.ts           # Lazy DID profile re-sync logic
│   │   │
│   │   ├── permissions/
│   │   │   └── index.ts                  # Pure permission resolution — no I/O
│   │   │
│   │   ├── markdown/
│   │   │   └── index.ts                  # unified pipeline: parse → sanitize → stringify
│   │   │
│   │   ├── notifications/
│   │   │   ├── worker.ts                 # setInterval polling loop
│   │   │   ├── send-dm.ts                # @atproto/api chat send, rate-limit check
│   │   │   └── send-email.ts             # Nodemailer wrapper (sendEmail fn only)
│   │   │
│   │   ├── og/
│   │   │   └── index.ts                  # OG metadata fetch (bare-URL-on-own-line only)
│   │   │
│   │   ├── crypto/
│   │   │   └── index.ts                  # AES-256 encrypt/decrypt for chat_session_encrypted
│   │   │
│   │   ├── abuse/
│   │   │   └── index.ts                  # checkAbuse() — single entry point for all rate-limit/spam checks
│   │   │                                 # Phase 1: stub (always allows). Phase 4: real logic.
│   │   └── utils/
│   │       └── slug.ts                   # Title → URL slug generation
│   │
│   └── routes/
│       ├── +layout.server.ts             # Global session/user hydration
│       ├── +layout.svelte                # Nav, footer shell
│       │
│       ├── (auth)/
│       │   ├── login/+page.svelte        # Handle input → ATproto OAuth redirect
│       │   ├── login/+page.server.ts
│       │   ├── callback/+server.ts       # OAuth callback handler
│       │   └── logout/+server.ts
│       │
│       ├── (forum)/
│       │   ├── +page.svelte              # Forum index — list of top-level forums
│       │   ├── +page.server.ts
│       │   │
│       │   └── f/
│       │       └── [forumSlug]/
│       │           ├── +page.svelte          # Thread list for forum
│       │           ├── +page.server.ts
│       │           ├── new/                  # New thread form
│       │           │   ├── +page.svelte
│       │           │   └── +page.server.ts
│       │           └── t/
│       │               └── [threadId]/
│       │                   ├── +page.svelte       # Thread view — flat post list
│       │                   ├── +page.server.ts
│       │                   └── [titleSlug]/       # Cosmetic slug — router ignores, redirects to canonical
│       │                       └── +server.ts
│       │
│       ├── (user)/
│       │   └── profile/
│       │       ├── +page.svelte          # User profile settings (notifications opt-in, etc.)
│       │       └── +page.server.ts
│       │
│       ├── (mod)/
│       │   └── mod/
│       │       ├── queue/                # Flagged content queue
│       │       │   ├── +page.svelte
│       │       │   └── +page.server.ts
│       │       └── log/                  # Mod action log (read-only)
│       │           ├── +page.svelte
│       │           └── +page.server.ts
│       │
│       ├── (admin)/
│       │   └── admin/
│       │       ├── forums/               # Create/edit/delete forums, set permissions
│       │       ├── users/                # Role assignment, ban management
│       │       └── settings/             # Instance-level settings (default visibility, etc.)
│       │
│       ├── banned/
│       │   └── +page.svelte              # Dedicated ban page shown to banned users
│       │
│       └── api/
│           └── preview/
│               └── +server.ts            # POST: render markdown server-side for editor preview
│
├── scripts/
│   ├── setup.sh                          # First-run setup (keypair, client-metadata.json, .env)
│   ├── migrate.sh                        # Wrapper: runs drizzle-kit migrate inside WSL/container
│   └── admin-promote.sh                  # Breakglass: docker exec → promote DID to admin
│
├── docker/
│   ├── Dockerfile                        # Multi-stage: build → node runtime
│   ├── docker-compose.yml
│   └── Caddyfile
│
├── drizzle.config.ts
├── svelte.config.ts
├── tailwind.config.ts
├── vite.config.ts
├── tsconfig.json
├── .env.example
└── logs/                                 # gitignored; dev log output (tee targets)
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
                        -- enum: 'admin' | 'member' | 'banned'
                        -- 'moderator' is now per-forum only (see user_forum_roles)
notify_via_bluesky      BOOLEAN NOT NULL DEFAULT false
chat_session_encrypted  TEXT                      -- AES-256; null until DM opt-in
created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
```

> `global_role` is intentionally reduced to `admin | member | banned`. Moderator status is
> per-forum and lives in `user_forum_roles`. Global admin and banned override everything.

### `forums`

```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
parent_id   UUID REFERENCES forums(id)            -- null = top-level
name        TEXT NOT NULL
description TEXT NOT NULL DEFAULT ''
slug        TEXT NOT NULL UNIQUE
sort_order  INTEGER NOT NULL DEFAULT 0
created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
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
is_deleted       BOOLEAN NOT NULL DEFAULT false
created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
edited_at        TIMESTAMPTZ                     -- null if never edited

-- Full-text search index
body_tsv  TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', body_markdown)) STORED
```

```sql
CREATE INDEX posts_body_tsv_idx ON posts USING GIN (body_tsv);
```

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

> Global `admin` and `banned` on `users.global_role` always take precedence over this table.
> Permission resolution order: banned → admin → user_forum_roles → forum_permissions by role.

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
```

### `mod_log`

```sql
id               UUID PRIMARY KEY DEFAULT gen_random_uuid()
moderator_did    TEXT NOT NULL REFERENCES users(did)
action           TEXT NOT NULL
                 -- 'ban' | 'unban' | 'delete_post' | 'restore_post'
                 -- 'lock_thread' | 'unlock_thread' | 'pin_thread' | 'unpin_thread'
                 -- 'assign_forum_mod' | 'remove_forum_mod' | 'promote_admin' (breakglass)
target_did       TEXT REFERENCES users(did)
target_post_id   UUID REFERENCES posts(id)
target_thread_id UUID REFERENCES threads(id)
target_forum_id  UUID REFERENCES forums(id)
reason           TEXT
created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
```

> Append-only. No update or delete routes exist anywhere in the codebase.

### `sessions` (Lucia-managed)

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

/post/[postId]/revisions/              Post revision history (public)

/login/                                ATproto OAuth initiation
/callback/                             OAuth callback (handled server-side)
/logout/                               POST only

/profile/                              User settings (auth required)

/mod/queue/                            Flagged content (moderator+ required)
/mod/log/                              Mod action log (moderator+ required)

/admin/forums/                         Forum management (admin required)
/admin/users/                          User/role management (admin required)
/admin/settings/                       Instance settings (admin required)

/banned/                               Ban page (shown to banned users)

/api/preview/                          POST: server-side markdown render for editor
/client-metadata.json                  Served by Caddy as static file (not a route)
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

All permission resolution lives exclusively in `src/lib/permissions/index.ts`.
Functions are pure — they take a user object + resolved forum_permissions rows and return a permissions result. No DB calls inside permission functions. Callers load the data, then call the function.

```typescript
// src/lib/permissions/index.ts
export function resolvePermissions(
  user: SessionUser | null,
  forumChain: Forum[],           // [leaf forum, ..., root forum]
  permissionRows: ForumPermission[],
  userForumRole: UserForumRole | null,
  instanceDefault: 'public' | 'members-only'
): ResolvedPermissions
```

---

## 6. Authentication Architecture

### ATproto OAuth Flow

1. User submits their handle on `/login/`
2. Server resolves handle → DID via PLC Directory, discovers PDS authorization server
3. `@atproto/oauth-client-node` initiates PAR + DPoP flow, redirects user to their PDS
4. User authorizes; PDS redirects to `/callback/`
5. SDK completes token exchange; DID extracted from `sub` field (cryptographically verified)
6. Lucia session created, session cookie set (`SameSite=Strict`, `HttpOnly`, `Secure`)
7. `users` row upserted: create on first login, update `handle`/`display_name`/`avatar_url`/`last_profile_sync` on every login
8. If `instance_settings.first_admin_claimed = 'false'`: promote this user to `global_role = 'admin'`, set `first_admin_claimed = 'true'`, write `mod_log` entry. Show one-time notice.

### Tier 2 (DM notifications opt-in)

- User navigates to `/profile/`, enables "Notify me via Bluesky DM"
- Server initiates a new OAuth request with scope `atproto transition:chat.bsky`
- On callback, new tokens encrypted with AES-256 (`SESSION_SECRET` as key material) and stored in `users.chat_session_encrypted`
- Profile page clearly explains this grants the forum permission to send DMs

### Lazy Profile Sync

- On every post submission, check `users.last_profile_sync`
- If > 24 hours: enqueue a background task (simple async fire-and-forget inside the server action, not a queue) to re-fetch profile from PLC Directory and update `handle`/`display_name`/`avatar_url`
- Post submission is never blocked by sync

### Session Hydration

`hooks.server.ts` validates the Lucia session on every request and populates `locals.user` with:
```typescript
{
  did: string,
  handle: string,
  displayName: string | null,
  avatarUrl: string | null,
  globalRole: 'admin' | 'member' | 'banned'
}
```
If `globalRole === 'banned'`: redirect to `/banned/` immediately (except `/banned/` itself and `/logout/`).

---

## 7. Content Pipeline

### Post Submission Flow

1. Server action receives `body_markdown` from form
2. Run markdown pipeline → `body_html`:
   ```
   body_markdown
     → remark-parse (parse to mdast)
     → remark-rehype (convert to hast)
     → rehype-sanitize (strip disallowed tags/attrs)
     → rehype-stringify (serialize to HTML string)
   ```
3. Scan `body_markdown` for bare URLs (regex: line that is only a URL, optional whitespace):
   - If found: fetch OG metadata via `open-graph-scraper` (timeout: 3s, single attempt)
   - Store result in `link_metadata` JSONB, or `null` on failure/timeout
4. If post is an edit: save current `body_markdown` + `body_html` to `post_revisions` first, increment `revision_number`, then update `posts`
5. Insert/update `posts` row (DB commit)
6. Update `threads.last_post_at`
7. Enqueue notification records to `notification_queue` (same transaction as step 5)
8. Trigger lazy profile sync if needed (async, non-blocking)

### Editor Preview

CodeMirror 6 editor in the browser. Preview mode (button toggle) POSTs `body_markdown` to `POST /api/preview/` which runs the same server-side pipeline and returns `body_html`. No client-side markdown rendering library needed.

### OG Link Detection Rule

```
Bare URL = a line in the markdown source that matches:
  /^\s*(https?:\/\/[^\s]+)\s*$/m
```

Only the first match per post is fetched. If the URL is inside a code block or inline in a sentence, it does not trigger. Admins can disable OG fetching instance-wide via `instance_settings` if spam/abuse is an issue.

---

## 8. Notification System

### Worker

Runs inside the SvelteKit Node process — started in `hooks.server.ts` on first request (guarded by a module-level flag to prevent double-start):

```typescript
// hooks.server.ts
if (!workerStarted) {
  workerStarted = true;
  startNotificationWorker(); // sets up setInterval(60_000)
}
```

Worker loop:
1. Query `notification_queue WHERE status = 'pending' ORDER BY created_at LIMIT 50`
2. For each: check per-recipient rate limit (no more than 1 DM/hour per recipient, tracked in `notification_queue` sent records)
3. Send via `@atproto/api` using `ATPROTO_SERVICE_APP_PASSWORD` credentials
4. Mark `sent` or `failed` with `sent_at`
5. Log to `logs/worker.log`

### Email (admin/mod alerts only)

`src/lib/notifications/send-email.ts` exports exactly one function:
```typescript
export async function sendEmail(to: string, subject: string, body: string): Promise<void>
```
All SMTP config from env vars. Application code never references a provider name.

---

## 9. Session Architecture

Custom session implementation (no external session library). Lucia v3 was deprecated in March 2025; the Lucia maintainers now recommend rolling your own. Session table: `sessions` (see schema above).

### Token Design

- Session token = 32 random bytes (via `crypto.getRandomValues`) encoded as hex — this is the cookie value
- Stored token = SHA-256 hash of the raw token — only the hash goes in the DB, never the raw token
- Verification: hash the cookie value, compare to stored hash in `sessions` table
- This means a DB breach does not expose valid session tokens (same principle as password hashing)

### Session Lifecycle

- **Create:** generate token → hash → insert `sessions` row with `expires_at = now() + 30 days` → set cookie
- **Validate (every request):** read cookie → hash → look up in `sessions` → if found and not expired, extend by 30 days if < 15 days remaining → populate `locals.user` and `locals.session`
- **Invalidate (logout):** delete `sessions` row → clear cookie
- Cookie attributes: `SameSite=Strict`, `HttpOnly`, `Secure` (in production)

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
4. Generate `client-metadata.json` with public key + redirect URIs + scopes
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

```
app    — SvelteKit Node container; internal network only; PORT=3000
db     — postgres:17; named volume forum_data; internal network only
caddy  — ports 80/443; reverse proxies to app:3000; serves /client-metadata.json from mounted ./docker/caddy-static/
```

### Caddy Config (key excerpts)

```
yourforum.com {
  handle /client-metadata.json {
    root * /srv/static
    file_server
  }
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

This section defines the architecture for abuse prevention. Full implementation is deferred to
Phase 4, but **the module interface and stub must exist from Phase 1** so every action site
can call it without needing to know the implementation status.

### Design Principle

All rate-limit and abuse checks go through a single module: `src/lib/abuse/index.ts`.
No inline checks anywhere else. Callers ask the module; the module decides.
This means the implementation can evolve (in-memory → DB-backed → Redis) without touching call sites.

### Module Interface (stub from Phase 1, filled out in Phase 4)

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

Phase 1 stub returns `{ allowed: true }` unconditionally. Phase 4 fills in real logic.
Call sites are written once and never change.

### Call Sites (wired in Phase 1/3, enforced in Phase 4)

| Location | Context type | Notes |
|---|---|---|
| `hooks.server.ts` | `login_attempt` | Pre-auth; IP only |
| `hooks.server.ts` | `post_submit` | Post-auth; DID + IP |
| `routes/.../new/+page.server.ts` | `thread_create` | Stricter limit than replies |
| `routes/.../+page.server.ts` (reply) | `post_submit` | Same as above |
| `routes/api/preview/+server.ts` | `preview_request` | Prevent pipeline abuse |
| `routes/.../flag/+server.ts` | `flag_submit` | Prevent flag spam |
| `src/lib/og/index.ts` | `og_fetch` | Prevent SSRF/fetch abuse |

### Rate Limit Tiers (Phase 4 targets)

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

**Phase 4 (initial):** PostgreSQL-backed using a `rate_limit_buckets` table:

```sql
CREATE TABLE rate_limit_buckets (
  key        TEXT NOT NULL,         -- e.g. "post_submit:did:plc:xxxx"
  count      INTEGER NOT NULL DEFAULT 0,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (key)
);
```

Simple fixed-window counter. Expired rows cleaned up by a periodic `DELETE WHERE window_start < now() - interval '1 hour'` in the notification worker loop.

**Future (if needed):** Swap to Redis without changing call sites — only `src/lib/abuse/index.ts` changes.

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
- `src/lib/og/index.ts` must reject requests to RFC 1918 private address ranges and loopback before fetching
- Stub the `isPrivateAddress(url)` guard from Phase 3; fill in Phase 4

**ATproto identity abuse**
- DIDs are verified cryptographically by `@atproto/oauth-client-node` — cannot be spoofed
- Handle changes are benign (DID is the key); profile sync updates the cache
- No additional mitigation needed

### `rate_limit_buckets` Schema Addition

Add to `src/lib/db/schema.ts` in Phase 1 (even though the table is empty until Phase 4):

```typescript
export const rateLimitBuckets = pgTable('rate_limit_buckets', {
  key:         text('key').primaryKey(),
  count:       integer('count').notNull().default(0),
  windowStart: timestamp('window_start', { withTimezone: true }).notNull().defaultNow(),
});
```

### Directory Addition

```
src/lib/abuse/
└── index.ts    # checkAbuse() — stub in Phase 1, real logic in Phase 4
```

---

## 14. Implementation Phases

Moved to **IMPLEMENTATION_PLAN.md**. That document contains the full task breakdown,
per-task test gates, and phase completion checklists.

Summary of phases:
1. Foundations — scaffold, DB, auth, sessions, setup script
2. Read-Only Forum — pages, permission enforcement, URL routing
3. Posting & Content — editor, markdown pipeline, OG, revisions
4. Moderation & Permissions — mod tools, ban, rate limiting (wire up `checkAbuse`)
5. Notifications & Admin — worker, DMs, email, admin UI, breakglass
6. Search & Shipping — full-text search, Docker, README
