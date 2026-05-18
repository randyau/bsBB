# bsBB – ATproto Forum

A modern, self-hosted threaded discussion forum built on ATproto and Bluesky identity. No traditional user accounts—everyone signs in with their Bluesky identity. Built with SvelteKit, PostgreSQL, and Docker.

**Status:** ✅ PHASES 1–9 COMPLETE (70+ commits, production-ready) — Full feature set with custom roles, user post management, notification preferences, unread tracking, thread subscriptions, post/thread moving, and comprehensive design system

## Why bsBB?

- **Identity via ATproto/Bluesky** – Sign in with your Bluesky account, no separate password
- **Simple markdown-only posts** – No WYSIWYG bloat; users control their formatting
- **Flat conversation model** – Chronological replies with quote/reference links (proven to scale better than nesting)
- **Full moderation tooling** – Ban users, lock/pin threads, soft-delete posts, audit log all actions
- **Easy to self-host** – Single Docker Compose deployment, automated setup script
- **Open source** – MIT license, zero proprietary dependencies

## Quick Start (Local Development)

### Prerequisites

- **Docker & Docker Compose** – Required for the database container
- **Node.js 20+** – For running the app and tooling locally
- **Git** – To clone the repo

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
# Generate a random 32+ character string
SESSION_SECRET=your-random-secret-here

# Dev auth bypass — enables http://localhost:5173/dev/login
DEV_AUTH_ENABLED=true
```

Leave `DATABASE_URL` as-is (`postgresql://forum:forum@localhost:5432/forum`) — this matches the dev database container.

> **ATproto OAuth** requires a public HTTPS URL and cannot work on localhost. For local development, `DEV_AUTH_ENABLED=true` gives you a dev login page with pre-seeded test users. Use real OAuth only when deploying to a server.

### 3. Start Everything

The dev script starts the database, runs migrations, seeds test users, and launches the dev server:

```bash
./scripts/dev.sh
```

This will:
1. Start a PostgreSQL container (`docker/docker-compose.dev.yml`)
2. Wait for the database to be healthy
3. Run schema migrations
4. Seed dev users for the login bypass
5. Start the SvelteKit dev server at **http://localhost:5173**

Press `Ctrl+C` to stop the server and shut down the database container.

> **First run is slow** (~20 seconds) due to Vite compiling. Subsequent starts are faster.

### 4. Log In and Explore

Visit the dev login page and select a test user:

```
http://localhost:5173/dev/login
```

Available test users:

| Handle | Role |
|---|---|
| `dev-admin.test` | admin |
| `dev-moderator.test` | member (promote to forum mod manually) |
| `dev-member.test` | member |
| `dev-banned.test` | banned |

**Log in as `dev-admin.test` first** — the very first login on a fresh database auto-promotes that user to admin via `instance_settings.first_admin_claimed`.

### 5. What's Available

- **Forum**: http://localhost:5173 (create threads, reply, quote posts)
- **User profiles**: http://localhost:5173/user/[handle] (view user posts, settings, notification preferences)
- **User post management**: http://localhost:5173/user/[handle]/manage-posts (hide/delete/restore own posts)
- **Settings**: http://localhost:5173/settings (notification preferences, account management)
- **Search**: http://localhost:5173/search (full-text search across posts)
- **Admin dashboard**: http://localhost:5173/admin (admin only)
  - User management (ban/promote/demote, manage user posts)
  - Forum management (reorder, assign moderators, permissions)
  - Roles management (create custom roles, assign users)
  - Thread management (lock/pin threads)
  - SQL query interface (SELECT-only)
  - Mod log viewer (append-only audit trail)

### Manual Setup (Without the Script)

If you prefer to run steps individually:

```bash
# Start just the database
docker compose -f docker/docker-compose.dev.yml up -d

# Run schema migrations
bash scripts/migrate.sh

# Seed instance settings + General forum (first time only)
npx tsx scripts/seed.ts

# Seed dev login test users (first time only)
npx tsx scripts/seed-dev-users.ts

# Start the dev server
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
│   │   ├── admin/              # Admin dashboard (users, threads, posts, mod log, query)
│   │   ├── (auth)/             # Auth routes (dev login, logout, OAuth callback)
│   │   └── api/preview/        # Markdown preview endpoint
│   ├── lib/
│   │   ├── db/                 # Drizzle ORM schema, migrations, and db instance
│   │   ├── auth/               # Session management, ATproto OAuth, profile sync
│   │   ├── abuse/              # Rate limiting (atomic PostgreSQL upserts)
│   │   ├── markdown/           # Markdown render pipeline, OG fetch, slug generation
│   │   ├── notifications/      # Email and Bluesky DM dispatch
│   │   ├── crypto/             # AES-256 encryption for chat session tokens
│   │   └── permissions/        # canRead() and canPost() with forum permission chain
│   ├── app.d.ts                # Locals type (user, sessionId)
│   ├── hooks.server.ts         # Session hydration, banned user redirect
│   └── +layout.svelte          # Root layout with nav and theme toggle
├── docker/
│   ├── docker-compose.dev.yml  # Dev: PostgreSQL only (run app with npm run dev)
│   ├── docker-compose.yml      # Staging: app + db + caddy
│   └── Dockerfile
├── docker-compose.prod.yml     # Production: app + worker + db + caddy
├── scripts/
│   ├── dev.sh                  # One-command dev startup (DB + migrate + seed + server)
│   ├── migrate.sh              # Run Drizzle migrations against dev DB
│   ├── seed.ts                 # Seed instance_settings + General forum
│   └── seed-dev-users.ts       # Seed fake users for dev login bypass
├── vite.config.ts
├── drizzle.config.ts
├── CLAUDE.md                   # Full specification and architecture
├── STYLEGUIDE.md               # Code style, design conventions, datetime formatting
├── ARCHITECTURE.md             # Technical design decisions
└── STATUS.md                   # Implementation status for all phases
```

### Running Tests

```bash
npm test           # Run all unit tests (no database required)
npm run test:watch # Watch mode
```

Tests cover auth, sessions, permissions, rate limiting, and markdown rendering. They run against the real dev database when `DATABASE_URL` is set, so make sure the database container is running (`docker compose -f docker/docker-compose.dev.yml up -d`).

For the full integration test suite (HTTP-level tests against a running server):

```bash
# Requires dev server running in another terminal
bash scripts/test-integration.sh
```

See **TESTING.md** for more details.

### Building for Production

```bash
npm run build
npm run preview                 # Test the production build locally
```

### Updating Database Schema

1. Edit `src/lib/db/schema.ts`
2. Generate a migration file:
   ```bash
   npx drizzle-kit generate
   ```
3. Review the generated SQL in `src/lib/db/migrations/`
4. Apply it:
   ```bash
   bash scripts/migrate.sh
   ```

---

## Key Concepts

### Authentication Flow

1. User clicks "Sign in with Bluesky"
2. Redirected to their PDS (Personal Data Server)
3. After approval, OAuth callback to `/callback`
4. Session created: 32-byte random token → SHA-256 hash in database, token in `HttpOnly` cookie
5. User fetched/created in `users` table with DID as primary key
6. First login auto-promotes user to admin (gated by `instance_settings.first_admin_claimed`)

### Forum Permissions

- **Role hierarchy**: `guest` → `member` → `moderator` → `admin`
- **Global roles** (`users.global_role`): `member`, `admin`, `banned`
- **Per-forum roles** (`user_forum_roles`): Currently just `moderator`
- **Permission inheritance**: Walk up forum parent chain until explicit permissions found
- **Instance default**: Set at deployment time (public or members-only)

### Rate Limiting

Atomic PostgreSQL upserts track request counts per window:
- `thread_create`: 10 per hour per DID
- `post_submit`: 30 per hour per DID
- `preview_request`: 60 per hour per IP
- `login_attempt`: 10 per 15 min per IP
- Others: 20 per hour per IP

Hitting a limit returns HTTP 429 with retry-after seconds.

### Content & Markdown

- Posts are markdown-only
- Server-side render via `unified` + `remark` + `rehype`
- Sanitized before storage (XSS protection)
- Embedded media fetched once at post time (OpenGraph metadata)
- Edits preserved in `post_revisions` table (append-only audit trail)

### Moderation

- **Ban**: Sets `users.global_role = 'banned'`, redirects user to `/banned`
- **Post management**: Hide, delete, restore posts; edit as moderator with reason logging
- **Thread management**: Lock/unlock, pin/unpin, move to different forum
- **Post moving**: Move posts to different threads for off-topic cleanup
- **Soft-delete**: Posts can be hidden (viewable to admins) or permanently deleted
- **All actions logged**: `mod_log` table with moderator, action, target, reason, timestamp

### User Features (Phase 9)

- **Unread tracking**: Forum listing shows unread badge for threads with new posts
- **Thread subscriptions**: Watch (always notify), Mute (never notify), or Default (respects global setting)
- **Notification control**: Filter by type (replies|quotes|both) and frequency (10min|hourly|daily)
- **Post management**: Users can hide, delete, or restore their own posts
- **Account control**: Anonymize account or delete all post content from settings danger zone

---

## Deployment

### For Self-Hosting

The project includes a setup script (`scripts/setup.sh`) that automates first-run configuration. On a fresh server:

```bash
git clone https://github.com/yourusername/bsBB.git
cd bsBB
./scripts/setup.sh
docker compose -f docker-compose.prod.yml up -d
```

The setup script handles:
1. P-256 keypair generation for ATproto OAuth
2. Validation of Bluesky service account (notifications)
3. SMTP configuration (email notifications)
4. Database migrations and seed data (General forum, instance settings)

The first user to log in after deployment is automatically promoted to admin.

### Recommended Hosting

- **Server**: Hetzner CAX11 (ARM64, 2 vCPU, 4GB RAM) or similar
- **OS**: Ubuntu 22.04 LTS
- **Reverse proxy**: Caddy (included in Docker Compose; auto-HTTPS via Let's Encrypt)
- **Backups**: Daily `pg_dump` to Cloudflare R2 or Backblaze B2

See `CLAUDE.md` for detailed deployment architecture and security defaults.

---

## Technology Stack

| Layer | Tech | Why |
|---|---|---|
| **Framework** | SvelteKit + `adapter-node` | SSR mandatory for SEO; monolith (no API boundary needed) |
| **Database** | PostgreSQL 17 | Relational structure; `tsvector` search; `JSONB` for metadata |
| **ORM** | Drizzle | TypeScript-native, thin, generates clean SQL |
| **Auth** | ATproto OAuth + custom sessions | Bluesky identity; 32-byte token + SHA-256 hash, Postgres-backed |
| **Markdown** | unified + remark + rehype | Server-side rendering, sanitized before storage |
| **CSS** | Tailwind v4 + shadcn-svelte | Utility-first, accessible components |
| **Reverse proxy** | Caddy | Automatic HTTPS, easy config |

---

## Documentation

- **`CLAUDE.md`** – Full specification, architecture decisions, all requirements. Read this for context on why things are designed the way they are.
- **`STATUS.md`** – Current implementation status across all 7 phases with commit counts and feature breakdown
- **`ARCHITECTURE.md`** – Technical architecture, stack decisions, schema, routing structure, and design rationale
- **`QUICK_REFERENCE.md`** – Quick lookup of file locations, critical facts, and common commands

---

## Contributing

We welcome contributions! Here's how:

1. Fork the repo
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make changes, following the patterns in existing code
4. Test locally: `npm run test` and manually verify UI changes
5. Commit with clear messages (see previous commits for style)
6. Push and open a pull request

### Code Style

**See STYLEGUIDE.md for comprehensive conventions on:**
- Datetime formatting (`formatTime()`, `formatDate()`, `formatAbsoluteTime()`, `formatTimeDisplay()`)
- CSS and theming (semantic classes, CSS custom properties, light/dark mode)
- Forms and validation (confirmation dialogs, button styling)
- Accessibility (ARIA, keyboard navigation)
- Component patterns (props typing, state management)

**Core rules:**
- TypeScript for all code; run `tsc --noEmit` to verify
- Svelte 5 reactivity (`$state`, `$props`, `$derived`) for components
- Drizzle parameterized queries (never raw SQL strings)
- Markdown sanitized server-side (before storage, not at render time)
- No comments unless the WHY is non-obvious

### Testing

- Unit tests via Vitest (`npm run test`)
- Integration tests hit real PostgreSQL (not mocked)
- Before marking a feature complete, test it in a browser

---

## Troubleshooting

### "Can't connect to database"
```bash
docker compose -f docker/docker-compose.dev.yml logs db
docker compose -f docker/docker-compose.dev.yml ps
```

### "ATPROTO_PRIVATE_KEY not set"
If testing without OAuth, use the dev login bypass (see "Quick Start" above).

### "TypeError: Cannot read property 'globalRole' of null"
Session not created. Check that login completed successfully and cookies are enabled.

### "INSERT ... ON CONFLICT" errors
Ensure migrations ran: `bash scripts/migrate.sh`

### Database state got messed up
Reset and reseed (dev only):
```bash
docker compose -f docker/docker-compose.dev.yml down -v  # Remove volume
docker compose -f docker/docker-compose.dev.yml up -d
bash scripts/migrate.sh
npx tsx scripts/seed.ts
npx tsx scripts/seed-dev-users.ts
```

---

## Status

**Phases 1–6 Complete.** See `STATUS.md` for detailed breakdown of all phases (35+ commits).

**Phase 7 In Progress:** Theme system with dark mode toggle, UI refinements, admin dashboard improvements.

---

## License

MIT – See LICENSE file.

---

## Support

- **Questions?** Check `CLAUDE.md` for architecture rationale
- **Found a bug?** Open an issue on GitHub
- **Want to contribute?** See "Contributing" section above

---

**Made by the bsBB community. Powered by ATproto and Bluesky. 🚀**
