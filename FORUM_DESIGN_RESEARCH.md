# Forum Interaction Design Research Report

Research into classic forum platforms (phpBB, vBulletin, Invision) and modern forum design best practices (2025), identifying interaction patterns and UI features worth considering.

---

## **1. Navigation & Information Architecture**

**Key Patterns from phpBB, vBulletin, Invision:**
- **Hierarchical breadcrumbs** — show full path (Forum > Sub-forum > Thread) at the top of every page for orientation
- **Category-first navigation** — organize primary navigation around forum categories rather than generic "All Posts"
- **"Unread threads" indicator** — visual cues (bold titles, badges) for threads with new activity since last visit
- **Quick navigation sidebar** — persistent list of recent or favorite forums alongside main content

**Modern Implementation:**
Most modern forums (Discourse, Invision Community) use clean navigation trees that collapse/expand. Consider adding a persistent sidebar showing your forum hierarchy with unread counts.

---

## **2. User Profiles & Identity**

**What Classic Forums Do Well:**
- **Detailed member profiles** — avatar, join date, post count, reputation/status indicators
- **"Posted by" metadata** — every post shows author name, avatar, join date, badge/title at a glance
- **User profiles as pages** — clickable author names lead to full profile showing activity history, recent posts, etc.

**Opportunity for Your Forum:**
Since you're using ATproto/Bluesky DIDs, you could:
- Display Bluesky verification status on profiles (checked ✓ badge)
- Link to user's Bluesky profile directly
- Show follower/following counts from Bluesky (if accessible)
- Add a "Member Since" date based on their first post

---

## **3. Thread/Post Interactions**

**Classic Feature: Quick Post Actions**
vBulletin and Invision expose these actions prominently on each post:
- **Quote** — immediately insert post text into reply box
- **Report/Flag** — report spam/abuse to moderators
- **Edit** (own posts only) — inline or modal editing
- **Permalink** — get a direct link to that specific post
- **Move/Merge** (mod only) — move threads between forums

**Modern Addition: Threaded Reference**
While you've rightly chosen flat replies (to avoid nesting complexity), consider:
- **"In reply to" indicator** — show which post a user is replying to, even in flat view
- **Quote preview on hover** — when you reference another post, show a tooltip preview
- **Thread timeline** — visual indicator of conversation flow (especially helpful for long threads)

---

## **4. Thread Management**

**What Works in Classic Forums:**
- **Pin/Unpin** — moderators can pin important threads to forum top (you have this ✓)
- **Lock/Unlock** — prevent new replies (you have this ✓)
- **Sticky threads** — separate section of "sticky" threads that always appear first
- **Thread Tags/Labels** — tag threads as [SOLVED], [FEEDBACK], [BUG] for easy scanning
- **Subscription toggle** — "Watch this thread" button to get notifications of new replies

**Your Current Gaps:**
- No thread tags/labels system
- No "watch thread" subscription feature
- No separate section for sticky/pinned threads (they just appear sorted higher)

---

## **5. Search & Discovery**

**Classic Approach:**
- **Advanced search page** — date range, author, forum subset, post type filters
- **Search result metadata** — shows post date, author, relevant excerpt
- **"People who viewed this also viewed" suggestions** — social proof pattern

**Modern Approach (which you're improving):**
- Substring matching for short queries ✓
- Sorting by relevance/recency ✓
- Direct author filtering

**Consider Adding:**
- **Saved searches** — users can save common searches (e.g., "my posts", "posts by [user]")
- **Search filters in results** — refine results without re-searching (author, date range, forum subset)

---

## **6. Notifications & Subscriptions**

**Classical Forum Pattern:**
- **Forum-level subscriptions** — "watch this forum" to be notified of all new threads
- **Thread subscriptions** — "watch this thread" to be notified of new replies
- **Mention notifications** — when someone replies to you or quotes you
- **Digest mode** — daily/weekly digest email instead of individual notifications

**Your Current State:**
- Bluesky DM notifications ✓ (opt-in)
- No email to regular users (intentional)
- No thread subscription

**Recommendation:**
At minimum, add thread subscriptions via Bluesky DM. When someone replies to a thread a user "watches", send a notification listing new replies since last visit.

---

## **7. Moderation & Admin Access Patterns**

**Classic Forum Approach:**
- **Inline mod actions** — "Delete", "Lock", "Move", "Approve" buttons appear directly on posts/threads for mods
- **Mod-only UI elements** — certain buttons/options only appear to users with permission
- **Action history** — moderation log (you have this ✓)
- **Bulk actions** — select multiple posts/threads and perform action to all

**What You Have:**
- Moderation actions available to mods ✓
- Mod log ✓

**What's Missing:**
- **Conditional UI rendering** — mod actions should appear inline on posts only to users who can perform them
- **Bulk moderation** — select multiple posts/threads and delete/lock/hide together
- **Approval queue** — new posts from new users awaiting mod approval (optional, anti-spam measure)

---

## **8. User Control Panel / Settings**

**Classic Forum Pattern:**
Every user has a control panel accessible from their profile showing:
- **Notifications settings** — control which activities trigger notifications
- **Subscription management** — view all watched forums/threads
- **Privacy settings** — who can see my profile, contact me, etc.
- **Forum preferences** — posts per page, theme, timezone
- **Activity feed** — my recent posts, threads I started

**Your Forum Currently Has:**
- Theme toggle ✓
- Profile page (basic) — can improve

**Recommended Additions:**
- **Activity tab** on user profile — "Posts by this user", "Threads started", timeline view
- **Notification preferences** — fine-grained control (on Bluesky settings page, not forum)
- **Subscriptions dashboard** — "Your watched threads" with quick unwatch button

---

## **9. Forum Structure Improvements**

**Pattern from Successful Forums:**
- **Sub-forums within forums** — hierarchical organization (you have this ✓)
- **Forum descriptions** — explain the purpose of each forum (you have this ✓)
- **Forum rules/announcement post** — pinned at top with guidelines (not implemented)
- **Forum statistics** — "23 posts in 5 threads by 3 members" summary
- **Most active members** — in sidebar, show who posts most in this forum

**Recommendation:**
Add forum-level statistics cards and a way to pin forum announcements (separate from thread pins).

---

## **10. Accessibility & Responsive Design**

**2025 Best Practices (from research):**
- Dark mode ✓ (you implemented this)
- Semantic HTML for screen readers
- Clear focus states for keyboard navigation
- Text contrast ratios meeting WCAG standards
- Mobile-first responsive layout

**Your Current State:**
Your dark mode is solid. Ensure keyboard navigation works throughout (tab order, focus indicators).

---

## **11. Modern UX Patterns Worth Considering**

**From Discourse and contemporary forums:**
- **Infinite scroll vs pagination** — both work; explicit pagination (which you use) is clearer
- **User typing indicator** — "John is typing..." in thread preview
- **Emotional reactions** (reactions/emojis) — optional, lightweight engagement (beyond scope but noted)
- **Share/embed links** — make it easy to share individual posts on Bluesky
- **Breadth-first thread view** — collapse long nested quotes to summaries
- **Unread counter badges** — on forum names in sidebar

---

## **Priority Recommendations for Phase 7+**

### **High Impact (would significantly improve usability):**
1. **Thread subscriptions / "Watch thread" feature** — most-requested user feature in any forum
2. **Inline moderator actions on posts** — currently requires clicking through to mod page
3. **Thread tags/labels** — [SOLVED], [PINNED], [LOCKED] badges for quick scanning
4. **User activity pages** — "Recent posts by X" and "Threads started by X"
5. **Forum announcements** — pinned announcement separate from regular threads

### **Medium Impact (nice polish):**
6. **Search result filters** — refine without re-searching
7. **Forum/thread statistics** — "5 posts in 2 threads"
8. **Bulk moderation** — select multiple and act
9. **Quote preview on hover** — when you reference another post
10. **Member profiles as proper pages** — not just inline

### **Lower Priority (nice to have):**
11. Saved searches
12. Digest-style notifications
13. User control panel consolidation
14. "Most active members in forum" sidebar widget

---

---

## **Phase 7+ Implementation Roadmap**

Confirmed priorities from Randy (2026-05-16):

### **Tier 1: High Impact, Core Functionality**

#### **1. Unread Thread Indicators & Counts**
- Track `last_viewed_at` per user per thread
- Display badge/highlight on forum listing for threads with new posts since last view
- Show unread count in sidebar/breadcrumbs if available
- Database: add `thread_views` table (user_did, thread_id, last_viewed_at)

#### **2. Hierarchical Breadcrumbs**
- Ensure all pages show full path: Forum > Sub-forum > Thread > Post (if applicable)
- Already implemented partially; audit for consistency across all routes

#### **3. User Profile Pages with Bluesky Integration**
- Profile shows:
  - Avatar + handle (with link to Bluesky profile)
  - Bluesky verification status (if available via ATproto)
  - "Member Since" (first post date on forum)
  - Post count, thread count
  - Recent activity: last 5 posts/threads started
  - Link to Bluesky profile (direct URI)
- Database: ensure `users.created_at` tracks first login; add `user_posts_count` and `user_threads_count` (denormalized, updated on post/thread creation)

#### **4. Permalinking**
- Every post should have a stable, shareable permalink: `/f/[forum]/t/[threadId]/[postId]`
- Permalink button on each post (copy to clipboard, or modal with link)
- Clicking the link should anchor/scroll to that post in the thread
- Implement `#post-[postId]` anchor in HTML

#### **5. Post/Thread Moving (Mod Tool)**
- Moderators can move a thread to a different forum
- Moderators can move a post to a different thread (rare, but useful for off-topic cleanup)
- Moderation log entry: `action = 'move_thread'` or `move_post'` with source/destination
- Database: `threads.forum_id` is mutable; `posts.thread_id` is mutable

#### **6. Thread Follow/Mute System with Unified Notification Framework**
- Extend notification system beyond DMs:
  - `notification_subscriptions` table: user_did, thread_id, type ('follow'|'mute'|'default')
  - 'follow': user explicitly watched thread → send DM on new reply
  - 'mute': user muted thread → never notify
  - 'default': inherit from forum-level setting or user preference
- UI: "Watch Thread" / "Mute Thread" buttons on thread pages
- Notification worker checks subscriptions before sending DMs
- Future: extend to forum-level watches and other notification types (email digest, in-app bell, etc.)

#### **7. Search by Poster & Posts by Poster**
- Search page: add "author:" filter (e.g., `author:alice.bsky.social`)
- User profile page: tab or section showing all posts by that user (paginated)
- User profile page: clickable author name on posts → filters to that author's posts
- Database: posts already have `author_did`; add index for fast filtering

#### **8. Inline Mod Tools for Posts**
- When viewing a thread, moderators see action buttons directly on posts:
  - Delete / Restore
  - Edit (as mod, with reason)
  - Lock thread (button on first post only)
  - Move post to another thread
  - Hide/Show (soft delete toggle)
- Buttons only render for users with `can_moderate` permission
- Clicking triggers modal or inline confirmation
- Database: no schema change; purely UI enhancement

#### **9. Bulk Moderation**
- Admin/mod pages: select multiple posts/threads via checkboxes
- Bulk actions: Delete, Lock, Move, Hide
- Confirmation modal listing all affected items
- Moderation log: one entry per action or one entry with count?
  - Recommendation: one per item for audit clarity (easier to undo/investigate)

#### **10. Approval Queue (Optional, Configurable)**
- Admin can enable per-forum: "New posts from users < N days old require approval"
- New posts go to `posts.is_approved = false` and are hidden from thread
- Moderators see approval queue with quick Approve/Reject buttons
- Reject sends DM to user explaining removal (e.g., "post didn't meet community guidelines")
- Database: add `posts.is_approved` (boolean, default true if queue disabled), `posts.rejected_reason` (text, nullable)

#### **11. User Post Deletion & Privacy Settings**
- User can delete their own posts (soft delete, preserves thread integrity)
- User can request removal from forum (GDPR-like): "Delete all my posts and personal data"
  - Admin interface to process requests
  - Deletes all posts by user (replace content with "[deleted by user]"), anonymizes revisions
  - Logs the action
- Database: `users.deletion_requested` (boolean), `posts.is_deleted` (already exists), `post_revisions.author_did` anonymization on full user deletion

#### **12. Forum Statistics Module**
- Widget showing:
  - Total posts in forum
  - Total threads in forum
  - Total members who posted
  - Most active poster this month (if applicable)
  - Posts today / this week / this month
- Placeholder on forum index or sidebar
- Database: can be computed on-demand from existing tables; optional: add materialized view for performance

#### **13. Emoji Handling**
See detailed section below.

#### **14. Accessibility Audit & Polish**
- WCAG 2.1 AA compliance: color contrast, keyboard navigation, screen reader labels
- Semantic HTML throughout (heading hierarchy, alt text for images, ARIA labels)
- Focus indicators on all interactive elements
- Keyboard-only navigation (tab order, no mouse-required actions)
- Test with screen reader (NVDA, JAWS) on key pages

---

### **Tier 2: Nice-to-Have Polish**

- **Breadcrumb favorites/quick nav sidebar** — bookmark frequently visited forums in sidebar
- **Search filters** — refine results (date range, forum subset) without re-searching
- **Quote preview on hover** — when a post references another, show tooltip preview
- **Thread tags** (e.g., [SOLVED], [FEEDBACK]) — optional labels for thread categorization
- **Digest-style notifications** — daily/weekly summary DM instead of per-post

---

## **Emoji Handling Deep Dive**

### **Current State**
- Markdown is rendered server-side via `unified` + `remark-*` + `rehype-*` pipeline
- HTML is sanitized with `rehype-sanitize` before storage
- Emojis in markdown text are passed through as-is (Unicode characters)

### **Required for Clean Emoji Support**

1. **Database encoding**
   - PostgreSQL should be `UTF-8` (check `CREATE DATABASE` command in setup)
   - Verify with: `SHOW server_encoding;` → should be `UTF8`
   - Our schema already uses `TEXT` columns, which support full Unicode

2. **Markdown rendering pipeline**
   - Add `remark-emoji` plugin (or similar) to convert `:smile:` shortcodes to actual emoji
   - Example: `:wave:` → `👋`
   - Or allow direct Unicode emoji (simpler): users paste `👋` directly
   - **Recommendation:** Both — allow paste-through and support `:shortcode:` as convenience

3. **HTML output & sanitization**
   - `rehype-sanitize` already permits emoji Unicode (it's just text)
   - No schema changes needed; emojis render as plain Unicode in HTML

4. **Frontend display**
   - Ensure CSS has `font-family: system-ui` or includes emoji-capable fonts (all modern browsers do)
   - No special handling needed; browsers render Unicode emoji natively
   - Test on different platforms (Windows, Mac, mobile) for consistent appearance

5. **Database queries & search**
   - PostgreSQL `tsvector` for full-text search handles emoji fine
   - Searching for emoji: may not work in `tsvector` (emoji aren't "words"), but basic substring matching will find them

6. **Admin considerations**
   - Emoji should be allowed in thread titles, post content, forum descriptions
   - Consider rate-limiting emoji-heavy posts as spam if needed (low priority)

### **Implemented: Emoji Support (Phase 7 Commit 2)**
- ✅ PostgreSQL encoding is UTF-8
- ✅ Added `node-emoji` to markdown pipeline (converts `:shortcode:` → unicode)
  - Both client-side (`markdown-it`) and server-side (`unified` pipeline) support emoji
  - Users can type `:wave:`, `:smile:`, `:tada:` etc., and they render as 👋, 😄, 🎉
- ✅ CSS font stack is system-ui (Tailwind v4 default)
- ✅ Emoji supported in thread titles, post content, forum descriptions, and all user-generated content

---

## **Sources**

- [Modern UX/UI Best Practices 2025 - devPulse](https://devpulse.com/insights/ux-ui-design-best-practices-2025-enterprise-applications/)
- [UX Design Trends 2025 - UXPin](https://www.uxpin.com/studio/blog/ui-ux-design-trends/)
- [Classic Forum Software Comparison - IONOS UK](https://www.ionos.co.uk/digitalguide/hosting/cms/the-best-forum-software/)
- [vBulletin vs Invision Power Board - StepByStep](https://www.stepbystep.com/Forum-Software-VBulletin-vs-Invision-Power-Board-131331/)
- [Community Forum Features Research - FasterCapital](https://fastercapital.com/content/Community-forums--Forum-Features--Highlighting-Essential-Forum-Features-for-User-Retention.html)
- [Forum Notification & Subscription Patterns - Drupal](https://www.drupal.org/project/forum_notifications_subscription)
