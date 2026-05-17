# Security Audit Report — ATproto Forum Project

**Date:** May 16, 2026  
**Scope:** Comprehensive security crawl as guest, authenticated member, and admin users  
**Status:** Multiple findings identified — Critical, High, and Low priority

---

## Executive Summary

The application demonstrates strong foundational security practices with proper authentication, authorization, and input sanitization. However, **several critical gaps in HTTP security headers** were identified that require immediate remediation before production deployment. All injection attacks were successfully blocked, and authentication/authorization controls are working as designed.

**Critical Issue Count:** 1  
**High Issue Count:** 3  
**Medium Issue Count:** 2  
**Low Issue Count:** 2  

---

## Findings

### 🔴 CRITICAL: Missing HTTP Security Headers

**Severity:** CRITICAL  
**Status:** Not Fixed  
**Impact:** Clickjacking, MIME sniffing, click-jacking attacks  

The application is missing fundamental security headers that protect against common browser-based attacks:

#### Missing Headers:
1. **Content-Security-Policy (CSP)** — MISSING
   - Required for XSS mitigation and controlling resource loading
   - Should be at minimum: `default-src 'self'; script-src 'self' 'nonce-*'; style-src 'self' 'unsafe-inline'`
   
2. **X-Frame-Options** — MISSING
   - Protects against clickjacking attacks
   - Should be: `X-Frame-Options: DENY` or `SAMEORIGIN`
   
3. **X-Content-Type-Options** — MISSING
   - Prevents MIME type sniffing attacks
   - Should be: `X-Content-Type-Options: nosniff`

4. **Strict-Transport-Security (HSTS)** — MISSING (for production)
   - Should be set in production: `Strict-Transport-Security: max-age=31536000; includeSubDomains`

5. **Referrer-Policy** — MISSING
   - Should be: `Referrer-Policy: no-referrer` or `strict-no-referrer`

#### Evidence:
```bash
curl -i http://localhost:5173/
# Response shows NO security headers
```

#### Remediation:
Add security headers in `src/hooks.server.ts` or SvelteKit config. Example:

```typescript
export const handle: Handle = async ({ event, resolve }) => {
  // ... existing code ...
  
  const response = await resolve(event, {
    transformPageChunk({ html }) {
      return formatHtml(html);
    }
  });

  // Add security headers
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'no-referrer');
  
  // CSP with nonce for scripts
  const nonce = crypto.randomUUID();
  response.headers.set(
    'Content-Security-Policy',
    `default-src 'self'; script-src 'self' 'nonce-${nonce}'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'`
  );
  
  // HSTS (production only)
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  return response;
};
```

---

### 🟠 HIGH: Insecure Preview Endpoint Content-Type Handling

**Severity:** HIGH  
**Status:** Not Fixed  
**Impact:** Potential for content-type confusion attacks  

The `/api/preview` endpoint uses `formData()` parsing but doesn't explicitly require `Content-Type: application/x-www-form-urlencoded`. When JSON is submitted, it returns a 500 error instead of rejecting the request cleanly.

#### Evidence:
```bash
# Correct (works)
curl -X POST http://localhost:5173/api/preview \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d 'body=test'

# Incorrect (returns 500)
curl -X POST http://localhost:5173/api/preview \
  -H "Content-Type: application/json" \
  -d '{"body":"test"}'
# Response: {"message":"Internal Error"}
```

#### Remediation:
Add explicit Content-Type validation:

```typescript
export const POST: RequestHandler = async ({ request, getClientAddress, locals }) => {
  const contentType = request.headers.get('content-type');
  
  if (!contentType?.includes('application/x-www-form-urlencoded')) {
    return json({ error: 'Content-Type must be application/x-www-form-urlencoded' }, { status: 400 });
  }

  // ... rest of handler ...
};
```

---

### 🟠 HIGH: Session Fixation Risk — No Rotation on Privilege Change

**Severity:** HIGH  
**Status:** Not Fixed  
**Impact:** Session could be reused across privilege escalations  

Currently, when a user is promoted from `member` to `admin` (or vice versa), their existing session token remains valid with the new privileges. An attacker could:

1. Have an account as a regular `member`
2. Wait for (or socially engineer) admin promotion
3. Use the same session token with escalated privileges without needing to re-authenticate

#### Evidence:
- No session rotation logic in admin promotion flow
- Session validation only checks `expiresAt` and user DID, not `globalRole` changes
- `validateSession()` in [src/lib/auth/session.ts:51-106](src/lib/auth/session.ts#L51-L106) caches role at login time

#### Remediation:
Invalidate all sessions when a user's `globalRole` changes:

```typescript
// In admin promotion action
export const actions = {
  promote: async ({ locals, request }) => {
    // ... authorization checks ...
    
    const data = await request.formData();
    const userDidToPromote = data.get('did');
    
    // Promote user
    await db.update(users).set({ globalRole: 'admin' }).where(eq(users.did, userDidToPromote));
    
    // Invalidate all sessions for this user
    await db.delete(sessions).where(eq(sessions.userDid, userDidToPromote));
    
    // Log the action
    // ...
  }
};
```

---

### 🟠 HIGH: Missing Rate Limiting on Preview Endpoint

**Severity:** HIGH  
**Status:** Partially Implemented  
**Impact:** Abuse potential; API not protected at scale  

The preview endpoint has rate limiting code (`checkAbuse`) but it's unclear if it's properly configured. Rapid requests succeed with no apparent throttling:

#### Evidence:
```bash
for i in {1..10}; do
  curl -s -X POST http://localhost:5173/api/preview \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d 'body=test' &
done
# All 10 requests completed without rate limit response
```

#### Remediation:
Verify rate limiting configuration in [src/lib/abuse/index.ts](src/lib/abuse/index.ts) and ensure:
- Per-IP rate limits for unauthenticated requests
- Per-DID rate limits for authenticated requests
- Appropriate thresholds (suggest: 10 req/min per user, 5 req/min per IP)
- Clear 429 response with `Retry-After` header

---

### 🟠 HIGH: Markdown Preview Doesn't Reject All Dangerous Content

**Severity:** HIGH  
**Status:** Partially Mitigated  
**Impact:** Sanitization works but trust model is unclear  

While sanitization is correctly implemented in the rendering pipeline, the content is sanitized at storage time, not preview time. If the sanitizer has a bypass, the stored HTML would be dangerous.

#### Evidence:
- Markdown preview returns sanitized HTML: `{"html":"<p>&#x3C;%= 7*7 %></p>"}`
- Server-side sanitization is good, but no client-side fallback
- No Content-Security-Policy prevents execution of any HTML that slips through

#### Remediation:
This is partially addressed by CSP headers (see above). Ensure:
1. CSP header is deployed (blocks inline script execution)
2. `rehype-sanitize` configuration is kept up-to-date
3. Regular audits of generated HTML

---

### 🟡 MEDIUM: Host Header Validation Only in Development

**Severity:** MEDIUM  
**Status:** Partially Implemented  
**Impact:** Potential for host header injection in production  

Vite's dev server correctly rejects invalid `Host` headers, but in production, the application depends entirely on Caddy's configuration. If Caddy is misconfigured, the app could be vulnerable to host header injection.

#### Evidence:
```bash
curl -H "Host: evil.com" http://localhost:5173/
# Response: "Blocked request. This host ("evil.com") is not allowed."

# But in production (if Caddy is misconfigured), this could be dangerous
```

#### Remediation:
Add host validation in the app itself:

```typescript
export const handle: Handle = async ({ event, resolve }) => {
  const host = event.request.headers.get('host');
  const allowedHosts = (process.env.ALLOWED_HOSTS || 'localhost').split(',');
  
  if (!allowedHosts.includes(host?.split(':')[0] ?? '')) {
    return new Response('Invalid Host header', { status: 400 });
  }
  
  // ... rest of handler ...
};
```

---

### 🟡 MEDIUM: No Subresource Integrity (SRI) for External Dependencies

**Severity:** MEDIUM  
**Status:** Not Applicable (SvelteKit SSR)  
**Impact:** Low risk due to SvelteKit architecture  

The application uses SvelteKit SSR which minimizes third-party script loading in the browser. However, if any external resources are ever added, they should use Subresource Integrity hashes.

#### Remediation:
If external scripts are added in the future, always use SRI:
```html
<script 
  src="https://example.com/script.js"
  integrity="sha384-ABC123..."
  crossorigin="anonymous">
</script>
```

---

### 🟢 LOW: Session Token Not Rotated in Rolling Expiry

**Severity:** LOW  
**Status:** Acceptable  
**Impact:** Session token lifetime is extended, not refreshed  

When a session's rolling expiry triggers, only the `expiresAt` timestamp is updated; the token itself remains the same. This is an acceptable design decision but increases the window for token compromise.

#### Evidence:
- [src/lib/auth/session.ts:76-84](src/lib/auth/session.ts#L76-L84) updates only `expiresAt`, not the token
- Token remains in cookie for the full 30-day duration

#### Note:
This is **not a critical issue** because:
- Token is HttpOnly and SameSite=Strict
- Rolling expiry gives users seamless experience
- Rotation would require client-side refresh logic
- Token is hashed in the database

#### Optional Improvement (Low Priority):
If you want strict token rotation, implement:

```typescript
// Only on every 7-day threshold, not on every request
const rotationThreshold = 7 * 24 * 60 * 60 * 1000; // 7 days
if (remaining < rotationThreshold) {
  const newToken = generateToken();
  await db.delete(sessions).where(eq(sessions.id, tokenHash));
  const newSession = await createSession(userDid);
  setSessionCookie(event, newSession);
}
```

---

### 🟢 LOW: Informational Error Messages

**Severity:** LOW  
**Status:** Acceptable  
**Impact:** Minimal information leakage  

The application returns generic error messages in most cases. Some error responses could be slightly more specific without being a security risk:

#### Example:
```bash
curl http://localhost:5173/api/nonexistent
# Returns generic HTML page, not a JSON error with "endpoint not found"
```

#### Note:
Current behavior (returning HTML for missing routes) is **acceptable and secure**. No changes required.

---

## Passed Security Checks ✅

### Authentication & Authorization
- ✅ Dev login restricted to `did:example:*` (prevents real user impersonation)
- ✅ Admin routes require `globalRole === 'admin'` check
- ✅ Non-admin users properly redirected from admin pages (403 Forbidden)
- ✅ Session validation includes DID lookup (prevents token reuse after account deletion)

### Input Validation & Sanitization
- ✅ XSS prevented: `<script>alert(1)</script>` returns `&#x3C;script&#x3E;` (escaped)
- ✅ SQL injection protected: Using Drizzle parameterized queries throughout
- ✅ Markdown SSTI attempts blocked: Template expressions rendered as escaped text
- ✅ XXE/XML injection blocked: XML tags rendered as escaped HTML
- ✅ Prototype pollution impossible: JSON objects not merged into prototypes

### Cookies & Sessions
- ✅ Session cookie flags correct: `HttpOnly`, `SameSite=Strict`, `Secure` (in prod)
- ✅ Token storage: SHA-256 hashed in database, raw token only in cookie
- ✅ Token generation: 32 cryptographically random bytes
- ✅ Token expiry: 30 days rolling expiry with refresh threshold

### Access Control
- ✅ Path traversal blocked: `/../../../etc/passwd` returns app HTML, not file contents
- ✅ Host header injection mitigated in dev (Vite), needs app-level check in prod
- ✅ CORS not misconfigured: No wildcard `Access-Control-Allow-Origin`

---

## Recommendations by Priority

### P0 (Immediate — Before Production)
1. **Add HTTP security headers** (X-Frame-Options, X-Content-Type-Options, CSP, HSTS, Referrer-Policy)
2. **Implement session rotation on privilege changes** (invalidate all sessions on role promotion)
3. **Add host header validation in the application** (not just Vite/Caddy)

### P1 (High Priority — This Phase)
4. **Validate Content-Type on `/api/preview` endpoint** (reject non-form content)
5. **Verify and document rate limiting configuration** (ensure adequate thresholds)
6. **Add Strict-Transport-Security to production Caddy config** (30+ day max-age)

### P2 (Medium Priority — Next Phase)
7. **Consider session token rotation** (optional; current design is acceptable)
8. **Add per-endpoint rate limiting documentation** (specify limits for each API)
9. **Audit `rehype-sanitize` configuration regularly** (stay updated with security patches)

### P3 (Low Priority — Polish)
10. **Implement SRI for any future external scripts** (if added)
11. **Add security response headers test suite** (CI/CD validation)

---

## Testing Methodology

**Test Environment:** `http://localhost:5173` (development mode)  
**Test Cases:** 38+ scenarios covering:
- Guest access to public pages
- Authenticated user privilege isolation
- Admin-only route access
- Input sanitization (XSS, SQL injection, SSTI, XXE, prototype pollution)
- HTTP security headers
- Cookie security flags
- Rate limiting behavior
- Session hijacking resistance
- CSRF protection
- Content-Type confusion

**Tools Used:** `curl`, browser dev tools, manual inspection of source code

---

## Conclusion

The application has **solid core security**, with proper authentication, authorization, and input sanitization. The primary gaps are **missing HTTP security headers** and **session management on privilege changes**, both of which are straightforward to fix.

**Recommendation:** Address P0 and P1 findings before pushing to production. The P2/P3 items can be addressed incrementally.

---

## Appendix: Full Vulnerability Test Results

### Test Results Table

| # | Test | Result | Status |
|---|---|---|---|
| 1 | Guest home page access | ✅ Returns HTML | OK |
| 2 | Session cookie security | ⚠️ No CSP, no X-Frame-Options | **CRITICAL** |
| 3 | Content-Security-Policy header | ❌ Missing | **CRITICAL** |
| 4 | X-Frame-Options header | ❌ Missing | **CRITICAL** |
| 5 | X-Content-Type-Options header | ❌ Missing | **CRITICAL** |
| 6 | XSS in markdown preview | ✅ HTML escaped | OK |
| 7 | Guest access to `/admin/users` | ✅ 403 Forbidden | OK |
| 8 | Guest access to `/admin/forums` | ✅ 403 Forbidden | OK |
| 9 | Guest access to `/admin/mod-log` | ✅ 403 Forbidden | OK |
| 10 | CSRF tokens on forms | ✅ SameSite=Strict | OK |
| 11 | Search query with XSS | ✅ Query param echoed safely | OK |
| 12 | Path traversal via URL | ✅ Returns app HTML | OK |
| 13 | User profile endpoint | ✅ Proper rendering | OK |
| 14 | SQL injection in search | ✅ Parameterized queries | OK |
| 15 | SQL injection in admin filter | ✅ Drizzle ORM protection | OK |
| 16 | Open redirect attempts | ✅ No redirect endpoint | OK |
| 17 | Error message disclosure | ✅ Generic responses | OK |
| 18 | Fake session hijacking | ✅ 403 on invalid token | OK |
| 19 | HTTP method override | ✅ SvelteKit handles correctly | OK |
| 20 | 404 info disclosure | ✅ Generic error page | OK |
| 21 | Dev login with valid DID | ✅ Session created | OK |
| 22 | Dev login form structure | ✅ Secure form submission | OK |
| 23 | Admin panel access (authenticated) | ✅ 200 OK with proper auth | OK |
| 24 | User data enumeration | ✅ Admin only, no exposure | OK |
| 25 | Non-admin to admin access | ✅ 403 Forbidden | OK |
| 26 | XXE/XML injection | ✅ Escaped safely | OK |
| 27 | Prototype pollution | ✅ JSON not merged into prototype | OK |
| 28 | SSTI in markdown | ✅ Template syntax escaped | OK |
| 29 | Rate limiting - rapid requests | ⚠️ No apparent throttling | **HIGH** |
| 30 | Content-Type confusion | ❌ Returns 500 instead of 400 | **HIGH** |
| 31 | Host header injection (dev) | ✅ Blocked by Vite | OK |
| 32 | Host header injection (app level) | ❌ No validation in code | **MEDIUM** |
| 33 | Session rotation on privilege change | ❌ Sessions not invalidated | **HIGH** |
| 34 | MIME type sniffing | ❌ No X-Content-Type-Options | **CRITICAL** |
| 35 | Clickjacking protection | ❌ No X-Frame-Options | **CRITICAL** |
| 36 | CORS misconfiguration | ✅ Properly scoped | OK |
| 37 | HSTS implementation | ❌ Missing in production config | **HIGH** |
| 38 | SRI for external resources | N/A | N/A |

