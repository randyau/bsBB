# Testing Guide — bsBB

This document covers how to test the forum using curl, automated scripts, and manual testing.

---

## Dev Environment Split — Read This First

This project runs in a hybrid Windows + WSL2 setup. **The right context depends on what you're doing:**

| Task | Where to run |
|---|---|
| `npm`, `node`, `tsc`, test suite, scripts | **WSL terminal** |
| HTTP requests to `localhost:5173` | **Windows terminal (VS Code or PowerShell)** |
| `curl.exe` for API testing | **VS Code terminal** — use `curl.exe` explicitly, NOT `curl` (PowerShell aliases `curl` to `Invoke-WebRequest`) |

**Why it matters for testing:** Docker on Windows exposes ports on the Windows network stack. `localhost:5173` resolves correctly from the Windows side. From inside WSL2, `localhost` often does not route to those ports — `curl http://localhost:5173/...` from a WSL shell will silently hang or fail with a connection error.

**Rule:** All `curl` commands in this document should be run from the **VS Code terminal** (which is Windows-side), not from a WSL shell.

If you're in WSL and need to hit the server, switch context:
```powershell
# In VS Code terminal (Windows side) — this works
curl http://localhost:5173/api/test/session?did=did:plc:test
```
```bash
# In WSL terminal — this often fails silently
curl http://localhost:5173/api/test/session?did=did:plc:test  # ← don't do this
```

---

## Automated Integration Test Suite

Phase 4 includes a Vitest integration test suite that validates admin, moderation, rate limiting, ban, and session behavior against a live dev server.

### Running the Tests

**Run from the WSL terminal** (where node_modules has Linux binaries):
```bash
npm test        # run once
npm run test:watch  # watch mode
```

The integration tests make real HTTP requests to `localhost:5173`, so the dev server must be running. Because these run in WSL (Node process) but target a Windows-side Docker port, they work via WSL2's automatic localhost bridging — unlike `curl` from WSL, Node's `fetch` routes correctly.

### What's Tested

`src/routes/api/test/integration.test.ts` — 28 tests covering:

- **Admin guard** — All 5 admin sub-pages block members (403); admit admins (200)
- **Admin SQL query** — Admin can run SELECT; non-SELECT rejected; member action POST returns failure body
- **Ban / unban** — Admin bans member → banned session redirects to `/banned`; unban restores access; self-ban blocked
- **Thread lock / unlock** — Admin can lock and unlock a real thread via action POST
- **Post delete / restore** — Admin can soft-delete and restore a real post via action POST
- **Rate limiting** — 11th thread create in the same hour window returns a rate-limit message in the body
- **Session validation** — Valid/invalid/missing cookies handled correctly
- **Test session endpoint** — GET without `did` → 400; POST sets `globalRole` correctly

### Critical SvelteKit Behaviors (read before writing tests)

**SvelteKit form actions always return HTTP 200**, even when `fail(4xx, ...)` is called. The error or success is encoded in the JSON response body:
- `{ "type": "success", ... }` — action returned normally
- `{ "type": "failure", ... }` — action called `fail()`

**Never assert HTTP 4xx on a form action POST.** Assert `body.type === 'failure'` instead.

**Form action URLs require the `?/<actionName>` suffix:**
```
POST /admin/users?/ban       ✓
POST /admin/users            ✗ (404)
POST /admin/query?/run       ✓
POST /admin/query             ✗ (404)
```

**SvelteKit layout `load()` does NOT run before form action POSTs.** The admin layout guard (`+layout.server.ts`) only protects GET requests. All admin form actions must include their own auth check — and they do:
```typescript
if (!locals.user || locals.user.globalRole !== 'admin') return fail(403, { error: 'Admin access required' });
```

**`createSession` must use POST to set `globalRole`.** The GET endpoint always creates a `member`-role session regardless of query params. Use POST with JSON body to create admin sessions.

### Requirements for Running Tests

- Dev server running (`npm run dev`)
- DB migrated — `rate_limit_buckets`, `mod_log`, `users`, `sessions` tables must exist
- Tests use unique timestamped DIDs and do not clean up created threads/posts — run against a dev DB, not production

---

## Phase 5: Worker & Background Jobs

### Running the Worker Locally

The notification worker processes pending notifications from the queue every 60 seconds. Run it separately from the dev server:

**Terminal 1 (dev server):**
```bash
npm run dev
```

**Terminal 2 (worker process):**
```bash
npx tsx src/worker.ts
```

Or in watch mode for development:
```bash
npm run dev:watch -- src/worker.ts
```

### Worker Unit Tests

Test encryption, email sending, and notification payloads (no database required):

```bash
npm test -- src/worker.test.ts
```

Tests cover:
- AES-256-GCM encryption/decryption
- Email sending (dev-mode logging)
- Notification payload schemas
- Worker polling pattern (FIFO, atomic claiming)

### How It Works

1. **Admin actions enqueue notifications** — When an admin bans/unbans/promotes a user, notification records are created in `notification_queue` table with status `pending`
2. **Worker polls queue** — Every 60 seconds, fetches up to 10 pending notifications using `FOR UPDATE SKIP LOCKED`
3. **Routes by type** — Dispatches to handler based on notification type:
   - `moderator_alert` → Send email to all admins
   - `dm_notification` → Send Bluesky DM to opted-in user
   - `profile_sync` → Update user's cached profile data
4. **Marks as sent/failed** — Updates status in DB after processing
5. **Safe under concurrency** — Multiple worker instances can run without race conditions (PostgreSQL's `FOR UPDATE SKIP LOCKED` prevents duplicate processing)

### Testing Worker Processing

**Manually enqueue a notification (in psql or admin SQL interface):**
```sql
INSERT INTO notification_queue (recipient_did, type, payload, status)
VALUES ('did:plc:testuser', 'moderator_alert', '{"action":"ban","targetLabel":"user@example.com","moderatorHandle":"admin"}', 'pending');
```

Then watch the worker logs:
```
[worker] processing 1 notifications
[worker:moderator_alert] sent to admin (did:plc:admin)
[worker] ✓ notification abc123 sent
```

### Environment Variables

**For email notifications (optional in dev):**
```env
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_USER=postmaster@example.com
SMTP_PASS=password
SMTP_FROM=noreply@example.com
```

In dev without these vars, emails are logged to console.

**For DM notifications (Bluesky):**
```env
ATPROTO_SERVICE_HANDLE=notifications@example.bsky.social
ATPROTO_SERVICE_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx
ENCRYPTION_KEY=<32-byte hex string>
```

Generate ENCRYPTION_KEY:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Quick Start: Testing with Curl

### 1. Create a Test Session

The dev-only `/api/test/session` endpoint creates a session token without requiring browser interaction.

**Via GET (member role only — cannot set globalRole via GET):**
```powershell
# Run from VS Code terminal (Windows side), using curl.exe not curl
$TOKEN = (curl.exe -s "http://localhost:5173/api/test/session?did=did:plc:testuser&handle=testuser" | ConvertFrom-Json).token
```

**Via POST (required for admin sessions — use a temp file to avoid shell quoting issues):**
```powershell
# Write JSON to a temp file first — avoids PowerShell quote mangling
'{"did":"did:plc:admin1","handle":"admin1","displayName":"Admin","globalRole":"admin"}' | Out-File -Encoding utf8 "$env:TEMP\session.json" -NoNewline
$ADMIN_TOKEN = (curl.exe -s -X POST http://localhost:5173/api/test/session -H "Content-Type: application/json" -d "@$env:TEMP\session.json" | ConvertFrom-Json).token
```

> **Why a file?** PowerShell passes single-quoted JSON strings to `curl.exe` with mangled quotes. Writing to a temp file and using `-d @file` avoids this entirely.

This returns:
```json
{
  "success": true,
  "token": "a1b2c3d4...",
  "did": "did:plc:testuser",
  "handle": "testuser",
  "displayName": "Test User",
  "globalRole": "member",
  "expiresAt": "2026-06-15T12:34:56.789Z",
  "curlExample": "curl -H \"Cookie: session=a1b2c3d4...\" http://localhost:5173/admin"
}
```

### 2. Use the Token in Requests

**Set as a cookie (PowerShell / VS Code terminal):**
```powershell
curl.exe -s -o NUL -w "%{http_code}" -H "Cookie: session=$TOKEN" http://localhost:5173/admin/users
# Expected: 200 for admin, 403 for member
```

---

## Test Scenarios

### Test Rate Limiting

Limit: 10 thread creates per hour per DID.

```powershell
# Get a fresh DID — rate limit buckets are keyed per DID per hour window
'{"did":"did:plc:rltest","handle":"rltest","displayName":"RL","globalRole":"member"}' | Out-File -Encoding utf8 "$env:TEMP\rl.json" -NoNewline
$RL = (curl.exe -s -X POST http://localhost:5173/api/test/session -H "Content-Type: application/json" -d "@$env:TEMP\rl.json" | ConvertFrom-Json).token

for ($i = 1; $i -le 12; $i++) {
    $body = curl.exe -s -X POST -H "Cookie: session=$RL" -H "Content-Type: application/x-www-form-urlencoded" -d "title=Thread$i&body=test" http://localhost:5173/f/general/new
    if ($body -match "Too many requests|Rate limit") { Write-Host "Attempt $i: RATE LIMITED" }
    else { Write-Host "Attempt $i: allowed" }
}
```

> **Important:** SvelteKit form actions always return HTTP 200, even when rate-limited. The rate limit message appears in the HTML body — not as an HTTP 429 status code. Check the body for "Too many requests".

### Test Admin Guard

```powershell
# Admin session — must use POST to set globalRole
'{"did":"did:plc:adm","handle":"adm","displayName":"Admin","globalRole":"admin"}' | Out-File -Encoding utf8 "$env:TEMP\adm.json" -NoNewline
$ADMIN = (curl.exe -s -X POST http://localhost:5173/api/test/session -H "Content-Type: application/json" -d "@$env:TEMP\adm.json" | ConvertFrom-Json).token
$MEMBER = (curl.exe -s "http://localhost:5173/api/test/session?did=did:plc:mem&handle=mem" | ConvertFrom-Json).token

# Member gets 403
curl.exe -s -o NUL -w "Member: HTTP %{http_code}`n" -H "Cookie: session=$MEMBER" http://localhost:5173/admin/users
# Admin gets 200
curl.exe -s -o NUL -w "Admin:  HTTP %{http_code}`n" -H "Cookie: session=$ADMIN" http://localhost:5173/admin/users
```

> **Note:** `/admin` itself returns 404 (no root page). Use `/admin/users`, `/admin/threads`, etc.

### Test Admin SQL Query Interface

Form actions use `?/<actionName>` suffix. The response is always HTTP 200 — check `body.type`.

```powershell
$ADMIN = "..." # from above

# Run a SELECT query
curl.exe -s -X POST "http://localhost:5173/admin/query?/run" `
    -H "Cookie: session=$ADMIN" `
    -H "Content-Type: application/x-www-form-urlencoded" `
    --data-urlencode "query=SELECT did, handle, global_role FROM users LIMIT 5"
# Returns: {"type":"success","data":"...encoded rows..."}

# Non-SELECT is rejected
curl.exe -s -X POST "http://localhost:5173/admin/query?/run" `
    -H "Cookie: session=$ADMIN" `
    -H "Content-Type: application/x-www-form-urlencoded" `
    -d "query=DELETE+FROM+users"
# Returns: {"type":"failure","data":"...Only SELECT queries..."}
```

### Test User Management

```powershell
$ADMIN = "..."
$TARGET_DID = "did:plc:mem"  # must exist in users table

# Ban — response body.type === 'success' if it worked
curl.exe -s -X POST "http://localhost:5173/admin/users?/ban" `
    -H "Cookie: session=$ADMIN" `
    -H "Content-Type: application/x-www-form-urlencoded" `
    -d "did=$TARGET_DID&reason=Spam"

# Banned user session now redirects to /banned
curl.exe -s -D - -H "Cookie: session=$MEMBER_TOKEN" http://localhost:5173/f/general
# Look for: location: /banned

# Unban
curl.exe -s -X POST "http://localhost:5173/admin/users?/unban" `
    -H "Cookie: session=$ADMIN" `
    -H "Content-Type: application/x-www-form-urlencoded" `
    -d "did=$TARGET_DID"
```

### Test Thread/Post Moderation

```powershell
$ADMIN = "..."
$THREAD_ID = "uuid-from-db"  # get from /admin/threads or psql
$POST_ID   = "uuid-from-db"  # get from /admin/posts or psql

# Lock thread
curl.exe -s -X POST "http://localhost:5173/admin/threads?/lock" `
    -H "Cookie: session=$ADMIN" `
    -H "Content-Type: application/x-www-form-urlencoded" `
    -d "threadId=$THREAD_ID"

# Delete post (soft delete — is_deleted = true)
curl.exe -s -X POST "http://localhost:5173/admin/posts?/delete" `
    -H "Cookie: session=$ADMIN" `
    -H "Content-Type: application/x-www-form-urlencoded" `
    -d "postId=$POST_ID&reason=Spam"

# Restore
curl.exe -s -X POST "http://localhost:5173/admin/posts?/restore" `
    -H "Cookie: session=$ADMIN" `
    -H "Content-Type: application/x-www-form-urlencoded" `
    -d "postId=$POST_ID"
```

---

## Advanced: Scripting with curl.exe (PowerShell)

### Helper Function

```powershell
function Get-TestSession {
    param(
        [string]$Did = "did:plc:testuser",
        [string]$Handle = "testuser",
        [string]$Role = "member"
    )
    $json = "{`"did`":`"$Did`",`"handle`":`"$Handle`",`"displayName`":`"Test`",`"globalRole`":`"$Role`"}"
    $json | Out-File -Encoding utf8 "$env:TEMP\bsbb_session.json" -NoNewline
    return (curl.exe -s -X POST http://localhost:5173/api/test/session -H "Content-Type: application/json" -d "@$env:TEMP\bsbb_session.json" | ConvertFrom-Json).token
}

# Usage:
$ADMIN  = Get-TestSession -Did "did:plc:myadmin" -Handle "myadmin" -Role "admin"
$MEMBER = Get-TestSession -Did "did:plc:mymember" -Handle "mymember"
curl.exe -s -o NUL -w "%{http_code}" -H "Cookie: session=$ADMIN" http://localhost:5173/admin/users
```

---

## Notes

### Dev-Only Endpoint

The `/api/test/session` endpoint is **only available in development mode** (`NODE_ENV !== 'production'`). It will return 404 in production.

### Session Expiry

Test sessions expire after 30 days. You can modify this in `src/routes/api/test/session/+server.ts` if needed for testing.

### No Side Effects in Tests

Creating a test session doesn't affect the forum state:
- User is created/updated in the database
- Session is created
- But no posts, threads, or moderation actions are taken

### Real OAuth Still Works

The dev endpoint is supplementary. Real ATproto OAuth via Bluesky still works (requires public URL).

---

## Troubleshooting

### "curl hangs or connection refused on localhost:5173"
- Running from WSL2 — switch to the VS Code terminal (Windows side).
- See the "Dev Environment Split" section at the top of this document.

### "curl returns HTML for Invoke-WebRequest instead of JSON"
- In PowerShell, `curl` is aliased to `Invoke-WebRequest`. Use `curl.exe` explicitly.

### "JSON body is mangled / SyntaxError in server logs"
- PowerShell eats quotes in single-quoted strings passed to `curl.exe`. Write JSON to a temp file and use `-d @file` instead of inline `-d '{"key":"val"}'`.

### "Form action POST returns unexpected result"
- Ensure the URL includes the action name: `/admin/users?/ban`, not `/admin/users`.
- SvelteKit returns HTTP 200 for all form actions. Check `body.type` for `'success'` or `'failure'`.

### "Token endpoint returns 404"
- Ensure you're running in dev mode (not production)
- Check that `NODE_ENV` is not set to `production`

### "Cookie not being sent"
- Use `-H "Cookie: session=..."` or `-b "session=..."` in curl
- Verify the token is not empty/truncated
- Check browser DevTools to see what cookies are actually set

### "CORS errors"
- The test endpoint doesn't set CORS headers (not needed for same-origin requests)
- If testing from a different origin, you'll need CORS configuration

### "Session token not recognized"
- Ensure the database migration ran: `docker compose exec app npm run db:migrate`
- Verify the `sessions` table exists in the database

---

## See Also

- **README.md** — General setup and deployment
- **CLAUDE.md** — Full specification and architecture
- **Phase 4 completion** — All admin/moderation features now testable
