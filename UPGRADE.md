# Upgrade Guide — bsBB Forum

How to upgrade an existing bsBB instance to a newer version.

---

## Before You Upgrade

1. **Take a backup** — always do this first. See [BACKUP.md](BACKUP.md).
2. **Read the release notes** — check for breaking changes or manual steps.
3. **Plan a maintenance window** — the upgrade takes 2–5 minutes; the forum is briefly unavailable during restart.

---

## Standard Upgrade (No Breaking Changes)

This is the normal case — a new version with new features or bug fixes, but no schema changes that require manual steps.

```bash
# On your server, in the bsBB directory
git pull

# Rebuild the app and worker images
docker compose -f docker-compose.prod.yml build app worker

# Restart services (brief downtime during restart)
docker compose -f docker-compose.prod.yml up -d

# Apply any new database migrations
docker compose -f docker-compose.prod.yml exec app npm run db:migrate
```

Total time: under 5 minutes. Users may see a brief error page during the restart.

### Verify the Upgrade

```bash
# Check all services are running and healthy
docker compose -f docker-compose.prod.yml ps

# Check app logs for startup errors
docker compose -f docker-compose.prod.yml logs --since 5m app
```

Visit your forum and spot-check that everything works: load the forum index, view a thread, check the admin dashboard.

---

## If a Migration Fails

Migrations are applied with `npm run db:migrate`, which runs all pending Drizzle migration files in order. If a migration fails:

1. **Do not run it again immediately** — read the error first.
2. Check the migration file in `src/lib/db/migrations/` to understand what it was trying to do.
3. If the migration partially applied, you may need to manually fix the database state before retrying. This is rare — Drizzle migrations are transactional.

```bash
# Connect to the database to inspect state
docker compose -f docker-compose.prod.yml exec db psql -U forum forum

# View migration history
SELECT * FROM drizzle_migrations ORDER BY created_at DESC LIMIT 10;
```

If you're stuck, restore from backup and ask for help before retrying.

---

## Rolling Back

If the upgrade goes wrong and you need to roll back:

### Option 1 — Roll back code only (no schema changes in the failed version)

```bash
git log --oneline -10   # find the previous commit
git checkout <previous-commit-hash>
docker compose -f docker-compose.prod.yml build app worker
docker compose -f docker-compose.prod.yml up -d
```

### Option 2 — Roll back to a backup (schema changed, migration can't be reversed)

Drizzle migrations are not automatically reversible. If a migration ran and you need to undo it, restore from your pre-upgrade backup:

```bash
# Stop the running services
docker compose -f docker-compose.prod.yml down

# Check out the old code
git checkout <previous-version-tag-or-commit>

# Start only the database so we can restore into it
docker compose -f docker-compose.prod.yml up -d db

# Wait for it to be ready
docker compose -f docker-compose.prod.yml exec db pg_isready -U forum

# Drop and restore the database from backup
docker compose -f docker-compose.prod.yml exec db \
  psql -U forum -c "DROP DATABASE forum; CREATE DATABASE forum;"

gunzip -c /root/backups/forum-YYYY-MM-DD.sql.gz | \
  docker compose -f docker-compose.prod.yml exec -T db psql -U forum forum

# Rebuild and start everything
docker compose -f docker-compose.prod.yml build app worker
docker compose -f docker-compose.prod.yml up -d
```

---

## Upgrading Environment Variables

When new environment variables are added in a release, `setup.sh` won't automatically add them to an existing `.env`. Check the release notes or compare your `.env` against `.env.example` to see what's new:

```bash
diff .env .env.example
```

Add any missing variables to your `.env`, then restart the services:

```bash
docker compose -f docker-compose.prod.yml up -d
```

---

## Zero-Downtime Upgrades

The current setup does not support zero-downtime upgrades — there's a brief restart gap. For most self-hosted forums this is acceptable.

If you need zero downtime:
- Run two app instances behind Caddy (update `docker-compose.prod.yml` to add `deploy.replicas: 2`)
- Apply migrations before restarting (migrations must be backward-compatible with the old code)
- Do a rolling restart: bring up new containers before taking down old ones

This is significant added complexity and not documented here. At typical self-hosted scale, a 30-second maintenance window is fine.

---

## Keeping Docker Images Up to Date

Base images (`postgres:17-alpine`, `caddy:latest`) occasionally receive security updates. Update them periodically:

```bash
docker compose -f docker-compose.prod.yml pull db caddy
docker compose -f docker-compose.prod.yml up -d db caddy
```

The app and worker images are rebuilt from `Dockerfile.prod` — they inherit a Node.js base image. That gets updated when you rebuild with `docker compose build`.
