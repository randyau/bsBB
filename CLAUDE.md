# CLAUDE.md — ATproto Forum Project

This file contains the full specification, architecture decisions, and design rationale for this project. It is intended to be read by Claude (or any developer) at the start of a coding session to establish full context without re-litigating decisions already made.

## Status — All Phases Complete (1–6) — Post-Launch Cleanup & Phase 7 Planned

### Completed Phases:
- **Phase 1 ✅** — Foundations (auth, sessions, DB, Docker)
- **Phase 2 ✅** — Read-only forum views (forum index, thread listing, thread detail)
- **Phase 3 ✅** — Post creation (new threads, replies, markdown, OG metadata)
- **Phase 3.1 ✅** — Polish (form validation, character counters, quote UX)
- **Phase 4 ✅** — Moderation & Admin (rate limiting, admin UI, ban/lock/delete, mod log)
- **Phase 5 ✅** — Notifications & Background Tasks (email, Bluesky DM, worker, lazy profile sync)
- **Phase 6 ✅** — Post Edits, Search & Shipping (edit+revisions, full-text search, prod Docker)

### Next: Phase 7 — Design, UI & Interaction Refinements
- Light/dark mode toggle
- Cohesive visual theme (replacing bare-bones Tailwind defaults)
- UX polish across all views

---

## Project Overview

A long-form, semi-durable threaded discussion forum — spiritually similar to classic phpBB but modernized. The defining architectural decision is that **all authentication and user identity is ATproto/Bluesky-based**. There are no traditional user accounts, no passwords, no email-based auth. Users sign in with their Bluesky identity.

The forum is intended to be open sourced so that others can self-host it. All setup should be automatable and documented for non-expert deployers.

---

## Core Requirements

### Authentication & Identity

- All authentication via ATproto OAuth (the official, stable mechanism as of 2025-2026)
- Users sign in with their Bluesky identity via the standard OAuth flow
- **DIDs (`did:plc:...`) are the primary user identifier throughout — never handles**
- Handles are mutable; DIDs are permanent. All foreign keys reference DIDs
- Display name, handle, and avatar are fetched from ATproto at login and cached locally
- Lazy profile sync: if `last_profile_sync` is > 24 hours old when a user posts, trigger an async background task to re-resolve their DID via the PLC Directory and update cached handle/avatar

### Forum Structure

- Hierarchical forum/category organization (forums containing sub-forums)
- Threads within forums
- Posts within threads
- **Flat reply model with quote/reference links** — not nested/threaded replies
  - Posts have an optional `reply_to_post_id` for reference links
  - Display order is always flat-chronological
  - This is a deliberate product decision: nested replies degrade at scale

### Content

- **Markdown only** — no WYSIWYG editor
- Plain `<textarea>` with a live preview pane, or CodeMirror 6 with markdown mode
- Markdown rendered server-side via `unified`/`remark` pipeline
- HTML output sanitized with `rehype-sanitize` **before storage**, not just at render time
- Embedded media via server-side oEmbed/OpenGraph resolution — **no local media storage**
  - When a post is submitted, backend fetches OpenGraph metadata (title, description, image URL) once
  - Stored in a `link_metadata` JSONB column on the posts table
  - Rendered as a static preview card — no client-side unfurling, no layout shift

### Search

- PostgreSQL `tsvector` full-text search across post content
- `pg_trgm` for fuzzy matching if needed
- No external search service (Elasticsearch, Meilisearch, etc.) — not needed at this scale

### Access Control

- Roles and permissions system
- Role assignment by DID
- Forum visibility tied to roles
- **Simple explicit permissions model** — a `forum_permissions` table with explicit rows per role per forum
- Hierarchical permission inheritance: mod in parent forum has mod rights in child forums unless explicitly overridden
- Do NOT use bitmask permissions — overkill for this scale, harder to debug

### Moderation & Administration

- Ban/suspend by DID
- Post deletion, thread locking
- Content flagging/reporting queue
- Moderation action log (audit trail)
- Anti-spam: rate limiting by DID (post-auth) and by IP (pre-auth)
- Standard admin tooling

### Explicitly Out of Scope (v1)

- Real-time chat or websocket-driven live updates
- Private messaging (separate from Bluesky DM notifications)
- Email notifications to regular users
- Reputation/karma/trust level systems
- Reaction systems
- File or image upload and hosting
- Complex rich text editor
- ATproto write-back (posting thread summaries to users' PDS) — deferred to v2

---

## Tech Stack

### Backend

| Concern | Choice | Rationale |
|---|---|---|
| Framework | SvelteKit (monolith), `adapter-node` | SSR mandatory for SEO and fast first loads; server actions handle DB + auth + markdown in one codebase; no artificial API boundary |
| Database | PostgreSQL 17 | Relational data model; `tsvector` search; `JSONB` for link metadata |
| ORM | Drizzle | TypeScript-native, thin, generates clean SQL, no magic; migration-file workflow only — no `drizzle-kit push` in any env |
| ATproto auth | `@atproto/oauth-client-node` | Official SDK handles DPoP, PAR, token management |
| Markdown | `unified` + `remark-parse` + `remark-rehype` + `rehype-sanitize` + `rehype-stringify` | Server-side pipeline, sanitized before storage |
| Sessions | Custom roll-your-own (Postgres) | Lucia v3 deprecated March 2025; rolling own is now the Lucia maintainers' recommended approach — crypto-secure token + SHA-256 hash, Postgres-backed, no external library |
| Email transport | Nodemailer over SMTP | Provider-agnostic; swap providers via env vars only |
| OG/link metadata | `open-graph-scraper` | Server-side at post submit; only for bare URLs on their own line |

### Frontend

- SvelteKit (same codebase as backend via server actions)
- CSS: Tailwind CSS v4 + shadcn-svelte component primitives
- Markdown editor: Plain `<textarea>` (Phase 3 MVP); can upgrade to CodeMirror 6 with markdown mode in Phase 5+
  - Preview is button-toggled via `POST /api/preview/` (server-rendered — no client-side markdown library)

### Infrastructure

| Concern | Choice |
|---|---|
| Server | Hetzner CAX11 (Arm64, 2 vCPU, 4GB RAM, ~€3.29/mo) or CX22 (x86) |
| Containerization | Docker Compose — 3 services only |
| Services | SvelteKit app + PostgreSQL + Caddy |
| HTTPS | Caddy automatic Let's Encrypt |
| Reverse proxy | Caddy (also serves `client-metadata.json` as static file) |
| Backups | Daily `pg_dump` → Cloudflare R2 or Backblaze B2 via cron, 7-day rolling |

### Docker Compose Services

1. **`app`** — SvelteKit container, built from repo, internal network only
2. **`db`** — Official Postgres image, data on named volume, internal network only
3. **`caddy`** — Reverse proxy, ports 80/443 exposed, serves `client-metadata.json` from mounted directory

Only Caddy is exposed to the internet. Postgres and app are unreachable from outside.

---

## Database Schema (Logical)

> Full SQL-level schema with indexes is in ARCHITECTURE.md §3. This section is the logical summary.

### `users`

| Column | Type | Notes |
|---|---|---|
| `did` | TEXT PRIMARY KEY | ATproto DID — never changes |
| `handle` | TEXT | Cached, updated by background sync |
| `display_name` | TEXT | Cached |
| `avatar_url` | TEXT | Cached |
| `last_profile_sync` | TIMESTAMPTZ | Triggers re-sync if > 24h on post |
| `global_role` | TEXT | `admin`, `member`, `banned` — moderator is per-forum only |
| `notify_via_bluesky` | BOOLEAN | Default false — opt-in DM notifications |
| `chat_session_encrypted` | TEXT NULLABLE | Encrypted ATproto chat tokens, null until opt-in |
| `created_at` | TIMESTAMPTZ | |

### `forums`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PRIMARY KEY | |
| `parent_id` | UUID NULLABLE FK → forums | Null = top-level forum |
| `name` | TEXT | |
| `description` | TEXT | |
| `slug` | TEXT UNIQUE | URL-safe identifier |
| `sort_order` | INTEGER | |
| `created_at` | TIMESTAMPTZ | |

### `threads`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PRIMARY KEY | |
| `forum_id` | UUID FK → forums | |
| `author_did` | TEXT FK → users.did | |
| `title` | TEXT | |
| `slug` | TEXT | Generated from title; unique per forum |
| `is_locked` | BOOLEAN | Default false |
| `is_pinned` | BOOLEAN | Default false |
| `created_at` | TIMESTAMPTZ | |
| `last_post_at` | TIMESTAMPTZ | Updated on new post — for sorting |

### `posts`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PRIMARY KEY | |
| `thread_id` | UUID FK → threads | |
| `author_did` | TEXT FK → users.did | |
| `body_markdown` | TEXT | Raw markdown as submitted |
| `body_html` | TEXT | Sanitized HTML, generated server-side at submit |
| `reply_to_post_id` | UUID NULLABLE FK → posts | For quote/reference links — flat model |
| `link_metadata` | JSONB NULLABLE | OG data for first bare-line URL in post |
| `is_deleted` | BOOLEAN | Soft delete — preserve thread integrity |
| `created_at` | TIMESTAMPTZ | |
| `edited_at` | TIMESTAMPTZ NULLABLE | |
| `body_tsv` | TSVECTOR | Generated column for full-text search |

### `post_revisions`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PRIMARY KEY | |
| `post_id` | UUID FK → posts | |
| `revision_number` | INTEGER | Increments per post; unique with post_id |
| `body_markdown` | TEXT | Full snapshot |
| `body_html` | TEXT | Full snapshot, sanitized |
| `edited_by_did` | TEXT FK → users.did | |
| `created_at` | TIMESTAMPTZ | |

Revisions are append-only. Current version lives in `posts`. Accessible at `/post/[id]/revisions/`.

### `forum_permissions`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PRIMARY KEY | |
| `forum_id` | UUID FK → forums | |
| `role` | TEXT | `guest`, `member`, `moderator`, `admin` |
| `can_read` | BOOLEAN | |
| `can_post` | BOOLEAN | |
| `can_moderate` | BOOLEAN | |

`guest` = unauthenticated visitors. Permission inheritance: walk up `parent_id` chain until a row is found; instance default applies if none exists. Explicit rows override inherited permissions.

### `user_forum_roles`

| Column | Type | Notes |
|---|---|---|
| `user_did` | TEXT FK → users.did | Composite PK with forum_id |
| `forum_id` | UUID FK → forums | |
| `role` | TEXT | Currently: `moderator` only |
| `assigned_by` | TEXT FK → users.did | |
| `assigned_at` | TIMESTAMPTZ | |

Global `admin` and `banned` on `users.global_role` always override this table. One role per user per forum.

### `notification_queue`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PRIMARY KEY | |
| `recipient_did` | TEXT FK → users.did | |
| `type` | TEXT | `reply_to_thread`, `quote`, `new_reply_in_thread`, `mod_action` |
| `payload` | JSONB | Notification-specific data |
| `status` | TEXT | `pending`, `sent`, `failed` |
| `created_at` | TIMESTAMPTZ | |
| `sent_at` | TIMESTAMPTZ NULLABLE | |

### `mod_log`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PRIMARY KEY | |
| `moderator_did` | TEXT FK → users.did | |
| `action` | TEXT | `ban`, `unban`, `delete_post`, `restore_post`, `lock_thread`, `unlock_thread`, `pin_thread`, `unpin_thread`, `assign_forum_mod`, `remove_forum_mod`, `promote_admin` |
| `target_did` | TEXT NULLABLE | User acted upon, if applicable |
| `target_post_id` | UUID NULLABLE | |
| `target_thread_id` | UUID NULLABLE | |
| `target_forum_id` | UUID NULLABLE | |
| `reason` | TEXT NULLABLE | |
| `created_at` | TIMESTAMPTZ | |

### `sessions` (custom, roll-your-own, self-pruning)

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PRIMARY KEY | SHA-256 hash of the token; token itself lives only in cookie |
| `user_did` | TEXT FK → users.did | |
| `expires_at` | TIMESTAMPTZ | Rolling 30-day expiry; invalidated on logout or expiry |

**Self-pruning maintenance:** `validateSession()` includes a 1% probabilistic `DELETE` of expired rows. Cleanup scales with traffic and requires no external cron or maintenance worker.

### `instance_settings`

| Column | Type | Notes |
|---|---|---|
| `key` | TEXT PRIMARY KEY | |
| `value` | TEXT | |

Seed rows: `default_forum_visibility` (`public` or `members-only`), `setup_complete`, `first_admin_claimed`.

---

## ATproto OAuth Architecture

### Two Tiers of Auth Scope

**Tier 1 — Identity only (all users at login)**
- Scope: `atproto`
- Used for: signing in, verifying identity, reading profile
- No write access to user's PDS

**Tier 2 — Identity + chat (opt-in notification users)**
- Scope: `atproto transition:chat.bsky`
- Requested lazily when user enables Bluesky DM notifications in their profile
- Initiates a new OAuth request mid-session with expanded scopes
- Tokens stored encrypted in `users.chat_session_encrypted`

### Client Metadata

- `client-metadata.json` is served at a stable public HTTPS URL: `{PUBLIC_BASE_URL}/client-metadata.json`
- This file is the forum's OAuth client identity on the ATproto network
- **Constructed dynamically** from environment variables, not written to disk (eliminates filesystem coupling)
- A SvelteKit server route (`src/routes/client-metadata.json/+server.ts`) builds and serves it on-demand
- Contains: `client_id` (its own URL), redirect URIs, public JWK, scopes — all from `ATPROTO_PRIVATE_KEY` env var
- Consequence: **The app is stateless** across multiple horizontally-scaled instances
- Setup script generates the P-256 (ES256) JWK keypair and stores it in `ATPROTO_PRIVATE_KEY` env var only

### Session Flow

1. User initiates login → redirect to their PDS authorization server
2. OAuth callback → `@atproto/oauth-client-node` handles token exchange
3. DID extracted from token response `sub` field (verified)
4. Custom session created: 32-byte random token → SHA-256 hash stored in DB, raw token in cookie (`SameSite=Strict`, `HttpOnly`, `Secure`)
5. User record upserted in `users` table (create on first login, update profile cache)
6. If `instance_settings.first_admin_claimed = 'false'`: promote user to `global_role = 'admin'`, set `first_admin_claimed = 'true'`, write `mod_log` entry, show one-time banner

---

## Notification System

### Email (Admin/Moderator only)

- Nodemailer over SMTP — provider configured entirely via environment variables
- No Mailgun SDK or any provider SDK in application code
- Application code calls only `sendEmail(to, subject, body)` from `lib/email.ts`
- Initial provider: Mailgun (deployer's existing account)
- Switching providers = changing 4 env vars, no code changes

Triggers:
- New item in moderation queue → notify moderators
- Flagged content → notify moderators
- Admin alerts (configurable)

### Bluesky DM Notifications (opt-in, regular users)

Notification triggers (only fire when user has opted in):
- Someone replied to your thread
- Someone quoted your post
- Thread you started has new replies
- Moderator action taken on your content

Do NOT send:
- View counts, engagement metrics
- Digest/broadcast messages
- Anything not triggered by a specific user action

### Notification Worker

- **Separate process** from the web tier (runs `src/worker.ts` in its own container)
- Polls `notification_queue` for `status = 'pending'` every 60 seconds
- Uses PostgreSQL's `FOR UPDATE SKIP LOCKED` to safely scale across multiple worker instances without race conditions
- Sends via `@atproto/api` chat methods using the service account credentials
- Rate limiting check before send: no more than 1 DM per recipient per hour
- Marks records `sent` or `failed` with timestamp
- Unprocessed notifications survive server restarts (persisted in DB)
- **Consequence:** Web tier remains stateless; can scale independently of worker tier

---

## Service Account (Forum Bot Identity)

The forum needs its own ATproto identity to send DM notifications. This is separate from user auth.

### What It Is

A Bluesky account created specifically for the forum instance (e.g. `notifications@yourforum.bsky.social`). It never posts publicly. Used only for sending DMs to opted-in users.

### Authentication Method

App Password (not full OAuth) — simpler for server-to-server, static credential, scoped and revocable from Bluesky account settings.

### Setup Paths for Deployers

1. **Create new bsky.app account** — common case, 5 minutes, documented in README
2. **Use existing Bluesky account** — same setup, different credentials
3. **Self-hosted PDS** — advanced, documented with link to ATproto PDS docs, not required

---

## Email & Notification Environment Variables

```
# ATproto OAuth Client
ATPROTO_CLIENT_ID=https://yourforum.com/client-metadata.json
ATPROTO_PRIVATE_KEY=<JWK JSON string>

# ATproto Service/Notification Account
ATPROTO_SERVICE_HANDLE=notifications.yourforum.bsky.social
ATPROTO_SERVICE_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx

# SMTP Email (provider-agnostic)
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_USER=postmaster@yourdomain.com
SMTP_PASS=<password>
SMTP_FROM=noreply@yourforum.com
ADMIN_EMAIL=admin@yourforum.com

# Database
DATABASE_URL=postgresql://user:password@db:5432/forum

# Sessions
SESSION_SECRET=<random 32+ byte string>

# App
PUBLIC_BASE_URL=https://yourforum.com
SETUP_COMPLETE=true
```

---

## Security Defaults

These must be in place from day one, not added later:

- `SameSite=Strict` on all session cookies
- Content Security Policy headers (configured in Caddy or SvelteKit hooks)
- All markdown sanitized server-side via `rehype-sanitize` **before storage**
- Drizzle parameterized queries throughout — no raw string concatenation
- Rate limiting at HTTP layer: by DID post-auth, by IP pre-auth
- DIDs as all user foreign keys — never handles
- `chat_session_encrypted` tokens encrypted at rest (AES-256)
- Postgres and app containers not exposed outside Docker network
- Mod action log is append-only — no delete route

---

## Deployment

### First-Run Setup (for open source deployers)

`scripts/setup.sh` (bash for early steps, offloads to Node for API validation) automates:

1. Generates P-256 JWK keypair via `scripts/gen-keypair.js`
2. Writes private key to `.env`
3. Generates and writes `client-metadata.json` with public key + config
4. Prompts for service notification account handle + App Password; validates via test API call
5. Prompts for SMTP credentials; sends test email
6. Prompts for default forum visibility (`public` or `members-only`)
7. Writes `SETUP_COMPLETE=true` to `.env`
8. All output also written to `logs/setup.log`
9. On first login after setup, the first user to authenticate is auto-promoted to admin (one-time only, gated on `instance_settings.first_admin_claimed`)

**Breakglass admin promotion:** `scripts/admin-promote.sh` runs via `docker exec` on the server. Requires SSH access — that is the safeguard. No web UI, no endpoint. Writes a `mod_log` entry with `action = 'promote_admin'` and `reason = 'breakglass'`.

### Deployment Workflow

```bash
# On the server
git pull
docker compose build app
docker compose up -d
```

Two-minute deploy. Rolling restart acceptable at this scale.

### Backup Cron (on host, not in container)

```bash
# Daily at 2am — adjust path and bucket as needed
0 2 * * * docker exec forum-db pg_dump -U postgres forum | gzip | \
  rclone rcat r2:forum-backups/$(date +\%Y-\%m-\%d).sql.gz
```

Keep 7 days rolling. Use `rclone` configured for R2 or B2.

### Full Recovery Procedure

1. Provision new Hetzner instance, point DNS
2. Clone repo
3. Copy `.env` (from password manager) and latest backup (from R2/B2)
4. `docker compose up -d`
5. Restore: `gunzip < backup.sql.gz | docker exec -i forum-db psql -U postgres forum`

Total time from bare server to running: under 30 minutes.

---

## Open Source Considerations

- All secrets in `.env` — never committed
- `client-metadata.json` is a generated artifact — in `.gitignore`, produced by setup script
- Setup script is the primary onboarding path — README points to it first
- Deployer's Bluesky account becomes the first admin on first login
- No hardcoded references to any specific domain, instance name, or account
- PDS self-hosting is documented as advanced/optional, not required

---

## Decisions Made and Why (Do Not Re-Litigate)

| Decision | Rationale |
|---|---|
| Flat reply model | Nested replies degrade at scale; flat-chronological with quote links is how successful long-form forums actually work |
| DIDs not handles as PKs | Handles are mutable; DIDs are permanent |
| No Redis in v1 | Unnecessary at this scale; adds operational overhead; sessions in Postgres (roll-your-own) are fine |
| No bitmask permissions | Premature optimization; explicit rows in `forum_permissions` are easier to debug and reason about |
| SvelteKit monolith not Hono+frontend | SSR is mandatory for forum SEO; no reason for API boundary at this scale |
| Nodemailer not provider SDK | Vendor lock-in prevention; SMTP is universal |
| Worker as separate process, not hooks.server.ts loop | Eliminates competing loops and race conditions if web tier scales. PostgreSQL's FOR UPDATE SKIP LOCKED handles queue distribution safely. |
| Dynamic client-metadata route, not static file | Eliminates filesystem state. App becomes stateless across instances. Setup writes to env vars only. |
| Atomic rate-limit upserts, not read-then-write | Concurrent requests are safe via SQL `INSERT ... ON CONFLICT`. Abstraction layer unchanged if switching to Redis later. |
| Probabilistic session cleanup, not cron job | 1% per request proportional to traffic. Eliminates external maintenance task. |
| Notifications opt-in not opt-out | Audience is Bluesky users who are sensitive to spam; trust is more valuable than reach |
| ATproto write-back deferred | Scope creep in v1; product decision about pushing content to users' feeds deserves its own deliberation |
| No email to regular users | Bluesky DMs are the native channel for this audience |
| `pg_dump` not managed backup service | Keeps infrastructure minimal; R2/B2 are cheap and reliable enough |
| Per-forum moderator roles, not global | Global moderator is too coarse; `user_forum_roles` table allows scoped assignment |
| `global_role` reduced to `admin\|member\|banned` | Moderator moved to per-forum; cleaner separation of concerns |
| Roll-your-own sessions (no Lucia) | Lucia v3 deprecated March 2025; maintainers now recommend implementing sessions directly — crypto token + SHA-256 hash stored in Postgres `sessions` table, ~50 lines, no external library |
| Plain textarea editor (Phase 3) | MVP approach; CodeMirror 6 can be added as progressive enhancement in Phase 5+ for better UX; preview via server endpoint keeps no client-side markdown renderer either way |
| Button-toggled preview, not live | Avoids client-side markdown dependency; preview is always authoritative server-rendered HTML |
| Thread URLs: `/f/[forum]/t/[uuid]/[slug]` | UUID is authoritative (links never break); slug is cosmetic with 301 redirect on mismatch |
| Post revisions: full snapshots | Simple to query and render; storage cost negligible at forum scale |
| OG fetch only for bare-line URLs | Reduces noise; matches user expectation (Slack/Discord behaviour); can be disabled instance-wide |
| Per-forum visibility tiers (`guest\|member\|moderator\|admin`) | Flexible enough for most community configurations without complex RBAC |
| Instance-level default visibility setting | Deployers choose public or members-only at setup; individual forums can override |
| First-admin via `instance_settings` gate | One-time, audited, survives restarts; gated on `first_admin_claimed` flag |
| Breakglass as `docker exec` only | SSH access is the safeguard; no web surface to attack; action is always logged |
| Seed a General forum at setup | Gives deployer something to log into immediately |
| Tailwind CSS v4 + shadcn-svelte | Most-documented utility framework; accessible components; clean to edit for frontend newcomers |
