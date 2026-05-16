# bsBB — Implementation Plan (Archive)

**Status:** Phases 1-3 complete. This document is maintained for historical reference.

For current implementation status, see:
- **ARCHITECTURE.md** — detailed status of all phases
- **QUICK_REFERENCE.md** — current phase status and file map
- **CLAUDE.md** — specification and completed features

Original purpose: Derived from ARCHITECTURE.md. Each task is small enough to complete in one session, ends with a testable gate, and can be paused safely. Phases map to ARCHITECTURE.md §14.

**How to use this doc (if working from the plan):**
- Work top to bottom within a phase. Do not start a task until its gate is cleared.
- Mark tasks `[x]` as completed. Mark the active task `[~]`.
- A phase gate must pass before moving to the next phase.
- "Validate" steps are manual checks. "Test" steps require a passing Vitest run.

---

## Phase 1 — Foundations

### 1.1 Project Scaffold

- [ ] Init SvelteKit project in WSL (`npm create svelte@latest`) — options: skeleton app, TypeScript strict, no additional tools yet
- [ ] Add `@sveltejs/adapter-node`, configure `svelte.config.ts`
- [ ] Add Tailwind CSS v4 + shadcn-svelte; verify a sample component renders
- [ ] Add Vitest; write one trivial passing test to confirm the test runner works
- [ ] Add `.env.example` with all keys from CLAUDE.md env section (values as placeholders)
- [ ] Add `.gitignore`: `node_modules`, `.env`, `logs/`, `client-metadata.json`, `.svelte-kit/`, `build/`
- [ ] Create `logs/` directory with a `.gitkeep`

**Validate:** `wsl -- npm run dev 2>&1 | tee logs/dev.log` starts without errors. Browser shows SvelteKit default page.

---

### 1.2 Drizzle + Database

- [ ] Add Drizzle ORM + `drizzle-kit` + `postgres` (node-postgres driver)
- [ ] Create `src/lib/db/index.ts` — single pool instance, reads `DATABASE_URL` from env
- [ ] Create `src/lib/db/schema.ts` — all tables from ARCHITECTURE.md §3:
  - `users`
  - `forums`
  - `threads`
  - `posts`
  - `post_revisions`
  - `forum_permissions`
  - `user_forum_roles`
  - `notification_queue`
  - `mod_log`
  - `sessions`
  - `instance_settings`
- [ ] Create `drizzle.config.ts`
- [ ] Run `drizzle-kit generate` → confirm migration file created under `src/lib/db/migrations/`
- [ ] Create `scripts/migrate.sh` — wraps `drizzle-kit migrate`, usable inside WSL and via `docker exec`

**Test:** Vitest unit test — import schema, confirm all table objects export without error (type-level smoke test).

**Validate:** Spin up a local Postgres 17 container (`docker run`), run `migrate.sh`, connect with `psql` and confirm all tables exist with correct columns.

---

### 1.3 Docker Compose (dev)

- [ ] Create `docker/docker-compose.yml` with `app` + `db` services (no Caddy yet — dev only)
- [ ] Create `docker/Dockerfile` — multi-stage: `node:22-alpine` build stage → runtime stage
- [ ] Confirm `docker compose up db` starts Postgres and is reachable from WSL host
- [ ] Confirm `migrate.sh` runs cleanly against the composed `db` service

**Validate:** `psql $DATABASE_URL -c '\dt'` lists all tables.

---

### 1.4 Lucia Sessions

- [ ] Add `lucia` v3 + Drizzle adapter
- [ ] Create `src/lib/auth/session.ts` — Lucia init, session validation helper, `createSession`, `invalidateSession`
- [ ] Populate `locals.session` and `locals.user` in `hooks.server.ts`
- [ ] Add TypeScript types for `App.Locals` in `src/app.d.ts`

**Test:** Vitest test — mock a `sessions` row, call session validation, confirm `locals.user` shape matches expected type.

---

### 1.5 ATproto OAuth

- [ ] Add `@atproto/oauth-client-node`
- [ ] Create `src/lib/auth/atproto.ts` — client init, reads `ATPROTO_CLIENT_ID` + `ATPROTO_PRIVATE_KEY` from env
- [ ] Create `src/routes/(auth)/login/+page.svelte` — single handle/DID input field
- [ ] Create `src/routes/(auth)/login/+page.server.ts` — resolve handle → initiate OAuth redirect
- [ ] Create `src/routes/(auth)/callback/+server.ts` — complete token exchange, extract DID from `sub`, upsert `users` row, create Lucia session, redirect to `/`
- [ ] Create `src/routes/(auth)/logout/+server.ts` — POST only, invalidate session, clear cookie, redirect to `/`

**Test:** Vitest test — mock OAuth token response, call upsert logic, confirm `users` row shape and `last_profile_sync` is set.

**Validate:** Full end-to-end with a real Bluesky account: log in → session cookie set → `users` row exists in DB → log out → cookie cleared.

---

### 1.6 Lazy Profile Sync

- [ ] Create `src/lib/auth/profile-sync.ts` — accepts DID, fetches profile from PLC Directory, updates `handle`/`display_name`/`avatar_url`/`last_profile_sync`
- [ ] Call from post-submission server action (Phase 3) — stub the call site now with a `// TODO: trigger sync` comment

**Test:** Vitest test — mock PLC Directory response, confirm DB update fields match fetched profile. Confirm sync is skipped when `last_profile_sync` < 24h.

---

### 1.7 First-Admin Gate

- [ ] In callback handler: after user upsert, query `instance_settings.first_admin_claimed`
- [ ] If `'false'`: set `users.global_role = 'admin'`, set `first_admin_claimed = 'true'`, write `mod_log` row, set a flash message in session
- [ ] In root `+layout.svelte`: display one-time banner if flash message is present

**Test:** Vitest test — simulate first login (claimed = false), confirm role promotion + flag flip + mod_log entry. Simulate second login (claimed = true), confirm no promotion.

**Validate:** Fresh DB — first login promotes to admin and shows banner. Second login (different account) does not.

---

### 1.8 Banned User Redirect

- [ ] In `hooks.server.ts`: after session hydration, if `locals.user.globalRole === 'banned'`, redirect to `/banned/` (except `/banned/` itself and `/logout/`)
- [ ] Create `src/routes/banned/+page.svelte` — static ban message page

**Test:** Vitest test — mock a banned user in locals, confirm redirect fires on a protected route, confirm it does not fire on `/banned/` itself.

---

### 1.9 Abuse Module Stub

- [ ] Create `src/lib/abuse/index.ts` with the full `AbuseContext` union type and `AbuseVerdict` type (see ARCHITECTURE.md §13)
- [ ] Implement `checkAbuse()` as a stub that always returns `{ allowed: true }` and logs the context to `logs/dev.log` in dev mode
- [ ] Add `rate_limit_buckets` table to `src/lib/db/schema.ts`; include in next migration run
- [ ] Add all rate-limit threshold keys to the `instance_settings` seed data (with default values from ARCHITECTURE.md §13)

**Test:** Vitest test — call `checkAbuse` with each `AbuseContext` type, confirm stub always returns `{ allowed: true }` and does not throw.

---

### 1.10 Setup Script

- [ ] Create `scripts/gen-keypair.js` — generates P-256 JWK pair, prints to stdout as JSON
- [ ] Create `scripts/setup.sh`:
  - Check prereqs (`node`, `docker`, `openssl`)
  - Call `gen-keypair.js`, write private key to `.env`
  - Prompt for `PUBLIC_BASE_URL`, generate `client-metadata.json`
  - Prompt for `ATPROTO_SERVICE_HANDLE` + `ATPROTO_SERVICE_APP_PASSWORD`, validate via API call
  - Prompt for SMTP credentials, send test email
  - Prompt for default forum visibility (`public` / `members-only`)
  - Write all vars to `.env` (refuse to overwrite without confirmation)
  - Write `SETUP_COMPLETE=true`
  - Tee all output to `logs/setup.log`
- [ ] Create seed script (`scripts/seed.ts` or inline in migrate.sh) — inserts `instance_settings` rows + General forum

**Validate:** Run `setup.sh` on a clean WSL environment. Confirm `.env` written, `client-metadata.json` generated, `logs/setup.log` populated. Run seed, confirm `instance_settings` and `forums` rows exist.

---

### Phase 1 Gate

- [ ] A real Bluesky account can log in and out
- [ ] `users` row is created on first login, updated on subsequent logins
- [ ] First login promotes to admin exactly once; second account gets `member`
- [ ] Banned user is redirected to `/banned/` on every route
- [ ] `migrate.sh` runs cleanly from scratch (idempotent on re-run)
- [ ] `setup.sh` completes without errors on a clean WSL environment
- [ ] All Vitest tests pass: `wsl -- npm test 2>&1 | tee logs/test.log`

---

## Phase 2 — Read-Only Forum

### 2.1 Permission Resolution

- [ ] Create `src/lib/permissions/index.ts` — pure `resolvePermissions` function:
  - Input: user (or null), forum chain (leaf → root), permission rows, user forum role (or null), instance default
  - Output: `{ canRead, canPost, canModerate }`
  - Resolution order: banned → admin → user_forum_role → forum_permissions row → walk parent chain → instance default

**Test:** Vitest tests covering all resolution paths:
  - Guest on public forum → `canRead: true`
  - Guest on members-only forum → `canRead: false`
  - Banned user → all false
  - Admin → all true
  - Forum mod → `canModerate: true`
  - Child forum inherits from parent when no explicit row
  - Explicit child row overrides parent

---

### 2.2 Forum Index Page

- [ ] Create `src/routes/(forum)/+page.server.ts` — load top-level forums, filter by `resolvePermissions` for current user
- [ ] Create `src/routes/(forum)/+page.svelte` — list forums with name, description, last-post metadata

**Validate:** Forums visible to guests on a public instance. Members-only forum hidden to guests.

---

### 2.3 Forum Thread List Page

- [ ] Create `src/routes/(forum)/f/[forumSlug]/+page.server.ts`:
  - Load forum by slug, 403 if not found or no `canRead`
  - Load threads paginated (25/page), sorted by `last_post_at` desc
  - Pass current page from `/page/[n]/` param
- [ ] Create `src/routes/(forum)/f/[forumSlug]/+page.svelte` — thread list with title, author handle, post count, last post time
- [ ] Create `src/routes/(forum)/f/[forumSlug]/page/[n]/` — same load function, different page param
- [ ] Add pagination component (prev/next + page numbers)

**Test:** Vitest test — mock forum + thread data, confirm pagination math (25/page, correct offset).

**Validate:** Forum page loads. Navigating to page 2 shows correct threads. Non-existent forum returns 404.

---

### 2.4 Thread View Page

- [ ] Create `src/routes/(forum)/f/[forumSlug]/t/[threadId]/+page.server.ts`:
  - Load thread by UUID, verify it belongs to the forum slug (404 if mismatch)
  - Load posts paginated (25/page), flat-chronological, `is_deleted = false` (show tombstone for deleted)
  - Check `canRead` permission
- [ ] Create `src/routes/(forum)/f/[forumSlug]/t/[threadId]/+page.svelte` — flat post list
- [ ] Create `src/routes/(forum)/f/[forumSlug]/t/[threadId]/page/[n]/` — paginated continuation
- [ ] Handle cosmetic slug: `src/routes/(forum)/f/[forumSlug]/t/[threadId]/[titleSlug]/+server.ts` — 301 redirect to canonical URL

**Test:** Vitest test — confirm 301 fires when slug is wrong or missing. Confirm correct slug passes through.

**Validate:** Thread page loads with posts. Wrong title slug in URL redirects to correct one. Non-existent thread ID returns 404.

---

### 2.5 Guest Enforcement & Layout

- [ ] Update `src/routes/+layout.server.ts` — pass `locals.user` to all pages
- [ ] Update `src/routes/+layout.svelte` — nav: show Login or user handle + logout
- [ ] Enforce `canRead` check in forum and thread load functions (return 403 or redirect to login)

**Validate:** Members-only instance: guest visiting `/f/general/` is redirected to login. After login, page loads.

---

### Phase 2 Gate

- [ ] Guest can browse a public forum end-to-end (index → forum → thread)
- [ ] Members-only forum returns 403/redirect for unauthenticated guests
- [ ] Pagination works correctly at 25 posts/page
- [ ] Wrong title slug in thread URL 301-redirects to correct canonical URL
- [ ] Permission resolution Vitest tests all pass
- [ ] All existing Vitest tests still pass

---

## Phase 3 — Posting & Content

### 3.1 Markdown Pipeline

- [ ] Add `unified`, `remark-parse`, `remark-rehype`, `rehype-sanitize`, `rehype-stringify`
- [ ] Create `src/lib/markdown/index.ts` — export `renderMarkdown(markdown: string): Promise<string>`
- [ ] Configure `rehype-sanitize` allowlist: standard inline/block elements, no `<script>`, no `<style>`, no event attributes

**Test:** Vitest tests:
  - `<script>alert(1)</script>` in input → no `<script>` in output
  - `<img onerror="...">` → attribute stripped
  - Standard markdown (bold, links, code blocks) renders correctly
  - Output is deterministic (same input → same output, run twice)

---

### 3.2 OG Metadata Fetch

- [ ] Add `open-graph-scraper`
- [ ] Create `src/lib/og/index.ts` — `fetchLinkMetadata(markdown: string): Promise<LinkMetadata | null>`
  - Detect first bare URL (regex: `^\s*(https?:\/\/[^\s]+)\s*$`)
  - Fetch OG tags (3s timeout, single attempt, swallow errors)
  - Return `{ url, title, description, imageUrl }` or `null`
- [ ] Check `instance_settings.og_fetch_enabled` before fetching (default `true`; admin can disable)
- [ ] Call `checkAbuse({ type: 'og_fetch', ip })` before fetching
- [ ] Add `isPrivateAddress(url: string): boolean` stub in `src/lib/og/index.ts` — reject RFC 1918 ranges and loopback (`10.x`, `172.16-31.x`, `192.168.x`, `127.x`, `::1`, `0.0.0.0`) before making any outbound request (SSRF guard; stub returns `false` in Phase 3, real logic filled in Phase 4)

**Test:** Vitest tests:
  - URL embedded in sentence → returns null
  - URL in code block → returns null
  - Bare URL on own line → fetch attempted
  - Fetch timeout/error → returns null (no throw)
  - Private IP URL (e.g. `http://192.168.1.1/`) → returns null without fetching (Phase 4)

---

### 3.3 Markdown Preview Endpoint

- [ ] Create `src/routes/api/preview/+server.ts` — POST handler: accept `{ markdown }`, run `renderMarkdown`, return `{ html }`
- [ ] Call `checkAbuse({ type: 'preview_request', did, ip })` — return 429 if not allowed

**Test:** Vitest test — POST with markdown body, confirm HTML response, confirm `<script>` is stripped.

---

### 3.4 CodeMirror Editor Component

- [ ] Add `codemirror` + `@codemirror/lang-markdown` + `@codemirror/view` etc.
- [ ] Create `src/lib/components/MarkdownEditor.svelte`:
  - CodeMirror 6 editor
  - "Preview" toggle button — POSTs to `/api/preview/`, renders returned HTML in a preview pane
  - Hidden `<textarea>` that syncs the markdown value for form submission

**Validate:** Editor loads, typing markdown and clicking Preview shows rendered output. Form submit sends raw markdown (not HTML).

---

### 3.5 New Thread Form

- [ ] Create `src/routes/(forum)/f/[forumSlug]/new/+page.svelte` — title input + MarkdownEditor
- [ ] Create `src/routes/(forum)/f/[forumSlug]/new/+page.server.ts` actions:
  - Call `checkAbuse({ type: 'thread_create', did, ip })` — return 429 if not allowed
  - Auth check + `canPost` permission check
  - Validate title (non-empty, max 300 chars)
  - Generate thread slug from title (`src/lib/utils/slug.ts`); handle collision (append `-2`, `-3`, etc.)
  - Run `renderMarkdown` on body
  - Fetch OG metadata
  - Insert `threads` row + `posts` row in a transaction
  - Trigger lazy profile sync if needed
  - Redirect to new thread canonical URL

**Test:** Vitest test — submit valid thread, confirm `threads` and `posts` rows created. Confirm `body_html` is sanitized. Confirm slug collision handling.

**Validate:** Create a thread via the UI. Appears in thread list. OG card rendered if bare URL present.

---

### 3.6 Reply Form

- [ ] Add reply form below thread page (auth required, `canPost`)
- [ ] Create server action in thread `+page.server.ts`:
  - Call `checkAbuse({ type: 'post_submit', did, ip })` — return 429 if not allowed
  - Validate body (non-empty, max configurable length — default 100,000 chars)
  - Optional `reply_to_post_id` (from "Quote" button — sends post ID)
  - Run `renderMarkdown`, fetch OG metadata
  - Insert `posts` row
  - Update `threads.last_post_at`
  - Enqueue notifications (see Phase 5) — stub with `// TODO: notify` for now
  - Trigger lazy profile sync
  - Redirect to last page of thread (or the new post anchor)
- [ ] Add "Quote" button on each post — populates `reply_to_post_id` and prefills editor with `> quoted text`

**Test:** Vitest test — submit reply, confirm post inserted, `last_post_at` updated. Confirm `reply_to_post_id` stored correctly.

---

### 3.7 Post Editing + Revision History

- [ ] Add "Edit" button on posts (own posts only; mods/admins can edit any post)
- [ ] Server action for edit:
  - Save current `body_markdown` + `body_html` to `post_revisions` (increment `revision_number`)
  - Re-render markdown + re-fetch OG if bare URL changed
  - Update `posts` row (`body_markdown`, `body_html`, `edited_at`)
  - All in a transaction
- [ ] Create `src/routes/post/[postId]/revisions/+page.server.ts` + `+page.svelte` — list revisions with timestamps and diffs rendered as side-by-side snapshots

**Test:** Vitest test — edit post twice, confirm two revision rows, correct `revision_number` sequence, original body preserved. Confirm `body_html` in revisions is sanitized.

**Validate:** Edit a post, check revision page shows original content.

---

### Phase 3 Gate

- [ ] Can create a thread with markdown body
- [ ] Can reply to a thread; reply appears flat-chronological
- [ ] Can quote a post; `reply_to_post_id` is stored
- [ ] OG card appears for a bare URL post; does not appear for inline URL
- [ ] Can edit a post; revision page shows original version
- [ ] `<script>` tags in markdown input are stripped from stored HTML
- [ ] Preview endpoint returns sanitized HTML
- [ ] All Vitest tests pass

---

## Phase 4 — Moderation & Permissions

### 4.1 Forum Mod Assignment UI

- [ ] Create `src/routes/(admin)/admin/forums/+page.svelte` + server — list forums, create/edit/delete forum
- [ ] Create forum edit page — set name, description, slug, parent, sort order
- [ ] Add moderator assignment UI on forum edit page — search user by handle → resolve to DID → insert `user_forum_roles` row
- [ ] Write `mod_log` entry for assignment/removal

**Validate:** Admin can create a sub-forum, assign a moderator, verify `user_forum_roles` row and `mod_log` entry.

---

### 4.2 Per-Forum Permission Management

- [ ] Add permission matrix UI on forum edit page — rows: `guest`, `member`, `moderator`; columns: `can_read`, `can_post`, `can_moderate`; checkboxes write `forum_permissions` rows
- [ ] Add "inherit from parent" option (deletes the explicit row, falls back to inheritance)
- [ ] Add instance default visibility toggle in `src/routes/(admin)/admin/settings/`

**Validate:** Set a forum to members-only. Confirm guest cannot read. Remove explicit row. Confirm it inherits parent (or instance default).

---

### 4.3 Flagging / Reporting

- [ ] Add "Flag" button on each post (auth required)
- [ ] Server action:
  - Call `checkAbuse({ type: 'flag_submit', did, ip })` — return 429 if not allowed
  - Insert `notification_queue` row of type `mod_alert` for all forum mods + global admins
- [ ] Prevent duplicate flags from the same user on the same post (unique check or cooldown)

**Test:** Vitest test — flag a post, confirm notification rows created for correct recipients only.

---

### 4.4 Moderation Queue

- [ ] Create `src/routes/(mod)/mod/queue/+page.server.ts` — load pending `mod_alert` notifications for forums the current user moderates (or all, if admin)
- [ ] Create `src/routes/(mod)/mod/queue/+page.svelte` — list flagged posts with context
- [ ] Actions per item: Delete post (soft), Dismiss flag, Ban user
- [ ] Each action writes a `mod_log` entry
- [ ] Redirect non-moderators (403)

**Validate:** Flag a post as a regular user. Log in as moderator of that forum. See flag in queue. Dismiss it. Confirm `mod_log` entry.

---

### 4.5 Post Deletion & Thread Locking

- [ ] Soft-delete action: set `posts.is_deleted = true`; display tombstone `[post deleted]` in thread view
- [ ] Lock thread action: set `threads.is_locked = true`; hide reply form; show lock indicator
- [ ] Pin thread: set `threads.is_pinned = true`; pinned threads sort to top of forum list
- [ ] All actions write `mod_log` entries

**Validate:** Delete a post — tombstone appears. Lock a thread — reply form hidden. Pin a thread — appears at top.

---

### 4.6 Ban Management

- [ ] Ban action (from mod queue or admin user page): set `users.global_role = 'banned'`, write `mod_log`
- [ ] Unban action: set back to `'member'`, write `mod_log`
- [ ] Confirm banned user redirect works immediately (session re-checked on next request)
- [ ] Create `src/routes/(admin)/admin/users/+page.svelte` — list users, search by handle, view role, ban/unban

**Validate:** Ban a user. Their next request redirects to `/banned/`. Unban them. They can access the forum again.

---

### 4.7 Mod Log Viewer

- [ ] Create `src/routes/(mod)/mod/log/+page.server.ts` + `+page.svelte` — paginated mod log, filterable by action type
- [ ] Confirm: no delete or update route for `mod_log` exists anywhere

**Validate:** Every action taken in 4.4–4.6 appears in the log with correct actor DID, target, and reason.

---

### 4.8 Rate Limiting & Anti-Abuse (fill in stub)

- [ ] Implement real logic in `src/lib/abuse/index.ts`:
  - Fixed-window counter using `rate_limit_buckets` table
  - Load thresholds from `instance_settings` at startup (cache in memory; reload on change)
  - Enforce all limits from ARCHITECTURE.md §13 rate limit tiers table
  - Apply new-account cooldown: stricter `thread_create` limit if `accountAgeHours < new_account_cooldown_hours`
  - Return `{ allowed: false, reason, retryAfterSeconds }` on violation
- [ ] In `hooks.server.ts`: call `checkAbuse({ type: 'login_attempt', ip })` on all pre-auth POST requests; return 429 with `Retry-After` header
- [ ] Fill in `isPrivateAddress()` in `src/lib/og/index.ts` — reject RFC 1918, loopback, link-local addresses before OG fetch
- [ ] Add worker loop task: `DELETE FROM rate_limit_buckets WHERE window_start < now() - interval '2 hours'`
- [ ] Log all rate-limit violations to `logs/dev.log` with context type, identifier, and count

**Test:** Vitest tests:
  - Simulate 11 `post_submit` actions from same DID within 1 min → 429 on 11th
  - Simulate 10 `login_attempt` from same IP within 10 min → 429 on 11th
  - New account (< 24h) hits thread limit faster than established account
  - Private IP in OG fetch → blocked without outbound request
  - Expired bucket rows do not affect counts

---

### Phase 4 Gate

- [ ] Admin can create forums, assign mods, set per-forum permissions
- [ ] Permission inheritance works (child inherits parent; explicit row overrides)
- [ ] Flagged posts appear in mod queue for the right moderators
- [ ] Soft delete, lock, pin all work and appear in mod log
- [ ] Ban redirects immediately; unban restores access
- [ ] Mod log is read-only — no UI or route to delete entries
- [ ] Rate limiting returns 429 on violation
- [ ] All Vitest tests pass

---

## Phase 5 — Notifications & Admin

### 5.1 Notification Worker

- [ ] Create `src/lib/notifications/worker.ts`:
  - `startNotificationWorker()` — guarded by module-level `started` flag
  - `setInterval` every 60s: query `notification_queue WHERE status = 'pending' LIMIT 50`
  - Dispatch each by `type` to the appropriate send function
  - Mark `sent` or `failed`, set `sent_at`
  - Log each send attempt to `logs/worker.log`
- [ ] Start worker in `hooks.server.ts` (after session init)

**Test:** Vitest test — mock DB query returning two pending notifications, confirm both are processed and marked, confirm no double-send on re-run.

---

### 5.2 Bluesky DM Send

- [ ] Add `@atproto/api`
- [ ] Create `src/lib/notifications/send-dm.ts`:
  - Init service account session using `ATPROTO_SERVICE_HANDLE` + `ATPROTO_SERVICE_APP_PASSWORD`
  - `sendDm(recipientDid, message)` — check rate limit (1 DM/recipient/hour), then send
  - Return `sent` or `failed`
- [ ] Create `src/lib/crypto/index.ts` — `encrypt(text)` / `decrypt(text)` using AES-256 + `SESSION_SECRET`

**Test:** Vitest test — mock `@atproto/api`, confirm rate limit suppresses second DM within 1 hour. Confirm encrypt/decrypt round-trips correctly.

**Validate:** Opted-in user receives a Bluesky DM when another user replies to their thread.

---

### 5.3 Tier 2 OAuth (DM opt-in)

- [ ] Create `src/routes/(user)/profile/+page.svelte` — show current notification setting; "Enable Bluesky DM notifications" toggle
- [ ] Server action: initiate new OAuth request with scope `atproto transition:chat.bsky`
- [ ] On callback: encrypt tokens, store in `users.chat_session_encrypted`
- [ ] Show clear consent copy: "This allows the forum to send you direct messages on Bluesky."

**Validate:** Enable DM notifications, complete OAuth, confirm `chat_session_encrypted` is set (non-null, not plaintext).

---

### 5.4 Wire Up Notification Triggers

Replace `// TODO: notify` stubs from Phase 3:

- [ ] Reply to thread → notify thread author (if opted in, not self)
- [ ] Reply to thread → notify `new_reply_in_thread` for all thread participants who are opted in (dedup: one notification per thread per hour per recipient)
- [ ] Quote (reply with `reply_to_post_id`) → notify quoted post's author
- [ ] Mod action on user's content → notify affected user

All enqueued in same transaction as the triggering event.

**Test:** Vitest test — create a reply, confirm correct `notification_queue` rows inserted. Confirm no self-notification. Confirm dedup logic.

---

### 5.5 Email Notifications

- [ ] Create `src/lib/notifications/send-email.ts` — `sendEmail(to, subject, body)` using Nodemailer + SMTP env vars
- [ ] Wire mod queue notifications: new flag → email all moderators of that forum + admins
- [ ] Worker dispatches `mod_alert` type notifications to `send-email`

**Validate:** Flag a post. Confirm moderator email received (use a test SMTP service like Mailpit in dev).

---

### 5.6 Admin Settings Page

- [ ] Create `src/routes/(admin)/admin/settings/+page.svelte` + server:
  - Toggle `default_forum_visibility`
  - Toggle `og_fetch_enabled`
  - Display `first_admin_claimed` status (read-only)

---

### 5.7 Breakglass Script

- [ ] Create `scripts/admin-promote.js` — accepts `--did` or `--handle` flag:
  - Resolve handle → DID if needed
  - Verify DID exists in `users` table
  - Set `global_role = 'admin'`
  - Write `mod_log` entry (`action = 'promote_admin'`, `reason = 'breakglass'`)
  - Print confirmation: DID, handle, timestamp
- [ ] Create `scripts/admin-promote.sh` — thin wrapper that calls `docker exec forum-app node scripts/admin-promote.js "$@"`
- [ ] Document in README under "Emergency Admin Access"

**Validate:** Run `admin-promote.sh --handle <handle>` against a running container. Confirm role updated in DB and `mod_log` entry written.

---

### Phase 5 Gate

- [ ] Worker starts once and processes notification queue every 60s
- [ ] Opted-in user receives Bluesky DM for reply/quote events
- [ ] Moderator receives email when a post in their forum is flagged
- [ ] DM rate limit (1/hour/recipient) is enforced
- [ ] `chat_session_encrypted` is AES-256 encrypted, never plaintext
- [ ] Breakglass script works and always writes a mod_log entry
- [ ] All Vitest tests pass

---

## Phase 6 — Search, Docker & Shipping

### 6.1 Full-Text Search

- [ ] Add search route: `src/routes/search/+page.server.ts` + `+page.svelte`
- [ ] Query: `WHERE body_tsv @@ plainto_tsquery('english', $query)` on `posts` joined to `threads` and `forums`
- [ ] Filter results by `resolvePermissions` for current user (don't leak members-only content to guests)
- [ ] Paginate results (25/page)
- [ ] Optionally: add `pg_trgm` index and fuzzy fallback if exact match returns 0 results

**Test:** Vitest test — insert two posts, search for a term in one, confirm only that post returned.

**Validate:** Search for a word that appears in a post. Result appears with correct thread/forum link. Search as guest — members-only post does not appear.

---

### 6.2 Dockerfile & Compose (production)

- [ ] Finalize `docker/Dockerfile` — multi-stage build, non-root user, health check
- [ ] Finalize `docker/docker-compose.yml` — add Caddy service, named volumes, restart policies, env_file
- [ ] Create `docker/Caddyfile`:
  - Reverse proxy to `app:3000`
  - Serve `/client-metadata.json` from static mount
  - CSP headers
  - Automatic HTTPS
- [ ] Create `docker/caddy-static/` directory (mounted into Caddy; `client-metadata.json` goes here post-setup)

**Validate:** `docker compose up` on a fresh WSL environment. All three containers start. `https://localhost` (or test domain) serves the forum.

---

### 6.3 Migration & Deploy Scripts

- [ ] Finalize `scripts/migrate.sh` — runs inside container on deploy, idempotent
- [ ] Add deploy documentation: `git pull` → `docker compose build app` → `docker compose up -d`
- [ ] Test migration idempotency: run `migrate.sh` twice against same DB, confirm no error

---

### 6.4 Backup Cron

- [ ] Document backup cron in README (host-level, not in container):
  ```
  0 2 * * * docker exec forum-db pg_dump -U postgres forum | gzip | \
    rclone rcat r2:forum-backups/$(date +%Y-%m-%d).sql.gz
  ```
- [ ] Document restore procedure
- [ ] Test restore: take a dump, drop all tables, restore, confirm data intact

---

### 6.5 README & Deployer Docs

- [ ] Write `README.md`:
  - Prerequisites (Docker, WSL2 or Linux, a Bluesky account for the bot)
  - Quick start: clone → `setup.sh` → `docker compose up`
  - First login / first admin instructions (with warning about one-time nature)
  - Backup setup
  - Emergency admin access (breakglass)
  - Environment variable reference (link to `.env.example`)
  - Self-hosted PDS (advanced, external link)

---

### Phase 6 Gate

- [ ] Search returns correct results and respects permissions
- [ ] `docker compose up` from scratch produces a working forum
- [ ] `setup.sh` → `docker compose up` → first login flow works end-to-end
- [ ] Backup and restore procedure tested successfully
- [ ] README is accurate — a developer unfamiliar with the project can deploy it by following it
- [ ] All Vitest tests pass
- [ ] `npx tsc --noEmit` reports zero errors

---

## Cross-Cutting Checklist (verify before calling any phase complete)

- [ ] No `users.handle` used as a foreign key anywhere
- [ ] No markdown rendered client-side (all preview via `/api/preview/`)
- [ ] No permission logic outside `src/lib/permissions/index.ts`
- [ ] No DB client instantiated outside `src/lib/db/index.ts`
- [ ] `mod_log` has no delete or update route
- [ ] All `body_html` columns populated via `renderMarkdown()` only
- [ ] All session cookies are `SameSite=Strict`, `HttpOnly`, `Secure`
- [ ] `chat_session_encrypted` is never stored or logged as plaintext
- [ ] `npx tsc --noEmit` passes
- [ ] No file exceeds 300 lines (if so: propose split per GUARDRAILS Rule 13)
- [ ] No inline rate-limit or abuse checks — all calls go through `checkAbuse()` in `src/lib/abuse/index.ts`
- [ ] `isPrivateAddress()` guard is in place before every outbound OG fetch
- [ ] `rate_limit_buckets` table is only touched by `src/lib/abuse/index.ts`
