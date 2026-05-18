# Documentation Audit Report

**Date:** 2026-05-18  
**Status:** ✅ ALL ISSUES FIXED  
**Last Updated:** 2026-05-18 (fixes applied)

---

## Fixes Applied ✅

### Critical Issues
1. ✅ **Caddyfile.prod created** at project root (was missing, breaking production deployment)
2. ✅ **ARCHITECTURE.md fixed** — removed CodeMirror, shadcn-svelte; documented actual markdown-it setup
3. ✅ **CLAUDE.md updated** — clarified live markdown preview, updated docker paths, fixed tech stack description
4. ✅ **PATTERNS.md enhanced** — added markdown rendering section explaining client vs server approach

### Minor Issues
5. ✅ **ROADMAP.md cleaned** — removed duplicate Phase 10 section
6. ✅ **New SCRIPTS.md created** — comprehensive helper scripts reference with when/how to use each
7. ✅ **DEPLOYMENT.md updated** — simplified with reference to setup.sh, mentioned Caddyfile.prod requirement

### Documentation Map
8. ✅ **Updated in CLAUDE.md** — added SCRIPTS.md, clarified purposes of all docs

---

## Critical Issues Fixed (Implementation vs Docs)

### 1. ❌ Markdown Editor — INACCURATE IN ARCHITECTURE.MD

**Documented in ARCHITECTURE.md (Line 56):**
```
| Markdown editor | CodeMirror 6 | With markdown mode; preview is button-toggled (not live) |
```

**Actual Implementation:**
- No CodeMirror dependency in `package.json` ✗
- Uses plain `<textarea>` ✓
- **Live preview** rendered on same page (not button-toggled) ✓
- Client-side rendering via `renderMarkdownClient()` using `markdown-it` ✓
- `/api/preview` endpoint exists but **NOT used** by the new thread form ⚠️

**Evidence:**
- `src/routes/f/[forumSlug]/new/+page.svelte` lines 76-108 show live preview
- `src/lib/markdown/client.ts` has `renderMarkdownClient()` using markdown-it
- `src/routes/api/preview/+server.ts` exists with tests, but new page doesn't call it
- No `@codemirror` packages in `package.json`

**CLAUDE.md partially correct:**
- ✓ Says "Plain `<textarea>`"
- ✗ Says "button-toggled preview pane"
- ✗ Says "server-rendered via `POST /api/preview`"

**ARCHITECTURE.md is wrong:**
- ✗ CodeMirror 6 (not used)
- ✗ Button-toggled (actually live continuous)

---

### 2. ❌ Production Docker Path — CONFUSING DOCUMENTATION

**Documented in CLAUDE.md (Line 180):**
```
Defined in `docker-compose.prod.yml`:
```

**Actual Files:**
- ✓ `docker-compose.prod.yml` exists at project root
- ✓ Contains worker service (lines 37-58)
- `docker/docker-compose.yml` exists but is NOT the production file
- `docker/docker-compose.dev.yml` exists and is correctly referenced

**Issue:** Documentation refers to correct file at root but also mentions `docker/docker-compose.yml` elsewhere which is confusing. Consider consolidating or clarifying which file is which.

**Fix:** Document explicitly that:
- Production: `docker-compose.prod.yml` (at root)
- Development: `docker/docker-compose.dev.yml`
- Intermediate/unused: `docker/docker-compose.yml`

---

### 3. ⚠️ Caddyfile Missing

**Documented in docker-compose.prod.yml (Line 83):**
```yaml
volumes:
  - ./Caddyfile.prod:/etc/caddy/Caddyfile
```

**Actual Files:**
- ✗ `Caddyfile.prod` does NOT exist
- ✓ `docker/Caddyfile` exists

**Issue:** docker-compose.prod.yml will fail to start because the volume mount references a non-existent file.

**Fix:** Either:
1. Create `Caddyfile.prod` at project root, OR
2. Update docker-compose.prod.yml to reference `./docker/Caddyfile`

---

### 4. ⚠️ Dev Workflow Documentation Mismatch

**Documented in CLAUDE.md (Lines 35-46):**
- Says `npm run dev:setup` is "one-command dev startup"
- Says it "starts DB, runs migrations, seeds dev users, starts server"

**Actual Implementation (scripts/dev.sh):**
- Line 93: Creates `.env.local` with DATABASE_URL and DEV_AUTH_ENABLED
- Line 98-113: Runs migrations via `drizzle-kit migrate`
- Line 116-129: Seeds dev users (but output says "skipped" if it fails)
- Line 131-142: Starts dev server with `npm run dev`

**Issue:** Documentation is accurate, but the script uses `drizzle-kit migrate` directly, not `npm run db:migrate`. The `npm run db:migrate` script (which calls `bash scripts/migrate.sh`) is a separate command.

**Verified correct:** The dev workflow docs are actually fine.

---

## Minor Issues

### 5. ⚠️ ROADMAP Has Duplicate Phase 10

**Found in ROADMAP.md:**
- Line 9: "## Phase 10 ✅ — Search & Discovery + UI Polish" (marked complete)
- Line 35: "## Phase 10 ⭕ — Search & Discovery" (marked not started with ⭕)

**Issue:** Confusing duplicate section. Phase 10 is already complete (confirmed by git history and commit messages).

**Fix:** Remove the second "Phase 10 ⭕" section entirely. It's stale.

---

### 6. ⚠️ ARCHITECTURE.md References Removed/Changed Components

**Documented in ARCHITECTURE.md (Line 48):**
```
| Component primitives | shadcn-svelte | Built on Tailwind; accessible; well-documented |
```

**Check result:**
- No `shadcn-svelte` in `package.json`

**Other docs issues:**
- ARCHITECTURE.md says "CodeMirror 6" (not used)
- ARCHITECTURE.md says "Markdown editor" with "button-toggled preview" (actually live)

---

### 7. ⚠️ Notification System — Worker Service Properly Documented

**Verified in docker-compose.prod.yml (Lines 37-58):**
- ✓ Worker service exists
- ✓ Runs `npx tsx src/worker.ts`
- ✓ Uses same Dockerfile.prod
- ✓ Has DATABASE_URL and service credentials

**Documentation is CORRECT** for this section.

---

## Verification Checklist

### Files Verified ✓
- `package.json` — npm scripts match CLAUDE.md
- `.env.example` — environment variables present
- `src/lib/utils/time.ts` — formatting functions exist ✓
- `src/routes/client-metadata.json/+server.ts` — dynamic metadata generation ✓
- `src/worker.ts` — exists ✓
- `Dockerfile.prod` — exists ✓
- `docker-compose.prod.yml` — exists with worker service ✓
- `docker/docker-compose.dev.yml` — exists ✓
- `scripts/setup.sh` — exists ✓
- `scripts/dev.sh` — exists ✓
- `scripts/seed.ts` — exists ✓
- `scripts/seed-dev-users.ts` — exists ✓

### Files NOT Found ✗
- `Caddyfile.prod` — referenced but missing
- `shadcn-svelte` — documented but not installed
- `CodeMirror 6` — documented but not installed

---

## Summary of Changes Needed

**High Priority (breaks deployment):**
1. Fix `Caddyfile.prod` path in docker-compose.prod.yml or create missing file

**Medium Priority (confuses developers):**
2. Update ARCHITECTURE.md Line 56 to reflect actual markdown editor (plain textarea, live preview on client)
3. Remove duplicate Phase 10 section from ROADMAP.md
4. Clarify production vs development docker-compose paths in documentation

**Low Priority (minor clarity):**
5. Document that markdown editor uses client-side rendering, not server endpoints
6. Remove shadcn-svelte reference from stack decisions if not used

---

## Recommendations

1. **Add deployment checklist** to DEPLOYMENT.md that verifies Caddyfile.prod exists before running docker-compose
2. **Update PATTERNS.md** with actual markdown preview behavior (client-side live, not server button-toggle)
3. **Lock ARCHITECTURE.md to current code** — it diverged from real implementation (CodeMirror, shadcn-svelte)
4. **Create DOCKER.md** to clarify:
   - Which compose file for which environment
   - Why three files exist
   - Volume mount requirements

---
