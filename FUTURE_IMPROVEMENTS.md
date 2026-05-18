# Future Improvements — Nice-to-Have Features

This document tracks lower-priority features and nice-to-haves that are deferred from the v1 launch. These are valuable enhancements but not critical for core functionality.

**Note:** This list is intentionally separate from ROADMAP.md (launch-critical) to keep v1 scope clear and manageable.

---

## Tier 2 Features (Candidate for v1.1)

### Thread Tags/Labels
**Priority:** Tier 2 — Nice-to-Have  
**Complexity:** Medium  
**Effort:** ~2 commits  
**Why Deferred:** Tagging is useful for Q&A-style forums but not essential for a discussion forum. Can be added post-launch without breaking existing functionality.

**Proposed Schema:**
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
- Predefined tags: `[SOLVED]`, `[FEEDBACK]`, `[BUG]`, `[QUESTION]`, `[ANNOUNCEMENT]`, `[OFF-TOPIC]`
- Moderators can add/remove tags on thread view
- Tags appear as colored badges on thread listings
- Filter forum listing by tag
- Search results filterable by tag
- Optional: users can suggest tags (moderators approve)

**Acceptance Criteria:**
- [ ] Tag badges appear on thread listing with color coding
- [ ] Mods can add/remove tags on thread detail page
- [ ] Tags are filterable on forum listing and search
- [ ] Colors are theme-aware (light/dark mode)
- [ ] Predefined tag set (not user-created)

---

### Advanced Search Filters
**Priority:** Tier 2 — Nice-to-Have  
**Complexity:** Medium  
**Effort:** ~1 commit  
**Why Deferred:** Basic search (author, content) is sufficient for launch. Advanced filtering (date range, multiple forums) is a polish feature.

**Features:**
- Filter sidebar on search results page
- Filters: date range (start/end), forum subset (multi-select), post type (thread/reply)
- Apply filters without re-searching (query params)
- "Clear filters" button
- Persistent filter state in URL for shareable searches
- Mobile: filters in collapsible menu

**Acceptance Criteria:**
- [ ] Filter sidebar renders on search results
- [ ] Each filter updates results via URL params
- [ ] Shared URLs preserve filter state
- [ ] Mobile friendly (collapsible or modal)

---

## Post-Launch Polish (v1.1+)

### Digest-Style Notifications
**Priority:** Tier 2  
**Complexity:** Medium-Hard  
**Effort:** ~3 commits  
**Why Deferred:** Immediate DM notifications work fine for small communities. Digests are a nice-to-have for users wanting batched updates.

**Features:**
- User notification preference: immediate, daily digest, weekly digest, off
- Digest summarizes: replies to your threads, quotes, new threads in watched forums
- Sends as single DM with summary list + links
- Digest sent at user's preferred time (timezone support)
- Database: add `notification_digest_sent_at` tracking

---

### Quote Preview on Hover
**Priority:** Tier 2  
**Complexity:** Low  
**Effort:** ~0.5 commits  
**Why Deferred:** Nice UX polish but not essential. Can be added anytime without risk.

**Features:**
- Hovering over quote links shows tooltip with quoted content
- Tooltip displays: author, first 100 chars, timestamp
- Positioned near cursor, no overlap
- Touch devices: tap/long-press fallback

---

### Favorites/Quick Nav Sidebar
**Priority:** Tier 2  
**Complexity:** Medium  
**Effort:** ~1-2 commits  
**Why Deferred:** Forum list works fine for small scale. Favorites are convenience, not necessity.

**Features:**
- Users can "favorite" forums from listing
- Favorites sidebar on all pages for quick access
- Drag-to-reorder (optional)
- Remove with X button
- Persisted per user
- Optional: unread badges on favorites

---

### "Share Post" Feature
**Priority:** Tier 2  
**Complexity:** Low  
**Effort:** ~0.5 commits  
**Why Deferred:** Copy permalink already exists. Share modal is pure polish.

**Features:**
- "Share" button on each post
- Modal with options:
  - Copy permalink to clipboard (with feedback)
  - Share to Bluesky (pre-fill post, open Bluesky)
  - Generate embed code (future)

---

## v1.0 Launch Requirements

Focus on **Tier 1 items only:**
- ✅ Authentication (ATproto/Bluesky)
- ✅ Forum CRUD + hierarchy
- ✅ Thread creation/replies
- ✅ Moderation (ban, lock, delete)
- ✅ Notifications (DMs)
- ✅ Search (basic)
- ✅ User profiles
- ✅ Unread indicators
- ✅ Thread subscriptions
- ✅ Bulk moderation

**Defer Everything Else** — These polish features don't block launch and can be added incrementally based on user feedback post-launch.

---

## Decision Log

- **Thread Tags (12.2):** Moved to backlog. Q&A tagging is nice-to-have; discussion forums don't need it day-1.
- **Digest Notifications (13.1):** Moved to backlog. Immediate DMs are sufficient for small communities; digests are future polish.
- **All Tier 2 items:** Moved to backlog to clarify v1.0 scope.

---
