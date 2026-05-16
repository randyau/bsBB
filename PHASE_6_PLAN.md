# Phase 6 — Post Edits, Search & Shipping (In Progress)

## Overview

Phase 6 completes the core forum functionality with post editing, full-text search, production-ready Docker, and deployment documentation. After Phase 6, the forum is feature-complete and ready to ship.

## Implementation Roadmap

### Commit 1: Post Edit Infrastructure
- Enable post editing for authors (after creation)
- Store edits in `post_revisions` table (append-only)
- Update `posts.editedAt` timestamp
- Guard: only author or admin can edit
- Revalidate markdown & sanitize HTML on each edit

### Commit 2: Post Revisions Viewer
- View edit history at `/f/[forum]/t/[thread]/post/[postId]/revisions`
- List all revisions with timestamp, editor, body
- Ability to view/compare revisions
- Read-only (no rollback in MVP)

### Commit 3: Full-Text Search Implementation
- Implement `tsvector` full-text search on `posts.body_tsv` column
- Add search endpoint: `POST /api/search`
- Query posts by keyword across all forums
- Return relevant results with snippet preview
- Pagination (20 results per page)

### Commit 4: Search UI & Results Page
- Add search bar to main nav (available on all pages)
- Create `/search` results page
- Display search results with:
  - Post snippet (50 chars) + author
  - Thread title (linked)
  - Forum name
  - Match relevance score
- Pagination and filters (by forum, date range)

### Commit 5: Production Docker Build
- Optimize Dockerfile for production (multi-stage build)
- Minimize image size (node_modules pruning, production deps)
- Update docker-compose.yml for production (add worker service)
- Health checks for all services
- Graceful shutdown handling

### Commit 6: Deployment Guide & Setup Script
- Comprehensive DEPLOYMENT.md (hosting options, SSL, backups)
- scripts/setup.sh validation and enhancement
- scripts/admin-promote.sh (breakglass admin)
- docker-compose.prod.yml template
- README with ship-ready status

---

## Database State

Tables already exist:
- `posts` table with `editedAt` and `bodyTsv` columns
- `post_revisions` table (append-only audit trail)

Indexes to add:
- GIN index on `posts.body_tsv` for full-text search

---

## Files to Create/Modify

**New:**
- `src/routes/f/[forumSlug]/t/[threadId]/post/[postId]/+server.ts` — PATCH edit endpoint
- `src/routes/f/[forumSlug]/t/[threadId]/post/[postId]/revisions/+page.server.ts` — Load revisions
- `src/routes/f/[forumSlug]/t/[threadId]/post/[postId]/revisions/+page.svelte` — Revisions UI
- `src/routes/api/search/+server.ts` — Full-text search API
- `src/routes/search/+page.server.ts` — Search results page
- `src/routes/search/+page.svelte` — Search results UI
- `DEPLOYMENT.md` — Hosting & setup guide
- `Dockerfile.prod` — Production build
- `docker-compose.prod.yml` — Production compose file

**Modify:**
- `src/routes/+layout.svelte` — Add search bar to nav
- `Dockerfile` (or create new for prod)
- `docker-compose.yml` — Add worker service
- `scripts/setup.sh` — Validation & enhancement
- `package.json` — Add build:prod script
- `README.md` — Update roadmap, ship status

---

## Success Criteria

- [x] Phase 5 complete (6/6 commits)
- [ ] Post editing working (author can edit, creates revision)
- [ ] Revisions viewable (history page)
- [ ] Search implemented (tsvector, API, UI)
- [ ] Production Docker optimized
- [ ] Deployment documentation complete
- [ ] 6 commits with passing tests
- [ ] Ready to deploy to production

---

## Testing Strategy

- Playwright/manual e2e: edit post, view revisions
- Search API: test queries, pagination, relevance
- Docker: build prod image, test in container
- Setup: run setup.sh on fresh server simulation
