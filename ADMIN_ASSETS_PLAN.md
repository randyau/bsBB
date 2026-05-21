# Admin Asset Storage Feature — Implementation Plan

## Overview
Admins can upload files (images, PDFs, ZIPs, etc.) for use in forum settings and content. Assets are stored on disk, tracked in DB, and referenced in markdown via `asset:slug` syntax.

## Implementation Phases

### Phase 1: Database & Core Storage (commits 1-3)
- [ ] Migration: Create `admin_assets` table
- [ ] Schema: id, slug, original_filename, mime_type, size, uploaded_by, created_at, updated_at
- [ ] Create `src/lib/assets.ts` with core utilities:
  - `generateAssetSlug(filename)` — unique slug from filename
  - `resolveAssetReferences(text)` — find `asset:slug` and replace with `/assets/slug`
  - `canAccessAssets(user)` — permission check
  - Type definitions for asset metadata

### Phase 2: Upload & Storage (commits 4-6)
- [ ] Server action: `?/uploadAsset(file)` in `/admin/assets`
  - Validate file type (by MIME, whitelist?)
  - Save to `uploads/assets/{slug}`
  - Insert record in `admin_assets`
  - Return `{ slug, url, filename, error? }`
- [ ] Filesystem setup: ensure `uploads/assets/` dir exists
- [ ] Update `.gitignore` to ignore `uploads/`

### Phase 3: Admin Assets Page (commits 7-9)
- [ ] `/admin/assets/+page.server.ts` with actions:
  - `load`: fetch all assets with metadata
  - `?/uploadAsset` 
  - `?/deleteAsset(slug)`
  - `?/renameAsset(slug, newFilename)`
- [ ] `/admin/assets/+page.svelte`:
  - Upload dropzone
  - Assets table (filename, size, date, actions)
  - Copy buttons for each asset (reference, image markdown, link markdown)
  - Delete confirmation dialog

### Phase 4: Asset Picker Component (commits 10-11)
- [ ] `src/components/AssetPicker.svelte`
  - Modal showing available assets
  - Search/filter by filename
  - File type icons
  - Click to insert `asset:slug` reference
  - "Copy as image markdown" / "Copy as link markdown" buttons
- [ ] MarkdownToolbar integration: add asset picker button (only if user can access)

### Phase 5: Integration & Settings (commits 12-13)
- [ ] Update favicon setting to use FileUploadField OR asset reference
- [ ] Add asset reference resolution to:
  - Settings rendering (homepage announcement, etc)
  - Post rendering (both preview + stored HTML)
  - unified markdown pipeline
- [ ] Client-side markdown preview resolution

### Phase 6: Caddy & Deployment (commits 14-15)
- [ ] Caddy config: serve `/assets/*` from `uploads/assets/`
- [ ] Docker: mount `uploads/` volume in app container
- [ ] Permissions: directory readable by app user
- [ ] Backup: include `uploads/` in backup strategy

### Phase 7: Tests & Polish (commits 16-17)
- [ ] Unit tests for slug generation, reference resolution
- [ ] Integration tests for upload/delete actions
- [ ] Permission checks tested
- [ ] Update PATTERNS.md with asset usage examples

## Key Design Decisions

| Decision | Rationale |
|---|---|
| No extensions in slugs | Prevents direct guessing; MIME type authoritative |
| String substitution for resolution | Simple, works anywhere (markdown, templates, settings) |
| Admins only (v1) | Simplifies permission model; mods can be added later |
| Stored on disk, not DB | Simplifies distribution; no blob columns; backups via volume |
| Asset picker modal | UX consistency with emoji picker; discoverable |

## Files to Create/Modify

**New:**
- `src/lib/assets.ts` — core utilities
- `src/routes/admin/assets/+page.server.ts` — CRUD actions
- `src/routes/admin/assets/+page.svelte` — UI
- `src/components/AssetPicker.svelte` — reusable picker
- `migrations/0XXX_create_admin_assets.sql` — schema
- `ADMIN_ASSETS_PLAN.md` — this file

**Modify:**
- `src/lib/db/schema.ts` — add adminAssets table
- `src/components/MarkdownToolbar.svelte` — add asset button
- `Caddyfile.prod` — static asset serving
- `docker-compose.prod.yml` — upload volume mount
- `.gitignore` — ignore uploads/
- `PATTERNS.md` — document asset usage
- `ADMIN_GUIDE.md` — document admin assets management

## Estimated Effort
~17 commits, 2-4 hours of focused work depending on testing depth.

## Non-Blocking Future Work
- User/mod upload permissions (permission table + UI)
- Asset usage scanning (show where asset is referenced)
- Asset description/metadata
- Bulk upload
- S3 backend option for scalability
