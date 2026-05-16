# Phase 6 — Post Edits, Search & Shipping (In Progress)

## Commits Completed (1/6)

---

### ✅ Commit 1: Post Edit Infrastructure
**Files:**
- `src/routes/f/[forumSlug]/t/[threadId]/post/[postId]/+server.ts` (new) — PATCH endpoint
- `src/routes/f/[forumSlug]/t/[threadId]/+page.svelte` (modified) — Edit button + inline editor
- `src/routes/f/[forumSlug]/t/[threadId]/+page.server.ts` — No changes needed (edit validation in server endpoint)

Implemented post editing with revision history. Authors and admins can edit posts; editing creates a revision snapshot before updating.

**Features:**
- PATCH endpoint at `/f/[forum]/t/[thread]/post/[postId]`
- Only post author or admin can edit
- Validates body (1-50,000 chars)
- Creates `post_revisions` snapshot before update
- Re-renders markdown and fetches link metadata
- Updates `posts.editedAt` timestamp
- Inline editor in thread view (click "Edit" button)
- Real-time save with loading state
- Cancellation preserves original content

**Edit Button Visibility:**
- Shows for post author and admin
- Hidden for deleted posts
- Hidden when thread is locked

---

## Remaining Commits (5/6)

### 📋 Commit 2: Post Revisions Viewer
**Files:**
- `src/routes/f/[forumSlug]/t/[threadId]/post/[postId]/+server.ts` (new)
- `src/routes/f/[forumSlug]/t/[threadId]/+page.server.ts` (modify)
- `src/routes/f/[forumSlug]/t/[threadId]/+page.svelte` (modify)

**What it does:**
- PATCH endpoint to edit post (only author or admin)
- Revalidate markdown, sanitize HTML
- Create `post_revisions` entry with old content
- Update `posts.editedAt` timestamp

---

### 📋 Commit 2: Post Revisions Viewer
**Files:**
- `src/routes/f/[forumSlug]/t/[threadId]/post/[postId]/revisions/+page.server.ts` (new)
- `src/routes/f/[forumSlug]/t/[threadId]/post/[postId]/revisions/+page.svelte` (new)

**What it does:**
- View complete edit history for a post
- List all revisions with timestamp, editor, body
- Link from post to revision history

---

### 📋 Commit 3: Full-Text Search Implementation
**Files:**
- `src/routes/api/search/+server.ts` (new)
- `src/lib/search.ts` (new)

**What it does:**
- `tsvector` full-text search on posts
- Pagination (20 results per page)
- Snippet preview generation
- Relevance scoring

---

### 📋 Commit 4: Search UI & Results Page
**Files:**
- `src/routes/search/+page.server.ts` (new)
- `src/routes/search/+page.svelte` (new)
- `src/routes/+layout.svelte` (modify) — Add search bar

**What it does:**
- Search bar in header on all pages
- Results page with filters (forum, date)
- Display snippet, author, thread, relevance

---

### 📋 Commit 5: Production Docker Build
**Files:**
- `Dockerfile.prod` (new) or modify `Dockerfile`
- `docker-compose.prod.yml` (new)
- `package.json` (modify) — Add prod build script

**What it does:**
- Multi-stage build for smaller image
- Production-optimized deps
- Worker service included
- Health checks

---

### 📋 Commit 6: Deployment Guide & Setup
**Files:**
- `DEPLOYMENT.md` (new) — Complete hosting guide
- `scripts/setup.sh` (modify) — Enhanced validation
- `docker-compose.prod.yml` (template)
- `README.md` (modify) — Ship status

**What it does:**
- Hetzner, DigitalOcean, VPS hosting instructions
- SSL/TLS setup (Caddy, Let's Encrypt)
- Database backups (pg_dump, R2/B2)
- Monitoring & scaling
- Setup script walkthrough

---

## Testing Checklist

### Commit 1 (Post Edit)
- [ ] User can edit own post
- [ ] Edit creates `post_revisions` entry
- [ ] Markdown re-rendered, HTML sanitized
- [ ] `editedAt` timestamp updated
- [ ] Non-author cannot edit (403)

### Commit 2 (Revisions)
- [ ] Revisions page loads
- [ ] Lists all revisions chronologically
- [ ] Shows timestamp, editor, body
- [ ] Link from post to revision history

### Commit 3 (Search API)
- [ ] POST /api/search?q=keyword returns results
- [ ] Results paginated (20 per page)
- [ ] Snippet preview generated
- [ ] Relevance score included

### Commit 4 (Search UI)
- [ ] Search bar in nav functional
- [ ] /search page displays results
- [ ] Can filter by forum
- [ ] Pagination works

### Commit 5 (Docker Prod)
- [ ] `docker build -f Dockerfile.prod` succeeds
- [ ] Image size optimized (<500MB)
- [ ] `docker-compose.prod.yml` valid
- [ ] Health checks pass

### Commit 6 (Deployment)
- [ ] DEPLOYMENT.md comprehensive
- [ ] scripts/setup.sh runs without errors
- [ ] docker-compose.prod.yml includes all services
- [ ] README updated with ship status

---

## Database State

Tables already exist:
- `posts.editedAt` — Edit timestamp
- `posts.body_tsv` — Full-text search vector (tsvector)
- `post_revisions` — Append-only revision history

Indexes to add:
- GIN index on `posts.body_tsv` for search performance

---

## Success Criteria

- [x] Phase 5 complete (6/6 commits)
- [ ] Post editing fully functional
- [ ] Revision history searchable
- [ ] Full-text search working
- [ ] Search UI intuitive
- [ ] Production Docker ready
- [ ] Deployment docs comprehensive
- [ ] 6 commits with tests
- [ ] Ready to ship
