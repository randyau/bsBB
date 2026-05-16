# Phase 4 — Moderation & Admin Interface (In Progress)

## Commits Completed (7/7) ✅ PHASE 4 COMPLETE

### ✅ Commit 1: Real Rate Limiting
**File:** `src/lib/abuse/index.ts`

Implemented atomic rate limiting using `rate_limit_buckets` table with PostgreSQL `INSERT ON CONFLICT DO UPDATE` pattern. Safely handles concurrent requests.

**Limits:**
- `thread_create`: 10 per hour per DID
- `post_submit`: 30 per hour per DID
- `preview_request`: 60 per hour per IP
- `login_attempt`: 10 per 15 min per IP
- `flag_submit`, `og_fetch`: 20 per hour

Returns `AbuseVerdict` with allowed/denied status and retry-after seconds.

---

### ✅ Commit 2: Admin Layout & Navigation
**Files:**
- `src/routes/admin/+layout.server.ts` — Admin guard (403 if not admin)
- `src/routes/admin/+layout.svelte` — Sidebar nav to Query/Users/Threads/Posts/Mod Log
- `src/routes/+layout.svelte` (modified) — Added "Admin" link in main nav for admins

---

### ✅ Commit 3: Admin SQL Query Interface
**Files:**
- `src/routes/admin/query/+page.server.ts` — Query validator and executor
- `src/routes/admin/query/+page.svelte` — Query input/results UI

**Features:**
- SELECT-only validation (blocks stacked queries)
- 1000-row limit, 5-second timeout
- Results rendered as HTML table with column headers
- All queries logged to `mod_log` for audit trail
- Graceful error handling and validation messages

**Purpose:** Eliminates need for `docker exec psql` in development/testing.

---

### ✅ Commit 4: Admin Users Page
**Files:**
- `src/routes/admin/users/+page.server.ts` — User actions (ban/unban/promote/demote)
- `src/routes/admin/users/+page.svelte` — User table with action buttons

**Actions:**
- Ban (with optional reason): `globalRole = 'banned'`
- Unban: `globalRole = 'member'`
- Promote: `globalRole = 'admin'`
- Demote: `globalRole = 'member'`

**Guards:**
- Cannot act on self (ban/demote)
- Cannot demote last admin
- All actions logged to `mod_log`

---

### ✅ Commit 5: Admin Threads Page
**Files:**
- `src/routes/admin/threads/+page.server.ts` — Thread actions (lock/unlock/pin/unpin)
- `src/routes/admin/threads/+page.svelte` — Thread table with action buttons

**Actions:**
- Lock: `is_locked = true`
- Unlock: `is_locked = false`
- Pin: `is_pinned = true`
- Unpin: `is_pinned = false`

**Data:** Forum name, thread title (linked), author, post count, last activity timestamp

---

### ✅ Commit 6: Admin Posts Page
**Files:**
- `src/routes/admin/posts/+page.server.ts` — Post actions (delete/restore)
- `src/routes/admin/posts/+page.svelte` — Post table with action buttons

**Actions:**
- Delete (with optional reason): `is_deleted = true`
- Restore: `is_deleted = false`

**Data:** Thread title (linked), author, timestamp, deleted status, body preview (50 chars)

**UI:** Shows deleted posts in muted styling. Last 200 posts by default.

---

### ✅ Commit 7: Admin Mod Log Page
**Files:**
- `src/routes/admin/mod-log/+page.server.ts` — Load mod log entries
- `src/routes/admin/mod-log/+page.svelte` — Read-only audit trail

**Display:** Timestamp, moderator handle, action type, target (user/post/thread), reason

**Features:** Optional filter by action type, last 200 entries

---

## Testing

### Automated Integration Test Suite ✅

**File:** `src/routes/api/test/integration.test.ts` — 28 tests, all passing

**Admin guard:** All 5 admin sub-pages return 403 for members, 200 for admins, 403 unauthenticated

**Admin actions (form action POSTs — body.type, not HTTP status):**
- ✅ Ban user → `body.type === 'success'`; banned session redirects to `/banned`
- ✅ Self-ban blocked → `body.type === 'failure'`
- ✅ Unban → access restored
- ✅ Thread lock/unlock → `body.type === 'success'`
- ✅ Post delete/restore → `body.type === 'success'`
- ✅ SQL SELECT query → success; non-SELECT → failure
- ✅ Member action POST → failure (action-level auth guard)

**Rate limiting:**
- ✅ 11th thread create in same hour window returns rate-limit message in body (HTTP status is still 200 — SvelteKit form action behavior)

**Session & auth:**
- ✅ Valid/invalid/missing cookies handled; GET endpoint creates member; POST sets globalRole

**Run tests (from WSL terminal):**
```bash
npm test
```

### Bugs Found and Fixed During Testing

The following bugs were discovered during manual testing and are now fixed:

1. **`checkAbuse` never enforced limits** — call sites used `try/catch` but the function returns a verdict object, never throws. Fixed: check `verdict.allowed` instead.
2. **Rate limit SQL silently failed** — passing a plain `Date` to Drizzle's `sql` template with postgres-js doesn't serialize correctly. Fixed: use `.toISOString()` with `::timestamptz` cast.
3. **`/admin/mod-log` 500** — joined `users` table twice without table aliases, which Drizzle rejects. Fixed: `alias(users, 'moderator')` and `alias(users, 'target_user')`.
4. **Admin form actions had no auth guard** — SvelteKit does NOT run layout `load()` before form action POSTs, so any session could POST to `/admin/users?/ban` etc. Fixed: added `if (!locals.user || locals.user.globalRole !== 'admin') return fail(403, ...)` to all 10 admin actions.

### Manual Testing Checklist

For end-to-end UI verification (automated tests cover the HTTP layer):

- [x] Rate limiting: 11th thread create shows rate limit message in page
- [x] Admin guard: member → 403; admin → 200
- [x] Ban/unban: banned session → `/banned` redirect; unbanned → access restored
- [x] Thread lock/unlock: DB `is_locked` flips correctly
- [x] Post delete/restore: DB `is_deleted` flips correctly
- [x] Mod log: actions logged with correct moderator DID, action type, target, reason
- [ ] Thread lock UI: reply form disappears when thread is locked (browser check)
- [ ] Post delete UI: "[post deleted]" shown in thread view (browser check)

---

## Database State

Tables used (all already in schema.ts):
- `rate_limit_buckets` — atomic rate limit counters
- `mod_log` — audit trail of all moderation actions
- `users.globalRole` — 'admin' | 'member' | 'banned'
- `threads.isLocked`, `threads.isPinned`
- `posts.isDeleted`

No new migrations needed if all tables exist. Verify via admin SQL query interface.
