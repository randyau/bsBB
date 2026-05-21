# Helper Scripts Reference

This document lists all shell and TypeScript helper scripts in `scripts/` and when to use them.

## Platform Notes

All scripts are **bash scripts targeting Linux/macOS**. This includes production scripts — they are designed to run on a Linux server.

- **Mac / Linux:** Run scripts directly in your terminal.
- **Windows with WSL2:** Run scripts from inside a WSL2 terminal (Ubuntu). This project is actively developed on WSL2 — all scripts are tested in that environment. See [QUICKSTART.md](QUICKSTART.md#windows-with-wsl2) for WSL2 setup.
- **Windows without WSL2:** Scripts won't run natively. Use Git Bash as a fallback, or use the manual commands documented below each script.
- **Production:** Scripts run on a Linux server — no Windows tooling is involved.

---

## Development Workflows

### `npm run dev:setup` — One-Command Dev Startup
**File:** `scripts/dev.sh`  
**When to use:** First time setting up local development, or to reset your dev environment

**What it does:**
1. Checks Docker access
2. Starts PostgreSQL 17 in Docker
3. Runs schema migrations
4. Seeds dev users (for `DEV_AUTH_ENABLED=true` flow)
5. Starts SvelteKit dev server on http://localhost:5173
6. Traps `Ctrl+C` to cleanly stop containers

**Command:**
```bash
npm run dev:setup
```

**Requirements:**
- Docker installed and accessible (no sudo if added to group)
- `package.json` in project root

**Output:**
- Database running on `localhost:5432`
- Dev server on `http://localhost:5173`
- Dev users ready for login (see CLAUDE.md "Dev login" section)

---

### `npm run db:migrate` — Apply Pending Migrations
**File:** `scripts/migrate.sh`  
**When to use:** After pulling code with new migrations, or after schema changes

**What it does:**
- Detects local vs. Docker environment
- Delegates to the running app container on prod (where `drizzle-kit` is installed)
- Runs `drizzle-kit migrate` with the correct `DATABASE_URL`
- Prints `✓ Migrations complete.` on success, or an error with recovery hint on failure

**Command:**
```bash
npm run db:migrate
```

**Expected output (nothing to apply):**
```
Running migrations against: postgresql://...
[✓] applying migrations...
✓ Migrations complete.
```

> **Note:** The `NOTICE: schema "drizzle" already exists` and `relation "__drizzle_migrations" already exists` messages are normal — Drizzle creates these if they don't exist. They do not indicate a problem.

---

### `npm run db:stamp` — Repair Empty Migration Tracking Table
**File:** `scripts/stamp-migrations.sh` → `scripts/stamp-migrations.ts`  
**When to use:** When `__drizzle_migrations` is empty but the schema already exists (see [Known Issue](#known-issue-drizzle-migration-tracking) below)

**What it does:**
- Uses drizzle-orm's own `readMigrationFiles` to compute the correct hash for each migration
- Inserts a record into `drizzle.__drizzle_migrations` for each migration not already tracked
- Safe to re-run — skips migrations already recorded
- Delegates to the app container on prod (same as `db:migrate`)

**Command:**
```bash
npm run db:stamp
npm run db:migrate  # verify — should report nothing to apply
```

---

## Seeding & Setup

### `npx tsx scripts/seed.ts` — Initial Database Seed
**When to use:** First time after migrations, on a fresh database

**What it does:**
- Inserts `instance_settings` table defaults
- Creates the "General" forum (global root)
- Idempotent — safe to run multiple times

**Command:**
```bash
# Automatic via npm run dev:setup, or manual:
npx tsx scripts/seed.ts
```

**Requires:**
- DATABASE_URL environment variable set
- Migrations already applied (`npm run db:migrate`)

---

### `npx tsx scripts/seed-dev-users.ts` — Dev User Seeding
**When to use:** Setting up dev login bypass (local only)

**What it does:**
- Inserts test users with fake `did:example:*` DIDs
- Idempotent — updates roles if manually changed
- **Never run in production** — users have no real ATproto identity

**Command:**
```bash
# Automatic via npm run dev:setup, or manual:
npx tsx scripts/seed-dev-users.ts
```

**Requires:**
- DATABASE_URL set
- `DEV_AUTH_ENABLED=true` in `.env.local` (automatic via `npm run dev:setup`)

**Test users created:**
- `did:example:dev-admin` → handle `dev-admin.test` (admin)
- `did:example:dev-moderator` → handle `dev-moderator.test` (member; per-forum mod role set separately)
- `did:example:dev-member` → handle `dev-member.test` (member)
- `did:example:dev-banned` → handle `dev-banned.test` (banned)

---

## Production Setup

### `scripts/setup.sh` — First-Run Deployment Setup
**When to use:** Once per new instance, during initial deployment

**What it does:**
1. Generates P-256 JWK keypair via `scripts/gen-keypair.js`
2. Writes private key to `.env`
3. Validates ATproto service account (handle + app password)
4. Validates SMTP credentials with test email
5. Prompts for default forum visibility
6. Logs all output to `logs/setup.log`
7. First user to login is auto-promoted to admin

**Command:**
```bash
bash scripts/setup.sh
```

**Interactive prompts:**
1. ATproto service handle (e.g., `notifications.yourforum.bsky.social`)
2. ATproto app password (create at https://bsky.app/settings/app-passwords)
3. SMTP credentials and test recipient
4. Default forum visibility (`public` or `members-only`)

**Requires:**
- `.env` file exists (or will be created)
- ATproto service account already created on Bluesky
- SMTP credentials ready (Mailgun, SendGrid, etc.)

**Output:**
- Updated `.env` file with all secrets
- `logs/setup.log` with complete transcript

---

### `node scripts/gen-keypair.js` — Generate ATproto OAuth Keypair
**When to use:** As part of `scripts/setup.sh` (usually automatic)

**What it does:**
- Generates P-256 (ES256) JWK keypair
- Outputs both keys as JSON
- Used for ATproto OAuth client metadata signing

**Command:**
```bash
# Usually called by setup.sh, or manually:
node scripts/gen-keypair.js
```

**Output format:**
```json
{
  "public": { ... JWK public key ... },
  "private": { ... JWK private key ... }
}
```

---

## Docker Management

### `npm run docker:build` — Rebuild Docker Images
**File:** `scripts/docker-rebuild.sh`  
**When to use:** After code changes, dependency updates, or Dockerfile changes

**What it does:**
1. Stops running containers
2. Rebuilds app and worker images without cache (ensures fresh build)
3. Starts all services (app, worker, db, caddy)
4. Waits for containers to be healthy

**Command:**
```bash
npm run docker:build
```

**Equivalent manual command:**
```bash
bash scripts/docker-rebuild.sh
```

**Requirements:**
- Docker installed and accessible
- `docker-compose.prod.yml` present
- Previous containers can be safely stopped

**When combined with dev workflow:**
```bash
npm run docker:build  # Rebuild
# Services are now running in containers
# App available at http://localhost (via Caddy proxy)
```

---

### `npm run docker:restart` — Quick Restart Without Rebuild
**File:** `scripts/docker-restart.sh`  
**When to use:** After restarting a laptop, or to reload config without rebuilding images

**What it does:**
1. Restarts all running containers (app, worker, db, caddy)
2. Skips rebuild — uses existing images
3. Waits for containers to be healthy
4. Faster than rebuild (~5–10 seconds vs. 1–2 minutes)

**Command:**
```bash
npm run docker:restart
```

**Equivalent manual command:**
```bash
bash scripts/docker-restart.sh
```

**Example workflow:**
```bash
npm run docker:restart  # Quick restart after machine sleep/wake
# Services back online in seconds
```

---

### `npm run docker:stop` — Stop All Services
**File:** `scripts/docker-stop.sh`  
**When to use:** Shutting down dev environment, freeing resources

**What it does:**
- Stops all Docker services (app, worker, db, caddy)
- Removes containers but preserves data volume
- Safe — database is persistent across restart

**Command:**
```bash
npm run docker:stop
```

**Equivalent manual command:**
```bash
bash scripts/docker-stop.sh
```

**Data persistence:**
- Database volume (`forum-db`) is preserved
- Stopping and restarting keeps all data
- To fully reset database, manually remove volume:
  ```bash
  docker volume rm forum-db
  ```

---

## Testing & Verification

### `npm test` — Run Unit Tests
**File:** Vitest configuration  
**When to use:** After code changes, before commits

**Command:**
```bash
npm test
```

**What it covers:**
- Unit tests for permissions, markdown, notifications, etc.
- Integration tests for database operations
- Does NOT require Docker (uses test database)

---

### `npm run check` — TypeScript & Svelte Type Check
**When to use:** Before commits to catch type errors

**Command:**
```bash
npm run check
```

**What it does:**
- Runs `svelte-kit sync`
- Checks TypeScript with strict mode
- Checks Svelte component types

---

### `scripts/verify-tests.sh` — Full Verification Suite
**When to use:** Before deploying to ensure everything passes

**Command:**
```bash
bash scripts/verify-tests.sh
```

**What it checks:**
1. Type checking (`npm run check`)
2. Unit tests (`npm test`)
3. Build succeeds (`npm run build`)

**Exit code:**
- `0` = all checks pass
- `1` = any check fails (detailed output shown)

---

### `scripts/test-integration.sh` — Integration Test Suite
**When to use:** Testing against real database, before major changes

**Command:**
```bash
bash scripts/test-integration.sh
```

**Requirements:**
- Docker with docker-compose
- No existing database (will create fresh)

---

## Maintenance & Utilities

### `scripts/lock-thread-check-metadata.sh` — Debug Thread Locking
**When to use:** Troubleshooting thread lock feature or OG metadata

**Command:**
```bash
bash scripts/lock-thread-check-metadata.sh <thread_id>
```

**What it does:**
- Locks the specified thread
- Fetches and displays OpenGraph metadata
- Useful for debugging link previews

---

## Recommended Commands by Workflow

### Initial Setup (Fresh Dev Environment)
```bash
npm install
cp .env.example .env
npm run dev:setup  # Sets DATABASE_URL, starts DB, runs migrations, seeds users, starts dev server
```

### After Pulling New Code
```bash
npm install        # If package.json changed
npm run db:migrate # If migrations added
npm run dev        # Restart dev server
```

### After First Deploy / Fresh Container with Existing Database
If you rebuilt the container against a DB that already has the schema (e.g., after migrating from a previous setup), the migration tracking table may be empty. Run stamp first:
```bash
npm run db:stamp    # Populates __drizzle_migrations with correct hashes
npm run db:migrate  # Should now report nothing to apply
```

### Before Committing
```bash
npm run check  # Type check
npm test  # Run unit tests
npm run build  # Verify build succeeds
```

### Before Production Deployment
```bash
bash scripts/verify-tests.sh  # Full test suite
npm run build  # Build production bundle
# Then: docker compose -f docker-compose.prod.yml build app worker  # app=Node, worker=Python
# Then: docker compose -f docker-compose.prod.yml up -d
```

### On Fresh Production Server
```bash
git clone <repo>
cd <repo>
npm install
bash scripts/setup.sh  # Interactive setup (prompts for secrets)
docker compose -f docker-compose.prod.yml up -d
# First user to login becomes admin
```

---

## Environment Variable Setup

Scripts use these env vars (usually set by parent script):

| Variable | Set by | Used by |
|---|---|---|
| `DATABASE_URL` | `dev.sh`, `.env` | All database scripts |
| `DEV_AUTH_ENABLED` | `dev.sh` (written to `.env.local`) | App for dev login bypass |
| `NODE_OPTIONS` | `dev.sh` | Loads dotenv automatically |
| `SKIP_CLEANUP` | User (optional) | `dev.sh` — set to keep containers after exit |

---

## Known Issue: Drizzle Migration Tracking

**Symptom:** `npm run db:migrate` appears to run but `drizzle.__drizzle_migrations` remains empty. The app fails on startup with a 500 error querying tables that should exist. Re-running `db:migrate` makes no difference.

**Root cause:** Drizzle runs all pending migrations in a single transaction. If any migration uses bare `CREATE TABLE` (without `IF NOT EXISTS`) and the table already exists, that statement throws, the whole transaction rolls back — including the tracking inserts into `__drizzle_migrations` — and nothing is recorded. This leaves the table perpetually empty, so every subsequent `db:migrate` call retries all migrations and fails again.

This affects this project because migrations 0000–0009 predate the `IF NOT EXISTS` convention and are non-idempotent. The tracking table ends up empty if the schema was ever applied outside of Drizzle's control (e.g., restored from a backup, or applied via raw SQL).

**Fix:**
```bash
npm run db:stamp    # Inserts correct hash records for all already-applied migrations
npm run db:migrate  # Now sees all migrations as recorded — applies only new ones
```

If the app is also reporting a 500 on a specific page, the relevant table may also be missing. Apply it manually via `psql`, then stamp.

**Prevention:** New migrations should always use `IF NOT EXISTS` for `CREATE TABLE` and `ADD COLUMN IF NOT EXISTS` for `ALTER TABLE`, so that re-running is always a no-op.

---

## Troubleshooting

### Script Fails with "npm not found"
**Cause:** Running via `sudo` without proper PATH  
**Fix:** Add user to docker group instead of using sudo:
```bash
sudo usermod -aG docker $USER
# Log out and back in
npm run dev:setup  # Now without sudo
```

### Database already running on port 5432
**Cause:** Previous container not stopped  
**Fix:**
```bash
docker compose -f docker/docker-compose.dev.yml down
npm run dev:setup
```

### Migrations fail with "Cannot find module"
**Cause:** `npm install` not run or node_modules corrupted  
**Fix:**
```bash
npm ci  # Clean install
npm run db:migrate
```

### `db:migrate` runs but tables are still missing / 500 errors after deploy
**Cause:** `drizzle.__drizzle_migrations` is empty — see [Known Issue](#known-issue-drizzle-migration-tracking) above.  
**Fix:**
```bash
npm run db:stamp
npm run db:migrate
```
If a specific table is still missing after stamping, apply it manually via `psql` using the SQL from `src/lib/db/migrations/<migration>.sql`.

### `db:stamp` or `db:migrate` reports "No such file or directory" inside container
**Cause:** The container image was built before the script was added to the repo.  
**Fix:** Rebuild the container to include the new scripts, then re-run:
```bash
npm run docker:build
npm run db:stamp
```

### "DEV_AUTH_ENABLED not set"
**Cause:** `.env.local` not created or dev server started wrong way  
**Fix:** Always use `npm run dev:setup`, not `npm run dev` directly for first startup

---
