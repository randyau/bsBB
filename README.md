# bsBB – ATproto Forum

A modern, self-hosted threaded discussion forum built on ATproto and Bluesky identity. No traditional user accounts—everyone signs in with their Bluesky identity. Built with SvelteKit, PostgreSQL, and Docker.

**Status:** Phase 4 In Progress (Moderation & Admin Interface)

## Why bsBB?

- **Identity via ATproto/Bluesky** – Sign in with your Bluesky account, no separate password
- **Simple markdown-only posts** – No WYSIWYG bloat; users control their formatting
- **Flat conversation model** – Chronological replies with quote/reference links (proven to scale better than nesting)
- **Full moderation tooling** – Ban users, lock/pin threads, soft-delete posts, audit log all actions
- **Easy to self-host** – Single Docker Compose deployment, automated setup script
- **Open source** – MIT license, zero proprietary dependencies

## Quick Start (Local Development)

### Prerequisites

- **Docker & Docker Compose** – Latest versions recommended
- **Node.js 20+** – For local development tooling (optional if using Docker)
- **Git** – To clone the repo

### 1. Clone and Install

```bash
git clone https://github.com/yourusername/bsBB.git
cd bsBB
npm install
```

### 2. Configure Environment

Copy the template and customize:

```bash
cp .env.example .env
```

Edit `.env` with:

```env
# Database (Docker Compose will provide this)
DATABASE_URL=postgresql://forum:password@db:5432/forum

# Session security (generate a random 32+ byte string)
SESSION_SECRET=your-random-secret-here

# Public URL (localhost for dev)
PUBLIC_BASE_URL=http://localhost:5173

# ATproto OAuth (see "ATproto Setup" below)
ATPROTO_CLIENT_ID=http://localhost:5173/client-metadata.json
ATPROTO_PRIVATE_KEY=<see setup script>

# Service account for notifications (optional, can skip in dev)
ATPROTO_SERVICE_HANDLE=
ATPROTO_SERVICE_APP_PASSWORD=

# SMTP for email notifications (optional, can skip in dev)
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
```

### 3. ATproto Setup (Required for Auth)

The project uses ATproto OAuth for authentication. For local development without a public domain, use the **dev login bypass**:

**Option A: Dev Login Bypass (Easiest for local dev)**
```bash
# The app includes a dev login endpoint that doesn't require Bluesky auth
# Just visit http://localhost:5173/dev-login?did=did:plc:xxx
# (See src/routes/(auth)/dev-login/+server.ts for details)
```

**Option B: Real Bluesky OAuth (Requires public URL)**
If you want to test with real Bluesky auth, you need a public HTTPS URL that Bluesky can reach. This means:
- Deploy to a staging server, or
- Use `ngrok` or `cloudflare tunnel` to expose localhost, or
- Set up via the full setup script after deploying

For now, use Option A for local development.

### 4. Start Docker Services

```bash
docker compose up -d
```

This starts:
- **PostgreSQL** – Database on internal network
- **Caddy** – Reverse proxy on http://localhost:5173

Wait for logs to settle (~10 seconds):

```bash
docker compose logs -f app
```

Press `Ctrl+C` when you see "Server running on port 5173".

### 5. Initialize Database

```bash
docker compose exec app npm run db:migrate
```

This runs schema and seed migrations.

### 6. Create a Test User

Visit the dev login page:

```
http://localhost:5173/dev-login?did=did:plc:example123&handle=testuser&displayName=Test%20User
```

You'll be logged in as a member. To promote to admin for testing:

```bash
docker compose exec app npm run admin-promote -- did:plc:example123
```

### 7. Access the Forum

- **Forum**: http://localhost:5173
- **Admin dashboard**: http://localhost:5173/admin (if admin)
- **SQL query runner**: http://localhost:5173/admin/query

---

## Development

### Project Structure

```
bsBB/
├── src/
│   ├── routes/                 # SvelteKit routes (pages, API endpoints)
│   │   ├── f/[forumSlug]/      # Forum and thread views
│   │   ├── admin/              # Admin dashboard (rate limiting, user management, mod log)
│   │   └── (auth)/             # Auth routes (dev login, logout)
│   ├── lib/
│   │   ├── db/                 # Drizzle ORM schema and helpers
│   │   ├── auth/               # Session management
│   │   ├── abuse/              # Rate limiting logic
│   │   └── utils/              # Shared utilities
│   ├── app.d.ts                # Type definitions for app state
│   ├── hooks.server.ts         # Server-side hooks (auth, HTML formatting)
│   └── +layout.svelte          # Root layout
├── docker-compose.yml          # Local development stack
├── vite.config.ts              # Vite build config
├── drizzle.config.ts           # Drizzle ORM config
├── CLAUDE.md                   # Full specification and architecture (read this!)
├── ARCHITECTURE.md             # Detailed implementation status per phase
└── PHASE_4_STATUS.md           # Phase 4 (moderation) commit checklist
```

### Running Tests

```bash
npm run test                    # Run all tests
npm run test -- src/routes     # Run tests in specific directory
npm run test:watch             # Watch mode
```

### Building for Production

```bash
npm run build
npm run preview                 # Test the production build locally
```

### Updating Database Schema

1. Edit `src/lib/db/schema.ts`
2. Generate migration:
   ```bash
   npm run db:generate
   ```
3. Review the generated SQL in `drizzle/` directory
4. Apply it:
   ```bash
   npm run db:migrate
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
- **Delete post**: Soft-delete via `posts.is_deleted = true` (preserves thread integrity)
- **Lock thread**: Prevents replies; `threads.is_locked = true`
- **All actions logged**: `mod_log` table with moderator, action, target, reason, timestamp

---

## Deployment

### For Self-Hosting

The project includes a setup script (`scripts/setup.sh`) that automates first-run configuration. On a fresh server:

```bash
git clone https://github.com/yourusername/bsBB.git
cd bsBB
./scripts/setup.sh
docker compose up -d
```

The script handles:
1. P-256 keypair generation for ATproto OAuth
2. Validation of Bluesky service account (notifications)
3. SMTP configuration (email notifications)
4. Database migrations
5. Seed data (General forum, first admin)

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
| **Auth** | ATproto OAuth + custom sessions | Bluesky identity; roll-your-own sessions (Lucia deprecated) |
| **Markdown** | unified + remark + rehype | Server-side rendering, sanitized before storage |
| **CSS** | Tailwind v4 + shadcn-svelte | Utility-first, accessible components |
| **Reverse proxy** | Caddy | Automatic HTTPS, easy config |

---

## Documentation

- **`CLAUDE.md`** – Full specification, architecture decisions, all requirements. Read this for context on why things are designed the way they are.
- **`ARCHITECTURE.md`** – Detailed implementation status, SQL schema, per-phase checklist
- **`PHASE_4_STATUS.md`** – Current phase (moderation & admin) commit checklist
- **`QUICK_REFERENCE.md`** – (If present) Quick lookup of file locations and responsibilities

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
docker compose logs db
docker compose ps  # Check if db container is running
```

### "ATPROTO_PRIVATE_KEY not set"
If testing without OAuth, use the dev login bypass (see "Quick Start" above).

### "TypeError: Cannot read property 'globalRole' of null"
Session not created. Check that login completed successfully and cookies are enabled.

### "INSERT ... ON CONFLICT" errors
Ensure migrations ran: `docker compose exec app npm run db:migrate`

### Database state got messed up
Reset and reseed (dev only):
```bash
docker compose down -v  # Remove volume
docker compose up -d
docker compose exec app npm run db:migrate
```

---

## Roadmap

**Phase 1–3:** ✅ Complete (auth, forums, posts)

**Phase 4:** 🚀 In Progress (moderation & admin interface)
- ✅ Real rate limiting
- ✅ Admin layout & navigation
- ✅ SQL query interface
- ✅ User management (ban/unban/promote)
- ⏳ Thread management (lock/pin)
- ⏳ Post management (delete/restore)
- ⏳ Mod log viewer

**Future phases:** Search, full-text indexing, notifications, performance optimizations

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
