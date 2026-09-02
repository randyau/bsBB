# Deployment Guide — bsBB Forum

This guide walks you through deploying bsBB to a fresh Linux server.

**New here?** Start with [QUICKSTART.md](QUICKSTART.md) for a faster path.  
**Already running?** See [UPGRADE.md](UPGRADE.md) for upgrading an existing instance.  
**Backup questions?** See [BACKUP.md](BACKUP.md).

---

## Prerequisites

- **Linux server** (Ubuntu 22.04+ recommended) — all production scripts are Linux bash scripts
- **Docker and Docker Compose** installed on the server
- **Node.js 20+** and npm installed on the server (for running `scripts/setup.sh`)
- **Git** installed on the server (to clone the repo)
- **Domain name** pointed at your server's IP — **required, not optional.** ATproto OAuth will not work without a real public domain; you cannot self-host on a bare IP address or localhost
- Bluesky account for the notification bot (optional but recommended)
- SMTP credentials for email alerts (optional)

> **Running setup from Windows?** Use a WSL2 terminal to run the bash scripts, or SSH directly into your Linux server and run them there. The scripts target Linux and are not designed for PowerShell or Command Prompt.

> **Running as root?** Many VPS providers (Hetzner, DigitalOcean) log you in as root by default. That's fine — the setup and Docker commands all work as root. The `scripts/start-prod.sh` helper rejects root as a safety precaution; if you're root, run `docker compose -f docker-compose.prod.yml up -d` directly instead.

> **Firewall:** Make sure ports 22 (SSH), 80 (HTTP), and 443 (HTTPS) are open. On Hetzner, the default firewall allows all traffic — no changes needed. On DigitalOcean or if you've enabled `ufw`: `sudo ufw allow 22 && sudo ufw allow 80 && sudo ufw allow 443 && sudo ufw enable`

---

## Step 1 — Provision a Server

**Recommended: Hetzner CX22** (x86_64, 2 vCPU, 4GB RAM, ~€4/mo)

**Minimum: 2 vCPU, 2 GB RAM.** The Python worker (~30 MB idle) replaced the previous Node.js worker, significantly reducing baseline memory. A 2 GB VPS is viable; a 4 GB VPS is comfortable.

Other good options: Hetzner CAX11 (ARM64, 2 vCPU, 4GB RAM, ~€3.29/mo), DigitalOcean Basic ($18/mo, 2 vCPU/4GB), any Ubuntu 22.04+ VPS with ≥4 GB RAM.

### Configure Swap

Hetzner and most cloud VPS providers provision no swap by default. Without swap, an OOM event kills processes immediately rather than degrading gracefully. Add a 2 GB swapfile:

```bash
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

Verify with `free -h`. This is a safety net — normal operation should never touch swap on a 4 GB machine.

### Install Docker

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Log out and back in so the group change takes effect
```

Verify: `docker ps` should work without sudo.

### Install Node.js 20+

**Using NodeSource repository (recommended for Ubuntu/Debian):**

```bash
# Add NodeSource repository
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# Install Node.js (includes npm)
sudo apt-get install -y nodejs
```

**Verify installation:**

```bash
node --version  # Should be v20.x or higher
npm --version   # Should be 10.x or higher
```

**Alternative: Using nvm** (if you prefer version management):

```bash
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/HEAD/install.sh | bash

# Reload shell
source ~/.bashrc

# Install Node.js 20
nvm install 20
nvm use 20

# Verify
node --version
npm --version
```

---

## Step 2 — Clone the Repository

```bash
git clone https://github.com/randyau/bsBB.git
cd bsBB
```

> **Note:** Do not run `npm install` on the server — the app runs entirely inside Docker. Node.js on the server is only needed for `scripts/setup.sh`.

---

## Step 3 — Run First-Run Setup

```bash
bash scripts/setup.sh
```

This interactive script:

1. Generates a P-256 keypair for ATproto OAuth
2. Generates a random `SESSION_SECRET`
3. Prompts you for your configuration
4. Writes a complete `.env` file (`client-metadata.json` is served dynamically by the app from these values — nothing else to generate)

**You'll be asked for:**

| Prompt | What to enter |
|---|---|
| Public base URL | `https://yourforum.com` (no trailing slash) |
| ATproto service handle | The Bluesky handle of your notification bot account |
| ATproto app password | Create one at https://bsky.app/settings/app-passwords |
| SMTP host | Your SMTP provider (Mailgun, SendGrid, Postmark, etc.) |
| SMTP port | Usually `587` |
| SMTP user/password | Your SMTP credentials |
| SMTP from address | The `From:` address for admin emails |
| Admin email | Where moderation alerts get sent |
| Default forum visibility | `public` or `members-only` |

**Don't have a notification bot yet?** You can skip those prompts and set them up later. The forum works without them — DM notifications just won't send.

**Don't have SMTP yet?** Same: skip and configure later. The forum works without email; admins won't get email alerts.

### Using a Subdomain?

If you're deploying to a **subdomain** (e.g., `forum.example.com` instead of `example.com`), that works fine. Just enter it as your Public Base URL:

```
PUBLIC_BASE_URL=https://forum.example.com
```

This controls:
- OAuth redirect URI: `https://forum.example.com/callback`
- Client metadata: `https://forum.example.com/client-metadata.json`
- Session cookies: automatically scoped to the subdomain

Everything else (Bluesky bot, SMTP, DNS) works identically with subdomains.

---

## Step 4 — Configure DNS

**A domain is required.** ATproto OAuth uses your domain as the OAuth client identifier (`client-metadata.json` must be publicly reachable at a real HTTPS URL). A bare IP address or `localhost` will not work.

### Get your server's IP

```bash
curl -4 ifconfig.me
```

### Add DNS records

At your domain registrar or DNS provider (Cloudflare, Namecheap, etc.), add:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | `yourforum.com` | `<your server IP>` | 300 |
| A | `www` | `<your server IP>` | 300 (optional) |

If deploying to a **subdomain** (e.g., `forum.example.com`):

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | `forum` | `<your server IP>` | 300 |

> **Cloudflare users:** Set the record to **DNS only** (grey cloud, not proxied) during initial setup so Caddy can complete the Let's Encrypt ACME challenge. You can enable proxying later if desired, but it's not required and adds complexity.

TTL 300 (5 minutes) lets you iterate quickly during setup. You can raise it to 3600+ once everything is confirmed working.

### Verify propagation

DNS changes can take a few minutes to propagate. Check before proceeding:

```bash
dig +short yourforum.com
# Should return your server's IP
```

Or use `nslookup yourforum.com` if `dig` is not installed. Do not start services until this resolves correctly — Caddy's automatic HTTPS will fail if DNS is not pointing at the server.


---
## (Optional) Set up Bluesky Notification account

Once you create a Bluesky account for sending notifications, you need to fill out a proper profile so that people know that it is a bot. How you specifically do so is up to you.

Doing this helps people, **and the Bluesky Moderation Team**, know that your account is not a spam account. Otherwise the bot may be banned or blocked from using DMs. (As us how we know.)

Info you may consider sharing:

* Link to your forum
* A profile picture
* How this is an opt-in feature
* How users can disable it in your notification settings

If you do get an issue with the moderator team, sending an email explaining the situation can resolve it.



---

## Step 5 — Start Production Services

```bash
docker compose -f docker-compose.prod.yml up -d
```

There is also a helper script (`bash scripts/start-prod.sh`) that does the same thing with extra health-check output, but it refuses to run as root. If you're logged in as root, use the `docker compose` command directly.

This starts four services:
- `db` — PostgreSQL 17 (internal network only)
- `app` — SvelteKit server (internal network only)
- `worker` — Notification queue processor (internal network only)
- `caddy` — Reverse proxy on ports 80/443 (automatic HTTPS)

Check they're all running:
```bash
docker compose -f docker-compose.prod.yml ps
```

Docker Compose starts all containers with `restart: unless-stopped`, so they automatically restart on crash and come back up after a server reboot (once the Docker daemon itself starts, which the install step enables by default).

---

## Step 6 — Run Database Migrations

```bash
docker compose -f docker-compose.prod.yml exec app npm run db:migrate
```

This applies the schema to the database. Safe to run multiple times.

---

## Step 7 — First Login

Visit `https://yourforum.com` and sign in with Bluesky. **The first account to log in is automatically promoted to admin** — that's you.

After logging in:
1. Go to **Admin → Forums** to set up your forum categories
2. Go to **Admin → Settings** if you want to adjust visibility defaults
3. Invite your community

---

## Ongoing Operations

### Viewing Logs

```bash
# All services
docker compose -f docker-compose.prod.yml logs -f

# Just one service
docker compose -f docker-compose.prod.yml logs -f app
docker compose -f docker-compose.prod.yml logs -f worker
docker compose -f docker-compose.prod.yml logs -f caddy
```

### Checking Service Health

```bash
docker compose -f docker-compose.prod.yml ps
```

All services should show `healthy` or `Up`.

### Database Size

```bash
docker compose -f docker-compose.prod.yml exec db \
  psql -U forum -c "SELECT pg_size_pretty(pg_database_size('forum'));"
```

### Disk Space

```bash
df -h
docker system df
```

---

## Monitoring

There's no bundled monitoring setup — at Hetzner CAX11 scale you don't need it. The practical checks:

- **Is the forum up?** `curl -s -o /dev/null -w "%{http_code}" https://yourforum.com` → should be `200`
- **Service status?** `docker compose -f docker-compose.prod.yml ps`
- **Any errors?** `docker compose -f docker-compose.prod.yml logs --since 1h app`

If you want uptime monitoring, [UptimeRobot](https://uptimerobot.com) has a free tier that pings your URL every 5 minutes and emails you if it goes down.

---

## Backups

See [BACKUP.md](BACKUP.md) for the full backup and restore guide.

Quick setup — add this to your crontab (`crontab -e`):

```bash
0 2 * * * cd /root/bsBB && docker compose -f docker-compose.prod.yml exec -T db \
  pg_dump -U forum forum | gzip > /root/backups/forum-$(date +\%Y-\%m-\%d).sql.gz
```

---

## Updating

See [UPGRADE.md](UPGRADE.md) for the full upgrade guide. Short version:

```bash
git pull
docker compose -f docker-compose.prod.yml build app worker  # app=Node, worker=Python (separate images)
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml exec app npm run db:migrate
```

---

## SSL/TLS

Caddy handles this automatically. It:
- Gets a Let's Encrypt certificate for your domain
- Renews it before expiry
- Redirects HTTP to HTTPS

Requirements:
- Your domain's DNS must point to the server
- Port 80 must be open (used for Let's Encrypt verification)
- Port 443 must be open (HTTPS)

If SSL isn't working, check Caddy logs:
```bash
docker compose -f docker-compose.prod.yml logs caddy
```

---

## Troubleshooting

### Services won't start

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs
```

Look for `Exited` services — their logs will show what failed.

### "Cannot connect to database"

The `app` service waits for `db` to be healthy before starting. If it keeps failing:

```bash
docker compose -f docker-compose.prod.yml logs db
```

Common cause: `DB_PASSWORD` not set in `.env`.

### "Migration failed"

```bash
docker compose -f docker-compose.prod.yml exec app npm run db:migrate
```

If it errors, check the app logs:
```bash
docker compose -f docker-compose.prod.yml logs app
```

### SSL certificate not issued

```bash
docker compose -f docker-compose.prod.yml logs caddy
```

Common causes:
- DNS not yet pointing to this server (can take minutes to hours to propagate)
- Port 80 blocked by firewall

### ATproto OAuth not working

The `ATPROTO_CLIENT_ID` must exactly match the URL where `client-metadata.json` is publicly accessible. It's served dynamically by the SvelteKit app (`src/routes/client-metadata.json/+server.ts`) from `ATPROTO_CLIENT_ID`, `ATPROTO_PUBLIC_KEY`, and `PUBLIC_BASE_URL`; Caddy proxies the request through to the app.

Verify it's accessible:
```bash
curl https://yourforum.com/client-metadata.json
```

If it returns a 500, check that `ATPROTO_PUBLIC_KEY` is set in the app service's environment (`docker compose -f docker-compose.prod.yml config` will show it). If it returns a 404, check the Caddy config isn't still routing `/client-metadata.json` to a static file.

### Worker not sending notifications

```bash
docker compose -f docker-compose.prod.yml logs worker
```

Check that `ATPROTO_SERVICE_HANDLE`, `ATPROTO_SERVICE_APP_PASSWORD`, and SMTP vars are all set in `.env`.

The worker is a Python 3.12 process (`worker/worker.py`). It makes three HTTP calls to Bluesky per DM:
1. `POST https://bsky.social/xrpc/com.atproto.server.createSession` — App Password login; response includes a `didDoc` with the account's real PDS URL
2. `GET <pds_url>/xrpc/chat.bsky.convo.getConvoForMembers` — get/create conversation (requires `atproto-proxy: did:web:api.bsky.chat#bsky_chat` header)
3. `POST <pds_url>/xrpc/chat.bsky.convo.sendMessage` — send the message

**Important:** calls 2 and 3 must go to the account's actual PDS shard (extracted from the `didDoc` in step 1), not to `bsky.social` directly. Sending to `bsky.social` returns `MethodNotImplemented` because its load balancer does not honour the `atproto-proxy` header.

If DMs are failing, check:
- App Password is still valid and has "Allow access to your direct messages" enabled (Bluesky Settings → App Passwords)
- `ATPROTO_SERVICE_HANDLE` and `ATPROTO_SERVICE_APP_PASSWORD` are set correctly in `.env`

---

## Security Notes

- Only Caddy (ports 80/443) is exposed to the internet. All other services are on an internal Docker network.
- The database has no external port binding — only the `app` and `worker` containers can reach it.
- `SESSION_SECRET` is generated randomly by `setup.sh`. Never share it.
- Content is sanitized before storage — no XSS from user-generated markdown.

---

## Support

- **Issues:** [github.com/randyau/bsBB/issues](https://github.com/randyau/bsBB/issues)
- **Questions:** [github.com/randyau/bsBB/discussions](https://github.com/randyau/bsBB/discussions)
- **Architecture rationale:** [CLAUDE.md](CLAUDE.md)
