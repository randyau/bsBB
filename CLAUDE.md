# CLAUDE.md — ATproto Forum Project

This file contains the full specification, architecture decisions, and design rationale for this project. It is intended to be read by Claude (or any developer) at the start of a coding session to establish full context without re-litigating decisions already made.

## Status — Phases 1–9 Complete (Core + Moderation Tools) — 70+ Commits ✅

**Total Implementation:** 70+ commits, production-ready forum with all core features, design polish, and comprehensive moderation tooling complete

### Completed Phases:
- **Phase 1 ✅** — Foundations (auth, sessions, DB, Docker) — 7 commits
- **Phase 2 ✅** — Read-only forum views (forum index, thread listing, thread detail) — 1 commit
- **Phase 3 ✅** — Post creation (new threads, replies, markdown, OG metadata) — 2 commits
- **Phase 4 ✅** — Moderation & Admin (rate limiting, admin UI, ban/lock/delete, mod log) — 7 commits
- **Phase 5 ✅** — Notifications & Background Tasks (email, Bluesky DM, worker, lazy profile sync) — 6 commits
- **Phase 6 ✅** — Post Edits, Search & Shipping (edit+revisions, full-text search, prod Docker) — 6 commits
- **Phase 7 ✅** — Design, UI & Interaction Refinements (11 commits + enhancements)
- **Phase 9 ✅** — Core Forum Experience & Moderation Tools (11 commits)
- **Commit 1 ✅** — Theme System & Light/Dark Mode
  - CSS custom properties for light/dark themes with semantic naming
  - ThemeToggle component with sun/moon icons in header
  - localStorage persistence + system preference detection
  - Smooth 200ms color transitions
  - Updated forum list with theme-aware colors
- **Commit 2 ✅** — Search, Admin UI, & Dark Mode Polish
  - Hybrid search (substring matching for short queries ≤4 chars, tsvector for longer)
  - Admin forums management page (list, reorder, assign per-forum mods)
  - User search/dropdown for moderator selection (queryable by handle, name, DID)
  - Dark mode consistency across all pages with semantic CSS classes
  - Search result cards render cleanly without hydration issues
  - "New Thread" button displays properly in light/dark modes
- **Commit 3 ✅** — Markdown preview, responsive layout, global CSS, dark mode defaults
  - Fix markdown preview rendering with .prose-content CSS class
  - Responsive container layout with max-widths per breakpoint
  - Abstract CSS into global semantic classes (.box, .alert, .btn-*, .form-*, .post, .thread-item, etc.)
  - Set dark mode as system default
  - Fix theme toggle sun/moon icons
- **Commit 4 ✅** — Custom roles & role-based forum access
  - New `roles` table for admin-defined custom roles (name, description, color for UI)
  - `userRoles` table for global custom role assignments (many-to-many with users)
  - Permissions enforcement in `canRead()`/`canPost()` functions checks both per-forum roles + custom roles
  - Admin roles page: create/edit/delete roles, assign/remove users with user search
  - Admin forum permissions matrix: click-to-toggle read/post/moderate per role per forum
  - Hierarchical permission inheritance: walk parent chain until first match found
  - Audit trail: all role/permission changes logged in mod_log with granular action names
- **Commit 5 (bugfixes)** ✅ — Admin UI details polish
  - Fix roles page member count click to toggle expansion (Set reactivity)
  - Add pagination to user management page (50 items/page with first/back/next/last nav)
- **Commit 6** ✅ — Typography scale & semantic spacing
  - CSS custom properties: --text-xs through --text-3xl, --leading-*, --space-*, --radius-*
  - Semantic heading classes: .page-title, .section-title, .subsection-title, .meta-text
  - Apply .page-title to all main route h1s (forum index, forum list, thread, new thread, admin pages)
  - Wire up .thread-item family of classes on thread list (was dead code)
  - Fix hardcoded colors (text-blue-600 → themed via CSS variables or .link class)
  - Set body baseline: font-size/line-height via CSS variables
  - Zero visual changes — pure maintainability layer (type scale now inspectable, updatable in one place)
- **Commit 7** ✅ — Button & form refinement
  - Button focus rings: 3px colored shadows for all variants (primary/secondary/danger)
  - Button states: hover (lift effect), active (inset shadow), disabled (opacity + no focus)
  - Form validation state classes: .form-control-error, .form-control-success, .form-control-loading
  - Form message classes: .form-error, .form-success, .form-required for required indicators
  - Custom checkbox and radio button styling with checked states and focus rings
  - Updated admin forums page: buttons use .btn/.btn-primary/.btn-secondary with proper focus rings
  - Updated admin forums page: form fields use .form-control, .form-group, .form-label
  - Updated permission toggles with improved visual feedback (checkmark indicators)
  - Updated new thread form to use semantic form classes throughout
  - Section headings now use .section-title class
- **Commit 8** ✅ — Card component refinement
  - Add .table-container semantic class for borderless table wrapper pattern (5+ admin pages)
  - Replace 15+ inline alert patterns with .alert-error/.alert-success across all admin pages
  - Replace inline empty-state and card patterns with .box-secondary/.card-secondary
  - Replace inline table wrappers with .table-container throughout admin UI (posts, users, threads, mod-log, query)
  - Fix theme safety bugs in revisions page (hardcoded bg-white → CSS variables, hardcoded blue tones → .box-secondary)
  - All container styling now uses semantic classes; no raw inline Tailwind patterns for cards/alerts/tables
  - Improves maintainability by centralizing design system definitions in app.css
- **Commit 9** ✅ — Enhanced post quoting with reference links and copy permalink
  - Posts with `reply_to_post_id` now display as quoted replies with visual distinction
  - Copy permalink button on each post for easy sharing
  - Quote links render the referenced post content inline
  - Full-text search integration for finding quoted posts
- **Commit 10** ✅ — User profile and notification preferences management
  - User profile page (/user/[handle]) displays Bluesky identity, DIDs, and forum activity
  - "Edit Profile" button links to settings for display name editing
  - "Notification Settings" button for toggling Bluesky DM notifications (opt-in)
  - Notification preferences UI explains which events trigger notifications (replies, quotes, thread activity)
  - `notifyViaBluesky` flag in SessionUser type ensures proper type safety
  - Users can manage which forums notify them and notification frequency
- **Commit 11** ✅ — Post and account management for users
  - New `/user/[handle]/manage-posts` page with searchable, paginated post list (25 per page)
  - Users can manage their own posts: hide, delete, restore
  - Admins can manage any user's posts via "Manage User's Posts" button on user profile
  - Post status badges show hidden/deleted state with visual indicators
  - Settings danger zone for account operations:
    - Delete all posts: permanently removes post content (stubs preserved for quote integrity)
    - Delete account: anonymizes account (overwrites handle, displayName, avatar)
    - Users can re-register with same Bluesky identity after account deletion
    - Confirmation requires typing handle to prevent accidents
    - All sessions deleted on account removal
  - Proper mod_log entries for all irreversible actions
- **Additional Enhancement** ✅ — Distinguish user-hidden vs moderator-hidden posts
  - Checks mod_log to determine if post was hidden by author (`hide_own_post`) or by moderator
  - Display "[post hidden by author]" when user hides their own post
  - Display "[post hidden by moderator]" when mod hides a post
  - Provides clarity on who made the visibility decision

### Phase 9 ✅ — Core Forum Experience & Moderation Tools (11 commits total)
- **Commit 1 ✅** — Unread Thread Indicators
  - New `thread_views` table tracks `user_did`, `thread_id`, `last_viewed_at`
  - Upsert on thread load: tracks when user last visited each thread
  - Forum listing shows unread badge/highlight for threads with new posts since last view
  - "Mark as read" button on thread view to manually update `last_viewed_at`
  - Theme-aware styling for unread indicators (light/dark mode)
- **Commit 2 ✅** — Thread Follow/Mute System
  - New `notification_subscriptions` table: `user_did`, `thread_id`, `subscription_type` ('follow'|'mute')
  - Watch/Mute buttons on thread pages with 3-state UI: [Mute] [Default notifs] [Watch]
  - Follow: explicitly watched thread always sends DM notifications (overrides global preference)
  - Mute: user muted thread never sends notifications (overrides global preference)
  - Default: inherit from user's global `notifyViaBluesky` setting
  - "Followed Threads" card on self-profile showing subscribed threads with Remove button
  - Subscription state loads on thread detail page and updates inline
  - Users can manage subscriptions from both thread view and profile
- **Commit 3 ✅** — Notification Preferences & Backend
  - New `notificationType` column: 'both'|'replies'|'quotes' (default 'both')
  - New `notificationFrequency` column: 'immediate'|'hourly'|'daily' (default 'immediate')
  - Settings UI: type selector (Replies & Quotes / Replies only / Quotes only)
  - Settings UI: frequency selector (Max once every 10 min / hour / day)
  - Controls only visible when Bluesky DM notifications enabled, shows helpful banner otherwise
  - Frequency-based rate limiting in worker: check last DM sent time, defer if within window
  - Helper functions `getLastDmSentTime()` and `getFrequencyWindow()` for throttling logic
  - Worker respects both thread-level subscriptions and global preferences
  - Profile sync implemented: fetches fresh handle, displayName, avatarUrl from Bluesky
  - Notification queue processing handles all preference checks before sending
- **Commit 4 ✅** — Post/Thread Moving (Mod Tools)
  - New `moveThread` action: move thread to different forum via `/admin/threads`
  - Modal form to select destination forum with all available options
  - Logs action with source/destination info: `action: 'move_thread'`
  - New `movePost` action: move post to different thread via `/admin/posts`
  - Modal form lists all threads by title with forum name for context
  - Logs action with context: `action: 'move_post'`
  - Proper ARIA labels and keyboard support (Escape to close, click backdrop to close)
  - Accessible dialogs with `role="dialog"`, `aria-modal`, `aria-labelledby`

---

## Dev Workflow (Local Development)

The fastest path to a running dev environment:

```bash
npm install
cp .env.example .env          # then set SESSION_SECRET and uncomment DEV_AUTH_ENABLED=true
npm run dev:setup             # starts DB, runs migrations, seeds dev users, starts server
```

Or step by step:

```bash
docker compose -f docker/docker-compose.dev.yml up -d   # PostgreSQL only (localhost:5432)
npm run db:migrate                                       # run schema migrations
npx tsx scripts/seed.ts                                  # seed instance_settings + General forum
npx tsx scripts/seed-dev-users.ts                        # seed dev login users (first time)
npm run dev                                              # SvelteKit on http://localhost:5173
```

Dev login (no ATproto OAuth needed): `http://localhost:5173/dev/login`
Requires `DEV_AUTH_ENABLED=true` in `.env`. Only shows users with `did:example:*` DIDs.

**Key npm scripts:**

| Script | What it does |
|---|---|
| `npm run dev:setup` | One-command dev startup (DB + migrate + seed + server) |
| `npm run dev` | Start SvelteKit dev server only (DB must already be running) |
| `npm test` | Run all unit tests |
| `npm run db:migrate` | Apply pending Drizzle migrations |
| `npm run db:generate` | Generate a new migration from schema changes |
| `npm run check` | TypeScript + Svelte type check |

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
- Plain `<textarea>` with a button-toggled preview pane (server-rendered via `POST /api/preview`)
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
| Sessions | Custom roll-your-own (Postgres) | 32-byte random token + SHA-256 hash; Postgres-backed, no external library. Simple, secure, proven at scale |
| Email transport | Nodemailer over SMTP | Provider-agnostic; swap providers via env vars only |
| OG/link metadata | `open-graph-scraper` | Server-side at post submit; only for bare URLs on their own line |

### Frontend

- SvelteKit (same codebase as backend via server actions)
- CSS: Tailwind CSS v4 with CSS custom properties for light/dark theming
- Markdown editor: Plain `<textarea>` with button-toggled preview via `POST /api/preview` (server-rendered — no client-side markdown library)

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

### Docker Compose Services (Production)

Defined in `docker-compose.prod.yml`:

1. **`app`** — SvelteKit container, built from repo, internal network only
2. **`worker`** — Same image as `app`, runs `npx tsx src/worker.ts` — notification queue processor
3. **`db`** — PostgreSQL 17 Alpine image, data on named volume, internal network only
4. **`caddy`** — Reverse proxy, ports 80/443 exposed, automatic HTTPS via Let's Encrypt

Only Caddy is exposed to the internet. All other services are unreachable from outside.

**Dev** uses `docker/docker-compose.dev.yml` — PostgreSQL only on `localhost:5432`. The app runs locally via `npm run dev`.

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
| `status` | TEXT | `'active'`, `'hidden'`, `'archived'`, `'deleted'` — post visibility state |
| `is_deleted` | BOOLEAN | DEPRECATED — use `status` column instead |
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

Revisions are append-only. Current version lives in `posts`. Accessible at `/f/[forumSlug]/t/[threadId]/post/[postId]/revisions`.

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

### `roles` (admin-defined custom roles)

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PRIMARY KEY | |
| `name` | TEXT UNIQUE | Role name (e.g., "Moderator", "Contributor", "VIP") |
| `description` | TEXT NULLABLE | Role description for UI/documentation |
| `color` | TEXT NULLABLE | Hex color code for role badge (e.g., `#e11d48`) |
| `created_at` | TIMESTAMPTZ | |

Admins can create custom roles and assign them globally to users. These supplement per-forum moderator assignments.

### `user_roles` (global custom role assignments)

| Column | Type | Notes |
|---|---|---|
| `user_did` | TEXT FK → users.did | Composite PK with role_id |
| `role_id` | UUID FK → roles.id | Cascade delete on role removal |
| `assigned_by` | TEXT FK → users.did | |
| `assigned_at` | TIMESTAMPTZ | |

Many-to-many relationship: users can have multiple global roles. Role badges are displayed on user profiles and in forum threads.

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
| `action` | TEXT | Thread ops: `lock_thread`, `unlock_thread`, `pin_thread`, `unpin_thread`; Post ops: `hide_post`, `hide_own_post`, `delete_post`, `delete_own_post`, `restore_post`; User ops: `ban`, `unban`, `promote_admin`, `demote_admin`, `delete_account`, `delete_all_posts`; Role ops: `create_role`, `edit_role`, `delete_role`, `assign_custom_role`, `remove_custom_role`; Forum ops: `reorder_forum`, `assign_forum_mod`, `remove_forum_mod`, `update_forum_permission` |
| `target_did` | TEXT NULLABLE | User acted upon, if applicable |
| `target_post_id` | UUID NULLABLE | Post acted upon, if applicable |
| `target_thread_id` | UUID NULLABLE | Thread acted upon, if applicable |
| `target_forum_id` | UUID NULLABLE | Forum acted upon, if applicable |
| `reason` | TEXT NULLABLE | Reason for action, or related data (role name, etc) |
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
- Application code calls only `sendEmail(to, subject, body)` from `src/lib/email.ts`
- Switching providers = changing SMTP env vars only, no code changes

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

- **Separate process** from the web tier (runs `src/worker.ts` in its own container via `docker-compose.prod.yml`)
- Polls `notification_queue` for `status = 'pending'` every 60 seconds
- Uses PostgreSQL's `FOR UPDATE SKIP LOCKED` to safely scale across multiple worker instances without race conditions
- Sends via `@atproto/api` chat methods using the service account credentials
- Rate limiting check before send: no more than 1 DM per recipient per hour
- Marks records `sent` or `failed` with timestamp
- Unprocessed notifications survive server restarts (persisted in DB)
- **Notification helpers** live in `src/lib/notifications.ts` (enqueue functions called by routes)
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

## Environment Variables

```
# ATproto OAuth Client
ATPROTO_CLIENT_ID=https://yourforum.com/client-metadata.json
ATPROTO_PRIVATE_KEY=<JWK JSON string — generated by scripts/gen-keypair.js>

# ATproto Service/Notification Account (for Bluesky DM notifications)
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

# Encryption (for chat_session_encrypted column)
ENCRYPTION_KEY=<random 32-byte hex string>

# App
PUBLIC_BASE_URL=https://yourforum.com
SETUP_COMPLETE=true

# Dev only — never set in production
# DEV_AUTH_ENABLED=true
```

---

## Security Defaults

These must be in place from day one, not added later:

- `SameSite=Strict` on all session cookies
- Content Security Policy headers — see details below
- All markdown sanitized server-side via `rehype-sanitize` **before storage**
- Drizzle parameterized queries throughout — no raw string concatenation
- Rate limiting at HTTP layer: by DID post-auth, by IP pre-auth
- DIDs as all user foreign keys — never handles
- `chat_session_encrypted` tokens encrypted at rest (AES-256)
- Postgres and app containers not exposed outside Docker network
- Mod action log is append-only — no delete route

### Content Security Policy

CSP is declared in `svelte.config.js` under `kit.csp.directives` — **not** in `hooks.server.ts`. This lets SvelteKit generate a fresh per-request nonce and stamp it on every inline `<script>` it injects (hydration bootstrap, `<svelte:head>` scripts), so `'unsafe-inline'` is not needed in `script-src`.

**Critical:** the `kit.csp` block is wrapped in `process.env.NODE_ENV === 'production'` and is intentionally absent in dev. Vite's HMR dev server injects its own inline scripts that SvelteKit cannot nonce — applying CSP in dev breaks hydration entirely (the toggle/any interactivity stops working with no obvious error). Do not add CSP to dev mode.

`hooks.server.ts` sets the other security headers (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, HSTS) but must not set `Content-Security-Policy` manually — that would conflict with and override the nonce SvelteKit generates.

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

**Admin promotion:** The first user to log in is automatically promoted to admin (one-time, gated by `instance_settings.first_admin_claimed` flag). After that, use the `/admin/users` page to manually promote other users. All promotions are logged in `mod_log` with `action = 'promote_admin'`.

---

## User Safety Guardrails

These guardrails prevent accidental data loss and destructive actions:

### Confirmation Dialogs for Irreversible Actions

**All actions that destroy, permanently delete, or irreversibly modify data must have a confirmation dialog.** This includes:

- **Permanently delete** operations (post content cleared, data unrecoverable)
- **Ban users** (reverts to message, but high-impact)
- **Promote/demote admins** (grants/revokes powerful permissions)
- **Clear/overwrite content** (any operation that cannot be undone via undo/restore)

**Implementation pattern:**

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

Then on the form:
```html
<form method="POST" action="?/delete" onsubmit={confirmDelete}>
  <!-- form fields -->
  <button type="submit">Delete</button>
</form>
```

**Confirmation message guidelines:**
- Be specific: state what will happen and whether it's reversible
- Use "irreversible" / "cannot be undone" language for permanent operations
- Use "removed from view" / "can be restored" language for soft-delete operations
- Keep it short (2-3 sentences max)

**Soft-delete actions** (hide, archive, mute) where content is preserved or reversible do not strictly require confirmation but should clarify reversibility:
- "Hide this post? It will be removed from view but can be restored."

### Button Styling for Destructive Actions

Irreversible actions should use `.btn-danger` styling (red) to signal severity and draw attention to prevent accidental clicks.

### Audit Trail for Destructive Actions

All irreversible operations must be logged in `mod_log` with:
- The moderator/user who took the action
- What action was taken
- Optional reason field (for ban, delete, etc.)
- Timestamp
- Target resource (post ID, user DID, etc.)

This ensures accountability and allows recovery/investigation of accidental deletions.

### Deployment Workflow

```bash
# On the server
git pull
docker compose -f docker-compose.prod.yml build app worker
docker compose -f docker-compose.prod.yml up -d
```

Two-minute deploy. Rolling restart acceptable at this scale.

### Backup Cron (on host, not in container)

```bash
# Daily at 2am — adjust project name and bucket as needed
0 2 * * * docker compose -f /path/to/docker-compose.prod.yml exec -T db \
  pg_dump -U forum forum | gzip | \
  rclone rcat r2:forum-backups/$(date +\%Y-\%m-\%d).sql.gz
```

Keep 7 days rolling. Use `rclone` configured for R2 or B2.

### Full Recovery Procedure

1. Provision new Hetzner instance, point DNS
2. Clone repo
3. Copy `.env` (from password manager) and latest backup (from R2/B2)
4. `docker compose -f docker-compose.prod.yml up -d`
5. Restore: `gunzip < backup.sql.gz | docker compose -f docker-compose.prod.yml exec -T db psql -U forum forum`

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
| Custom sessions (no external library) | 32-byte random token + SHA-256 hash in Postgres `sessions` table, ~50 lines. Simple, proven, easier to reason about than external libraries |
| Plain textarea editor | Simple and sufficient; preview via server endpoint means no client-side markdown renderer needed; CodeMirror 6 is a future option if editing UX becomes a priority |
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
