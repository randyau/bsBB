# v1.0 Launch Roadmap

**Last Updated:** 2026-05-18  
**Status:** Phase 10 Complete — Next: Phase 11 (Approval Queue)  
**Execution Order:** Phase 11 → Phase 12 → Phase 13

---

## Phase 10 ✅ — Search & Discovery + UI Polish

All complete. 10 commits total covering:
- Search by poster with `author:` filter syntax
- Forum statistics widget (posts, threads, members, monthly activity)
- Timezone support (per-user storage + browser auto-detection)
- Centralized datetime formatting across all pages
- Table layout improvements for thread listing
- Shared component library (AdminPageShell, Pagination, EmptyState, Breadcrumb, ConfirmModal, UserTypeahead)
- UI polish (unread indicator color, thread list readability)

---

## Phase 9 ✅ — Core Forum Experience & Moderation Tools

All complete. 11 commits total covering:
- Unread thread indicators (`thread_views` table, per-user tracking)
- Thread follow/mute system (`notification_subscriptions`, 3-state UI, notification overrides)
- Notification preferences (type: replies/quotes/both; frequency: 10min/hourly/daily)
- Post/thread moving moderation tools with modal dialogs and full audit log
- Inline mod tools (lock/unlock thread on first post, hide/restore/edit/move in dropdown)
- Bulk moderation for posts (checkboxes, select-all, hide/restore bulk actions with confirmation modal)
- Bulk moderation for threads (checkboxes, select-all, lock/unlock bulk actions)

---

## Phase 11 ⭕ — Approval Queue

**Goal:** Give moderators a spam prevention lever without blocking all new users.

- Per-forum toggle: "Require approval for posts from accounts < N days old"
- New posts from young accounts set `posts.is_approved = false`, hidden from thread until approved
- `/admin/approval-queue` page with Approve/Reject buttons per pending post
- Reject sends DM to user with reason
- Auto-approve after 24h to prevent queue backlog

**Schema:**
```sql
ALTER TABLE posts ADD COLUMN is_approved BOOLEAN DEFAULT true;
ALTER TABLE posts ADD COLUMN rejection_reason TEXT;
```

**Acceptance Criteria:**
- [ ] Per-forum approval toggle in `/admin/forums`
- [ ] New posts from young accounts require approval
- [ ] Approval queue page shows pending posts with context
- [ ] Approve/Reject buttons update mod_log
- [ ] Reject sends DM with reason
- [ ] Auto-approve after 24h

---

## Phase 12 ⭕ — Accessibility & Polish (Final UI Pass)

**Goal:** Comprehensive accessibility audit across all built features. Done last to cover everything built.

### 12.1 WCAG Color Contrast
- Audit all text/background combos for WCAG AA (4.5:1 normal, 3:1 large)
- Fix contrast issues in light/dark themes
- Ensure visible focus indicators (3px colored outline minimum)

### 12.2 Semantic HTML & Screen Reader
- Audit heading hierarchy (no skips)
- Add `<label>` to all form inputs, `aria-label` to icon-only buttons
- Add `role="region"` and `aria-labelledby` to major sections
- Test with NVDA/JAWS on key pages

### 12.3 Keyboard Navigation & Focus Management
- Audit tab order on all pages
- Modal focus trapping and focus restore on close
- Dropdown arrow key navigation
- Test: full nav using only keyboard

### 12.4 Breadcrumbs Audit
- Verify breadcrumbs on all major pages (forum index, forum, thread, admin, user profile)
- Fix missing or incorrectly ordered breadcrumbs
- Consistent styling across all pages

**Acceptance Criteria:**
- [ ] WCAG AA contrast passes for all text (light + dark)
- [ ] Heading hierarchy correct on all pages
- [ ] All form inputs labeled
- [ ] Icon-only buttons have aria-label
- [ ] Tab order logical on all pages
- [ ] Focus indicators visible and consistent
- [ ] Modal focus trapping works
- [ ] Keyboard-only navigation possible throughout
- [ ] Breadcrumbs present and correct on all pages

---

## Phase 13 ⭕ — Deployment, Operations & Documentation

**Goal:** Make it easy for adopters and testers to spin up, run, upgrade, and back up their instance.

### 13.1 Dev Setup & Local Testing Docs
- `QUICKSTART.md` — from zero to running locally in 5 minutes
- `.env.example` with full descriptions for every variable
- Troubleshooting guide for common dev issues
- Verify `npm run dev:setup` works on Windows/Mac/Linux

**Acceptance Criteria:**
- [ ] New developer can run locally without help
- [ ] All npm scripts documented
- [ ] Database reset procedure is clear

### 13.2 Production Deployment Guide
- `DEPLOYMENT.md` — step-by-step VPS setup
- `scripts/setup.sh` tested end-to-end
- Caddy HTTPS setup, migrations, health checks documented
- First-user admin promotion documented

**Acceptance Criteria:**
- [ ] Fresh VPS → running forum in under 30 minutes
- [ ] SMTP and ATproto OAuth setup walkthroughs included
- [ ] Rollback procedure documented

### 13.3 Backup, Restore & Disaster Recovery
- `BACKUP.md` — backup strategies, automated script, S3/R2/B2 integration
- Restore procedure tested on fresh instance
- Retention policy and RTO/RPO targets documented

**Acceptance Criteria:**
- [ ] Daily backup cron works reliably
- [ ] Restore from backup verified end-to-end
- [ ] Recovery time documented

### 13.4 Upgrade Guide
- `UPGRADE.md` — how to upgrade instances between versions
- Drizzle migrations automated (`npm run db:migrate`)
- Rollback procedure if upgrade fails

**Acceptance Criteria:**
- [ ] Upgrade path documented and tested
- [ ] Breaking changes flagged in release notes

### 13.5 Adopter Documentation
- `ADMIN_GUIDE.md` — user/role management, forum setup, moderation
- `USER_GUIDE.md` — posting, searching, notifications, settings
- Update `ARCHITECTURE.md` with current deployment details

**Acceptance Criteria:**
- [ ] New admin can operate forum without asking questions
- [ ] Users understand all features

---

## Deferred (Post-Launch)

Moved to `FUTURE_IMPROVEMENTS.md`:
- Thread Tags/Labels
- Digest-Style Notifications
- Advanced Search Filters
- Quote Preview on Hover
- Favorites/Quick Nav Sidebar
- Share Post Button

---
