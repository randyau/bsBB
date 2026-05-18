# Implementation History — Phases 1–10

**Reference only.** For current working context, see CLAUDE.md. This document tracks what was built and when.

---

## Status Summary

**80+ commits across 10 phases**. Production-ready forum with all core features, design polish, comprehensive moderation tooling, and search/discovery features complete.

---

## Phase 1 ✅ — Foundations (7 commits)

- SvelteKit + adapter-node + Tailwind CSS v4 + Vitest
- PostgreSQL 17 with Drizzle ORM (12 tables)
- Custom roll-your-own sessions (32-byte token, SHA-256 hash)
- ATproto OAuth integration with `@atproto/oauth-client-node`
- User upsert, lazy profile sync, first-admin gate
- Banned user redirect `/banned` endpoint
- Rate limiting stub
- Docker Compose (dev config)
- Setup scripts (keypair generation, migrations, seeding)

---

## Phase 2 ✅ — Read-Only Forum Views (1 commit)

- Forum index (list all forums)
- Forum view (threads in forum)
- Thread detail (posts in thread)
- User profile stub

---

## Phase 3 ✅ — Post Creation (2 commits)

- New thread form with markdown editor
- Reply to thread
- Markdown pipeline: `remark` → `rehype-sanitize` before storage
- OpenGraph metadata fetch for URLs
- Post creation with `posts` table

---

## Phase 4 ✅ — Moderation & Admin (7 commits)

- Rate limiting: by DID post-auth, by IP pre-auth
- Admin pages: forums, threads, users, posts, mod-log
- Ban/suspend by DID
- Post deletion (soft + hard)
- Thread locking and pinning
- Content flagging/reporting stub
- Moderation action log (audit trail)

---

## Phase 5 ✅ — Notifications & Background Tasks (6 commits)

- Email notifications via Nodemailer (SMTP)
- Bluesky DM notifications via `@atproto/api` chat methods
- Background worker (separate process, `src/worker.ts`)
- `notification_queue` table (pending/sent/failed states)
- Lazy profile sync: fetch fresh handle/avatar from Bluesky
- Session-level rate limiting for DMs (no more than 1/hour per recipient)

---

## Phase 6 ✅ — Post Edits, Search & Shipping (6 commits)

- Post revision history: `post_revisions` table with snapshots
- Full-text search: PostgreSQL `tsvector` + substring matching
- Post edit form with preview
- Revision browser: `/f/[forum]/t/[thread]/post/[postId]/revisions`
- Search page with results
- Production Docker Compose stack

---

## Phase 7 ✅ — Design, UI & Interaction Refinements (11 commits)

### Commit 1 — Theme System & Light/Dark Mode
- CSS custom properties for light/dark themes
- ThemeToggle component (sun/moon icons)
- localStorage persistence + system preference detection
- 200ms color transitions

### Commit 2 — Search, Admin UI, & Dark Mode Polish
- Hybrid search (substring ≤4 chars, tsvector longer)
- Admin forums management page
- User search/dropdown for moderator selection
- Dark mode consistency

### Commit 3 — Markdown Preview, Responsive Layout, Global CSS
- Markdown preview rendering via `.prose-content`
- Responsive container layout
- Global semantic CSS classes (`.box`, `.alert`, `.btn-*`, `.form-*`, `.post`, `.thread-item`)
- Dark mode as system default

### Commit 4 — Custom Roles & Role-Based Forum Access
- New `roles` table (admin-defined roles)
- `userRoles` table (many-to-many assignments)
- Permissions enforcement in `canRead()`/`canPost()`
- Admin roles page (create/edit/delete roles)
- Admin forum permissions matrix
- Hierarchical permission inheritance

### Commit 5 — Admin UI Details Polish
- Fix roles page member count toggle
- Pagination on user management (50/page)

### Commit 6 — Typography Scale & Semantic Spacing
- CSS variables: `--text-xs` through `--text-3xl`
- Semantic heading classes: `.page-title`, `.section-title`, `.subsection-title`, `.meta-text`
- Fixed hardcoded colors

### Commit 7 — Button & Form Refinement
- Button focus rings (3px colored shadows)
- Button states: hover (lift), active (inset shadow), disabled (opacity)
- Form validation classes: `.form-control-error`, `.form-control-success`
- Custom checkbox/radio styling

### Commit 8 — Card Component Refinement
- `.table-container` semantic class
- Replace 15+ inline alerts with `.alert-error`/`.alert-success`
- Centralized design system in `app.css`

### Commit 9 — Enhanced Post Quoting with Reference Links
- Posts with `reply_to_post_id` display as quoted
- Copy permalink button per post
- Quote links render referenced post inline

### Commit 10 — User Profile & Notification Preferences
- User profile page displays Bluesky identity
- Edit profile button
- Notification settings toggle
- Manage which forums notify you

### Commit 11 — Post & Account Management
- `/user/[handle]/manage-posts` page (25/page, paginated)
- Users hide/delete/restore their own posts
- Admins manage any user's posts
- Account deletion with danger zone
- Delete all posts with preservation of stubs for quotes

---

## Phase 9 ✅ — Core Forum Experience & Moderation Tools (11 commits)

### Commit 1 — Unread Thread Indicators
- `thread_views` table tracks `user_did`, `thread_id`, `last_viewed_at`
- Upsert on thread load
- Unread badge on forum listing
- "Mark as read" button on thread view

### Commit 2 — Thread Follow/Mute System
- `notification_subscriptions` table (`user_did`, `thread_id`, `subscription_type`)
- 3-state UI: [Mute] [Default notifs] [Watch]
- Override global preferences per thread
- Followed threads card on profile

### Commit 3 — Notification Preferences & Backend
- `notificationType`: 'both'|'replies'|'quotes'
- `notificationFrequency`: 'immediate'|'hourly'|'daily'
- Settings UI with selectors
- Frequency-based rate limiting in worker
- Profile sync from Bluesky

### Commit 4 — Post/Thread Moving (Mod Tools)
- `moveThread` action via `/admin/threads`
- `movePost` action via `/admin/posts`
- Modal forms with destination selection
- Audit trail in mod_log
- Proper ARIA labels and keyboard support

---

## Phase 10 ✅ — Search & Discovery + UI Polish (10 commits)

### Commit 1 — Search by Poster
- `author:` filter syntax (e.g., `author:alice.bsky.social`)
- Author-only search (posts by author, sorted by date)
- Combined author+content search
- Clickable author handles on results
- User profile posts tab paginated (25/page)

### Commit 2 — Forum Statistics
- Stats widget on forum pages: posts, threads, members, posts this month
- Computed on-demand
- Light/dark mode styling

### Commit 3 — Timezone Support & Datetime Formatting Consolidation
- Per-user timezone storage (default: America/New_York)
- Browser timezone auto-detection at first login
- Centralized `formatTimeDisplay()`: "2026-05-18 00:30 (21m ago)"
- Eliminated duplicated time formatting code
- Table layout for thread listing (title + starter on left, posts + timestamp on right)
- Unread indicator: blue → emerald green (#10b981)
- Created 6 shared components: AdminPageShell, Pagination, EmptyState, Breadcrumb, ConfirmModal, UserTypeahead

### Commits 4–10 — Bug Fixes & Polish
- Notification state sync from form response
- Notification toggle fixes
- UI layout improvements (thread list, admin pages)
- Timezone detection API endpoint
- Unread indicator color refinement

---

## Architecture Highlights

All decisions documented in ARCHITECTURE.md, but key points:

- **Authentication**: ATproto OAuth only (no passwords, email-based auth)
- **Storage**: PostgreSQL 17, Drizzle ORM, schema migrations only (no `drizzle-kit push`)
- **Markdown**: Server-side pipeline, sanitized before storage, no client-side rendering
- **Sessions**: Custom roll-your-own (32-byte token, SHA-256, Postgres-backed)
- **Search**: PostgreSQL `tsvector` + substring matching (no external service)
- **Notifications**: Async queue, background worker, frequency-based rate limiting
- **Permissions**: Explicit `forum_permissions` table, hierarchical inheritance
- **Theming**: CSS custom properties, light/dark mode, no hardcoded colors
- **Infrastructure**: Docker Compose, Caddy reverse proxy, automated setup

---

## Next Phases (Post-Launch)

See ROADMAP.md for:
- Phase 11: Approval Queue (spam prevention for new accounts)
- Phase 12: Accessibility & Polish (WCAG audit, keyboard navigation)
- Phase 13: Deployment, Operations & Documentation

---
