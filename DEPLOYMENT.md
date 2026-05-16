# Deployment Guide — bsBB Forum

This guide walks you through deploying bsBB to production on your own server.

## Prerequisites

- Linux server (Ubuntu 22.04+ recommended)
- Docker & Docker Compose installed
- Domain name (for SSL/TLS)
- Basic CLI familiarity

## Quick Start (5 minutes)

### 1. Clone and Configure

```bash
git clone https://github.com/yourusername/bsBB.git
cd bsBB
cp .env.example .env
```

### 2. Generate Secrets

```bash
# Generate encryption key (32 bytes)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))" >> .env

# Generate session secret (32+ bytes)
node -e "console.log('SESSION_SECRET=' + require('crypto').randomBytes(32).toString('hex'))" >> .env
```

### 3. Edit Environment

```bash
nano .env
```

Required variables:
```env
PUBLIC_BASE_URL=https://yourforum.com
DOMAIN=yourforum.com

# Database
DB_USER=forum
DB_PASSWORD=<generate strong password>
DB_NAME=forum

# ATproto OAuth
ATPROTO_PRIVATE_KEY=<from setup script or manual generation>

# Email (SMTP)
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_USER=postmaster@yourdomain.com
SMTP_PASS=<password>
SMTP_FROM=noreply@yourforum.com

# Service account (for DM notifications, optional)
ATPROTO_SERVICE_HANDLE=notifications@yourforum.bsky.social
ATPROTO_SERVICE_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx
```

### 4. Start Services

```bash
docker-compose -f docker-compose.prod.yml up -d
```

### 5. Initialize Database

```bash
docker-compose -f docker-compose.prod.yml exec app npm run db:migrate
docker-compose -f docker-compose.prod.yml exec app npm run db:seed
```

### 6. Create First Admin

```bash
docker-compose -f docker-compose.prod.yml exec app npm run admin-promote -- <did>
```

Done! Visit `https://yourforum.com`

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
