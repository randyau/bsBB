# bsBB — ATproto Forum

A modern, self-hosted threaded discussion forum built on ATproto and Bluesky identity. No traditional user accounts — everyone signs in with their Bluesky identity. Built with SvelteKit, PostgreSQL, and Docker.

**Status:** Phases 1–13 complete. Production-ready. See [ROADMAP.md](ROADMAP.md) for history.

**📖 Documentation:**
- **[QUICKSTART.md](QUICKSTART.md)** — Deploy to a live server in 10 minutes
- **[DEPLOYMENT.md](DEPLOYMENT.md)** — Full production deployment guide with prerequisites and troubleshooting
- **[CLAUDE.md](CLAUDE.md)** — Architecture decisions, tech stack, and core requirements
- **[PATTERNS.md](PATTERNS.md)** — Code style guide and component patterns
- **[ADMIN_GUIDE.md](ADMIN_GUIDE.md)** — Admin panel walkthrough
- **[SCRIPTS.md](SCRIPTS.md)** — Helper scripts reference

## Why bsBB?

- **Identity via ATproto/Bluesky** — Sign in with your Bluesky account, no separate password
- **Markdown-only posts** — No WYSIWYG bloat; clean formatting with live preview
- **Flat conversation model** — Chronological replies with quote/reference links (proven to scale better than nesting)
- **Full moderation tooling** — Ban users, lock/pin threads, soft-delete posts, approval queue, audit log
- **Easy to self-host** — Single Docker Compose deployment, automated setup script
- **Open source** — MIT license, zero proprietary dependencies

---

## Quick Start (Local Development)

### Prerequisites

- **Docker & Docker Compose** — Required for the database container
- **Node.js 20+** — For running the app locally
- **Git** — To clone the repo

### 1. Clone and Install

```bash
git clone https://github.com/yourusername/bsBB.git
cd bsBB
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Open `.env` and set at minimum:

```env
# Generate with: openssl rand -hex 32
SESSION_SECRET=your-random-secret-here
ENCRYPTION_KEY=your-other-random-secret-here
```

Leave `DATABASE_URL` as-is — it matches the dev database container.

> **ATproto OAuth requires a public HTTPS URL and cannot work on localhost.** For local development, use the dev login bypass below instead of real OAuth.

### 3. Start Everything

```bash
npm run dev:setup
```

This one command: starts the PostgreSQL container, runs migrations, seeds test users, and launches the dev server at **http://localhost:5173**.

Press `Ctrl+C` to stop the server and shut down the database container.

### 4. Log In

Visit the dev login page:

```
http://localhost:5173/dev/login
```

| Handle | Role |
|---|---|
| `dev-admin.test` | admin |
| `dev-moderator.test` | member |
| `dev-member.test` | member |
| `dev-banned.test` | banned |

**Log in as `dev-admin.test` first** — the very first login on a fresh database auto-promotes that user to admin.

### 5. What's Available

- **Forum index:** http://localhost:5173 — browse, post, reply
- **Search:** http://localhost:5173/search — full-text and `author:handle` search
- **User profile:** http://localhost:5173/user/[handle]
- **Settings:** http://localhost:5173/settings — notifications, account management
- **Admin dashboard:** http://localhost:5173/admin — users, forums, threads, roles, mod log

### Manual Setup (Without the Script)

```bash
docker compose -f docker/docker-compose.dev.yml up -d
bash scripts/migrate.sh
npx tsx scripts/seed.ts
npx tsx scripts/seed-dev-users.ts
npm run dev
```

---

## Development

### Project Structure

```
bsBB/
├── src/
│   ├── routes/                 # SvelteKit routes (pages, API endpoints)
│   │   ├── f/[forumSlug]/      # Forum and thread views
│   │   ├── admin/              # Admin dashboard
│   │   ├── (auth)/             # Auth routes (dev login, logout, OAuth callback)
│   │   └── api/preview/        # Markdown preview endpoint
│   ├── lib/
│   │   ├── db/                 # Drizzle ORM schema, migrations, db instance
│   │   ├── auth/               # Session management, ATproto OAuth, profile sync
│   │   ├── abuse/              # Rate limiting
│   │   ├── markdown/           # Markdown pipeline, OG fetch, slug generation
│   │   ├── notifications/      # Email and Bluesky DM dispatch
│   │   ├── crypto/             # AES-256 encryption for chat session tokens
│   │   └── permissions/        # canRead() and canPost() with forum permission chain
│   ├── hooks.server.ts         # Session hydration, banned user redirect
│   └── +layout.svelte          # Root layout with nav and theme toggle
├── docker/
│   ├── docker-compose.dev.yml  # Dev: PostgreSQL only
│   └── caddy-static/           # Static files served by Caddy (client-metadata.json)
├── docker-compose.prod.yml     # Production: app + worker + db + caddy
├── Dockerfile.prod             # Production image
├── Caddyfile.prod              # Caddy reverse proxy config
├── scripts/
│   ├── dev.sh                  # One-command dev startup
│   ├── setup.sh                # First-run production setup
│   ├── migrate.sh              # Run Drizzle migrations
│   ├── seed.ts                 # Seed instance_settings + General forum
│   ├── seed-dev-users.ts       # Seed fake users for dev login
│   └── gen-keypair.js          # Generate ATproto OAuth keypair
└── docs/
    CLAUDE.md                   # Full spec and architecture decisions
    PATTERNS.md                 # Code style and conventions
    ARCHITECTURE.md             # Technical design and schema
    DEPLOYMENT.md               # Production deployment guide
    QUICKSTART.md               # Fast path: zero to running
    UPGRADE.md                  # How to upgrade an existing instance
    BACKUP.md                   # Backup and restore procedures
    ADMIN_GUIDE.md              # Admin operations reference
    USER_GUIDE.md               # User features reference
    SCRIPTS.md                  # Helper scripts reference
    ROADMAP.md                  # Phase history and status
```

### Running Tests

```bash
npm test           # Run all unit tests
npm run test:watch # Watch mode
npm run check      # TypeScript + Svelte type check
```

### Updating Database Schema

1. Edit `src/lib/db/schema.ts`
2. Generate a migration: `npx drizzle-kit generate`
3. Review the generated SQL in `src/lib/db/migrations/`
4. Apply it: `npm run db:migrate`

### Building for Production

```bash
npm run build
npm run preview   # Test the production build locally
```

---

## Key Concepts

### Authentication Flow

1. User clicks "Sign in with Bluesky"
2. Redirected to their PDS (Personal Data Server)
3. After approval, OAuth callback to `/callback`
4. Session created: 32-byte random token → SHA-256 hash in database, token in `HttpOnly` cookie
5. First login auto-promotes user to admin (gated by `instance_settings.first_admin_claimed`)

### Forum Permissions

- **Role hierarchy:** `guest` → `member` → `moderator` → `admin`
- **Global roles** (`users.global_role`): `member`, `admin`, `banned`
- **Per-forum roles** (`user_forum_roles`): `moderator`
- **Permission inheritance:** walks up the forum parent chain until explicit permissions are found

### Content & Markdown

- Posts are markdown-only; server-side render via `unified` + `remark` + `rehype`
- Sanitized before storage (XSS protection)
- Embedded media fetched once at post time (OpenGraph metadata)
- Edits preserved in `post_revisions` (append-only audit trail)

### Moderation

- **Ban:** Sets `users.global_role = 'banned'`, redirects user to `/banned`
- **Post management:** Hide, delete, restore posts; edit as moderator with reason logging
- **Thread management:** Lock/unlock, pin/unpin, move to different forum
- **Approval queue:** Per-forum setting to require approval for posts from new accounts
- **All actions logged:** `mod_log` with moderator, action, target, reason, timestamp

---

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for the complete guide. Quick version:

```bash
git clone https://github.com/yourusername/bsBB.git
cd bsBB
npm install
bash scripts/setup.sh
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml exec app npm run db:migrate
```

The first user to log in is automatically promoted to admin.

**Recommended hosting:** Hetzner CAX11 (ARM64, 2 vCPU, 4GB RAM, ~€3.29/mo)

---

## Technology Stack

| Layer | Tech | Why |
|---|---|---|
| **Framework** | SvelteKit + `adapter-node` | SSR mandatory for SEO; monolith (no API boundary needed) |
| **Database** | PostgreSQL 17 | Relational structure; `tsvector` search; `JSONB` for metadata |
| **ORM** | Drizzle | TypeScript-native, thin, generates clean SQL |
| **Auth** | ATproto OAuth + custom sessions | Bluesky identity; 32-byte token + SHA-256, Postgres-backed |
| **Markdown** | unified + remark + rehype | Server-side rendering, sanitized before storage |
| **CSS** | Tailwind CSS v4 + CSS custom properties | Utility-first; custom properties for light/dark theming |
| **Reverse proxy** | Caddy | Automatic HTTPS, simple config |

---

## Documentation

| Document | Purpose |
|---|---|
| [QUICKSTART.md](QUICKSTART.md) | Zero to running in 5 minutes |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Full production deployment guide |
| [UPGRADE.md](UPGRADE.md) | How to upgrade an existing instance |
| [BACKUP.md](BACKUP.md) | Backup, restore, and disaster recovery |
| [ADMIN_GUIDE.md](ADMIN_GUIDE.md) | Admin operations: users, forums, moderation |
| [USER_GUIDE.md](USER_GUIDE.md) | User features: posting, search, notifications |
| [SCRIPTS.md](SCRIPTS.md) | All helper scripts and when to use them |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Technical design, schema, stack decisions |
| [PATTERNS.md](PATTERNS.md) | Code style and conventions (read before coding) |
| [CLAUDE.md](CLAUDE.md) | Full spec and architecture decisions |

---

## Troubleshooting

### "Can't connect to database"
```bash
docker compose -f docker/docker-compose.dev.yml logs db
docker compose -f docker/docker-compose.dev.yml ps
```

### "ATPROTO_PRIVATE_KEY not set"
Use the dev login bypass for local development — real ATproto OAuth requires a public HTTPS URL.

### "INSERT ... ON CONFLICT" errors
Ensure migrations ran: `npm run db:migrate`

### Database state got messed up (dev only)
```bash
docker compose -f docker/docker-compose.dev.yml down -v
npm run dev:setup
```

---

## Contributing

1. Fork the repo and create a feature branch
2. Follow the patterns in [PATTERNS.md](PATTERNS.md)
3. Test locally: `npm run check && npm test`
4. Verify UI changes manually in a browser
5. Open a pull request with a clear description

---

## License

MIT — See LICENSE file.
