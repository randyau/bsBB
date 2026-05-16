# Testing Guide — bsBB

This document covers how to test the forum using curl, automated scripts, and manual testing.

---

## Dev Environment Split — Read This First

This project runs in a hybrid Windows + WSL2 setup. **The right context depends on what you're doing:**

| Task | Where to run |
|---|---|
| `npm`, `node`, `tsc`, test suite, scripts | **WSL terminal** |
| HTTP requests to `localhost:5173` | **Windows terminal (VS Code or PowerShell)** |

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

Phase 4 includes a comprehensive Vitest integration test suite that validates all moderation, admin, and rate-limiting features.

### Running the Tests

**Run once:**
```bash
npm test
```

**Watch mode (re-run on file changes):**
```bash
npm run test:watch
```

### What's Tested

The integration test suite (`src/routes/api/test/integration.test.ts`) validates:

1. **Admin Guard** — Non-admin users get 403 on `/admin` routes
2. **Admin Pages** — All admin pages (`/admin/users`, `/admin/threads`, `/admin/posts`, `/admin/query`, `/admin/mod-log`)
3. **Session Validation** — Valid/invalid/missing session cookies are handled correctly
4. **Test Endpoint Protection** — `/api/test/session` is dev-only (404 in production)

### Test Architecture

- **Technology:** Vitest + Node's native `fetch` API
- **No browser automation** — HTTP-level tests only (faster, simpler)
- **Automatic setup/teardown** — Each test gets fresh admin and member sessions
- **Helper functions:**
  - `createSession(did, handle, role)` — Creates a test user and returns session token
  - `withSession(session)` — Formats headers with session cookie for requests

### Example Test Run Output

```
✓ src/routes/api/test/integration.test.ts (17 tests)

Phase 4 — Moderation & Admin Integration Tests
  Admin Guard
    ✓ returns 403 for non-admin accessing /admin (45ms)
    ✓ returns 200 for admin accessing /admin (42ms)
    ✓ returns 403 for unauthenticated user accessing /admin (38ms)
  Admin Users Page
    ✓ admin can access /admin/users (38ms)
    ✓ member cannot access /admin/users (40ms)
  Admin SQL Query Interface
    ✓ admin can access /admin/query (41ms)
    ...
  Admin Mod Log Page
    ✓ admin can access /admin/mod-log (44ms)
    ✓ member cannot access /admin/mod-log (39ms)
    ✓ displays log entries (47ms)
  Test Endpoint Protection
    ✓ test endpoint returns 404 in production mode (35ms)
    ✓ test endpoint requires did parameter (38ms)
  Session Cookie Validation
    ✓ valid session cookie grants access (39ms)
    ✓ invalid session cookie denies access (40ms)
    ✓ missing session cookie denies access (36ms)

Test Files  1 passed (1)
     Tests  17 passed (17)
  Start at  12:34:56
  Duration  5.23s
```

### How the Tests Work

Each test:
1. Creates a fresh admin and member session via `createSession()` helper
2. Makes HTTP requests to the running dev server (localhost:5173)
3. Validates response status codes and HTML content
4. Checks that admin-only routes return 403 for members
5. Verifies session cookie behavior

Example test:
```typescript
it('returns 403 for non-admin accessing /admin', async () => {
  const res = await fetch(`${BASE_URL}/admin`, {
    ...withSession(memberSession)
  });
  expect(res.status).toBe(403);
});
```

### Requirements for Running Tests

- **Dev server running:** `npm run dev` in another terminal
- **Database migrated:** Tables for users, sessions, mod_log must exist
- **Fresh sessions each test:** Tests clean up automatically (no data persists)

### Adding More Tests

To add a test to the suite:

1. Open `src/routes/api/test/integration.test.ts`
2. Add a new `it()` block in the appropriate `describe()` section
3. Use `adminSession` or `memberSession` for authenticated requests
4. Run `npm run test:watch` to iterate

---

## Quick Start: Testing with Curl

### 1. Create a Test Session

The dev-only `/api/test/session` endpoint creates a session token without requiring browser interaction.

**Via GET (simplest):**
```bash
TOKEN=$(curl -s "http://localhost:5173/api/test/session?did=did:plc:testuser&handle=testuser&displayName=TestUser" | jq -r .token)
echo "Token: $TOKEN"
```

**Via POST (more control, JSON body):**
```bash
curl -X POST http://localhost:5173/api/test/session \
  -H "Content-Type: application/json" \
  -d '{
    "did": "did:plc:testuser",
    "handle": "testuser",
    "displayName": "Test User",
    "globalRole": "member"
  }' | jq .
```

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

**Set as a cookie:**
```bash
TOKEN="a1b2c3d4..."
curl -H "Cookie: session=$TOKEN" http://localhost:5173/admin
```

**Or save to a cookie jar and reuse:**
```bash
# Create token and save cookies
curl -s "http://localhost:5173/api/test/session?did=did:plc:user1" \
  | jq -r .token > /tmp/token.txt

TOKEN=$(cat /tmp/token.txt)

# Use in requests (curl will send the cookie automatically)
curl -b "session=$TOKEN" http://localhost:5173/admin
curl -b "session=$TOKEN" http://localhost:5173/f/general
```

---

## Test Scenarios

### Test Rate Limiting

Rate limit 10 thread creates per hour per DID.

```bash
# Create test user
TOKEN=$(curl -s "http://localhost:5173/api/test/session?did=did:plc:ratelimit" | jq -r .token)

# Try to create threads (should fail on 11th)
for i in {1..12}; do
  echo "Attempt $i:"
  curl -X POST \
    -H "Cookie: session=$TOKEN" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "title=Thread%20$i&body=Test%20body" \
    http://localhost:5173/f/general/new 2>&1 | head -20
  echo ""
done
```

Expected: Attempts 1-10 succeed, attempt 11 returns HTTP 429 (Too Many Requests).

### Test Admin Guard

```bash
# Create regular user
TOKEN=$(curl -s "http://localhost:5173/api/test/session?did=did:plc:member&globalRole=member" | jq -r .token)

# Try to access admin panel (should get 403)
curl -H "Cookie: session=$TOKEN" http://localhost:5173/admin
# Expected: 403 error

# Create admin user
ADMIN_TOKEN=$(curl -s "http://localhost:5173/api/test/session?did=did:plc:admin&globalRole=admin" | jq -r .token)

# Access admin panel (should succeed)
curl -H "Cookie: session=$ADMIN_TOKEN" http://localhost:5173/admin
# Expected: HTML page content
```

### Test SQL Query Interface

```bash
# Get admin token
ADMIN=$(curl -s "http://localhost:5173/api/test/session?did=did:plc:admin&globalRole=admin" | jq -r .token)

# Run a query via the admin UI (browser)
# Or test the API endpoint directly:
curl -X POST \
  -H "Cookie: session=$ADMIN" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "query=SELECT%20*%20FROM%20users%20LIMIT%205" \
  http://localhost:5173/admin/query
```

### Test User Management

```bash
ADMIN=$(curl -s "http://localhost:5173/api/test/session?did=did:plc:admin&globalRole=admin" | jq -r .token)

# Ban a user
curl -X POST \
  -H "Cookie: session=$ADMIN" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "did=did:plc:testuser&reason=Spam" \
  http://localhost:5173/admin/users?/ban
```

### Test Thread/Post Moderation

```bash
ADMIN=$(curl -s "http://localhost:5173/api/test/session?did=did:plc:admin&globalRole=admin" | jq -r .token)

# Lock a thread (need a real thread ID from the forum)
curl -X POST \
  -H "Cookie: session=$ADMIN" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "threadId=<uuid>" \
  http://localhost:5173/admin/threads?/lock

# Delete a post
curl -X POST \
  -H "Cookie: session=$ADMIN" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "postId=<uuid>&reason=Spam" \
  http://localhost:5173/admin/posts?/delete
```

---

## Advanced: Scripting with curl

### Helper Function

Add to your `.bashrc` or `.zshrc`:

```bash
bsbb_test_session() {
  local did="${1:-did:plc:testuser}"
  local handle="${2:-testuser}"
  local role="${3:-member}"
  
  curl -s -X POST http://localhost:5173/api/test/session \
    -H "Content-Type: application/json" \
    -d "{\"did\":\"$did\",\"handle\":\"$handle\",\"globalRole\":\"$role\"}" \
    | jq -r .token
}

# Usage:
TOKEN=$(bsbb_test_session "did:plc:myuser" "myhandle" "admin")
curl -H "Cookie: session=$TOKEN" http://localhost:5173/admin
```

### Batch Testing Script

```bash
#!/bin/bash

# Create multiple test users
for i in {1..5}; do
  DID="did:plc:user$i"
  HANDLE="user$i"
  TOKEN=$(curl -s "http://localhost:5173/api/test/session?did=$DID&handle=$HANDLE" | jq -r .token)
  
  echo "User $i: $DID -> Token: ${TOKEN:0:16}..."
  
  # Store token for later use
  echo "$TOKEN" > "/tmp/token_user$i.txt"
done

# Later, reuse tokens:
TOKEN=$(cat /tmp/token_user1.txt)
curl -H "Cookie: session=$TOKEN" http://localhost:5173/admin
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
- You are almost certainly running curl from inside WSL2. Switch to the VS Code terminal (Windows side) and retry.
- See the "Dev Environment Split" section at the top of this document.

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
