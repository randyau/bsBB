# bsBB — Implementation Status

**Last Updated:** 2026-05-16  
**Overall Status:** 🚀 Phase 7 In Progress (Phases 1–6 Complete, 35+ commits)

## Summary

All core features are implemented and production-ready. Phase 7 focuses on design and UI refinements. The forum is fully functional with:
- ✅ ATproto authentication via OAuth
- ✅ Forum hierarchy with permissions
- ✅ Post creation with markdown + OG metadata
- ✅ Full moderation suite (ban/delete/lock/pin)
- ✅ Email + Bluesky DM notifications
- ✅ Background worker for async tasks
- ✅ Full-text search (hybrid tsvector + substring)
- ✅ Post editing with revision history
- ✅ Production Docker Compose stack
- 🚀 Theme system with light/dark mode (Phase 7)
- 🚀 Admin forums management (Phase 7)

---

## Detailed Phase Breakdown

### Phase 1 ✅ — Foundations (7 commits)

**Status:** Complete  
**Key Features:**
- SvelteKit + adapter-node + Tailwind CSS v4 + Vitest
- PostgreSQL 17 with Drizzle ORM (12 tables)
- Custom roll-your-own sessions (32-byte token, SHA-256 hash)
- ATproto OAuth integration with `@atproto/oauth-client-node`
- User upsert, lazy profile sync, first-admin gate
- Banned user redirect `/banned` endpoint
- Rate limiting stub (Phase 4 fills in real logic)
- Docker Compose (dev config)
- Setup scripts (keypair generation, migrations, seeding)

**Commit Sequence:**
1. SvelteKit scaffold + Tailwind v4 + Vitest
2. Database schema + Drizzle ORM setup
3. ATproto OAuth + custom sessions
4. User model + profile sync
5. Admin gating + banned user handling
6. Rate limiting stub + abuse module
7. Docker & setup scripts

**Files:**
- `src/routes/(auth)/` — Login, callback, logout routes
- `src/lib/auth/` — Session management, login flow
- `src/lib/db/schema.ts` — Full database schema
- `docker-compose.yml` — Development stack
- `scripts/setup.sh` — Deployment setup automation

---

### Phase 2 ✅ — Read-Only Forum Views (1 commit)

**Status:** Complete  
**Key Features:**
- Forum index with pagination (`/`)
- Forum view with thread listing (`/f/[slug]`)
- Thread detail with flat post list (`/f/[slug]/t/[slug]`)
- Permission checks on all views (`canRead`)
- URL routing with slug + UUID (redirects on mismatch)
- Pinned/locked thread badges
- Quote preview links in thread replies

**Files:**
- `src/routes/f/[forumSlug]/+page.svelte` — Forum listing
- `src/routes/f/[forumSlug]/t/[threadId]/+page.svelte` — Thread detail
- `src/lib/db/queries.ts` — Query helpers

---

### Phase 3 ✅ — Post Creation & Content (2 commits)

**Status:** Complete  
**Key Features:**
- New thread form (`/f/[slug]/new`)
- Inline reply form with quote button
- Markdown preview endpoint (`POST /api/preview`)
- Server-side markdown rendering (unified + remark + rehype + sanitize)
- OG metadata fetching for bare-line URLs (5s timeout, graceful errors)
- Thread slug generation with uniqueness retry
- Atomic thread+post insertion
- Character counters on forms
- Form validation with error messages

**Commit Sequence:**
1. Post creation (threads, replies, markdown preview, OG metadata)
2. Form validation, character counters, quote UX polish

**Files:**
- `src/routes/f/[forumSlug]/new/+page.svelte` — New thread form
- `src/routes/f/[forumSlug]/t/[threadId]/+page.svelte` — Reply form + quote
- `src/routes/api/preview/+server.ts` — Markdown preview endpoint
- `src/lib/markdown.ts` — Markdown rendering pipeline
- `src/lib/og.ts` — OpenGraph metadata fetching

---

### Phase 4 ✅ — Moderation & Admin (7 commits)

**Status:** Complete  
**Key Features:**
- Real rate limiting (atomic PostgreSQL upserts)
  - `thread_create`: 10 per hour per DID
  - `post_submit`: 30 per hour per DID
  - `preview_request`: 60 per hour per IP
  - `login_attempt`: 10 per 15 min per IP
  - Others: 20 per hour per IP
- Admin dashboard with sidebar navigation
- SQL query interface (SELECT-only, 1000 row limit)
- User management (ban/unban/promote/demote)
- Thread management (lock/unlock/pin/unpin)
- Post management (delete/restore)
- Mod log viewer (append-only audit trail)
- Admin guard on `/admin` routes (403 for non-admins)
- 17 integration tests with Vitest

**Commit Sequence:**
1. Real rate limiting
2. Admin layout guard + nav
3. SQL query interface
4. Users page
5. Threads page
6. Posts page
7. Mod log page

**Files:**
- `src/lib/abuse/index.ts` — Rate limiting logic
- `src/routes/admin/` — All admin pages and actions

---

### Phase 5 ✅ — Notifications & Background Tasks (6 commits)

**Status:** Complete  
**Key Features:**
- Email notifications (Nodemailer over SMTP)
- Bluesky DM notifications (opt-in per user)
- Background worker polling `notification_queue` every 60s
- PostgreSQL `FOR UPDATE SKIP LOCKED` for safe concurrent workers
- AES-256-GCM encryption for chat tokens (`chat_session_encrypted`)
- Lazy profile sync check on post submit
- 7 unit tests for worker, encryption, email

**Notification Types:**
- Moderator alerts (ban/delete/lock actions)
- DM notifications (replies, quotes, etc.)
- Profile sync enqueue (lazy update)

**Commit Sequence:**
1. Email infrastructure (Nodemailer + SMTP)
2. Notification worker polling loop
3. Moderator email alerts
4. Bluesky DM notifications + encryption
5. Lazy profile sync
6. Tests & documentation

**Files:**
- `src/worker.ts` — Main polling loop + notification handlers
- `src/lib/email.ts` — Nodemailer wrapper
- `src/lib/notifications.ts` — Notification enqueueing helpers
- `src/lib/crypto.ts` — AES-256-GCM encryption
- `docker-compose.prod.yml` — Production stack with worker service

---

### Phase 6 ✅ — Post Edits, Search & Shipping (6 commits)

**Status:** Complete  
**Key Features:**
- Post editing with PATCH endpoint
- Post revisions (append-only audit trail with editor info)
- Revision viewer page with timeline
- Full-text search (PostgreSQL tsvector)
- Search API endpoint with pagination
- Search UI with result cards, sorting, pagination
- Search bar in header navigation
- Production Docker build (multi-stage, 200MB image)
- Deployment guide with backup/scaling/monitoring

**Commit Sequence:**
1. Post edit infrastructure (PATCH, revisions snapshot)
2. Revisions viewer page
3. Full-text search implementation
4. Search UI & results page
5. Production Docker build
6. Deployment guide

**Files:**
- `src/routes/f/[forumSlug]/t/[threadId]/post/[postId]/+server.ts` — Edit endpoint
- `src/routes/f/[forumSlug]/t/[threadId]/post/[postId]/revisions/` — Revision viewer
- `src/lib/search.ts` — Search queries (hybrid tsvector + LIKE)
- `src/routes/search/` — Search UI
- `Dockerfile.prod` — Production multi-stage build
- `DEPLOYMENT.md` — Full deployment guide

---

### Phase 7 🚀 — Design, UI & Interaction Refinements (2/10 commits)

**Status:** In Progress  

#### Commit 1 ✅ — Theme System & Light/Dark Mode
- CSS custom properties for light/dark themes
- ThemeToggle component with sun/moon icons
- localStorage persistence + system preference detection
- Smooth 200ms color transitions
- Updated forum list with theme-aware colors

#### Commit 2 ✅ — Search, Admin UI, & Dark Mode Polish
- Hybrid search (substring matching for short queries, tsvector for long)
- Admin forums management page (list, reorder, assign mods)
- User search/dropdown for moderator selection
- Dark mode consistency across all pages
- Semantic CSS classes (`.text-secondary`, `.bg-tertiary`, etc.)
- Fixed "New Thread" button styling
- Clean search result rendering

**Planned Commits (3–10):**
3. Typography & spacing scale
4. Button & form control styles
5. Card & container components
6. Modal & dialog system
7. Loading states & animations
8. Responsive layout & mobile polish
9. Accessibility & focus management
10. Component library documentation

---

## Database Schema Summary

**12 Tables:**
1. `users` — DIDs, handles, roles, profile cache
2. `forums` — Hierarchical forum structure
3. `threads` — Thread metadata
4. `posts` — Post content (markdown + HTML)
5. `post_revisions` — Append-only edit history
6. `forum_permissions` — Role-based access control
7. `user_forum_roles` — Per-forum moderators
8. `sessions` — Custom roll-your-own (SHA-256 hash, auto-pruning)
9. `mod_log` — Audit trail (ban/delete/lock/etc.)
10. `notification_queue` — Async worker queue
11. `rate_limit_buckets` — Atomic rate limit tracking
12. `instance_settings` — Configuration flags

**Key Indexes:** `did`, `email`, `slug`, `tsvector`, `created_at`, foreign keys

---

## Technology Stack (Verified)

| Layer | Tech | Version |
|---|---|---|
| Framework | SvelteKit | v2.x |
| Runtime | Node.js | 22-alpine (Docker) |
| Language | TypeScript | 5.x (strict mode) |
| CSS | Tailwind CSS v4 | 4.x |
| Database | PostgreSQL | 17 (Alpine Docker) |
| ORM | Drizzle | v0.29+ |
| Auth | ATproto OAuth | @atproto/oauth-client-node |
| Markdown | unified + remark | v10+ |
| Email | Nodemailer | v6.9+ |
| Testing | Vitest | v1.x |
| Reverse Proxy | Caddy | latest (Docker) |

---

## Commit Count by Phase

| Phase | Commits | Status |
|---|---|---|
| Phase 1 | 7 | ✅ |
| Phase 2 | 1 | ✅ |
| Phase 3 | 2 | ✅ |
| Phase 4 | 7 | ✅ |
| Phase 5 | 6 | ✅ |
| Phase 6 | 6 | ✅ |
| Phase 7 | 2/10 | 🚀 |
| **Total** | **35+** | **In Progress** |

---

## Key Accomplishments

✅ Full ATproto-based authentication (no passwords)  
✅ Hierarchical forum structure with permissions  
✅ Markdown-only posts with server-side rendering  
✅ Full moderation suite (ban/delete/lock/pin)  
✅ Email + Bluesky DM notifications  
✅ Background worker for async tasks  
✅ Full-text search (hybrid approach)  
✅ Post editing with audit trail  
✅ Production Docker stack with health checks  
✅ Comprehensive deployment guide  
✅ Theme system with light/dark mode  
✅ Admin UI improvements & forums management  

---

## Next Steps

**Phase 7 (Commits 3–10):**
- Establish typography and spacing scale
- Unified button & form styling
- Reusable card, modal, alert components
- Loading states and micro-animations
- Full responsive design (mobile-first)
- WCAG 2.1 AA accessibility compliance
- Component library documentation

**After Phase 7:**
- Internal testing with real forum usage
- Performance profiling and optimization
- Security audit
- Public release / open source

---

## Documentation Files

- **CLAUDE.md** — Full spec and architecture rationale
- **ARCHITECTURE.md** — Technical architecture (⚠️ outdated for Phases 5–7, needs update)
- **STATUS.md** — This file
- **PHASE_7_PLAN.md** — Phase 7 detailed roadmap
- **DEPLOYMENT.md** — Production deployment guide
- **README.md** — Project overview and quick start
- **TESTING.md** — Test suite documentation

---

## Known Issues / Tech Debt

- ARCHITECTURE.md only documents through Phase 4 (needs update)
- No E2E tests (deferred to post-v1)
- Some pages need responsive design polish (Phase 7 in progress)
- Post PATCH endpoint could use more granular permissions (Phase 4+ feature)

---

