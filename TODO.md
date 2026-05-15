# TODO — Manual Tasks & Blockers

Items that require human action, credentials, external setup, or manual testing. Track progress here.

---

## Phase 1 — Manual Testing (Blocked on Bluesky Account)

These tasks must be completed before Phase 1 is fully shipped. Blocked on having a real Bluesky account to test with.

### 🔒 ATproto OAuth Setup & Testing

- [ ] Create or use a Bluesky account for testing (or use an existing one)
- [ ] Generate P-256 JWK keypair via `scripts/gen-keypair.js`
  ```bash
  export PATH=/home/agi/.nvm/versions/node/v24.14.0/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:$PATH
  npx tsx scripts/gen-keypair.js
  ```
  - Outputs to `.env` as `ATPROTO_PRIVATE_KEY`
  - Outputs `client-metadata.json` to `docker/caddy-static/`

- [ ] Set up ATproto OAuth Client ID
  - For local dev: use a ngrok tunnel or point a real domain to localhost
  - `ATPROTO_CLIENT_ID` must be the public HTTPS URL to `client-metadata.json`
  - Example: `https://yourforum.ngrok.io/client-metadata.json` or `https://bsbB.example.com/client-metadata.json`

- [ ] Test OAuth flow end-to-end
  - Start dev server: `npm run dev`
  - Navigate to `/login`
  - Verify redirect to PDS authorization server
  - Complete OAuth flow on Bluesky
  - Verify redirect back to callback handler
  - Check that session cookie is set

### 👤 User Management Testing

- [ ] **First login — Auto-admin promotion**
  - Verify `users` table row created with correct DID, handle, display_name, avatar_url
  - Verify `global_role = 'admin'` set to `true`
  - Verify `instance_settings.first_admin_claimed` set to `'true'`
  - Verify one-time banner shown on first login
  - Verify `mod_log` entry created with `action = 'promote_admin'`
  - Log out and log back in as same user
  - Verify banner does NOT show on second login
  - Verify user is still admin

- [ ] **Second login — Member role**
  - Use a different Bluesky account
  - Log in and verify `global_role = 'member'` (not admin)
  - Verify no banner shown

- [ ] **Profile sync — Lazy update**
  - Log in with first account
  - Manually update your Bluesky profile (handle, display name, or avatar)
  - Check DB: `last_profile_sync` should be old (from first login)
  - Create a post (Phase 2+ — not yet implemented)
  - Verify `last_profile_sync` is updated
  - Verify cached profile (handle, display_name, avatar_url) is refreshed
  - *(Can skip until Phase 2 posts are implemented)*

### 🚫 Banned User Testing

- [ ] **Banned user redirect**
  - Manually update DB: `UPDATE users SET global_role = 'banned' WHERE did = '...'`
  - Try to access any page (except `/banned` and `/logout`)
  - Verify redirect to `/banned`
  - Verify sign-out button works
  - After sign out, verify redirect back to `/login`

- [ ] **Unbanned user re-access**
  - Manually update DB: `UPDATE users SET global_role = 'member' WHERE did = '...'`
  - Log back in
  - Verify no redirect to `/banned`
  - Verify can access forum

---

## Phase 2 — Forum CRUD (✅ Complete — Read-only views)

These tasks are next. Some may be blocked on Phase 1 completion or have their own blockers.

- [ ] **Forum listing & display**
  - [ ] Create forum hierarchy in DB (via SQL or admin UI once built)
  - [ ] List top-level forums on homepage
  - [ ] List sub-forums within a parent
  - [ ] Display forum description and thread count

- [ ] **Thread listing & pagination**
  - [ ] List threads in a forum with pagination
  - [ ] Show thread title, author, post count, last post time
  - [ ] Sort by last_post_at (default), or by created_at
  - [ ] Implement "pinned" thread priority

- [ ] **Thread detail page**
  - [ ] Display thread title and metadata (author, created_at)
  - [ ] List all posts in thread (flat, chronological)
  - [ ] Show post author info (handle, avatar, DID)
  - [ ] Show post body (rendered HTML)
  - [ ] Show reply-to references (if post.reply_to_post_id is set)
  - [ ] Soft-deleted posts: show placeholder or hide entirely

- [ ] **Search (basic)**
  - [ ] Full-text search via PostgreSQL `tsvector`
  - [ ] Search form on homepage
  - [ ] Display search results with pagination

- [ ] **Permission enforcement**
  - [ ] Check `forum_permissions` on forum listing
  - [ ] Hide forums user cannot read
  - [ ] Show "access denied" if user tries to access forum directly but lacks permission
  - [ ] Recursive permission check: guest/member/moderator/admin

---

## Phase 3 — Posting & Content (Deferred)

- [ ] **Editor form & submission**
  - [ ] CodeMirror 6 markdown editor
  - [ ] Live preview button (server-rendered via `/api/preview`)
  - [ ] Markdown validation before submit
  - [ ] CSRF protection

- [ ] **OG/link metadata fetch**
  - [ ] Extract first bare-line URL from post
  - [ ] Fetch OG metadata via `open-graph-scraper`
  - [ ] Store in `link_metadata` JSONB column
  - [ ] Render as card in thread view

- [ ] **Post revisions**
  - [ ] Track all edits in `post_revisions` table
  - [ ] Show "edited" indicator on post if edited
  - [ ] Link to `/post/[id]/revisions/` to view history

---

## Phase 4 — Moderation & Rate Limiting (Deferred)

- [ ] **Abuse/rate limiting enforcement**
  - [ ] Implement `src/lib/abuse/index.ts` real logic
  - [ ] Wire up `checkAbuse()` call sites
  - [ ] Test rate limits: post_submit, thread_create, login_attempt, etc.

- [ ] **Ban/suspend UI**
  - [ ] Admin endpoint to ban user by DID
  - [ ] Write `mod_log` entry
  - [ ] Verify banned user gets redirected

- [ ] **Post deletion & restoration**
  - [ ] Soft-delete posts (set `is_deleted = true`)
  - [ ] Hide deleted posts in views (or show placeholder)
  - [ ] Admin endpoint to restore post

- [ ] **Thread lock/pin**
  - [ ] Admin endpoint to lock thread (prevent new posts)
  - [ ] Admin endpoint to pin thread
  - [ ] Verify pinned threads appear first in forum listing

---

## Phase 5 — Notifications & Admin (Deferred)

- [ ] **Notification worker**
  - [ ] Implement `src/lib/notifications/worker.ts`
  - [ ] Poll `notification_queue` every 60 seconds
  - [ ] Send DMs via `@atproto/api`
  - [ ] Rate limit: max 1 DM per recipient per hour
  - [ ] Mark sent/failed in queue

- [ ] **Service account setup**
  - [ ] Create a Bluesky account for notifications (e.g., `notifications@yourforum.bsky.social`)
  - [ ] Generate app password
  - [ ] Store in `ATPROTO_SERVICE_HANDLE` and `ATPROTO_SERVICE_APP_PASSWORD`
  - [ ] Test DM send

- [ ] **Email setup (SMTP)**
  - [ ] Configure SMTP provider (Mailgun, SendGrid, etc.)
  - [ ] Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
  - [ ] Test email send via Nodemailer

- [ ] **Admin UI**
  - [ ] Forum management (create/edit/delete, set permissions)
  - [ ] User management (view roles, assign roles, ban/unban)
  - [ ] Instance settings (default visibility, rate limits)
  - [ ] Moderation queue (flagged posts)
  - [ ] Audit log viewer

---

## Phase 6 — Search & Shipping (Deferred)

- [ ] **Full-text search optimization**
  - [ ] Test `body_tsv` indexed search performance
  - [ ] Optimize GIN index if needed
  - [ ] Add `pg_trgm` for fuzzy matching (optional)

- [ ] **Docker & production build**
  - [ ] Test full Docker Compose stack
  - [ ] Verify Caddy reverse proxy works
  - [ ] Verify `client-metadata.json` served statically
  - [ ] CSP headers configured

- [ ] **README & setup script**
  - [ ] Write detailed README
  - [ ] Test `scripts/setup.sh` on fresh instance
  - [ ] Verify keypair generation, client-metadata.json creation, .env population
  - [ ] Verify migrations run
  - [ ] Verify first user becomes admin

---

## Environment & Credentials Checklist

Items to gather before moving to production:

- [ ] **Bluesky test account(s)**
  - Account handle: ___________
  - Password: (in password manager)

- [ ] **ATproto OAuth**
  - [ ] P-256 JWK keypair generated (see Phase 1)
  - [ ] `ATPROTO_PRIVATE_KEY` in `.env`
  - [ ] `ATPROTO_CLIENT_ID` (public HTTPS URL to `client-metadata.json`)

- [ ] **Domain & HTTPS**
  - Domain: ___________
  - [ ] DNS pointing to server
  - [ ] Caddy auto-renews TLS cert

- [ ] **Service account (notifications)**
  - Account handle: ___________
  - App password: (in password manager)
  - [ ] `ATPROTO_SERVICE_HANDLE` in `.env`
  - [ ] `ATPROTO_SERVICE_APP_PASSWORD` in `.env`

- [ ] **SMTP (email)**
  - [ ] Provider chosen (Mailgun, SendGrid, etc.)
  - [ ] `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` in `.env`
  - [ ] Test email sent and received

- [ ] **Database**
  - [ ] PostgreSQL 17 running (dev: Docker, prod: managed service or self-hosted)
  - [ ] `DATABASE_URL` in `.env`
  - [ ] Migrations applied
  - [ ] Backups configured (R2/B2 + rclone)

- [ ] **Session secret**
  - [ ] 32+ byte random string generated
  - [ ] `SESSION_SECRET` in `.env`

---

## Notes

- All `.env` variables must be set before `docker compose up`
- `client-metadata.json` is a **generated artifact** — never edit by hand, always regenerate via `scripts/gen-keypair.js`
- `SETUP_COMPLETE=true` is set by `scripts/setup.sh` — do not set manually unless you know what you're doing
- See QUICK_REFERENCE.md for environment variable details
- See CLAUDE.md for full design decisions

