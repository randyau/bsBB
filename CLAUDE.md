# CLAUDE.md — ATproto Forum Project

This file contains the essential specification, architecture decisions, and design rationale needed to work on this project. For detailed implementation history, see HISTORY.md.

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
| `npm run worker` | Run notification worker (if testing separately) | [src/worker.ts](#) |

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
- Markdown editor: Plain `<textarea>` with live client-side preview via `markdown-it` (no CodeMirror or rich editor)
- Shared components: AdminPageShell, Pagination, EmptyState, Breadcrumb, ConfirmModal, UserTypeahead, ThemeToggle

### Infrastructure

| Concern | Choice |
|---|---|
| Server | Hetzner CAX11 (Arm64, 2 vCPU, 4GB RAM, ~€3.29/mo) or CX22 (x86) |
| Containerization | Docker Compose |
| Prod services | app + worker + db + caddy (4 services) |
| Dev services | db only — app runs via `npm run dev` |
| HTTPS | Caddy automatic Let's Encrypt |
| Reverse proxy | Caddy (also serves `client-metadata.json` as static file) |
| Backups | Daily `pg_dump` → Cloudflare R2 or Backblaze B2 via cron, 7-day rolling |

### Docker Compose Services

**Production** (`docker-compose.prod.yml` at project root):

1. **`app`** — SvelteKit container, built from `Dockerfile.prod`, internal network only
2. **`worker`** — Same image, runs `npx tsx src/worker.ts` — notification queue processor
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

**`users`** — ATproto identity, cached profile, globalRole, notify preferences (type/frequency/bluesky), timezone, chat_session_encrypted
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

### Two Tiers of Auth Scope

**Tier 1 — Identity only (all users at login)**
- Scope: `atproto`
- Used for: signing in, verifying identity, reading profile
- No write access to user's PDS

**Tier 2 — Identity + chat (opt-in notification users)**
- Scope: `atproto transition:chat.bsky`
- Requested lazily when user enables Bluesky DM notifications in their profile
- Tokens stored encrypted in `users.chat_session_encrypted`

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

- **Separate process** from web tier (`src/worker.ts` in its own container)
- Polls `notification_queue` every 60 seconds for `status = 'pending'`
- Uses PostgreSQL `FOR UPDATE SKIP LOCKED` for safe distributed processing
- Sends via `@atproto/api` chat methods with service account credentials
- Web tier remains stateless; can scale independently

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

- `SameSite=Strict` on all session cookies
- Content Security Policy headers (declared in `svelte.config.js`, NOT `hooks.server.ts`)
- All markdown sanitized server-side via `rehype-sanitize` **before storage**
- Drizzle parameterized queries throughout — no raw string concatenation
- Rate limiting at HTTP layer: by DID post-auth, by IP pre-auth
- DIDs as all user foreign keys — never handles
- `chat_session_encrypted` tokens encrypted at rest (AES-256)
- Postgres and app containers not exposed outside Docker network
- Mod action log is append-only — no delete route

### Content Security Policy

- Declared in `svelte.config.js` under `kit.csp.directives` only
- **NOT** in `hooks.server.ts` (would conflict with SvelteKit's nonce generation)
- SvelteKit generates fresh per-request nonce, stamps inline `<script>` tags
- Intentionally absent in dev (Vite HMR injects scripts SvelteKit cannot nonce)
- `hooks.server.ts` sets other headers: `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, HSTS

---

## User Safety Guardrails

### Confirmation Dialogs for Irreversible Actions

**All actions that destroy, permanently delete, or irreversibly modify data must have a confirmation dialog:**

```typescript
function confirmDelete(): boolean {
  return confirm(
    'Permanently delete this post?\n\n' +
    'This will irreversibly clear all content. The post stub will remain ' +
    'for quotes/links, but content cannot be recovered.\n\n' +
    'This action cannot be undone.'
  );
}
```

**Message guidelines:**
- Be specific: state what will happen and whether it's reversible
- Use "irreversible" / "cannot be undone" for permanent operations
- Use "removed from view" / "can be restored" for soft-delete
- Keep it 2-3 sentences max

### Button Styling

- **Destructive:** Always use `.btn-danger` (red) to signal severity
- **Primary:** Use `.btn-primary` for main CTA
- **Secondary:** Use `.btn-secondary` for alternatives
- **Disabled:** All support `:disabled` styling

### Audit Trail

All irreversible operations logged in `mod_log` with:
- The user/moderator who took the action
- What action was taken
- Optional reason field
- Timestamp
- Target resource (post ID, user DID, etc.)

---

## Deployment

### First-Run Setup

`scripts/setup.sh` automates deployment setup:

1. Generates P-256 JWK keypair via `scripts/gen-keypair.js`
2. Writes private key to `.env`
3. Generates `client-metadata.json` with public key + config
4. Prompts for service account handle + App Password; validates via API
5. Prompts for SMTP credentials; sends test email
6. Prompts for default forum visibility (`public` or `members-only`)
7. Writes `SETUP_COMPLETE=true` to `.env`
8. All output logged to `logs/setup.log`
9. First user to log in is auto-promoted to admin (one-time only)

### Deployment Workflow

```bash
# On the server
git pull
docker compose -f docker-compose.prod.yml build app worker
docker compose -f docker-compose.prod.yml up -d
```

Two-minute deploy. Rolling restart acceptable at this scale.

### Backup Strategy

```bash
# Daily at 2am — adjust project name and bucket
0 2 * * * docker compose -f /path/to/docker-compose.prod.yml exec -T db \
  pg_dump -U forum forum | gzip | \
  rclone rcat r2:forum-backups/$(date +\%Y-\%m-\%d).sql.gz
```

Keep 7 days rolling. Use `rclone` configured for R2 or B2.

### Full Recovery

1. Provision new instance, point DNS
2. Clone repo
3. Copy `.env` and latest backup
4. `docker compose -f docker-compose.prod.yml up -d`
5. `gunzip < backup.sql.gz | docker compose -f docker-compose.prod.yml exec -T db psql -U forum forum`

Total time: under 30 minutes.

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
| Button-toggled preview | Authoritative server-rendered preview (no client markdown lib) |
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
| **DEPLOYMENT.md** | Production deployment guide |
| **ROADMAP.md** | Phase roadmap (Phases 11–13) and future work |
| **GUARDRAILS.md** | AI engineering operational rules |
| **HISTORY.md** | Implementation history (Phases 1–10, 80+ commits) |

---
