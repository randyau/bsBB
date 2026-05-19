# Post-Launch Improvements & Future Features

These are improvements and features deferred from v1.0 to keep the initial launch focused and straightforward.

---

## Storage & Media

### Local Avatar Image Caching
**Priority:** Medium  
**Effort:** 3-5 days  
**Rationale:** Currently storing Bluesky CDN URLs only. Local caching would ensure avatars persist even if Bluesky CDN URLs break or change, but adds storage/hosting complexity.

**Scope:**
- Add `avatar_blob` BYTEA column to `users` table for local copies
- Fetch and cache avatar on profile sync (lazy loading)
- Serve cached versions by default, fallback to remote if cache missing
- Periodic cleanup of unused cached images
- Optional image optimization (resize, compress) before storage

**Considerations:**
- Requires blob storage solution (PostgreSQL, or separate S3/R2 bucket)
- CDN costs if using S3/R2 (vs. relying on Bluesky's free CDN)
- Storage quotas per instance
- Bandwidth implications at scale
- Privacy: keep or delete on user delete?

**Decision:** Post-v1 to evaluate hosting costs and user demand.

---

## Forum Features

### Thread Tags/Labels
**Priority:** Medium  
**Effort:** 2-3 days  
**Scope:** Allow admins to define thread tags (Bug, Feature Request, Discussion, etc.), use on creation/moderation, filter by tag in UI.

### Favorites/Quick Navigation Sidebar
**Priority:** Low  
**Effort:** 2-3 days  
**Scope:** Logged-in users can "star" forums/threads, quick-access sidebar, quick nav on mobile.

### Advanced Search Filters
**Priority:** Medium  
**Effort:** 3-4 days  
**Scope:** Date range, poster filter, thread status (locked/pinned), tag filters, author reputation.

### Quote Preview on Hover
**Priority:** Low  
**Effort:** 1-2 days  
**Scope:** When hovering over `>!quote` refs, show a tooltip with quoted post content.

### Share Post Button
**Priority:** Low  
**Effort:** 1 day  
**Scope:** Copy permalink to clipboard, generate short share link for social media.

---

## Notifications & Communication

### Digest-Style Notifications
**Priority:** Medium  
**Effort:** 3-4 days  
**Scope:** Instead of individual DMs per reply, group notifications into digest emails/DMs (daily/weekly summaries).

### Read Receipts (Optional, Privacy-Aware)
**Priority:** Low  
**Effort:** 2-3 days  
**Scope:** Optional per-user setting to show "Seen at" timestamps on posts. Privacy-first: disabled by default.

---

## Admin & Moderation

### Spam Detection & Auto-Moderation Rules
**Priority:** High (post-launch)  
**Effort:** 4-5 days  
**Scope:** Custom spam rules (keyword blacklist, rate limiting patterns, new account restrictions), auto-action (hide pending review, auto-reject, require approval).

### Bulk User Actions
**Priority:** Medium  
**Effort:** 2-3 days  
**Scope:** Suspend/unsuspend multiple users, bulk role assignment, export user list.

### Forum Analytics Dashboard
**Priority:** Low  
**Effort:** 3-4 days  
**Scope:** Posts per day, active users, peak hours, thread engagement metrics, Grafana/Prometheus integration.

---

## Developer & DevOps

### Prometheus Metrics Export
**Priority:** Medium  
**Effort:** 2-3 days  
**Scope:** Expose `/metrics` endpoint with request counts, latency, database pool stats, queue depth.

### Health Check Endpoint
**Priority:** Low  
**Effort:** 1 day  
**Scope:** `/health` returns JSON with DB connection, queue status, cache stats for monitoring.

### Database Query Logging & Slow Query Analysis
**Priority:** Low  
**Effort:** 1-2 days  
**Scope:** Optional verbose query logging, identify N+1 queries, recommend indexes.

---

## Performance & Scalability

### Full-Text Search Pagination Optimization
**Priority:** Low  
**Effort:** 1-2 days  
**Scope:** Large result sets (10k+ matches) currently slow; add pagination cursors or offset optimization.

### Redis Caching Layer (Optional)
**Priority:** Low  
**Effort:** 4-5 days  
**Rationale:** v1 uses Postgres for sessions/cache. Redis optional for high-traffic instances but adds deployment complexity.

---

## Documentation & Onboarding

### Admin Training Videos
**Priority:** Low  
**Effort:** 2-3 days (production)  
**Scope:** 5-10 minute video walkthroughs: setup, forum creation, moderation, user management.

### Adopter Community Forum
**Priority:** Low  
**Effort:** Ongoing  
**Scope:** Public forum for self-hosted instance admins to share tips, troubleshoot, request features.

---

## Integrations & Extensibility

### Plugin/Theme System
**Priority:** Low (major undertaking)  
**Effort:** 2-3 weeks  
**Rationale:** Allow admins to ship custom CSS/JS without code edits. Requires sandboxing, versioning, package management.

### Matrix/Discord Bridge
**Priority:** Low  
**Effort:** 3-4 days  
**Scope:** Post new threads to a Discord channel, DM replies to Discord users (read-only initially).

### Slack Notifications
**Priority:** Low  
**Effort:** 1-2 days  
**Scope:** Optional Slack webhook integration for DMs (mentions, thread replies).

---

## Deferred Indefinitely (Unlikely for v1 or v2)

- **Real-time chat or live updates** — adds websocket/polling complexity; forum model doesn't require it
- **Private messaging system** — defer to Bluesky DMs; separate PM system over-engineered for forums
- **File/image upload & hosting** — out of scope; oEmbed + link metadata sufficient
- **Complex rich text editor (WYSIWYG)** — Markdown + live preview proven simpler; avoid JS bloat
- **User reputation/karma system** — contentious, gamifiable; keep moderation trust-based
- **Reaction emoji system** — low priority; can use emoji in posts instead
- **Nested threaded replies** — anti-pattern at scale; flat + quotes proven better

---
