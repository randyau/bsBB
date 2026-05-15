# CLAUDE.md — ATproto Forum Project

This file contains the full specification, architecture decisions, and design rationale for this project. It is intended to be read by Claude (or any developer) at the start of a coding session to establish full context without re-litigating decisions already made.

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
| Framework | SvelteKit (monolith) | SSR mandatory for SEO and fast first loads; server actions handle DB + auth + markdown in one codebase; no artificial API boundary |
| Database | PostgreSQL | Relational data model; `tsvector` search; `JSONB` for link metadata |
| ORM | Drizzle | TypeScript-native, thin, generates clean SQL, no magic |
| ATproto auth | `@atproto/oauth-client-node` | Official SDK handles DPoP, PAR, token management |
| Markdown | `unified` + `remark` + `rehype-sanitize` | Server-side pipeline, sanitized before storage |
| Sessions | Postgres-backed sessions | Redis removed — unnecessary at this scale; add later if needed |
| Email transport | Nodemailer over SMTP | Provider-agnostic; swap providers via env vars only |
| oEmbed/OG | `oembed-parser` or equivalent | Server-side at post submission time |

### Frontend

- SvelteKit (same codebase as backend via server actions)
- No heavy client-side framework needed beyond what SvelteKit provides
- Markdown editor: plain textarea + preview pane, or CodeMirror 6

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

### `users`

| Column | Type | Notes |
|---|---|---|
| `did` | TEXT PRIMARY KEY | ATproto DID — never changes |
| `handle` | TEXT | Cached, updated by background sync |
| `display_name` | TEXT | Cached |
| `avatar_url` | TEXT | Cached |
| `last_profile_sync` | TIMESTAMPTZ | Triggers re-sync if > 24h on post |
| `role` | ENUM | `admin`, `moderator`, `member`, `banned` |
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
| `link_metadata` | JSONB NULLABLE | Stored OG/oEmbed data for first link in post |
| `is_deleted` | BOOLEAN | Soft delete — preserve thread integrity |
| `created_at` | TIMESTAMPTZ | |
| `edited_at` | TIMESTAMPTZ NULLABLE | |

### `forum_permissions`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PRIMARY KEY | |
| `forum_id` | UUID FK → forums | |
| `role` | ENUM | Which role this rule applies to |
| `can_read` | BOOLEAN | |
| `can_post` | BOOLEAN | |
| `can_moderate` | BOOLEAN | |

Permission inheritance: if no explicit row exists for a child forum, inherit from parent. Explicit rows override inherited permissions.

### `notification_queue`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PRIMARY KEY | |
| `recipient_did` | TEXT FK → users.did | |
| `type` | ENUM | `reply`, `quote`, `mod_action`, etc. |
| `payload` | JSONB | Notification-specific data |
| `status` | ENUM | `pending`, `sent`, `failed` |
| `created_at` | TIMESTAMPTZ | |
| `sent_at` | TIMESTAMPTZ NULLABLE | |

### `mod_log`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PRIMARY KEY | |
| `moderator_did` | TEXT FK → users.did | |
| `action` | ENUM | `ban`, `delete_post`, `lock_thread`, etc. |
| `target_did` | TEXT NULLABLE | User acted upon, if applicable |
| `target_post_id` | UUID NULLABLE | |
| `target_thread_id` | UUID NULLABLE | |
| `reason` | TEXT NULLABLE | |
| `created_at` | TIMESTAMPTZ | |

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

- `client-metadata.json` must be served at a stable public HTTPS URL
- This file is the forum's OAuth client identity on the ATproto network
- **Generated from config — never hand-edited**
- Served by Caddy as a static file from a mounted directory
- Contains: `client_id` (its own URL), redirect URIs, public JWK, scopes
- Setup script generates the P-256 (ES256) JWK keypair and produces this file

### Session Flow

1. User initiates login → redirect to their PDS authorization server
2. OAuth callback → `@atproto/oauth-client-node` handles token exchange
3. DID extracted from token response `sub` field (verified)
4. Server-side session created (Postgres-backed), session cookie set (`SameSite=Strict`)
5. User record upserted in `users` table (create on first login, update profile cache)

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

- Runs inside the SvelteKit server process (not a separate container)
- `setInterval` polling `notification_queue` for `status = 'pending'` every 60 seconds
- Sends via `@atproto/api` chat methods using the service account credentials
- Rate limiting check before send: no more than 1 DM per recipient per hour
- Marks records `sent` or `failed` with timestamp
- Unprocessed notifications survive server restarts (persisted in DB)

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

The setup script (`setup.js` or `setup.sh`) automates:

1. Generates P-256 JWK keypair
2. Writes private key to `.env`
3. Generates and writes `client-metadata.json` with public key + config
4. Prompts for service notification account handle + App Password
5. Validates both by making test ATproto API calls
6. Prompts for SMTP credentials, sends test email
7. Writes `SETUP_COMPLETE=true` to `.env`
8. On first login after setup, the first user to authenticate is auto-promoted to admin

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
| No Redis in v1 | Unnecessary at this scale; adds operational overhead; sessions in Postgres are fine |
| No bitmask permissions | Premature optimization; explicit rows in `forum_permissions` are easier to debug and reason about |
| SvelteKit monolith not Hono+frontend | SSR is mandatory for forum SEO; no reason for API boundary at this scale |
| Nodemailer not provider SDK | Vendor lock-in prevention; SMTP is universal |
| Notifications opt-in not opt-out | Audience is Bluesky users who are sensitive to spam; trust is more valuable than reach |
| ATproto write-back deferred | Scope creep in v1; product decision about pushing content to users' feeds deserves its own deliberation |
| No email to regular users | Bluesky DMs are the native channel for this audience |
| `pg_dump` not managed backup service | Keeps infrastructure minimal; R2/B2 are cheap and reliable enough |
