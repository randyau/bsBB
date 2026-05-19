# Turnkey Setup Wizard — Concept

**Status:** Concept only. Not implemented. Parked until there is demand.

The goal: reduce deployment to one or two commands, with all remaining configuration done in a browser — no manual `.env` editing, no CLI secret generation, no SSH sessions.

---

## Target Experience

```bash
# Option A — from source
git clone https://github.com/you/bsBB && cd bsBB && docker compose up

# Option B — turnkey (preferred end-state)
curl -fsSL https://yourforum.com/install.sh | bash
```

Browser opens → `/setup` wizard → enter site URL + site name → sign in with Bluesky → done.

---

## How It Works (High Level)

### Phase 1 — Bootstrap (before app starts)

`entrypoint.sh` runs before the Node process starts:

1. Check if `/app/config/secrets.env` exists. If not:
   - Generate `SESSION_SECRET` (32 random bytes, hex)
   - Run `node scripts/gen-keypair.js` → write `ATPROTO_PRIVATE_KEY`
   - Write both to `/app/config/secrets.env` (Docker volume-mounted path)
2. Source `secrets.env` into the environment
3. Wait for Postgres to be ready (`pg_isready` loop)
4. Run migrations (`npm run db:migrate`)
5. Start the app (`node build/index.js`)

`/app/config/` is a named Docker volume. Secrets persist across container restarts and image upgrades without ever appearing in the image layer.

### Phase 2 — Setup Wizard (in browser)

On every request, if `instance_settings.setup_complete` is `false` (or the row doesn't exist), redirect to `/setup`.

The wizard is a short multi-step form — no ATproto auth required yet:

**Step 1 — Site identity**
- Public URL (e.g. `https://myforum.com`) — stored in `instance_settings` as `public_base_url`
- Site name — stored in `instance_settings` as `site_name`

**Step 2 — Email (optional, skippable)**
- SMTP host, port, user, password, from address
- Stored in `instance_settings` (encrypted at rest, or plaintext with a clear warning)
- Can be configured later from admin panel

**Step 3 — Sign in**
- Static page: "Setup is ready. Sign in with your Bluesky account to claim the admin role."
- Normal ATproto OAuth flow from here
- First login with `first_admin_claimed = false` → user gets `globalRole = admin` → flag flipped to `true`
- `setup_complete` set to `true` → redirected to `/`

### Phase 3 — Normal Operation

No restart needed anywhere in this flow. The key insight is that `PUBLIC_BASE_URL` is read from `instance_settings` at request time rather than from the process environment. The `client-metadata.json` route already reads from env — it would need to fall back to the DB value if the env var is not set.

---

## Key Architectural Changes Required

### 1. `PUBLIC_BASE_URL` from DB with env fallback

Currently: `client-metadata.json` and OAuth routes read `PUBLIC_BASE_URL` from `process.env` only.

Change: read from `instance_settings.public_base_url` first; fall back to `PUBLIC_BASE_URL` env var. This means after the wizard sets the URL, all OAuth machinery works immediately — no restart.

Affected files (approximate):
- `src/routes/client-metadata.json/+server.ts`
- `src/lib/server/atproto.ts` (OAuth client init)
- Any route that constructs absolute redirect URLs

### 2. `instance_settings` for SMTP

Currently SMTP credentials are env-only. The wizard needs to write them somewhere. Options:
- Store in `instance_settings` as a JSON blob (simple, but credentials in DB)
- Write to the config volume as `smtp.env` (cleaner separation, but requires file I/O from app)
- Env-only stays, wizard just shows instructions for what to put in `.env` (cop-out but safe)

Recommendation: store in `instance_settings` with a note in docs that DB access = credential access, same as any other framework.

### 3. `/setup` route with redirect guard

Middleware in `hooks.server.ts` (or a layout load function):
- If `setup_complete = false` and path is not `/setup*` → redirect to `/setup`
- If `setup_complete = true` and path is `/setup` → redirect to `/`

### 4. `entrypoint.sh` + Docker image

Currently the project has no published Docker image. The turnkey path requires:
- `Dockerfile.prod` already exists — needs an entrypoint wrapper
- Image published to ghcr.io (GitHub Actions workflow)
- A standalone `docker-compose.turnkey.yml` that references the published image (no build step)
- An `install.sh` that downloads the compose file and runs `docker compose up -d`

### 5. Wizard UI

A simple multi-step Svelte page at `src/routes/setup/`. No auth, no layout shell. Plain form, submit each step to a server action that writes to `instance_settings`.

---

## What Does NOT Change

- ATproto OAuth flow itself — unchanged
- Migration system — unchanged, just called from entrypoint
- Session handling — unchanged, secret is auto-generated instead of manually set
- First-login-claims-admin logic — already implemented
- All post-setup operation — identical to current deployment

---

## Scope Estimate

| Work item | Size |
|---|---|
| `entrypoint.sh` (secret gen + migrate + start) | Small |
| `PUBLIC_BASE_URL` DB fallback in OAuth routes | Small–Medium |
| `/setup` wizard route (3 steps) | Medium |
| `hooks.server.ts` redirect guard | Small |
| SMTP in `instance_settings` | Small |
| GitHub Actions image publish workflow | Small |
| `docker-compose.turnkey.yml` + `install.sh` | Small |
| **Total** | **~1–2 days of focused work** |

---

## Open Questions

1. **SMTP in DB vs file** — which is more acceptable to self-hosters? Most expect credentials in env files.
2. **Image registry** — ghcr.io (free with public repo) is the obvious choice; Docker Hub is an alternative.
3. **Upgrade path** — if someone uses the turnkey install, how do they upgrade? `docker compose pull && docker compose up -d` should work if migrations run on startup (they do).
4. **Multi-instance / reverse proxy** — the wizard assumes the app is directly reachable at the public URL during setup. Users behind Cloudflare Tunnel or a custom proxy need to handle that themselves before running the wizard.
5. **Dev mode conflict** — `DEV_AUTH_ENABLED` and the setup wizard need to coexist cleanly; dev mode should bypass the wizard.

---

## Why This Is Parked

The current deployment story (clone → edit `.env` → `docker compose up`) is already low friction for the target audience (technical self-hosters). The wizard primarily benefits non-technical users or managed hosting scenarios. It is non-trivial work that changes some core initialization paths. Worth building when there is actual demand.
