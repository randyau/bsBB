# Human TODO — Manual Testing & Setup Checklist

This document tracks tasks that require human action: credentials, external services, real-browser testing, and production deployment steps. Update checkboxes as you complete each item.

---

## Part 1 — Environment Setup (Required Before Any Testing)

### 1.1 Secrets & Keypairs

- [ ] Run `npx tsx scripts/gen-keypair.js` to generate the ATproto P-256 JWK keypair
  - Writes `ATPROTO_PRIVATE_KEY` to `.env`
- [ ] Generate a session secret (32+ random bytes):
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
  - Set as `SESSION_SECRET` in `.env`
- [ ] Generate an encryption key for chat tokens:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
  - Set as `ENCRYPTION_KEY` in `.env` (64 hex chars = 32 bytes)

### 1.2 ATproto OAuth

- [ ] Create or choose a Bluesky account for testing (your personal account is fine)
- [ ] Set `PUBLIC_BASE_URL` to a publicly reachable HTTPS URL
  - For local dev: use ngrok (`ngrok http 5173`) and set the ngrok URL
  - For production: your real domain
- [ ] Set `ATPROTO_CLIENT_ID` to `$PUBLIC_BASE_URL/client-metadata.json`
- [ ] Verify `GET /client-metadata.json` returns valid JSON before attempting login

### 1.3 Notification Bot Account

- [ ] Create a dedicated Bluesky account for forum notifications (e.g., `notifications.yourforum.bsky.social`)
  - Or use your own account for testing — it won't post publicly
- [ ] Generate an App Password (Bluesky Settings → Privacy and Security → App Passwords)
- [ ] Set `ATPROTO_SERVICE_HANDLE` and `ATPROTO_SERVICE_APP_PASSWORD` in `.env`

### 1.4 Email / SMTP

- [ ] Choose an SMTP provider (Mailgun, Postmark, AWS SES, etc.)
- [ ] Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` in `.env`
- [ ] Set `ADMIN_EMAIL` to the address that should receive moderator alerts
- [ ] Test email delivery: `npx tsx scripts/test-email.js <your-email>`

### 1.5 Database

- [ ] Start the database: `docker compose up db -d`
- [ ] Run migrations: `npx drizzle-kit migrate`
- [ ] Verify schema: `docker exec -it forum-db psql -U postgres forum -c '\dt'`

---

## Part 2 — Auth & Session Flow

- [ ] Start dev server: `npm run dev`
- [ ] Navigate to `/login` — verify the login form renders
- [ ] Click "Sign in with Bluesky", enter handle, submit
- [ ] Verify redirect to your PDS authorization page
- [ ] Authorize the app on Bluesky
- [ ] Verify redirect back to the forum (callback URL)
- [ ] Verify session cookie is set (`session` cookie, HttpOnly, SameSite=Strict)
- [ ] Verify user row in `users` table has correct `did`, `handle`, `display_name`, `avatar_url`

### First-Admin Promotion

- [ ] Verify `global_role = 'admin'` is set for first login user
- [ ] Verify `instance_settings.first_admin_claimed = 'true'` after first login
- [ ] Verify the one-time admin welcome banner appears on first login
- [ ] Log out and log back in — verify banner does NOT reappear
- [ ] Log in with a second account — verify `global_role = 'member'`

### Session Expiry

- [ ] Manually set a session's `expires_at` to the past in the DB
- [ ] Reload any page — verify redirect to `/login`

---

## Part 3 — Forum Browsing

- [ ] Seed a forum if none exists (insert a row in `forums` table or use admin UI)
- [ ] Visit `/` — verify the forum index shows the seeded forum
- [ ] Visit `/f/[slug]` — verify thread listing renders (empty is fine)
- [ ] Verify guest access works for public forums (log out and browse)
- [ ] Verify members-only forum shows 403 to logged-out users

---

## Part 4 — Post Creation

- [ ] Log in, navigate to a forum, click "New Thread"
- [ ] Submit a thread with markdown content — verify it renders correctly
- [ ] Verify a link preview card appears when post contains a bare URL on its own line
- [ ] Verify the OG fetch does NOT attempt to fetch private IPs (test with `http://192.168.1.1` — should silently skip)
- [ ] Post a reply to the thread — verify it appears in flat-chronological order
- [ ] Use the quote button on a post — verify the reply form pre-fills with the quote reference
- [ ] Verify you cannot post in a locked thread (lock it via admin first)

---

## Part 5 — Post Editing & Revisions

- [ ] Edit a post you authored — verify the inline editor appears
- [ ] Save the edit — verify the post body updates and "edited" timestamp appears
- [ ] Edit the same post again — verify this does NOT crash (revision #2 must be created)
- [ ] Navigate to `/f/[forum]/t/[thread]/post/[postId]/revisions/` — verify revision history lists all previous versions
- [ ] Verify you cannot edit another user's post (non-admin)
- [ ] Verify an admin CAN edit any post

---

## Part 6 — Search

- [ ] Use the search bar to search for text in a post you created
- [ ] Verify results appear and link to the correct thread
- [ ] Search for something that doesn't exist — verify empty results, no error

---

## Part 7 — Moderation & Admin

### Ban

- [ ] Log in as admin, go to `/admin/users`
- [ ] Ban a test user account
- [ ] Immediately try to access any page as that banned account — verify redirect to `/banned` (session should be invalidated immediately)
- [ ] Unban the user — verify they can log in and access the forum again

### Thread Management

- [ ] Lock a thread via `/admin/threads` — verify posting in it returns an error
- [ ] Pin a thread — verify it appears at the top of the forum listing
- [ ] Unlock and unpin

### Post Management

- [ ] Soft-delete a post via `/admin/posts`
- [ ] Verify the deleted post shows a placeholder in the thread view (content hidden)
- [ ] Restore the post — verify content returns

### Mod Log

- [ ] After performing several mod actions, check `/admin/mod-log`
- [ ] Verify each action (ban, lock, delete, etc.) has an entry with correct actor, target, and timestamp

### Admin SQL Query

- [ ] Go to `/admin/query`
- [ ] Run: `SELECT did, handle, global_role FROM users LIMIT 5` — verify results
- [ ] Attempt a write query: `DELETE FROM users WHERE 1=1` — verify it is blocked
- [ ] Attempt a stacked query: `SELECT 1; DROP TABLE users` — verify it is blocked

---

## Part 8 — Notifications

### Email Alerts

- [ ] Ban a user — verify a moderator alert email is received at `ADMIN_EMAIL`
- [ ] Lock a thread — verify alert email arrives
- [ ] Check email formatting is readable (not raw HTML tags)

### Bluesky DM Notifications

- [ ] As a test user, go to profile/settings and enable Bluesky DM notifications
- [ ] Have another user reply to your thread
- [ ] Verify a DM arrives from the notification bot account
- [ ] Verify the DM is NOT sent if notifications are disabled

### Worker Process

- [ ] Start the worker: `npm run worker` (or `docker compose up worker`)
- [ ] Verify it logs "notification worker started" and polls every 60 seconds
- [ ] Insert a row into `notification_queue` manually — verify the worker picks it up and marks it `sent`

---

## Part 9 — Rate Limiting

- [ ] Submit posts rapidly until rate limited — verify 429 response with a clear error message
- [ ] Verify rate limit resets after the time window (check `rate_limit_buckets` table)
- [ ] Verify that banning a user does not bypass rate limits on subsequent accounts

---

## Part 10 — Production Deployment

- [ ] Run `docker compose up` on the production server — verify all 3 services start (app, db, caddy)
- [ ] Verify HTTPS works at your domain (Caddy issues cert automatically)
- [ ] Verify `GET https://yourdomain.com/client-metadata.json` returns valid JSON
- [ ] Run `npx drizzle-kit migrate` against the prod database (or include in deploy script)
- [ ] Log in as the first user — verify admin promotion
- [ ] Set up backup cron (see DEPLOYMENT.md)
- [ ] Test backup restore: dump, drop, restore, verify data intact

---

## Part 11 — Security Spot Checks

- [ ] Verify session cookie has `HttpOnly`, `SameSite=Strict`, `Secure` flags in production
- [ ] Verify CSP headers are present on all pages (check Network tab → Response Headers)
- [ ] Verify that `/admin/*` returns 403 for non-admin logged-in users
- [ ] Verify that `/admin/*` returns 403 (or redirects to login) for logged-out users
- [ ] Post a `<script>alert(1)</script>` as post content — verify it is rendered as escaped text, not executed
- [ ] Post `javascript:alert(1)` as a link — verify it is not rendered as a clickable link

---

## Credentials Tracking

Fill in as you set them up:

| Credential | Location | Status |
|---|---|---|
| ATPROTO_PRIVATE_KEY | `.env` | [ ] Generated |
| SESSION_SECRET | `.env` | [ ] Generated |
| ENCRYPTION_KEY | `.env` | [ ] Generated |
| ATPROTO_CLIENT_ID | `.env` | [ ] Set |
| ATPROTO_SERVICE_HANDLE | `.env` | [ ] Set |
| ATPROTO_SERVICE_APP_PASSWORD | Password manager | [ ] Created |
| SMTP_* (5 vars) | `.env` | [ ] Configured |
| ADMIN_EMAIL | `.env` | [ ] Set |
| DATABASE_URL | `.env` | [ ] Set |
| PUBLIC_BASE_URL | `.env` | [ ] Set |
| Domain & DNS | Registrar | [ ] Configured |
| TLS cert | Caddy (auto) | [ ] Verified |
| Backup cron | Host crontab | [ ] Configured |
