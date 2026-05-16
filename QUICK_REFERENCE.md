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
| **Session storage** | Postgres `sessions` table, not Redis or Lucia |
| **Session token** | 32-byte random → SHA-256 hash in DB, raw token in cookie |
| **Cookie flags** | `SameSite=Strict`, `HttpOnly`, `Secure` |
| **Session TTL** | 30 days rolling |
| **First admin** | Auto-promoted on first login, gated by `instance_settings.first_admin_claimed` |
| **Banned users** | Redirected to `/banned` by `hooks.server.ts` |
| **Reply model** | Flat + optional quote links via `reply_to_post_id`, never nested |
| **Markdown sanitize** | Server-side before storage via `rehype-sanitize` |
| **OG metadata fetch** | Server-side at post submit, only for bare-line URLs |
| **Rate limiting** | By DID post-auth, by IP pre-auth (not yet implemented) |
| **Profile sync** | Lazy: re-sync if `last_profile_sync` > 24h and user posts |
| **Permissions model** | Explicit rows in `forum_permissions`, not bitmask |
| **Moderator role** | Per-forum only (in `user_forum_roles`), not global |
| **Global roles** | `admin`, `member`, `banned` (in `users.global_role`) |

---

## Database Schema Summary

**Core tables:**
- `users` — DIDs, cached profile, global_role, session tokens
- `forums` — hierarchical (parent_id), name, slug, visibility
- `threads` — author_did, title, slug, is_locked, is_pinned, last_post_at
- `posts` — author_did, thread_id, body_markdown, body_html, reply_to_post_id, link_metadata JSONB, is_deleted soft-flag
- `post_revisions` — append-only snapshots, body_markdown + body_html

**Auth/Access:**
- `sessions` — id (token hash), user_did, expires_at
- `forum_permissions` — role, forum_id, can_read/post/moderate flags
- `user_forum_roles` — user_did, forum_id, role (moderator only), assigned_by, assigned_at

**Audit/Notifications:**
- `mod_log` — action, moderator_did, target_did/post_id/thread_id/forum_id, reason, created_at
- `notification_queue` — recipient_did, type, payload JSONB, status (pending/sent/failed)
- `instance_settings` — key-value for setup state, default_forum_visibility, first_admin_claimed

**Search:**
- `posts.body_tsv` — generated column + GIN index for full-text search

---

## Common Commands

```bash
# Set up PATH for Node v24
export PATH=/home/agi/.nvm/versions/node/v24.14.0/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:$PATH

# Type check
npx svelte-kit sync && npx tsc --noEmit

# Run tests
npm test

# Start dev server (slow first start ~21s due to /mnt/e/ I/O, normal)
npm run dev

# Start dev DB
docker compose -f docker/docker-compose.dev.yml up -d

# Run migrations
bash scripts/migrate.sh

# Seed instance_settings + General forum
npx tsx scripts/seed.ts
```

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
```

### App
```
DATABASE_URL=postgresql://user:password@localhost:5432/forum
PUBLIC_BASE_URL=https://yourforum.com
SESSION_SECRET=<random 32+ byte string>
SETUP_COMPLETE=true
```

---

## Key Design Decisions (read before questioning)

- **No Lucia** — Lucia v3 deprecated March 2025; maintainers recommend rolling your own
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
| Add a DB table | `src/lib/db/schema.ts`, then `drizzle-kit generate`, add migration to `migrations/` |
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
| Promote breakglass admin | `docker exec forum-app bash scripts/admin-promote.sh <did>` (requires SSH) |

---

## Phase Status

- **Phase 1 ✅** — Auth, sessions, DB, Docker, abuse stub, setup scripts. Ready for manual E2E testing.
- **Phase 2 ✅** — Forum index, thread listing (with pagination), thread detail (flat posts). Permission enforcement. Slug redirects.
- **Phase 3 ✅** — Post creation (new threads, replies), markdown preview, OG metadata, slug uniqueness. canPost permission.
- **Phase 4** — Moderation & rate limiting (ban/unban, delete/restore, content flagging, real rate limit checks)
- **Phase 5** — Notifications & admin UI (DM worker, email, admin tools, audit log)
- **Phase 6** — Post edits/revisions, full-text search, Docker prod, README, ship

