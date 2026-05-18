# Phase 9+ Implementation Roadmap

**Last Updated:** 2026-05-17  
**Status:** Phase 9 COMPLETE (11 commits)  
**Source:** FORUM_DESIGN_RESEARCH.md consolidation  
**Goal:** Track all planned improvements across phases to prevent scope loss

---

## Overview

This document captures all improvements and features identified in FORUM_DESIGN_RESEARCH.md, organized into phases (Phase 9 onwards). Each phase targets a specific area of functionality or polish. Completed items are marked ✅; not-yet-started items are marked with ⭕.

---

## Phase 9 — Core Forum Experience & Mod Tools

**Goal:** Fill critical usability gaps and empower moderators with powerful tools.

### 9.1 ✅ Post/Thread Moving (Mod Tool)
**Priority:** Tier 1 — High Impact  
**Complexity:** Medium  
**Effort:** ~1 commit (Commit 4)

- Moderators can move a thread to a different forum via `/admin/threads`
- Moderators can move a post to a different thread (rare but useful for off-topic cleanup)
- Moderation log entries: `action = 'move_thread'` or `'move_post'` with source/destination
- Schema: `threads.forum_id` and `posts.thread_id` are mutable
- UI: modal/form to select destination forum/thread
- Accessible dialogs with ARIA labels and keyboard support

**Acceptance Criteria:**
- [x] Move thread dialog appears on `/admin/threads` for each thread
- [x] Move thread updates `threads.forum_id` and logs action
- [x] Move post dialog on `/admin/posts` moves to another thread
- [x] Both operations create proper mod_log entries with source/destination context
- [x] Permissions enforced: only admins can move (uses globalRole check)

---

### 9.2 ✅ Inline Mod Tools for Posts (Complete)
**Priority:** Tier 1 — High Impact  
**Complexity:** Medium  
**Effort:** ~1-2 commits (Commit 3 implemented edit-as-mod; rest TBD)

- When viewing a thread, moderators see action buttons directly on posts:
  - [x] Edit (as mod, with reason/log entry) — COMPLETE (Commit 3)
  - [x] Delete / Restore — COMPLETE (exists in dropdown menu)
  - [x] Lock thread (button on first post only) — COMPLETE
  - [x] Move post to another thread — COMPLETE (via admin/posts, available via form on posts)
  - [x] Hide/Show (soft delete toggle) — COMPLETE (dropdown actions)
- Buttons only render for users with admin `globalRole`
- Actions execute without leaving thread view (or reload after)
- All actions create mod_log entries

**Acceptance Criteria:**
- [x] Mod action buttons visible on thread view in dropdown menu for admins
- [x] Each action opens appropriate modal/confirmation or executes inline
- [x] Actions execute without leaving thread view
- [x] All actions properly logged in mod_log
- [x] Regular users see no action buttons
- [x] Lock thread button on first post (COMPLETE)

---

### 9.3 🔄 Bulk Moderation (In Progress - Posts Complete)
**Priority:** Tier 1 — High Impact  
**Complexity:** Medium-Hard  
**Effort:** ~2 commits (Commit 1: Posts done, Commit 2: Threads needed)

**Completed:**
- [x] Posts page: checkboxes for individual selection + "Select all" header checkbox
- [x] Posts page: bulk actions bar appears when items selected
- [x] Posts page: bulk action buttons (Hide, Restore) with confirmation modal
- [x] Server handlers: `bulkAction` POST handler for posts with hide/restore support
- [x] Each action logs individually in mod_log for audit trail
- [x] Restored items maintain individual undo capability

**Pending (Threads):**
- [ ] Threads page: checkboxes for individual selection + "Select all" header checkbox
- [ ] Threads page: bulk actions bar with Lock/Unlock buttons
- [ ] Threads page: confirmation modal for bulk thread operations
- [ ] Server handler: update bulkAction to support lock/unlock

**Design Decisions:**
- Inspired by phpBB and Discourse but simplified for small scale
- Per-item logging: each bulk action creates individual mod_log entries (not one aggregate entry)
- Enables item-by-item undo and better audit trail granularity
- "Select all" only affects current page (not site-wide) - matches phpBB pattern

**Acceptance Criteria:**
- [x] Checkboxes appear on post list page  
- [x] "Select all" checkbox selects all visible items on page
- [x] Bulk actions button appears when items selected
- [x] Confirmation modal shows affected item count
- [x] Each action creates individual mod_log entries
- [x] Bulk operations redirect with success message
- [ ] Same functionality on thread list page
- [ ] Thread-specific actions (lock/unlock) work in bulk

---

### 9.4 ✅ Thread Follow/Mute System
**Priority:** Tier 1 — High Impact  
**Complexity:** Medium  
**Effort:** ~2 commits (Commit 2, plus preference additions in Commit 3)

**Database Schema:**
```sql
CREATE TABLE notification_subscriptions (
  id UUID PRIMARY KEY,
  user_did TEXT FK → users.did,
  thread_id UUID FK → threads.id,
  subscription_type TEXT, -- 'follow', 'mute', 'default'
  created_at TIMESTAMPTZ,
  UNIQUE (user_did, thread_id)
);
```

**Features:**
- [x] "Watch Thread" / "Mute Thread" buttons on thread pages (3-state UI: Mute / Default notifs / Watch)
- [x] Follow: explicitly watched thread → send DM on new reply (overrides global preference)
- [x] Mute: user muted thread → never notify (overrides global preference)
- [x] Default: inherit from user's global `notifyViaBluesky` setting
- [x] Notification worker checks `notification_subscriptions` before enqueueing DMs
- [x] User can view their watched threads on profile in "Followed Threads" card
- [x] Quick remove button on watched thread list in profile

**Acceptance Criteria:**
- [x] "Watch" / "Mute" buttons on thread detail page with clear state indication
- [x] Subscriptions table created with unique constraint on (user_did, thread_id)
- [x] Worker respects subscription types before sending notifications (follow forces send, mute blocks)
- [x] User can view "Followed Threads" on profile (shows all watch/mute subscriptions)
- [x] Unwatch works from both thread view and profile; removes subscription entirely
- [x] Subscription state overrides global preference correctly

---

### 9.5 ✅ Unread Thread Indicators & Counts
**Priority:** Tier 1 — High Impact  
**Complexity:** Medium  
**Effort:** ~1 commit (Commit 1)

**Database Schema:**
```sql
CREATE TABLE thread_views (
  user_did TEXT FK → users.did,
  thread_id UUID FK → threads.id,
  last_viewed_at TIMESTAMPTZ,
  PRIMARY KEY (user_did, thread_id)
);
```

**Features:**
- [x] Track `last_viewed_at` per user per thread in dedicated table
- [x] Display badge/highlight on forum listing for threads with new posts since last view
- [x] Unread badge appears on thread cards (theme-aware for light/dark)
- [x] "Mark thread as read" button manually updates `last_viewed_at`
- [x] Unread indicator styled per theme with clear visual distinction

**Acceptance Criteria:**
- [x] `thread_views` table created with (user_did, thread_id) composite PK
- [x] Load thread page → upsert row with current timestamp
- [x] Forum listing shows unread badge for threads with new posts since `last_viewed_at`
- [x] Unread badge displays on forum listing thread cards
- [x] "Mark as read" button works on thread page (updates timestamp)
- [x] Theme-aware styling for unread indicators (distinct colors in light/dark mode)

---

## Phase 10 — Search & Discovery

**Goal:** Empower users to find content and authors easily.

### 10.1 ⭕ Search by Poster & Posts by Poster
**Priority:** Tier 1 — High Impact  
**Complexity:** Medium  
**Effort:** ~2 commits

**Features:**
- Search page: add "author:" filter (e.g., `author:alice.bsky.social`)
- User profile page: new "Posts" tab showing all posts by that user (paginated, sortable by date/relevance)
- Forum listing: clickable author name on posts → filters search to that author's posts
- Link to author's profile from each post
- Add index on `posts.author_did` for fast filtering

**Acceptance Criteria:**
- [ ] Search page accepts `author:` filter syntax
- [ ] Author filter works in hybrid search (tsvector + substring)
- [ ] User profile page has "Posts" tab with pagination (25/page)
- [ ] Author names are clickable links to profile
- [ ] Profile page shows post count and recent activity
- [ ] `posts.author_did` index created

---

### 10.2 ⭕ Forum Statistics Module
**Priority:** Tier 1 — High Impact  
**Complexity:** Low  
**Effort:** ~1 commit

**Features:**
- Widget showing per-forum statistics:
  - Total posts in forum
  - Total threads in forum
  - Total members who posted (distinct `author_did`)
  - Most active poster this month (if applicable)
  - Posts today / this week / this month
- Display on forum header or sidebar
- Can be computed on-demand or via materialized view for perf
- Update on every new thread/post (or cache with 1-hour TTL)

**Acceptance Criteria:**
- [ ] Statistics card appears on forum view
- [ ] Counts are accurate and up-to-date
- [ ] Stats update after new thread/post
- [ ] Dark/light mode styling applied
- [ ] Responsive on mobile

---

### 10.3 ⭕ Advanced Search Filters (Tier 2)
**Priority:** Tier 2 — Nice-to-Have  
**Complexity:** Medium  
**Effort:** ~1 commit

**Features:**
- Search results page: add filter sidebar
- Filters: date range (start/end), forum subset (multi-select), author, post type (thread/reply)
- Apply filters without re-searching (query params)
- "Clear filters" button
- Persistent filter state in URL for shareable searches

**Acceptance Criteria:**
- [ ] Filter sidebar renders on search results
- [ ] Each filter updates results without full re-search
- [ ] URL updates with filter params
- [ ] Shared URLs preserve filters
- [ ] Mobile: filters in collapsible menu or modal

---

### 12.1 ⭕ Approval Queue (Tier 1)

**Priority:** Tier 1 — High Impact  
**Complexity:** Medium  
**Effort:** ~2 commits  
**Why Last (Pre-A11y):** Approval queue UI and interactions should be audited for accessibility in Phase 11.

**Schema Changes:**
```sql
ALTER TABLE posts ADD COLUMN is_approved BOOLEAN DEFAULT true;
ALTER TABLE posts ADD COLUMN rejection_reason TEXT;
```

**Features:**
- Admin can enable per-forum: "New posts from users < N days old require approval"
- New posts from young accounts go to `posts.is_approved = false`, hidden from thread
- Moderators see dedicated approval queue page (/admin/approval-queue)
- Quick Approve/Reject buttons on each pending post
- Reject sends DM to user explaining removal (configurable message)
- Posts older than X hours automatically approved (prevent queue backlog)
- Bypass for trusted/verified accounts

**Acceptance Criteria:**
- [ ] Per-forum approval queue toggle in `/admin/forums`
- [ ] New posts from young accounts set `is_approved = false`
- [ ] Approval queue page shows pending posts with context
- [ ] Approve/Reject buttons work and update mod_log
- [ ] Reject sends DM with reason
- [ ] Auto-approve after 24 hours if not reviewed
- [ ] Young account definition is configurable (days old)

---

## Phase 11 — Accessibility & Polish (Final Launch Pass)

**Goal:** Comprehensive accessibility audit and polish across all built features. Done last to ensure all UI touches are covered.

### 11.1 ⭕ Accessibility Audit & Polish (Tier 1 Priority)
**Priority:** Tier 1 — High Impact  
**Complexity:** Medium  
**Effort:** ~3-4 commits (one per category)

**Commit 1: WCAG Color Contrast & Visual Accessibility**
- Audit all text/background combos for WCAG AA compliance (4.5:1 for normal text, 3:1 for large)
- Fix color contrast issues in light/dark themes
- Test with contrast checker (WebAIM, WAVE)
- Ensure focus indicators are visible (3px colored outline minimum)
- All buttons/links have clear focus states (already partially done in Phase 7)

**Commit 2: Semantic HTML & Screen Reader Support**
- Audit heading hierarchy (h1 > h2 > h3, no skips)
- Add `<label>` tags to all form inputs
- Add `aria-label` to icon-only buttons
- Add `alt` text to images (if any)
- Add `role="region"` and `aria-labelledby` to major sections
- Main landmark on main content, nav on navigation, etc.
- Test with NVDA (Windows) or JAWS on key pages: forum index, thread, new post form, admin panel

**Commit 3: Keyboard Navigation & Focus Management**
- Audit tab order on all pages (should be logical: left-to-right, top-to-bottom)
- Ensure all interactive elements are keyboard accessible (tab, enter, arrow keys where applicable)
- Modals: trap focus within modal, restore focus on close
- Dropdowns: arrow keys navigate, escape closes
- No keyboard traps (user can always tab out)
- Test: full navigation using only Tab, Shift+Tab, Enter, Escape, Arrow keys

**Commit 4: Screen Reader Testing & ARIA Enhancements**
- Test with screen reader on: forum index, thread view, new post form, search results, admin pages
- Record issues and fix:
  - Missing form labels
  - Hidden skip links (screen-reader only)
  - Announcement of dynamic content changes (aria-live regions for notification queue, bulk action count)
  - Proper table headers and row/col associations
- Ensure all user feedback (errors, success messages) is announced

**Acceptance Criteria (all commits):**
- [ ] WCAG AA contrast check passes (4.5:1 normal, 3:1 large)
- [ ] Heading hierarchy audit: all pages follow h1 > h2+ pattern, no skips
- [ ] All form inputs have associated labels
- [ ] Icon-only buttons have aria-label
- [ ] Tab order is logical on all pages
- [ ] Focus indicators visible and styled consistently
- [ ] No keyboard traps (can always tab out)
- [ ] Screen reader test on forum index, thread, form, admin
- [ ] All dynamic content updates announced via aria-live
- [ ] Skip link hidden on desktop, visible on screen reader / tab focus

---

### 11.2 ✅ Hierarchical Breadcrumbs (Verify & Audit)
**Priority:** Tier 1 — Already partially done  
**Complexity:** Low  
**Effort:** ~0.5 commits (audit + fixes only)

**Status:** Breadcrumbs likely already implemented based on Phase 2. Audit for:
- Forum index: no breadcrumb (or "Home")
- Forum listing: "Home > Forum Name"
- Thread view: "Home > Forum Name > Thread Title"
- Post detail: "Home > Forum Name > Thread Title > Post #N" (if applicable)
- Admin pages: "Admin > Section > Page"
- User profile: "Home > User > Profile" or "Home > Users > User Name"
- Consistent styling and spacing across all pages

**Acceptance Criteria:**
- [ ] Audit current breadcrumbs on all major pages
- [ ] Fix any missing or incorrectly ordered breadcrumbs
- [ ] Ensure consistent styling/spacing
- [ ] Breadcrumbs are clickable and navigate correctly
- [ ] Mobile: breadcrumbs collapse/scroll if too long

---

---

## ⚠️ Future Improvements Deferred

The following Tier 2 features have been moved to **FUTURE_IMPROVEMENTS.md** for post-launch consideration:

- **Phase 12.2:** Thread Tags/Labels (Q&A polish, not essential for discussion forum)
- **Phase 13.1:** Digest-Style Notifications (nice-to-have, immediate DMs sufficient for v1)
- **Phase 14.1:** Quote Preview on Hover (polish only)
- **Phase 14.2:** Favorites/Quick Nav Sidebar (convenience feature)
- **Phase 14.3:** Share Post Button (polish only)
- **Phase 10.3:** Advanced Search Filters (basic search sufficient for v1)

**Rationale:** These are valuable but not launch-blocking. Keeping v1.0 scope tight allows faster shipping and lets user feedback guide post-launch prioritization.

See **FUTURE_IMPROVEMENTS.md** for detailed specs and rationale.

---

## Summary Table

| Phase | Item | Status | Tier | Effort |
|---|---|---|---|---|
| 9 | Post/Thread Moving | ✅ | 1 | Medium |
| 9 | Inline Mod Tools | ✅ | 1 | Medium |
| 9 | Bulk Moderation | ⭕ | 1 | Medium-Hard |
| 9 | Thread Follow/Mute | ✅ | 1 | Medium |
| 9 | Unread Indicators | ✅ | 1 | Medium |
| 10 | Search by Poster | ⭕ | 1 | Medium |
| 10 | Forum Statistics | ⭕ | 1 | Low |
| 12 | Approval Queue | ⭕ | 1 | Medium |
| 11 | Accessibility Audit | ⭕ | 1 | Medium |
| 11 | Breadcrumb Audit | ✅ | 1 | Low |

**v1.0 Launch Status:** 6 of 10 Tier 1 items complete  
**Execution Order:** Phase 10 → Phase 12 → Phase 11 (A11y last, comprehensive pass)  
**Remaining Tier 1:** 4 items (Search by Poster, Forum Stats, Approval Queue, Accessibility)  
**Tier 2 Deferred:** 6 items in FUTURE_IMPROVEMENTS.md  
**v1.0 Effort:** ~7-9 commits to complete launch scope

---

## v1.0 Launch Execution Order

After Phase 9 core completion, build in this order:

1. **Phase 10:** Search & Discovery
   - 10.1 Search by Poster (medium effort)
   - 10.2 Forum Statistics (low effort)

2. **Phase 12:** Content Management  
   - 12.1 Approval Queue (medium effort)

3. **Phase 11:** Accessibility & Polish (Final Comprehensive Pass)
   - 11.1 WCAG AA Audit (4 commits)
   - 11.2 Breadcrumb Verification

**Why Accessibility Last:**
Accessibility touches all UI — forms, modals, tables, buttons, navigation. Building it as the final pass ensures:
- All feature UI is stable before auditing
- Comprehensive coverage of newly-added components
- No missed elements that get added later and forgotten
- Single focused effort vs. scattered a11y work

These 4 items complete the v1.0 launch scope. All Tier 2 features are in FUTURE_IMPROVEMENTS.md.

---

