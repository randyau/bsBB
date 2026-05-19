# v1.0 Launch Roadmap

**Last Updated:** 2026-05-19  
**Status:** All Phases 1–13 Complete — v1.0 Launch Ready

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

## Phase 11 ✅ — Approval Queue

Per-forum toggle: require approval for posts from accounts < N days old. New posts from young accounts are hidden until approved or rejected (with reason DM). Auto-approve after 24h to prevent queue backlog. `/admin/approval-queue` page.

---

## Phase 12 ✅ — Accessibility & Polish (Final UI Pass)

WCAG AA color contrast audit (light + dark), semantic HTML and heading hierarchy, all form inputs labeled, icon-only buttons get `aria-label`, keyboard-only navigation, modal focus trapping, visible focus indicators, breadcrumbs on all pages.

---

## Phase 13 ✅ — Deployment, Operations & Documentation

`QUICKSTART.md`, `DEPLOYMENT.md`, `BACKUP.md`, `UPGRADE.md`, `ADMIN_GUIDE.md`, `USER_GUIDE.md` — complete ops and adopter documentation. `scripts/setup.sh` tested end-to-end. Systemd service file included.

---

## Deferred (Post-Launch)

See **[FUTURE_IMPROVEMENTS.md](FUTURE_IMPROVEMENTS.md)** for a complete prioritized backlog of post-v1.0 features and improvements, including:

- **Storage & Media:** Local avatar caching, media handling strategies
- **Forum Features:** Thread tags, advanced search, favorites sidebar, quote preview
- **Notifications:** Digest-style summaries, read receipts
- **Admin & Moderation:** Spam detection rules, bulk user actions, analytics dashboard
- **DevOps & Performance:** Prometheus metrics, health checks, caching optimization
- **Integrations:** Discord/Matrix bridges, Slack notifications
- **Known Out of Scope:** Real-time chat, private messaging, file uploads, WYSIWYG editor, karma systems

---
