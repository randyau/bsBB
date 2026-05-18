# Deployment Guide — bsBB Forum

This guide walks you through deploying bsBB to production on your own server.

**For detailed script documentation, see [SCRIPTS.md](SCRIPTS.md#production-setup), especially `scripts/setup.sh`.**

## Prerequisites

- Linux server (Ubuntu 22.04+ recommended)
- Docker & Docker Compose installed
- Domain name (for SSL/TLS)
- Basic CLI familiarity
- **Required files present:**
  - `Caddyfile.prod` (at project root — reverse proxy config)
  - `docker-compose.prod.yml` (at project root — production services)

## Quick Start (5 minutes)

### 1. Clone Repository

```bash
git clone https://github.com/yourusername/bsBB.git
cd bsBB
npm install
```

### 2. Run First-Run Setup (Interactive)

```bash
bash scripts/setup.sh
```

This script (see [SCRIPTS.md](SCRIPTS.md#scriptssetupsh--first-run-deployment-setup)):
- Generates ATproto OAuth keypair
- Validates ATproto service account credentials
- Validates SMTP email configuration
- Creates `.env` with all secrets
- Logs everything to `logs/setup.log`

**Prompts for:**
- ATproto service handle (e.g., `notifications.yourforum.bsky.social`)
- ATproto app password (create at https://bsky.app/settings/app-passwords)
- SMTP host/port/user/password (Mailgun, SendGrid, etc.)
- Default forum visibility (public or members-only)

### 3. Start Production Services

```bash
docker compose -f docker-compose.prod.yml up -d
```

Services start:
- `app` — SvelteKit server on :3000
- `worker` — Notification queue processor
- `db` — PostgreSQL 17 on internal network
- `caddy` — Reverse proxy on ports 80/443

### 4. First User Login Becomes Admin

Visit `https://yourforum.com`, sign in with Bluesky. First user is auto-promoted to admin (one-time).

Done!

---

## Hosting Platforms

### Hetzner (Recommended for this scale)

**Instance:** CAX11 (Arm64, 2 vCPU, 4GB RAM, €3.29/mo)

1. Provision Ubuntu 22.04 instance
2. SSH in: `ssh root@<IP>`
3. Follow Quick Start above

### DigitalOcean

**Droplet:** Basic, 2GB RAM, $12/mo

1. Create Ubuntu 22.04 droplet
2. SSH in
3. Install Docker: `curl -fsSL https://get.docker.com | sh`
4. Follow Quick Start

### VPS (Linode, Vultr, etc.)

- Any Ubuntu 22.04+ instance works
- Install Docker via package manager or official installer
- Follow Quick Start

---

## SSL/TLS

Caddy (in docker-compose.prod.yml) automatically handles SSL via Let's Encrypt.

**Manual setup:**

1. Point domain DNS to server IP
2. Ensure port 80 is open (Let's Encrypt verification)
3. Caddy reads `DOMAIN` env var and auto-renews

---

## Backups

### Daily Backup Script

Create `/opt/bsbb-backup.sh`:

```bash
#!/bin/bash
DATE=$(date +%Y-%m-%d)
BACKUP_DIR="/backups"
mkdir -p $BACKUP_DIR

# Backup database
docker-compose -f /root/bsBB/docker-compose.prod.yml exec -T db \
  pg_dump -U forum forum | gzip > $BACKUP_DIR/forum-$DATE.sql.gz

# Upload to R2 (or B2)
rclone rcat r2:forum-backups/forum-$DATE.sql.gz < $BACKUP_DIR/forum-$DATE.sql.gz

# Keep 7 days rolling
find $BACKUP_DIR -name "forum-*.sql.gz" -mtime +7 -delete
```

Add to crontab:

```bash
0 2 * * * /opt/bsbb-backup.sh
```

### Restore from Backup

```bash
gunzip -c backup-2026-05-16.sql.gz | \
  docker-compose -f docker-compose.prod.yml exec -T db psql -U forum
```

---

## Monitoring

### Health Checks

All services have health checks in docker-compose.prod.yml:

```bash
docker-compose -f docker-compose.prod.yml ps
```

### Logs

```bash
# App logs
docker-compose -f docker-compose.prod.yml logs -f app

# Worker logs
docker-compose -f docker-compose.prod.yml logs -f worker

# Database logs
docker-compose -f docker-compose.prod.yml logs -f db
```

### Metrics

Monitor via:
- Server CPU/RAM: `top` or cloud provider dashboard
- Disk space: `df -h`
- Database size: `docker-compose exec db psql -U forum -c "SELECT pg_size_pretty(pg_database_size('forum'));"`

---

## Scaling

### Horizontal Scaling (Multiple App Instances)

For load balancing, you can run multiple app instances behind Caddy:

```yaml
# docker-compose.prod.yml (modified)
app:
  # ... (same as above)
  deploy:
    replicas: 2
```

Caddy automatically load-balances.

### Database Scaling

For larger deployments, consider:
- Managed PostgreSQL (RDS, DigitalOcean, Heroku)
- Read replicas
- Connection pooling (pgBouncer)

---

## Troubleshooting

### "Connection refused"

Check if services are running:

```bash
docker-compose -f docker-compose.prod.yml ps
```

### "Database migration failed"

Ensure database is ready:

```bash
docker-compose -f docker-compose.prod.yml logs db
```

### "SSL certificate not generated"

Ensure:
- Domain DNS points to server
- Port 80 is open
- Check Caddy logs: `docker-compose logs caddy`

### "Worker not processing notifications"

Check worker logs:

```bash
docker-compose -f docker-compose.prod.yml logs worker
```

Ensure env vars are set (SMTP_HOST, ATPROTO_SERVICE_*).

---

## Updates

To update to the latest version:

```bash
git pull
docker-compose -f docker-compose.prod.yml build app worker
docker-compose -f docker-compose.prod.yml up -d
docker-compose -f docker-compose.prod.yml exec app npm run db:migrate
```

Two-minute deploy with zero downtime (rolling updates).

---

## Next Steps

1. **Configure email notifications** — Test SMTP connection
2. **Set up ATproto service account** — For Bluesky DM notifications
3. **Create forum categories** — Via admin SQL interface
4. **Invite users** — Share your domain
5. **Monitor logs** — Keep tabs on errors the first week

---

## Support

- **Issues:** GitHub Issues
- **Questions:** GitHub Discussions
- **Security:** Report privately to maintainers

See **CLAUDE.md** for architecture & design rationale.
