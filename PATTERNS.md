# Code Patterns & Snippets

Reusable patterns to copy-paste and adapt. See actual implementations in code references.

**For style, design, and formatting conventions, see STYLEGUIDE.md.**

---

## Datetime Formatting

Always use centralized formatting functions from `src/lib/utils/time.ts`:

```typescript
import { formatTime, formatDate, formatAbsoluteTime, formatTimeDisplay } from '$lib/utils/time';

// Default choice — shows both absolute and relative time
const created = formatTimeDisplay(post.createdAt);  // "2026-05-18 14:30 (2h ago)"

// Date only (no time component)
const dated = formatDate(post.createdAt);  // "2026-05-18"

// Absolute datetime only
const absolute = formatAbsoluteTime(post.createdAt);  // "2026-05-18 14:30"

// Relative time only
const relative = formatTime(post.createdAt);  // "2h ago"
```

See **STYLEGUIDE.md** for when to use each variant.

---

## Session Management

### Create a new session
```typescript
import { createSession, setSessionCookie } from '$lib/auth/session';

const token = await createSession(did);
setSessionCookie(event, token);
```

### Validate session from request
```typescript
import { getSessionToken, validateSession } from '$lib/auth/session';

export async function handle({ event, resolve }) {
  const token = getSessionToken(event);
  if (token) {
    const session = await validateSession(token);
    event.locals.user = session?.user || null;
    event.locals.sessionId = session?.id || null;
  }
  return resolve(event);
}
```

### Delete session
```typescript
import { invalidateSession, deleteSessionCookie } from '$lib/auth/session';

await invalidateSession(sessionId);
deleteSessionCookie(event);
```

---

## User Management

### Upsert user on login (create or update profile cache)
```typescript
import { upsertUser } from '$lib/auth/user';

const user = await upsertUser(did, handle, displayName, avatarUrl);
```

### Claim first admin (idempotent, safe to call multiple times)
```typescript
import { claimFirstAdmin } from '$lib/auth/user';

const wasPromoted = await claimFirstAdmin(did);
if (wasPromoted) {
  // Show one-time banner, write mod_log entry, etc.
}
```

### Lazy profile sync (fire-and-forget background task)
```typescript
import { maybeSyncProfile } from '$lib/auth/profile-sync';

// Fetches from PLC + bsky.app if > 24h old, updates cache
maybeSyncProfile(did, lastProfileSync).catch(err => {
  console.error('profile sync failed:', err);
});
```

---

## Permissions

### Check if user can read a forum
```typescript
import { db } from '$lib/db';
import { canRead } from '$lib/permissions';

// Returns true/false
const allowed = await canRead(db, forumId, locals.user);

// In a route handler:
if (!allowed) {
  throw error(403, 'Access denied');
}
```

### Check if user can post in a forum
```typescript
import { db } from '$lib/db';
import { canPost } from '$lib/permissions';

// Returns true/false; false for banned users or guests
const allowed = await canPost(db, forumId, locals.user);

if (!allowed) {
  return fail(403, { error: 'You cannot post in this forum' });
}
```

### Custom roles (admin-defined)
```typescript
import { db } from '$lib/db';
import { roles, userRoles } from '$lib/db/schema';
import { eq } from 'drizzle-orm';

// Create a custom role
await db.insert(roles).values({
  name: 'Moderator',
  description: 'Community moderators',
  color: '#e11d48',  // hex color for badge
});

// Assign role to user
await db.insert(userRoles).values({
  userDid: targetDid,
  roleId: roleId,
  assignedBy: locals.user.did,
});

// Query user's custom roles
const userCustomRoles = await db.query.userRoles.findMany({
  where: eq(userRoles.userDid, userDid),
  with: { role: true },  // join to get role name/color
});

// Remove custom role
await db.delete(userRoles)
  .where(and(
    eq(userRoles.userDid, userDid),
    eq(userRoles.roleId, roleId)
  ));
```

---

## Database Queries

### Insert with Drizzle (parameterized)
```typescript
import { db } from '$lib/db';
import { users } from '$lib/db/schema';

await db.insert(users).values({
  did,
  handle,
  display_name: displayName,
  avatar_url: avatarUrl,
  global_role: 'member',
  created_at: new Date(),
}).onConflictDoUpdate({
  target: users.did,
  set: {
    handle,
    display_name: displayName,
    avatar_url: avatarUrl,
    last_profile_sync: new Date(),
  },
});
```

### Select with WHERE
```typescript
import { db } from '$lib/db';
import { users } from '$lib/db/schema';
import { eq } from 'drizzle-orm';

const user = await db.query.users.findFirst({
  where: eq(users.did, did),
});
```

### Select multiple with WHERE
```typescript
import { db } from '$lib/db';
import { users } from '$lib/db/schema';
import { eq } from 'drizzle-orm';

const admins = await db.query.users.findMany({
  where: eq(users.global_role, 'admin'),
});
```

### Update
```typescript
import { db } from '$lib/db';
import { users } from '$lib/db/schema';
import { eq } from 'drizzle-orm';

await db.update(users)
  .set({ global_role: 'banned' })
  .where(eq(users.did, did));
```

### Update post status (not is_deleted)
```typescript
import { db } from '$lib/db';
import { posts } from '$lib/db/schema';
import { eq } from 'drizzle-orm';

// Use status column instead of is_deleted
// Status values: 'active' | 'hidden' | 'archived' | 'deleted'
await db.update(posts)
  .set({ status: 'hidden' })  // User or mod hides post
  .where(eq(posts.id, postId));

await db.update(posts)
  .set({ status: 'deleted' }) // Content removed, stub preserved
  .where(eq(posts.id, postId));

// Query posts by status
const activePostsInThread = await db.query.posts.findMany({
  where: and(
    eq(posts.threadId, threadId),
    eq(posts.status, 'active')
  ),
});
```

### Log moderation actions (append-only audit trail)
```typescript
import { db } from '$lib/db';
import { modLog } from '$lib/db/schema';

// Always log mod actions — never modify/delete mod_log
await db.insert(modLog).values({
  moderatorDid: locals.user.did,
  action: 'hide_post',  // or 'hide_own_post', 'delete_post', 'ban', etc.
  targetPostId: postId,
  targetDid: post.authorDid,
  reason: 'Spam',  // optional context
});

// Check if post was hidden by author or mod
const hideAction = await db.query.modLog.findFirst({
  where: and(
    or(
      eq(modLog.action, 'hide_own_post'),
      eq(modLog.action, 'hide_post')
    ),
    eq(modLog.targetPostId, postId)
  ),
  orderBy: desc(modLog.createdAt),
});

const isUserHidden = hideAction?.action === 'hide_own_post';
const isModHidden = hideAction?.action === 'hide_post';
```

---

## Markdown & HTML

### Server-side sanitize before storage
```typescript
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeSanitize from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';

async function markdownToHtml(markdown: string): Promise<string> {
  const processor = unified()
    .use(remarkParse)
    .use(remarkRehype)
    .use(rehypeSanitize)
    .use(rehypeStringify);
  
  const result = await processor.process(markdown);
  return result.toString();
}
```

Use the imported `renderMarkdown` from `src/lib/markdown/index.ts` instead:
```typescript
import { renderMarkdown } from '$lib/markdown';

const bodyHtml = await renderMarkdown(markdown);
```

### Extract OG metadata from bare-line URL
```typescript
import { fetchLinkMetadata } from '$lib/markdown/og';

// Extracts first bare-line URL from markdown
// Returns { url, title, description, imageUrl } or null on error/timeout
const metadata = await fetchLinkMetadata(markdown);

// Errors are graceful: 5s timeout, network failures, etc. silently return null
// Never blocks post submission
if (metadata) {
  // Store in post: { url, title, description, imageUrl }
}
```

---

## Routes & Server Actions

### Basic `+page.server.ts` (load + action)
```typescript
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) {
    throw error(401, 'Unauthorized');
  }
  
  return {
    user: locals.user,
    // fetch data
  };
};

export const actions: Actions = {
  default: async ({ request, locals }) => {
    if (!locals.user) {
      throw error(401, 'Unauthorized');
    }
    
    const formData = await request.formData();
    const title = formData.get('title');
    
    // validate, insert, return result
    return { success: true };
  },
};
```

### OAuth callback route (`+server.ts`)
```typescript
import { getAtprotoClient } from '$lib/auth/atproto';
import { upsertUser, claimFirstAdmin } from '$lib/auth/user';
import { createSession, setSessionCookie } from '$lib/auth/session';

export const GET: RequestHandler = async ({ url, event }) => {
  const atproto = getAtprotoClient();
  
  // Handle OAuth callback
  const session = await atproto.callback(url.toString());
  
  // Extract DID from token
  const did = session.info.sub;
  
  // Upsert user in DB
  const user = await upsertUser(did, '', '', null);
  
  // Claim first admin if applicable
  await claimFirstAdmin(did);
  
  // Create local session
  const token = await createSession(did);
  setSessionCookie(event, token);
  
  return new Response(null, {
    status: 302,
    headers: { Location: '/' },
  });
};
```

### Redirect banned users (in `hooks.server.ts`)
```typescript
import { redirect } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
  // ... session setup ...
  
  if (event.locals.user?.global_role === 'banned') {
    if (event.url.pathname !== '/banned' && event.url.pathname !== '/logout') {
      throw redirect(302, '/banned');
    }
  }
  
  return resolve(event);
};
```

---

## Testing

### Session test pattern
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createSession, validateSession, invalidateSession } from '$lib/auth/session';

describe('session', () => {
  let sessionId: string;
  const testDid = 'did:plc:test123';
  
  beforeEach(async () => {
    sessionId = await createSession(testDid);
  });
  
  afterEach(async () => {
    await invalidateSession(sessionId);
  });
  
  it('validates a fresh session', async () => {
    const session = await validateSession(sessionId);
    expect(session).toBeDefined();
    expect(session?.user.did).toBe(testDid);
  });
  
  it('rejects an invalid token', async () => {
    const session = await validateSession('invalid_token');
    expect(session).toBeNull();
  });
});
```

### DB test pattern (use real dev DB)
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '$lib/db';
import { users } from '$lib/db/schema';
import { eq } from 'drizzle-orm';

describe('users table', () => {
  const testDid = `did:plc:test_${Date.now()}`;
  
  beforeEach(async () => {
    // Clean up test data
    await db.delete(users).where(eq(users.did, testDid));
  });
  
  it('inserts a user', async () => {
    await db.insert(users).values({
      did: testDid,
      handle: 'test.bsky.social',
      created_at: new Date(),
    });
    
    const user = await db.query.users.findFirst({
      where: eq(users.did, testDid),
    });
    
    expect(user?.handle).toBe('test.bsky.social');
  });
});
```

---

## Type Patterns

### App.Locals (authenticated user context)
```typescript
// In src/app.d.ts
declare global {
  namespace App {
    interface Locals {
      user: SessionUser | null;
      sessionId: string | null;
    }
  }
}

interface SessionUser {
  did: string;
  handle: string | null;
  display_name: string | null;
  avatar_url: string | null;
  global_role: 'admin' | 'member' | 'banned';
  notifyViaBluesky: boolean;  // opt-in DM notifications flag
  lastProfileSync: Date;      // when profile was last synced from PDS
  createdAt: Date;            // account creation timestamp
}
```

### Result type (success/error)
```typescript
type Result<T, E = string> = 
  | { ok: true; data: T }
  | { ok: false; error: E };

// Usage
const result: Result<User> = ok 
  ? { ok: true, data: user }
  : { ok: false, error: 'Not found' };

if (result.ok) {
  console.log(result.data);
} else {
  console.error(result.error);
}
```

---

## Error Handling

### HTTP errors in routes
```typescript
import { error } from '@sveltejs/kit';

if (!locals.user) {
  throw error(401, 'Unauthorized');
}

if (!post) {
  throw error(404, 'Post not found');
}

if (isInvalid) {
  throw error(400, 'Invalid request');
}
```

### Try-catch in server actions
```typescript
export const actions: Actions = {
  default: async ({ request, locals }) => {
    try {
      // ... do work ...
      return { success: true };
    } catch (err) {
      console.error(err);
      return { success: false, error: 'Something went wrong' };
    }
  },
};
```

---

## Slugs & URL Generation

### Generate slug from title
```typescript
import { generateSlug } from '$lib/markdown/slug';

const threadSlug = generateSlug(title);
// "My Cool Thread" → "my-cool-thread"
```

### Thread URL pattern
```
/f/[forum_slug]/t/[thread_id]/[thread_slug]
```
- `[forum_slug]` — cosmetic, for SEO
- `[thread_id]` — authoritative (UUID), links never break
- `[thread_slug]` — cosmetic, derived from title
- 301 redirect if slug mismatches

---

## Common Gotchas

1. **Drizzle migrations are file-only** — Never use `drizzle-kit push` in any environment. Always hand-craft or generate-then-review.
2. **Sessions in DB, not memory** — Survives server restarts. Token is SHA-256 hashed in DB, raw token in cookie.
3. **DIDs not handles** — Handles are mutable; use DIDs as all user FKs.
4. **Markdown sanitized before storage** — Not at render time. Prevents XSS.
5. **Lazy profile sync** — Fire-and-forget, catches errors internally. Don't await in hot paths.
6. **First admin is idempotent** — Safe to call multiple times; gated by `instance_settings.first_admin_claimed`.
7. **Banned users get redirected** — In `hooks.server.ts` before route load. Except `/banned` and `/logout`.
8. **Custom sessions (no external library)** — Proven simple and secure (32-byte token + SHA-256 hash). See `src/lib/auth/session.ts`. Don't replace with Lucia or similar.
9. **Use post.status, not post.is_deleted** — `status` column replaces `is_deleted` boolean. Values: `'active'` | `'hidden'` | `'archived'` | `'deleted'`.
10. **Check mod_log to distinguish user vs mod action** — `hide_own_post` vs `hide_post`, `delete_own_post` vs `delete_post`. Display accordingly.
11. **Custom roles are global** — Assigned via `user_roles` (many-to-many). Distinguished from per-forum moderator assignments in `user_forum_roles`.
12. **Mod_log is append-only** — No delete or update routes. Provides permanent audit trail. Check this table for action history.

