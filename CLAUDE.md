# CLAUDE.md — ATproto Forum Project

This file contains the essential specification, architecture decisions, and design rationale needed to work on this project.

## Status

✅ **Phases 1–13 Complete** — v1.0 launch-ready forum with full features: auth, forums, posts, moderation, search, notifications, custom roles, user post management, unread tracking, thread subscriptions, timezone support, approval queue, accessibility polish, and full deployment/ops documentation.

**Current:** v1.0 launch-ready. See ROADMAP.md for post-launch backlog.

**Dev:** See "Dev Workflow" section below.

---

## Style Guide & Code Conventions

**All styling, code style, and formatting conventions are documented in PATTERNS.md.** This is the authoritative reference for:

- **Datetime formatting** — centralized in `src/lib/utils/time.ts`: use `formatTimeDisplay()` which returns "2026-05-18 00:30 (21m ago)" format
- **CSS and theming** — semantic classes (`.box`, `.btn-danger`, `.form-control`, etc.), CSS custom properties for light/dark mode, never hardcoded colors
- **Forms and validation** — confirmation dialogs for destructive actions, proper button styling for destructive operations
- **Accessibility** — ARIA attributes, keyboard navigation, color contrast requirements
- **Component patterns** — props typing, state management with Svelte 5 runes, component structure

**Refer to PATTERNS.md before writing any code.** All examples and patterns documented there supersede older patterns in the codebase.

---

## Dev Workflow (Local Development)

**See [SCRIPTS.md](SCRIPTS.md) for complete documentation of all helper scripts.**

The fastest path to a running dev environment:

```bash
npm install
cp .env.example .env
npm run dev:setup             # One command: starts DB, runs migrations, seeds users, starts dev server
```

Dev login (no ATproto OAuth needed): `http://localhost:5173/dev/login`
Requires `DEV_AUTH_ENABLED=true` (set automatically by `npm run dev:setup`). Only shows users with `did:example:*` DIDs.

**Quick reference — use these npm scripts:**

| Script | Purpose | See SCRIPTS.md |
|---|---|---|
| `npm run dev:setup` | One-command startup (DB + migrate + seed + server) | [scripts/dev.sh](#) |
| `npm run dev` | Dev server only (DB must already be running) | [scripts/dev.sh](#) |
| `npm test` | Run all unit tests | [Vitest](#) |
| `npm run db:migrate` | Apply pending migrations | [scripts/migrate.sh](#) |
| `npm run db:generate` | Generate new migration from schema changes | [Drizzle](#) |
| `npm run check` | TypeScript + Svelte type check | [svelte-kit sync](#) |
| `npm run build` | Build production bundle | [SvelteKit](#) |
| `python worker/worker.py` | Run notification worker locally (DB must be running) | [worker/worker.py](#) |

For detailed explanations and step-by-step guides, see **[SCRIPTS.md](SCRIPTS.md)**.

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
- Plain `<textarea>` with **live client-side preview** (rendered via `markdown-it` on every keystroke)
- Markdown pipeline server-side via `unified`/`remark` for stored content
- HTML output sanitized with `rehype-sanitize` **before storage**, not just at render time
- Embedded media via server-side oEmbed/OpenGraph resolution — **no local media storage**
  - When a post is submitted, backend fetches OpenGraph metadata (title, description, image URL) once
  - Stored in a `link_metadata` JSONB column on the posts table
  - Rendered as a static preview card — no client-side unfurling, no layout shift

### Search

- PostgreSQL `tsvector` full-text search across post content
- `pg_trgm` for fuzzy matching if needed
- No external search service (Elasticsearch, Meilisearch, etc.) — not needed at this scale
- Author filter: `author:handle` syntax on search page

### Access Control

- Roles and permissions system
- Role assignment by DID
- Forum visibility tied to roles
- **Simple explicit permissions model** — a `forum_permissions` table with explicit rows per role per forum
- Hierarchical permission inheritance: mod in parent forum has mod rights in child forums unless explicitly overridden
- Do NOT use bitmask permissions — overkill for this scale, harder to debug
- Custom admin-defined roles with global assignments

### Moderation & Administration

- Ban/suspend by DID
- Post deletion (soft + hard), thread locking, pinning
- Post/thread moving between locations (mod tool)
- Comprehensive moderation action log (audit trail)
- Anti-spam: rate limiting by DID (post-auth) and by IP (pre-auth)
- Standard admin tooling (manage forums, users, threads, posts, roles, custom roles, mod-log)

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
| Sessions | Custom roll-your-own (Postgres) | 32-byte random token + SHA-256 hash; Postgres-backed, no external library. Simple, secure, proven at scale |
| Email transport | Nodemailer over SMTP | Provider-agnostic; swap providers via env vars only |
| OG/link metadata | `open-graph-scraper` | Server-side at post submit; only for bare URLs on their own line |

### Frontend

- SvelteKit (same codebase as backend via server actions)
- CSS: Tailwind CSS v4 with CSS custom properties for light/dark theming
- Markdown editor: Plain `<textarea>` with live client-side preview via `markdown-it` + DOMPurify (no CodeMirror or rich editor)
- Shared components: AdminPageShell, Pagination, EmptyState, Breadcrumb, ConfirmModal, UserTypeahead, ThemeToggle, EmojiPicker, MarkdownToolbar, Toast, TableSearch

### Infrastructure

| Concern | Choice |
|---|---|
| Server | Hetzner CAX11 (Arm64, 2 vCPU, 4GB RAM, ~€3.29/mo) or CX22 (x86) |
| Containerization | Docker Compose |
| Prod services | app + worker + db + caddy (4 services) |
| Dev services | db only — app runs via `npm run dev` |
| HTTPS | Caddy automatic Let's Encrypt |
| Reverse proxy | Caddy (serves `client-metadata.json` as static file; proxies everything else to app) |
| Backups | Daily `pg_dump` → Cloudflare R2 or Backblaze B2 via cron, 7-day rolling |

### Docker Compose Services

**Production** (`docker-compose.prod.yml` at project root):

1. **`app`** — SvelteKit container, built from `Dockerfile.prod`, internal network only
2. **`worker`** — Python 3.12 image (`worker/Dockerfile`), runs `worker/worker.py` — notification queue processor
3. **`db`** — PostgreSQL 17 Alpine, data on named volume, internal network only
4. **`caddy`** — Reverse proxy (uses `Caddyfile.prod`), ports 80/443 exposed, automatic HTTPS via Let's Encrypt

Only Caddy is exposed to the internet. All other services on internal network only.

**Development** (`docker/docker-compose.dev.yml`):
- PostgreSQL only on `localhost:5432`
- App runs locally via `npm run dev` (not in container)

---

## Database Schema (Logical)

> Full SQL-level schema with indexes is in ARCHITECTURE.md. This section is the logical summary.

### Core Tables

**`users`** — ATproto identity, cached profile, globalRole (`admin|moderator|member|banned`), notify preferences (type/frequency/bluesky), timezone
**`forums`** — Hierarchical forum structure (parent_id for sub-forums, require_approval_days for spam gate)
**`threads`** — Discussion threads (locked/pinned status, last_post_at for sorting)
**`posts`** — Thread posts (markdown + sanitized HTML, reply_to_post_id for quotes, status for soft-delete, is_approved + rejection_reason for approval queue)
**`post_revisions`** — Edit history (append-only snapshots)

### Permissions & Roles

**`forum_permissions`** — Explicit read/post/moderate per role per forum (guest, member, moderator, admin)
**`user_forum_roles`** — Per-forum moderator assignments (user_did + forum_id)
**`roles`** — Admin-defined custom roles (name, description, color)
**`user_roles`** — Global custom role assignments (many-to-many)

### Moderation & Notifications

**`mod_log`** — Append-only audit trail (action, target_did, target_post_id, reason, timestamp)
**`notification_queue`** — Async DM queue (pending/sent/failed status, payload JSONB)
**`notification_subscriptions`** — Per-thread follow/mute (user_did + thread_id + type)
**`thread_views`** — Last-viewed tracking (user_did + thread_id + last_viewed_at)

### Inbox & Rate Limiting

**`user_notifications`** — In-app notification inbox (always written, independent of DM opt-in; type: reply/quote/new_reply_in_thread/post_rejected)
**`rate_limit_buckets`** — Token-bucket rate limiting by key (DID or IP), count + window_start

### Admin & Config

**`sessions`** — Custom roll-your-own (token SHA-256 hash, expires_at, rolling expiry)
**`instance_settings`** — Key-value config (setup_complete, first_admin_claimed, default_forum_visibility)

See ARCHITECTURE.md for full schema with column types and indexes.

---

## ATproto OAuth Architecture

### Auth Scope

**Identity only (all users at login)**
- Scope: `atproto`
- Used for: signing in, verifying identity, reading profile
- No write access to user's PDS

> **Note:** An earlier design stored per-user chat tokens (`chat_session_encrypted`) to send DMs on behalf of users. This was removed. DM notifications are now sent entirely by the forum service account using its App Password credentials — no additional OAuth scope is requested from users.

### Client Metadata

- `client-metadata.json` served at `{PUBLIC_BASE_URL}/client-metadata.json`
- **Dynamically constructed** from environment variables (no filesystem coupling)
- Generated by SvelteKit route (`src/routes/client-metadata.json/+server.ts`)
- App is **stateless** across horizontally-scaled instances
- Setup script generates P-256 JWK keypair, stores in `ATPROTO_PRIVATE_KEY` env var

---

## Notification System

### In-App Inbox (always-on)

- Written to `user_notifications` on every qualifying event, regardless of DM opt-in
- Types: `reply`, `quote`, `new_reply_in_thread`, `post_rejected`
- Users see their inbox without needing a Bluesky account connected

### Email (Admin/Moderator only)

- Nodemailer over SMTP — provider configured entirely via environment variables
- Triggers: new moderation queue item, flagged content, admin alerts

### Bluesky DM Notifications (opt-in)

**Triggers (only when user opts in):**
- Someone replied to your thread
- Someone quoted your post
- Thread you started has new replies
- Moderator action taken on your content

**Rate limiting:** No more than 1 DM per recipient per hour
**Frequency preferences:** User can choose immediate, hourly, or daily batching
**Thread overrides:** Follow (always notify) or Mute (never notify) per thread

### Notification Worker

- **Separate process** from web tier (`worker/worker.py` in its own container — Python 3.12, not Node)
- Polls `notification_queue` every 60 seconds for `status = 'pending'`
- Uses PostgreSQL `FOR UPDATE SKIP LOCKED` for safe distributed processing
- Sends Bluesky DMs via raw XRPC HTTP calls (no SDK) with service account App Password credentials
- Web tier remains stateless; can scale independently
- `worker/test_parity.py` verifies the Python worker makes identical HTTP calls to the Bluesky API as the TypeScript SDK did — re-run it if the Bluesky DM code changes

### Service Account (Forum Bot)

- Bluesky account created for the forum instance (e.g., `notifications@yourforum.bsky.social`)
- Uses App Password (not full OAuth) for DM access
- Configured via environment variables (`ATPROTO_SERVICE_HANDLE`, `ATPROTO_SERVICE_APP_PASSWORD`)

---

## Environment Variables

```
# ATproto OAuth Client
ATPROTO_CLIENT_ID=https://yourforum.com/client-metadata.json
ATPROTO_PRIVATE_KEY=<JWK JSON string — generated by scripts/gen-keypair.js>

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
DATABASE_URL=postgresql://forum:forum@localhost:5432/forum   # dev
# DATABASE_URL=postgresql://forum:<password>@db:5432/forum   # prod (db = Docker service name)

# Sessions
SESSION_SECRET=<random 32+ byte string>

# App
PUBLIC_BASE_URL=https://yourforum.com
SETUP_COMPLETE=true

# Dev only — never set in production
# DEV_AUTH_ENABLED=true
```

---

## Security Defaults

These must be in place from day one:

- `SameSite=Lax` on session cookies (Strict breaks ATproto OAuth redirects back from the PDS)
- Content Security Policy headers (declared in `svelte.config.js`, NOT `hooks.server.ts`)
- All markdown sanitized server-side via `rehype-sanitize` **before storage**
- Drizzle parameterized queries throughout — no raw string concatenation
- Rate limiting at HTTP layer: by DID post-auth, by IP pre-auth
- DIDs as all user foreign keys — never handles
- Service account App Password stored only in env vars; never in DB
- Postgres and app containers not exposed outside Docker network
- Mod action log is append-only — no delete route

### Content Security Policy

- Declared in `svelte.config.js` under `kit.csp.directives` only
- **NOT** in `hooks.server.ts` (would conflict with SvelteKit's nonce generation)
- SvelteKit generates fresh per-request nonce, stamps inline `<script>` tags
- Intentionally absent in dev (Vite HMR injects scripts SvelteKit cannot nonce)
- `hooks.server.ts` sets other headers: `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, HSTS

---

## Deployment

See **[DEPLOYMENT.md](DEPLOYMENT.md)** for the full production deployment guide, **[BACKUP.md](BACKUP.md)** for backup/restore procedures, and **[UPGRADE.md](UPGRADE.md)** for upgrading an existing instance.

---

## Key Decisions (Not Re-Litigated)

| Decision | Rationale |
|---|---|
| Flat reply model | Nested replies degrade at scale; flat + quotes proven to scale |
| DIDs not handles as PKs | Handles mutable; DIDs permanent |
| No Redis in v1 | Unnecessary at scale; Postgres sessions sufficient |
| No bitmask permissions | Explicit rows easier to debug |
| SvelteKit monolith | SSR mandatory for SEO; no API boundary needed at this scale |
| Nodemailer not SDK | Vendor lock-in prevention; SMTP universal |
| Worker as separate process | Safe distributed queue via `FOR UPDATE SKIP LOCKED` |
| Dynamic client-metadata | Stateless app across instances |
| Notifications opt-in | Bluesky users sensitive to spam; trust > reach |
| Plain textarea editor | Simple; preview via server endpoint eliminates client library |
| Live client-side preview | `markdown-it` + DOMPurify on every keystroke; server pipeline is authoritative at submit |
| `pg_dump` backups | Infrastructure minimal; R2/B2 cheap and reliable |
| Custom sessions | 32-byte token + SHA-256, ~50 lines, simple and proven |

---

## Documentation Map

| Document | Purpose |
|---|---|
| **README.md** | Entry point, getting started, quick start |
| **CLAUDE.md** | This file — project spec, architecture decisions, core requirements |
| **PATTERNS.md** | Code patterns, style guide, conventions (read before coding) |
| **ARCHITECTURE.md** | Technical design, full database schema, APIs, stack decisions |
| **SCRIPTS.md** | Helper scripts reference — when to use each script and what it does |
| **QUICKSTART.md** | From zero to running locally in 5 minutes |
| **DEPLOYMENT.md** | Production deployment guide |
| **BACKUP.md** | Backup strategies, restore procedures, disaster recovery |
| **UPGRADE.md** | How to upgrade between versions |
| **ADMIN_GUIDE.md** | Admin operations: users, roles, forums, moderation |
| **USER_GUIDE.md** | End-user guide: posting, search, notifications, settings |
| **ROADMAP.md** | Phase roadmap and post-launch backlog |
| **FUTURE_IMPROVEMENTS.md** | Prioritized post-v1.0 feature backlog |
| **GUARDRAILS.md** | AI engineering operational rules |

---
