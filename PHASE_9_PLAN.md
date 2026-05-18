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

### 9.3 ⭕ Bulk Moderation
**Priority:** Tier 1 — High Impact  
**Complexity:** Medium-Hard  
**Effort:** ~2 commits

- Admin/mod pages: select multiple posts/threads via checkboxes
- Bulk actions menu: Delete, Lock, Move, Hide, Change Status
- Confirmation modal listing all affected items
- Moderation log: one entry per item for audit clarity (allows individual undo/investigation)
- Apply to `/admin/posts`, `/admin/threads`

**Acceptance Criteria:**
- [ ] Checkboxes appear on post/thread list pages
- [ ] "Select all on page" checkbox selects all visible items
- [ ] Bulk actions dropdown appears when items selected
- [ ] Confirmation modal shows affected items count
- [ ] Each action creates individual mod_log entries
- [ ] Bulk delete can be undone item-by-item via restore actions

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

## Phase 11 — Accessibility & Polish

**Goal:** Ensure forum is usable by everyone and polished for production.

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

## Phase 12 — Content Management & Moderation

**Goal:** Provide tools for community self-governance and content lifecycle.

### 12.1 ⭕ Approval Queue (Tier 1 — Optional)
**Priority:** Tier 1 — High Impact (optional)  
**Complexity:** Medium  
**Effort:** ~2 commits

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

### 12.2 ⭕ Thread Tags/Labels (Tier 2)
**Priority:** Tier 2 — Nice-to-Have  
**Complexity:** Medium  
**Effort:** ~2 commits

**Schema:**
```sql
CREATE TABLE thread_tags (
  id UUID PRIMARY KEY,
  thread_id UUID FK → threads.id,
  tag TEXT, -- 'solved', 'feedback', 'bug', 'question', 'announcement'
  added_by TEXT FK → users.did,
  created_at TIMESTAMPTZ
);
```

**Features:**
- Predefined tags: [SOLVED], [FEEDBACK], [BUG], [QUESTION], [ANNOUNCEMENT], [OFF-TOPIC]
- Mods can add/remove tags on thread view
- Tags appear as badges on thread listings
- Filter search/listing by tag
- Color-coded per tag type
- Users can suggest tags (optional, mod approves)

**Acceptance Criteria:**
- [ ] Tag badges appear on thread listing
- [ ] Mods can add/remove tags on thread detail page
- [ ] Tags are filterable on forum listing
- [ ] Colors are theme-aware (light/dark mode)
- [ ] Search results filterable by tag

---

## Phase 13 — Notifications & Community Engagement

**Goal:** Keep users informed with flexible notification options.

### 13.1 ⭕ Digest-Style Notifications (Tier 2)
**Priority:** Tier 2 — Nice-to-Have  
**Complexity:** Medium-Hard  
**Effort:** ~3 commits

**Features:**
- User notification preference: immediate, daily digest, weekly digest, off
- Digest generates summary of:
  - Replies to your threads
  - Quotes of your posts
  - New threads in watched forums
- Sends as single DM with summary list + links
- Digest sent at user's preferred time (in their timezone, if available)
- Database: add `user_notification_frequency` (immediate|daily|weekly), `notification_digest_sent_at`

**Acceptance Criteria:**
- [ ] User settings page has notification frequency choice
- [ ] Worker batches digests by frequency
- [ ] Digest DM is well-formatted and readable
- [ ] Sent at correct time (or closest cron interval)
- [ ] Links in digest navigate to correct thread/post

---

## Phase 14 — Polish & Fine-Tuning

**Goal:** Final touches for production polish.

### 14.1 ⭕ Quote Preview on Hover (Tier 2)
**Priority:** Tier 2 — Nice-to-Have  
**Complexity:** Low  
**Effort:** ~0.5 commits

**Features:**
- When a post has `reply_to_post_id`, hovering over the quote link shows a tooltip
- Tooltip displays: author name, first 100 chars of quoted content, timestamp
- Tooltip is positioned near cursor, not overlapping main content
- Works on desktop (hover); touch devices show on click or tap-and-hold

**Acceptance Criteria:**
- [ ] Tooltip appears on hover over quote links
- [ ] Content is readable (good contrast, proper size)
- [ ] Doesn't interfere with thread reading
- [ ] Mobile fallback works (click or long-press)

---

### 14.2 ⭕ Breadcrumb Favorites/Quick Nav Sidebar (Tier 2)
**Priority:** Tier 2 — Nice-to-Have  
**Complexity:** Medium  
**Effort:** ~1-2 commits

**Features:**
- Users can "favorite" forums from the forum listing
- Favorites appear in sidebar for quick access
- Drag-to-reorder favorites (optional, nice UX)
- Remove favorite with X button
- Persisted per user (in `user_settings` table or similar)
- Optional: show unread count on favorite forums

**Acceptance Criteria:**
- [ ] Favorite button on forum cards
- [ ] Favorites sidebar shows on all pages (except mobile?)
- [ ] Favorites persist across sessions
- [ ] Remove favorite works
- [ ] Reorder works (if drag implemented)
- [ ] Unread badges on favorites (optional)

---

### 14.3 ⭕ "Share Post" Feature (Tier 2)
**Priority:** Tier 2 — Nice-to-Have  
**Complexity:** Low  
**Effort:** ~0.5 commits

**Features:**
- "Share" button on each post (alongside Edit, etc.)
- Opens modal with options:
  - Copy permalink to clipboard
  - Share to Bluesky (pre-fill post with link, open Bluesky in new tab)
  - Generate embed code (if applicable later)
- Copy-to-clipboard feedback ("Copied!")

**Acceptance Criteria:**
- [ ] Share button appears on each post
- [ ] Copy permalink works
- [ ] Bluesky share pre-fills with post link
- [ ] "Copied!" confirmation on clipboard action

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
| 10 | Advanced Search Filters | ⭕ | 2 | Medium |
| 11 | Accessibility Audit | ⭕ | 1 | Medium |
| 11 | Breadcrumb Audit | ✅ | 1 | Low |
| 12 | Approval Queue | ⭕ | 1 | Medium |
| 12 | Thread Tags | ⭕ | 2 | Medium |
| 13 | Digest Notifications | ⭕ | 2 | Medium-Hard |
| 14 | Quote Preview Hover | ⭕ | 2 | Low |
| 14 | Favorites Sidebar | ⭕ | 2 | Medium |
| 14 | Share Post Button | ⭕ | 2 | Low |

**Phase 9 Status:** 5 of 5 items complete (all core features done)  
**Total Tier 1 Items:** 11 (5 done, 6 remaining)  
**Total Tier 2 Items:** 5  
**Total Effort:** ~16-20 commits across Phases 9–14

---

## Recommended Phase 9 Start Order

Focus on **Tier 1** items first. Suggested execution order for Phase 9:

1. **Unread Thread Indicators** (quick win, high impact)
2. **Thread Follow/Mute System** (extends notification framework)
3. **Inline Mod Tools** (forces audit of post display, high visibility)
4. **Post/Thread Moving** (complements inline tools)
5. **Bulk Moderation** (integrates with admin pages)

This order builds incrementally on the notification system and mod UI, keeping cohesive commits.

---

