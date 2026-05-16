# Phase 5 — Notifications & Background Tasks (In Progress)

## Overview

Phase 5 implements background job processing for notifications, profile syncing, and email alerts. The worker runs as a separate process that polls the database for pending tasks, ensuring the web tier remains stateless and can scale independently.

## Architecture Decisions

- **Worker as separate process** — Uses PostgreSQL's `FOR UPDATE SKIP LOCKED` to safely scale multiple workers without race conditions
- **Email via SMTP** — Provider-agnostic (Nodemailer), configured entirely via environment variables
- **Bluesky DM notifications** — Opt-in only; uses ATproto chat API with rate limiting
- **Lazy profile sync** — Triggered when user's cached profile is >24h old (async, non-blocking)
- **No external job queue** — PostgreSQL's `notification_queue` table is sufficient at this scale

## Implementation Roadmap

### Commit 1: Email Infrastructure
- Set up Nodemailer with SMTP configuration
- Create `src/lib/email.ts` with `sendEmail()` helper
- Environment variable validation in server hooks
- Test with sample email in dev mode

### Commit 2: Notification Worker — Core Loop
- Implement main polling loop in `src/worker.ts`
- Use `FOR UPDATE SKIP LOCKED` for safe concurrent processing
- Mark notifications as `sent` or `failed`
- Graceful error handling and retry logic

### Commit 3: Moderator Email Alerts
- Enqueue notifications when content is flagged
- Send emails to moderators/admins
- Log all notification attempts to database

### Commit 4: Bluesky DM Notifications (Opt-In)
- Implement DM sending via `@atproto/api` chat methods
- Rate limiting: max 1 DM per user per hour
- Opt-in via `users.notify_via_bluesky` flag
- Encrypt `chat_session_encrypted` tokens at rest

### Commit 5: Lazy Profile Sync
- Background sync task triggered on post submit
- Re-resolve DID via PLC Directory if >24h stale
- Update cached handle, display name, avatar
- Non-blocking (fire-and-forget)

### Commit 6: Tests & Documentation
- Integration tests for worker polling
- Test email sending with mock SMTP
- Update TESTING.md with worker instructions
- Docker Compose worker service configuration

---

## Database State

All tables already exist in `src/lib/db/schema.ts`:
- `notification_queue` — Pending notifications (type, payload, status)
- `users.notifyViaBluesky` — Opt-in DM flag
- `users.chatSessionEncrypted` — Encrypted ATproto chat tokens
- `users.lastProfileSync` — Timestamp for lazy sync check
- `mod_log` — Already logging all moderation actions

---

## Files to Create/Modify

**New:**
- `src/lib/email.ts` — Nodemailer wrapper
- `src/lib/crypto.ts` — AES-256 encryption for chat tokens
- `PHASE_5_STATUS.md` — Progress tracking

**Modify:**
- `src/worker.ts` — Replace stub with real implementation
- `src/hooks.server.ts` — Validate email/ATproto env vars
- `src/routes/admin/users/+page.server.ts` — Enqueue notifications on user actions
- `docker-compose.yml` — Add worker service

---

## Environment Variables (New)

```env
# Email (provider-agnostic SMTP)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=noreply@example.com
SMTP_PASS=password
SMTP_FROM=noreply@example.com

# ATproto service account (for notifications)
ATPROTO_SERVICE_HANDLE=notifications.example.bsky.social
ATPROTO_SERVICE_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx

# Encryption (generate once)
ENCRYPTION_KEY=<random 32-byte hex string>
```

---

## Testing Strategy

- Unit tests for email formatting, encryption
- Integration tests for worker polling loop
- Mock SMTP server for email testing
- Mock ATproto API for DM testing
- Manual testing with real email in dev mode

---

## Success Criteria

- [x] Email infrastructure working (dev mode test email)
- [ ] Worker polls notification_queue safely
- [ ] Moderator alerts sent on content flag
- [ ] DM notifications sent to opted-in users
- [ ] Profile sync updates cached data correctly
- [ ] All 6 commits with passing tests
- [ ] TESTING.md includes worker instructions
- [ ] docker-compose.yml includes worker service
