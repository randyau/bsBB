# Backup & Restore — bsBB Forum

Everything important in bsBB is in the PostgreSQL database. Back that up and you can recover from anything.

---

## What to Back Up

| Item | Where | How |
|---|---|---|
| Database | Docker volume `db_data` | `pg_dump` (see below) |
| `.env` file | Project root | Copy to secure location |
| SSL certificates | Caddy manages these | Automatically renewed; no manual backup needed |

`client-metadata.json` is rendered dynamically by the app from `.env` values (`ATPROTO_CLIENT_ID`, `ATPROTO_PUBLIC_KEY`, `PUBLIC_BASE_URL`) — there's no separate file to back up.

The code itself lives in git — just re-clone. The only irreplaceable data is the database and your `.env`.

---

## Automated Daily Backups

### Step 1 — Create the backup script

Create `/root/bsbb-backup.sh`:

```bash
#!/bin/bash
set -e

BSBB_DIR="/root/bsBB"   # adjust if your repo is elsewhere
BACKUP_DIR="/root/backups"
DATE=$(date +%Y-%m-%d)

mkdir -p "$BACKUP_DIR"

# Dump the database and compress it
docker compose -f "$BSBB_DIR/docker-compose.prod.yml" exec -T db \
  pg_dump -U forum forum | gzip > "$BACKUP_DIR/forum-$DATE.sql.gz"

echo "Backup complete: $BACKUP_DIR/forum-$DATE.sql.gz"

# Remove backups older than 7 days
find "$BACKUP_DIR" -name "forum-*.sql.gz" -mtime +7 -delete

echo "Old backups pruned. Current backups:"
ls -lh "$BACKUP_DIR"
```

Make it executable:
```bash
chmod +x /root/bsbb-backup.sh
```

Test it:
```bash
/root/bsbb-backup.sh
ls -lh /root/backups/
```

### Step 2 — Schedule with cron

```bash
crontab -e
```

Add this line (runs daily at 2am):
```
0 2 * * * /root/bsbb-backup.sh >> /root/backups/backup.log 2>&1
```

### Step 3 — Verify backups are running

After a day or two, check:
```bash
ls -lh /root/backups/
cat /root/backups/backup.log
```

---

## Offsite Backup (Recommended)

Keeping backups on the same server as the database is better than nothing, but won't help if the server itself is lost. Upload backups to cloud storage.

### Option A — Cloudflare R2

R2 has a generous free tier (10GB free, no egress fees).

1. Create an R2 bucket in your Cloudflare dashboard
2. Create an API token with R2 write permissions
3. Install `rclone`: `curl https://rclone.org/install.sh | sudo bash`
4. Configure rclone: `rclone config` (follow prompts for Cloudflare R2)
5. Add to your backup script:

```bash
# After the pg_dump line, add:
rclone copy "$BACKUP_DIR/forum-$DATE.sql.gz" r2:your-bucket-name/
```

### Option B — Backblaze B2

Similar to R2. Free tier: 10GB storage, 1GB/day egress.

1. Create a B2 bucket at backblaze.com
2. Create an app key with write access
3. Install and configure rclone for B2
4. Add to backup script:

```bash
rclone copy "$BACKUP_DIR/forum-$DATE.sql.gz" b2:your-bucket-name/
```

### Option C — Simple SCP to another server

If you have a second server or a local machine:

```bash
scp "$BACKUP_DIR/forum-$DATE.sql.gz" user@backup-server:/backups/
```

---

## Manual Backup

Take a one-off backup at any time (useful before upgrades):

```bash
docker compose -f docker-compose.prod.yml exec -T db \
  pg_dump -U forum forum | gzip > /root/backups/forum-pre-upgrade.sql.gz
```

---

## Restore from Backup

### Restoring on the Same Server

If you need to restore the database on the same running instance:

```bash
# Stop the app so no writes happen during restore
docker compose -f docker-compose.prod.yml stop app worker

# Drop and recreate the database
docker compose -f docker-compose.prod.yml exec db \
  psql -U forum -c "DROP DATABASE forum; CREATE DATABASE forum;"

# Restore from backup
gunzip -c /root/backups/forum-YYYY-MM-DD.sql.gz | \
  docker compose -f docker-compose.prod.yml exec -T db psql -U forum forum

# Restart everything
docker compose -f docker-compose.prod.yml start app worker
```

### Full Disaster Recovery (New Server)

Use this when recovering to a completely fresh server.

**Estimated time: 20–30 minutes**

1. **Provision a new server** (Ubuntu 22.04)

2. **Install Docker:**
   ```bash
   curl -fsSL https://get.docker.com | sh
   sudo usermod -aG docker $USER
   # Log out and back in
   ```

3. **Clone the repository:**
   ```bash
   git clone https://github.com/randyau/bsBB.git
   cd bsBB
   ```

4. **Restore your `.env` file:**
   Copy your backed-up `.env` to the project root. `client-metadata.json` is rendered dynamically from it — nothing else to restore.
   
   If you don't have your `.env`, you can re-run `bash scripts/setup.sh` — but you'll need to generate new secrets, and existing user sessions will be invalidated.

5. **Point DNS to the new server's IP.** (May take a few minutes to propagate.)

6. **Start services:**
   ```bash
   docker compose -f docker-compose.prod.yml up -d
   ```

7. **Restore the database:**
   ```bash
   # Wait for the database to be healthy
   docker compose -f docker-compose.prod.yml exec db pg_isready -U forum
   
   # Restore
   gunzip -c /path/to/forum-backup.sql.gz | \
     docker compose -f docker-compose.prod.yml exec -T db psql -U forum forum
   ```

8. **Verify everything works:** visit your domain, log in, check the admin dashboard.

---

## Verifying a Backup

Don't wait for a disaster to find out your backups are corrupt. Test them periodically:

```bash
# Check the backup file is valid gzip
gunzip -t /root/backups/forum-2026-05-18.sql.gz && echo "OK"

# Check the SQL looks reasonable (first 20 lines)
gunzip -c /root/backups/forum-2026-05-18.sql.gz | head -20
```

For a full restore test, spin up a temporary local database:

```bash
docker run --rm -e POSTGRES_PASSWORD=test -e POSTGRES_USER=forum \
  -e POSTGRES_DB=forum -p 5433:5432 -d postgres:17-alpine

sleep 3

gunzip -c /root/backups/forum-2026-05-18.sql.gz | \
  psql postgresql://forum:test@localhost:5433/forum

# Check row counts
psql postgresql://forum:test@localhost:5433/forum \
  -c "SELECT schemaname, tablename, n_live_tup FROM pg_stat_user_tables ORDER BY n_live_tup DESC;"

# Clean up
docker stop $(docker ps -q --filter ancestor=postgres:17-alpine)
```

---

## Recovery Time Objectives

| Scenario | Expected Recovery Time |
|---|---|
| Restore to same server | 5–10 minutes |
| Full recovery to new server | 20–30 minutes |
| DNS propagation (variable) | 0–60 minutes |

**Recovery Point Objective (RPO):** Up to 24 hours of data loss with daily backups. For lower RPO, run backups more frequently (e.g., every 6 hours via cron).
