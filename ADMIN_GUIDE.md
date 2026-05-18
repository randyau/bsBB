# Admin Guide — bsBB Forum

This guide covers everything an admin needs to operate their bsBB forum: initial setup, user management, forum structure, moderation, and day-to-day operations.

---

## Getting Admin Access

The first Bluesky account to log in after deployment is automatically promoted to admin. This happens exactly once — after that, admin access must be granted manually through the admin dashboard.

If you missed the auto-promotion (someone else logged in first), you can fix it from the database:

```bash
docker compose -f docker-compose.prod.yml exec db \
  psql -U forum forum -c \
  "UPDATE users SET global_role = 'admin' WHERE handle = 'yourhandle.bsky.social';"
```

---

## Admin Dashboard

The admin dashboard is at `/admin`. It's only accessible to users with `global_role = 'admin'`.

Sections:

| Section | What you do there |
|---|---|
| **Users** | View, ban, promote, or manage any user's posts |
| **Forums** | Create, rename, reorder, and configure forums and sub-forums |
| **Threads** | Lock, unlock, pin, or move threads across forums |
| **Roles** | Create custom roles, assign them to users |
| **Approval Queue** | Review and approve/reject posts from new accounts |
| **Mod Log** | Audit trail of all moderation actions |
| **SQL Query** | Run SELECT queries against the database (read-only) |

---

## Setting Up Forums

### Creating Your First Forum

1. Go to **Admin → Forums → New Forum**
2. Enter a name (e.g., "General Discussion") and optional description
3. Set the parent forum (leave blank for a top-level forum)
4. Set visibility (public or members-only)
5. Click Create

### Forum Hierarchy

Forums can be nested: a top-level "Community" forum might contain sub-forums "General", "Help", and "Off-Topic". Sub-forums inherit permissions from their parent unless you explicitly override them.

### Forum Visibility

- **Public:** Anyone (including logged-out visitors) can read. Only members can post.
- **Members-only:** Logged-in users only can read and post.

Set the default for new forums via `DEFAULT_FORUM_VISIBILITY` in `.env`.

### Assigning Moderators

1. Go to **Admin → Forums**, select a forum
2. Under "Moderators", search for a user and assign them
3. Forum moderators can lock/unlock threads, hide/restore posts, and move posts within their forum

---

## User Management

### Promoting a User to Admin

**Admin dashboard:**
1. Go to **Admin → Users**, find the user
2. Click "Promote to Admin"

**Via database (if needed):**
```bash
docker compose -f docker-compose.prod.yml exec db \
  psql -U forum forum -c \
  "UPDATE users SET global_role = 'admin' WHERE handle = 'theirhandle.bsky.social';"
```

### Banning a User

1. Go to **Admin → Users**, find the user
2. Click "Ban" — optionally enter a reason
3. The user sees a ban message when they try to log in and cannot post

Banning sets `global_role = 'banned'`. The user's posts remain visible (unless you hide them separately).

### Viewing a User's Posts

1. Go to **Admin → Users**, find the user
2. Click "Manage Posts" to see all their posts with hide/delete options

Or visit `/user/[handle]` from any page — the admin view there shows hidden posts and includes moderation tools.

### Custom Roles

Custom roles are labels you can assign to users (e.g., "Trusted Member", "Contributor", "Beta Tester"). They're cosmetic by default — they appear on user profiles and can be used to identify trusted members.

1. Go to **Admin → Roles → New Role**
2. Enter a name, description, and optional color
3. Assign users to the role from **Admin → Users** or from the role management page

---

## Moderation

### The Approval Queue

The approval queue holds posts from accounts newer than a threshold you configure per forum. Use it to limit spam from brand-new Bluesky accounts.

**To enable per forum:**
1. Go to **Admin → Forums**, select a forum
2. Under "Spam Prevention", set "Require approval for accounts newer than N days"
3. Save

**Working the queue:**
1. Go to **Admin → Approval Queue**
2. Review each pending post in context
3. Click **Approve** to publish it, or **Reject** with a reason
4. Rejected posts: the user gets a DM with the reason (if they've opted into notifications)

Posts not actioned within 24 hours are auto-approved to prevent backlog.

### Hiding vs. Deleting Posts

| Action | What happens | Reversible? |
|---|---|---|
| **Hide** | Post disappears from public view; admins/mods still see it | Yes — restore anytime |
| **Soft delete** | Post stub remains (for quote links), content is cleared | No — content is gone |
| **Hard delete** | Post and stub are completely removed | No — post is gone |

When in doubt, hide rather than delete. You can always restore a hidden post; you can't un-delete.

### Locking Threads

A locked thread can be read but not replied to. Use it to close a discussion without deleting it.

From a thread: admins and forum moderators see a "Lock thread" button on the first post.

From the admin dashboard: **Admin → Threads → Lock**.

### Moving Posts and Threads

**Move a thread to a different forum:**
1. From the thread, click the mod tools menu → "Move thread"
2. Select the destination forum
3. The thread moves; a log entry is created

**Move a post to a different thread:**
1. From the post, click the mod tools menu → "Move post"
2. Select the destination thread
3. The post moves; original location shows a placeholder

### The Mod Log

Every moderation action is logged at `/admin/mod-log`. The log is append-only — nothing can be deleted from it.

Fields: timestamp, moderator, action type, target (user/post/thread), reason (if provided).

Use it to audit mod activity, resolve disputes, and maintain accountability.

---

## Content Policy Enforcement

bsBB doesn't include built-in content policy tools beyond what's described above. Suggested practices:

1. **Write your rules** — add them to your forum as a pinned thread in a "Rules" forum
2. **Start with the approval queue** — enable it for all forums with a 7-day threshold to filter early spam
3. **Warn before banning** — use a mod log entry with reason before banning users; gives you a paper trail
4. **Use soft delete** — hide posts rather than deleting; you may need to review them later

---

## Instance Settings

A few settings are stored in the `instance_settings` table and aren't yet exposed through the admin UI. You can view and modify them with the SQL query interface at **Admin → SQL Query**, or directly via `psql`:

```bash
docker compose -f docker-compose.prod.yml exec db \
  psql -U forum forum -c "SELECT key, value FROM instance_settings;"
```

| Key | Values | Meaning |
|---|---|---|
| `setup_complete` | `true` / `false` | Whether first-run setup has run |
| `first_admin_claimed` | `true` / `false` | Whether the auto-admin has been assigned |
| `default_forum_visibility` | `public` / `members-only` | Default for new forums |

---

## Routine Maintenance

### Weekly

- Check **Admin → Approval Queue** for any pending posts
- Scan **Admin → Mod Log** for unexpected activity
- Check disk space: `df -h`

### Monthly

- Review user bans — some may be worth lifting
- Check backup log: `cat /root/backups/backup.log | tail -30`
- Update base Docker images: see [UPGRADE.md](UPGRADE.md)

### As Needed

- After any incident: document in the mod log with full reason
- After a spam wave: consider tightening the approval queue threshold
- After code updates: follow [UPGRADE.md](UPGRADE.md)

---

## Database Access

The admin dashboard includes a **SQL Query** interface that runs SELECT-only queries. Use it to look up users, check post counts, or investigate issues without needing command-line access.

For write operations, use `psql` directly:

```bash
docker compose -f docker-compose.prod.yml exec db psql -U forum forum
```

Common queries:

```sql
-- Find a user by handle
SELECT did, handle, global_role, created_at FROM users WHERE handle ILIKE '%searchterm%';

-- Count posts per forum
SELECT f.name, COUNT(p.id) AS post_count
FROM forums f
LEFT JOIN threads t ON t.forum_id = f.id
LEFT JOIN posts p ON p.thread_id = t.id
GROUP BY f.name ORDER BY post_count DESC;

-- Recent moderation actions
SELECT created_at, moderator_did, action, reason
FROM mod_log ORDER BY created_at DESC LIMIT 20;

-- Pending approval queue
SELECT p.id, u.handle, p.created_at, LEFT(p.content_markdown, 100)
FROM posts p
JOIN users u ON u.did = p.author_did
WHERE p.is_approved = false AND p.status = 'visible'
ORDER BY p.created_at;
```

---

## Getting Help

- **Something broken in production?** Check logs: `docker compose -f docker-compose.prod.yml logs -f app`
- **Database issues?** See [BACKUP.md](BACKUP.md) for recovery options
- **Upgrading?** See [UPGRADE.md](UPGRADE.md)
- **Architecture questions?** See [ARCHITECTURE.md](ARCHITECTURE.md) and [CLAUDE.md](CLAUDE.md)
