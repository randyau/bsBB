# Quick Reference — bsBB Forum

One-sentence summary: ATproto/Bluesky-based forum. No passwords. DID-keyed users. Flat replies. Markdown-only. Postgres + SvelteKit.

---

## Key Files Map

| What | Where |
|---|---|
| **Project spec & decisions** | `CLAUDE.md` |
| **Database schema** | `src/lib/db/schema.ts` |
| **DB migrations** | `src/lib/db/migrations/` |
| **Auth system** | `src/lib/auth/` (session.ts, atproto.ts, user.ts, profile-sync.ts) |
| **Markdown pipeline** | `src/lib/markdown/` (index.ts, og.ts, slug.ts) |
| **Permissions** | `src/lib/permissions/index.ts` (canRead, canPost) |
| **Routes** | `src/routes/` |
| **Tests** | `src/**/*.test.ts` |
| **Abuse checks** | `src/lib/abuse/index.ts` |
| **Docker** | `docker/` (docker-compose.yml, docker-compose.dev.yml, Caddyfile) |
| **Setup scripts** | `scripts/` (setup.sh, migrate.sh, gen-keypair.js, seed.ts) |

---

## Critical Facts (don't derive, read here)

| Fact | Value |
|---|---|
| **Primary user ID** | DID (`did:plc:...`), never handle |
| **Session storage** | Postgres `sessions` table (custom roll-your-own implementation) |
| **Session token** | 32-byte random → SHA-256 hash in DB, raw token in cookie |
| **Cookie flags** | `SameSite=Strict`, `HttpOnly`, `Secure` |
| **Session TTL** | 30 days rolling |
| **First admin** | Auto-promoted on first login, gated by `instance_settings.first_admin_claimed` |
| **Banned users** | Redirected to `/banned` by `hooks.server.ts` |
| **Reply model** | Flat + optional quote links via `reply_to_post_id`, never nested |
| **Markdown sanitize** | Server-side before storage via `rehype-sanitize` |
| **OG metadata fetch** | Server-side at post submit, only for bare-line URLs |
| **Rate limiting** | Atomic PostgreSQL upserts: thread_create 10/hr/DID, post_submit 30/hr/DID, preview 60/hr/IP, login 10/15min/IP |
| **Profile sync** | Lazy: re-sync if `last_profile_sync` > 24h and user posts |
| **Permissions model** | Explicit rows in `forum_permissions`, not bitmask |
| **Moderator role** | Per-forum only (in `user_forum_roles`), not global |
| **Global roles** | `admin`, `member`, `banned` (in `users.global_role`) |
| **Custom roles** | Admin-defined roles in `roles` table, globally assigned in `user_roles` |
| **Post status** | `'active'`, `'hidden'`, `'archived'`, `'deleted'` (status column, not just is_deleted) |
| **User vs mod hidden** | Checked via mod_log action type (hide_own_post vs hide_post) for display |
| **Notifications** | Opt-in Bluesky DMs via `notifyViaBluesky` flag, encrypted chat tokens in `chat_session_encrypted` |

---

## Database Schema Summary

**Core tables:**
- `users` — DIDs, cached profile, global_role, notifyViaBluesky flag, chat_session_encrypted
- `forums` — hierarchical (parent_id), name, slug, visibility
- `threads` — author_did, title, slug, is_locked, is_pinned, last_post_at
- `posts` — author_did, thread_id, body_markdown, body_html, reply_to_post_id, link_metadata JSONB, status (ACTIVE/HIDDEN/ARCHIVED/DELETED)
- `post_revisions` — append-only snapshots, body_markdown + body_html

**Auth/Access:**
- `sessions` — id (token hash), user_did, expires_at
- `forum_permissions` — role, forum_id, can_read/post/moderate flags
- `user_forum_roles` — user_did, forum_id, role (moderator only), assigned_by, assigned_at
- `roles` — admin-defined custom roles with color, description
- `user_roles` — user_did, role_id (many-to-many)

**Audit/Notifications:**
- `mod_log` — action (ban/unban/promote/demote/create_role/assign_custom_role/hide_post/hide_own_post/delete_post/delete_own_post/etc.), moderator_did, target_did/post_id/thread_id/forum_id, reason, created_at
- `notification_queue` — recipient_did, type, payload JSONB, status (pending/sent/failed)
- `instance_settings` — key-value for setup state, default_forum_visibility, first_admin_claimed

**Search:**
- `posts.body_tsv` — generated column + GIN index for full-text search

---

## Common Commands

```bash
# One-command dev startup (DB + migrate + seed + server)
npm run dev:setup

# Or manually, step by step:
docker compose -f docker/docker-compose.dev.yml up -d  # start DB only
npm run db:migrate                                      # run schema migrations
npx tsx scripts/seed.ts                                 # seed instance_settings + General forum
npx tsx scripts/seed-dev-users.ts                       # seed dev login users (once)
npm run dev                                             # start SvelteKit on localhost:5173

# Type check
npm run check

# Run tests
npm test                                                # unit tests (fast, ~1s)
bash scripts/test-integration.sh                        # integration tests (dev server must be running)

# Generate a new DB migration after editing schema.ts
npm run db:generate                                     # creates SQL in src/lib/db/migrations/
npm run db:migrate                                      # applies it
```

See `TESTING.md` for detailed testing documentation.

---

## Environment Variables

### ATproto OAuth
```
ATPROTO_CLIENT_ID=https://yourforum.com/client-metadata.json
ATPROTO_PRIVATE_KEY=<JWK JSON string>
```

### Service Account (DM notifications)
```
ATPROTO_SERVICE_HANDLE=notifications.yourforum.bsky.social
ATPROTO_SERVICE_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx
```

### SMTP (email)
```
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_USER=postmaster@yourdomain.com
SMTP_PASS=<password>
SMTP_FROM=noreply@yourforum.com
ADMIN_EMAIL=admin@yourforum.com   # Receives moderator alert emails
```

### App
```
DATABASE_URL=postgresql://user:password@localhost:5432/forum
PUBLIC_BASE_URL=https://yourforum.com
SESSION_SECRET=<random 32+ byte string>
SETUP_COMPLETE=true
```

### Dev Auth (local only — never set in production)
```
DEV_AUTH_ENABLED=true
```

---

## SvelteKit Dev Gotchas

### `process.env` is not populated in dev mode

Vite intercepts `.env` loading during development. Values from `.env` and `.env.local` are **not** added to `process.env` in SvelteKit's SSR runner — they are only accessible via SvelteKit's env modules.

**Rule:** In any `+page.server.ts` or `+server.ts`, always read env vars with `$env/dynamic/private`, never `process.env`:

```ts
// Wrong — undefined in dev
process.env.MY_VAR

// Correct
import { env } from '$env/dynamic/private';
env.MY_VAR
```

`$env/static/private` also works if the value is known at build time. `$env/dynamic/private` is safer as a default since it works at both build and runtime.

This does not affect scripts run directly with `tsx` (e.g. seed scripts), where `process.env` works normally.

---

## Key Design Decisions (read before questioning)

- **Custom sessions (no external library)** — 32-byte token + SHA-256 hash in Postgres; simple and secure
- **No Redis** — Sessions in Postgres are fine at this scale
- **No bitmask permissions** — Explicit rows easier to debug
- **Flat replies, not nested** — Nested replies degrade at scale
- **Markdown only** — No WYSIWYG; server-side sanitize; CodeMirror 6 for editing
- **DIDs not handles as PKs** — Handles are mutable; DIDs are permanent
- **No ATproto write-back yet** — Deferred to v2 (scope decision)
- **No email to regular users** — Bluesky DMs are the native channel
- **Nodemailer not provider SDK** — Prevents vendor lock-in; SMTP is universal

---

## Test Files

- `src/lib/auth/session.test.ts` — Session CRUD (create, validate, invalidate)
- `src/lib/auth/user.test.ts` — User upsert, first-admin claim
- `src/lib/auth/profile-sync.test.ts` — Profile fetch from PLC + bsky.app
- `src/lib/auth/banned-redirect.test.ts` — Banned user redirect logic
- `src/lib/abuse/index.test.ts` — Abuse verdict stub (always allow)
- `src/lib/db/schema.test.ts` — Schema validation
- `src/lib/permissions/index.test.ts` — canRead + canPost permission resolution (requires DATABASE_URL)

**Run all:** `npm test` (35+ tests, ~1s without DB tests)

---

## When You Need To...

| Task | Start Here |
|---|---|
| Add a new route | `src/routes/` — SvelteKit file-based routing, `+page.svelte` + `+page.server.ts` |
| Add a DB table | `src/lib/db/schema.ts`, then `npm run db:generate` + `npm run db:migrate` |
| Add a test | Create `src/lib/**/*.test.ts`, run `npm test` |
| Change session TTL | `src/lib/auth/session.ts` line ~30 |
| Change password/auth | Not applicable — ATproto OAuth only |
| Add a global permission | `users.global_role` column + `src/hooks.server.ts` |
| Add a per-forum permission | `forum_permissions` table + app logic |
| Change markdown rules | `src/lib/markdown/index.ts` — edit unified pipeline stages |
| Render markdown | Call `renderMarkdown(text)` from `src/lib/markdown/index.ts` |
| Fetch OG metadata | Call `fetchLinkMetadata(markdown)` from `src/lib/markdown/og.ts` (returns null on error) |
| Generate thread slugs | Call `generateSlug(title)` from `src/lib/markdown/slug.ts` |
| Add a moderator action | `mod_log` table + action enum |
| Change email provider | `.env` SMTP_* vars only — no code changes |
| Setup a new instance | `bash scripts/setup.sh` (generates keypair, validates OAuth, seeds DB) |
| Promote breakglass admin | Run `UPDATE users SET global_role = 'admin' WHERE did = '<did>';` via `/admin/query` or psql |
| Log in locally without Bluesky | See **Dev Auth** section below |

---

## Dev Auth (Local Testing Without Bluesky)

> **Run curl and browser tests from the Windows/VS Code terminal, not WSL.** Docker ports are on the Windows network stack; `localhost:5173` does not resolve from inside WSL2. See `TESTING.md` for the full explanation.

ATproto OAuth requires a publicly reachable HTTPS URL, so it cannot work on localhost. For local manual testing, there is a dev-only login bypass.

**How it works:**
- `scripts/seed-dev-users.ts` inserts 4 fake users with `did:example:*` DIDs into the DB
- `GET /dev/login` shows a list of those users; clicking one creates a real session and redirects to `/`
- The route is double-gated: returns 404 unless **both** `NODE_ENV !== 'production'` AND `DEV_AUTH_ENABLED=true`
- Only users whose DID starts with `did:example:` are shown — real user DIDs are never listed

**Setup (one-time):**
```bash
# 1. Add to .env
DEV_AUTH_ENABLED=true

# 2. Seed dev users (after migrations)
npx tsx scripts/seed-dev-users.ts

# 3. Start dev server and visit
http://localhost:5173/dev/login
```

**Dev users seeded:**

| DID | Handle | Global Role |
|---|---|---|
| `did:example:dev-admin` | dev-admin.test | admin |
| `did:example:dev-moderator` | dev-moderator.test | member (assign forum-mod role manually) |
| `did:example:dev-member` | dev-member.test | member |
| `did:example:dev-banned` | dev-banned.test | banned |

**Safety:** `DEV_AUTH_ENABLED` is not set in `.env.example` and must never appear in a production `.env`. The production guard (`NODE_ENV === 'production'`) is a second independent check. Do not add this variable to Docker Compose prod config.

---

## Phase Status

- **Phase 1 ✅** — Auth, sessions, DB, Docker, setup scripts
- **Phase 2 ✅** — Forum index, thread listing, thread detail, permission enforcement, slug redirects
- **Phase 3 ✅** — Post creation, replies, markdown preview, OG metadata, slug uniqueness
- **Phase 4 ✅** — Moderation: ban/unban, delete/restore posts, lock/pin threads, rate limiting, admin UI, mod log
- **Phase 5 ✅** — Notifications: email (Nodemailer), Bluesky DM (opt-in), background worker, lazy profile sync
- **Phase 6 ✅** — Post editing with revision history, full-text search, production Docker stack
- **Phase 7 🚀** — Theme system, light/dark mode, UI refinements (in progress)

See `STATUS.md` for detailed breakdown.

