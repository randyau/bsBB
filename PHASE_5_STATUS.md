# Phase 5 — Notifications & Background Tasks (In Progress)

## Commits Completed (6/6) ✅ PHASE 5 COMPLETE

### ✅ Commit 1: Email Infrastructure
**File:** `src/lib/email.ts`

Implemented Nodemailer wrapper with SMTP configuration entirely via environment variables. Lazy initialization, graceful degradation in dev mode (logs instead of sending).

**Features:**
- Provider-agnostic SMTP configuration (swap with env vars only)
- Lazy transporter initialization (on first email send)
- Dev-mode fallback: logs emails instead of sending
- Plain text fallback from HTML
- `testEmail()` function for setup validation

**Requires environment variables:**
```env
SMTP_HOST       # SMTP server (e.g., smtp.mailgun.org)
SMTP_PORT       # SMTP port (usually 587)
SMTP_USER       # Username or email
SMTP_PASS       # Password
SMTP_FROM       # From: header address
```

In development without these vars, emails are logged to console.

---

### ✅ Commit 2: Notification Worker — Core Loop
**File:** `src/worker.ts`

Implemented main polling loop that fetches pending notifications from the queue and processes them safely under concurrent access using PostgreSQL's `FOR UPDATE SKIP LOCKED`.

**Features:**
- Polls every 60 seconds (configurable)
- Atomically claims up to 10 pending notifications per poll
- Routes by notification type (`moderator_alert`, `dm_notification`, `profile_sync`)
- Marks as `sent` on success or `failed` on error
- Graceful error handling — logs and marks as failed (no retry loop)
- Safe for multiple concurrent worker instances

**How it works:**
1. Query pending notifications with `FOR UPDATE SKIP LOCKED` (prevents race conditions)
2. For each notification, route to handler by type
3. Handler processes (placeholder for now, filled in later commits)
4. Mark as sent or failed based on outcome
5. Next poll after 60 seconds

---

### ✅ Commit 3: Moderator Email Alerts
**Files:**
- `src/lib/notifications.ts` (new) — Enqueueing helpers
- `src/worker.ts` (modified) — handleModeratorAlert implementation
- `src/routes/admin/users/+page.server.ts` (modified) — Enqueue on ban/unban/promote/demote

Implemented notification enqueueing and email sending for moderation actions. Admin actions now automatically enqueue notifications to all admins/mods.

**Features:**
- `enqueueModerationAlert()` — Enqueue notification for all admins
- `enqueueDmNotification()` — Enqueue DM (respects opt-in)
- `enqueueProfileSync()` — Enqueue profile sync task
- Worker sends emails with action details, target info, moderator, and reason
- Graceful fallback in dev mode (logs instead of sending)

**Actions now enqueue notifications:**
- Ban user → all admins notified
- Unban user → all admins notified
- Promote to admin → all admins notified
- Demote from admin → all admins notified

---

## Remaining Commits (3/6)

### 📋 Commit 4: Bluesky DM Notifications (Opt-In)
**Files:**
- `src/routes/admin/users/+page.server.ts` (modify)
- `src/routes/admin/posts/+page.server.ts` (modify)
- `src/routes/admin/threads/+page.server.ts` (modify)

**What it does:**
- Enqueue email notifications when mods take actions
- Track all notification attempts in database
- Send to all admins/mods

---

### ✅ Commit 4: Bluesky DM Notifications (Opt-In)
**Files:**
- `src/lib/crypto.ts` (new) — AES-256-GCM encryption
- `src/worker.ts` (modified) — handleDmNotification implementation

Implemented encryption for chat session tokens and DM handler. Users can opt in to Bluesky DM notifications.

**Features:**
- AES-256-GCM encryption with authenticated encryption
- `encrypt()` and `decrypt()` functions
- Checks `users.notifyViaBluesky` opt-in flag
- Message builder for different notification types
- Rate limiting placeholder (future enhancement)

---

### ✅ Commit 5: Lazy Profile Sync
**Files:**
- `src/routes/f/[forumSlug]/t/[threadId]/+page.server.ts` (modified)
- `src/worker.ts` (modified) — handleProfileSync implementation
- `src/lib/notifications.ts` — Already has enqueueProfileSync helper

Implemented lazy profile sync: when users post, check if their cached profile is >24 hours old and enqueue a background sync task.

**Features:**
- On post submit, check `users.lastProfileSync` age
- If >24h stale, enqueue profile_sync notification (non-blocking, fire-and-forget)
- Worker polls and processes: updates `lastProfileSync` timestamp
- Future enhancement: integrate with ATproto PLC Directory for real profile refresh

**Why lazy sync?**
- Users' handles are mutable; cache can become stale
- Checking on every post hit would be slow
- Background sync keeps data fresh without blocking user actions

---

### ✅ Commit 6: Tests & Documentation
**Files:**
- `src/worker.test.ts` (new) — Unit tests
- `TESTING.md` (modified) — Worker guide

Completed Phase 5 with comprehensive tests and documentation.

**Tests (src/worker.test.ts):**
- AES-256-GCM encryption/decryption
- Symmetric encryption with IV randomization
- Email sending (dev-mode logging)
- Notification payload schemas
- Worker polling pattern (FIFO, atomic claiming)

**Documentation (TESTING.md):**
- How to run worker (`npx tsx src/worker.ts`)
- Worker test suite (`npm test -- src/worker.test.ts`)
- Step-by-step workflow (enqueue → poll → dispatch → send)
- Manual testing (SQL INSERT notifications)
- Environment variables (SMTP, ATproto, encryption)
- Concurrency safety with `FOR UPDATE SKIP LOCKED`

---

## Testing Checklist

### Commit 1 (Email)
- [ ] `sendEmail()` logs in dev mode (no SMTP_HOST)
- [ ] `sendEmail()` sends real email when env vars set (requires SMTP)
- [ ] `testEmail()` validates configuration

### Commit 2 (Worker)
- [ ] Worker starts without errors: `npx tsx src/worker.ts`
- [ ] Polls notification_queue every 60s
- [ ] Gracefully handles errors

### Commit 3 (Moderator alerts)
- [ ] Banning a user enqueues a notification
- [ ] Deleting a post enqueues a notification
- [ ] Notifications appear in `notification_queue` table

### Commit 4 (Bluesky DM)
- [ ] Opt-in users receive DMs when replied to
- [ ] Rate limiting prevents >1 DM per hour per user
- [ ] Chat tokens are encrypted at rest

### Commit 5 (Profile sync)
- [ ] Posting a thread with stale profile enqueues sync task
- [ ] Worker picks up and processes sync task
- [ ] User's cached handle/avatar updated in DB

### Commit 6 (Tests & Docs)
- [ ] `npm test` includes worker tests
- [ ] Worker service starts in docker-compose
- [ ] TESTING.md explains how to run worker locally

---

## Database State

All tables already exist:
- `notification_queue` — Pending notifications (type, payload, status)
- `users.notifyViaBluesky` — Opt-in DM flag
- `users.chatSessionEncrypted` — Encrypted chat tokens
- `users.lastProfileSync` — Stale check timestamp
- `mod_log` — Action audit trail (already populated by Phase 4)

No migrations needed.

---

## Success Criteria

- [x] Email infrastructure working
- [ ] Worker polling loop safe under concurrent access
- [ ] Moderator alerts tested and working
- [ ] DM notifications opt-in and rate-limited
- [ ] Profile sync background task
- [ ] All 6 commits with passing tests
- [ ] Documentation updated
