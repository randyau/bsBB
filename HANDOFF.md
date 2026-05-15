# Claude Handoff — Phase 1 In Progress

This file is for the Claude instance running locally in WSL within this repo.
Read this fully before doing anything. Delete this file when Phase 1 is complete and committed.

---

## Environment

- **Project root (WSL):** `/mnt/e/linux/dev/bsBB`
- **Node:** `/home/agi/.nvm/versions/node/v24.14.0/bin/` — must be on PATH for all commands
- **Docker:** `/usr/bin/docker`
- **Canonical command pattern:**
  ```bash
  export PATH=/home/agi/.nvm/versions/node/v24.14.0/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:$PATH
  cd /mnt/e/linux/dev/bsBB
  ```
- **Dev DB:** running via `docker compose -f docker/docker-compose.dev.yml up -d` — Postgres 17 on `localhost:5432`, creds `forum/forum`, db `forum`
- **Run tests:** `npm test`
- **Type check:** `npx svelte-kit sync && npx tsc --noEmit`
- **Temp dir for scratch scripts:** `/mnt/e/linux/dev-tmp/`

---

## Key Decisions Made (do not re-litigate)

- **No Lucia** — Lucia v3 deprecated March 2025. Sessions are roll-your-own (see `src/lib/auth/session.ts`). CLAUDE.md and ARCHITECTURE.md have already been updated to reflect this.
- **Sessions:** 32-byte random token → SHA-256 hash stored in DB. Cookie holds raw token. Rolling 30-day expiry.
- **DIDs as all user FKs** — never handles.
- **Flat reply model** — no nested threads.
- **Drizzle migration-file workflow only** — never `drizzle-kit push`.
- **`node_modules` lives on `/mnt/e/`** — accepted slow first-start. Do not move it.

---

## Phase 1 Status

### ✅ DONE

**1.1 — Scaffold**
- SvelteKit + adapter-node + Tailwind v4 + Vitest all wired
- `npm test` runs, `npm run dev` starts (slow due to /mnt/e/ I/O, ~21s, normal)
- Committed as: `Phase 1.1: SvelteKit scaffold...`

**1.2 — Drizzle + Schema**
- All 12 tables in `src/lib/db/schema.ts`
- Migration at `src/lib/db/migrations/0000_loose_jack_power.sql` — includes manually added self-referential FKs (`forums.parent_id`, `posts.reply_to_post_id`), composite PK for `user_forum_roles`, `body_tsv` generated column + GIN index
- `drizzle.config.ts` in place
- `scripts/migrate.sh` — runs migrations, defaults to `localhost:5432`
- `scripts/seed.ts` — seeds `instance_settings` (12 rows) + General forum
- DB is live and seeded — verified with `psql \dt` and SELECT queries

**1.3 — Docker Compose**
- `docker/docker-compose.dev.yml` — db only (for dev)
- `docker/docker-compose.yml` — full prod (app + db + caddy)
- `docker/Caddyfile` — reverse proxy + CSP headers + client-metadata.json static serve
- `docker/caddy-static/` — directory exists (client-metadata.json goes here post-setup)

**1.4 — Sessions (roll-your-own)**
- `src/lib/auth/session.ts` — `createSession`, `validateSession`, `invalidateSession`, `setSessionCookie`, `deleteSessionCookie`, `getSessionToken`
- `src/app.d.ts` — `App.Locals` typed with `user: SessionUser | null`, `sessionId: string | null`
- Tests: `src/lib/auth/session.test.ts` — 4 tests passing

**1.6 — Lazy Profile Sync**
- `src/lib/auth/profile-sync.ts` — `maybeSyncProfile(did, lastProfileSync)` fire-and-forget
- Fetches from PLC directory + `public.api.bsky.app`
- Tests: `src/lib/auth/profile-sync.test.ts` — 2 tests passing

**1.7 — First-Admin Gate**
- `src/lib/auth/user.ts` — `upsertUser()` and `claimFirstAdmin()`
- `claimFirstAdmin` uses conditional UPDATE on `instance_settings` (atomic, idempotent)
- Tests: `src/lib/auth/user.test.ts` — 3 tests passing

**1.8 — Banned User Redirect**
- In `src/hooks.server.ts` — redirects to `/banned` for banned users, except `/banned` and `/logout`
- `src/routes/banned/+page.svelte` — ban message page with sign-out button
- Tests: `src/lib/auth/banned-redirect.test.ts` — 6 tests passing (pure logic test)

**1.9 — Abuse Module Stub**
- `src/lib/abuse/index.ts` — full `AbuseContext` union type, `AbuseVerdict`, `checkAbuse()` always returns `{ allowed: true }`
- Tests: `src/lib/abuse/index.test.ts` — 7 tests passing

**Other files written:**
- `src/hooks.server.ts` — session hydration + banned redirect + worker stub
- `src/routes/+layout.server.ts` — passes `user` to all pages
- `src/routes/+layout.svelte` — nav with login/logout + Tailwind import
- `src/lib/utils/slug.ts` — `slugify()` utility

**Test count:** 35 tests across 7 files, all passing.

---

### ❌ INCOMPLETE — needs finishing

**1.5 — ATproto OAuth routes**

Files written but **`tsc --noEmit` fails** on `src/lib/auth/atproto.ts`:

```
src/lib/auth/atproto.ts(47,37): error TS2344: Type 'typeof NodeOAuthClient'
does not satisfy the constraint '(...args: any) => any'.
```

The problem is on this line in `atproto.ts`:
```typescript
keyset: [privateKey as Parameters<typeof NodeOAuthClient>[0]['keyset'][0]],
```

The `keyset` field in `OAuthClientOptions` expects `Keyset | Iterable<Key | undefined | null | false>` where `Key` and `Keyset` are from `@atproto/jwk` — not a raw `JsonWebKey`. The raw JWK needs to be imported via the ATproto SDK's own key factories.

**Fix needed:** Look at `node_modules/@atproto/jwk/dist/keyset.d.ts` and `node_modules/@atproto/jwk/dist/key.d.ts` to find the right import (`importJWK`? `Key.fromJWK`? `Keyset.fromJWKS`?). Use that to convert `privateKey: JsonWebKey` into the SDK's `Key` type before passing to `keyset`.

The three OAuth routes are written and just need tsc to pass:
- `src/routes/(auth)/login/+page.svelte` + `+page.server.ts`
- `src/routes/(auth)/callback/+server.ts`
- `src/routes/(auth)/logout/+server.ts`

`callback/+server.ts` imports `upsertUser` and `claimFirstAdmin` from `src/lib/auth/user.ts` — those are fine.

---

**1.10 — Setup Script**

Written but not validated:
- `scripts/setup.sh` — interactive first-run setup
- `scripts/gen-keypair.js` — P-256 JWK generation via Web Crypto

The setup script uses `require('@atproto/api')` in a Node `-e` snippet for service account validation — this might need to be `import` style or wrapped differently since the project uses ESM. Low priority; the script is for deployers and doesn't block Phase 1 gate.

---

## Phase 1 Gate Checklist (what still needs to happen)

From `IMPLEMENTATION_PLAN.md §Phase 1 Gate`:

- [ ] Fix `atproto.ts` type error → `tsc --noEmit` clean
- [ ] End-to-end login test with a real Bluesky account (manual — needs `ATPROTO_*` env vars)
- [ ] Verify `users` row created on first login, updated on re-login
- [ ] Verify first login promotes to admin + shows banner (manual)
- [ ] Verify second account gets `member` (manual)
- [ ] Verify banned user redirect works (manual or integration test)
- [ ] `migrate.sh` idempotency — run twice, confirm no error ✅ (already verified)
- [ ] All Vitest tests pass ✅ (35/35)
- [ ] Commit everything

---

## What to do next (in order)

1. **Fix `atproto.ts`** — resolve the `keyset` type. Check:
   ```bash
   cat node_modules/@atproto/jwk/dist/key.d.ts | grep -E 'export|fromJwk|import'
   cat node_modules/@atproto/jwk/dist/keyset.d.ts | grep -E 'export|fromJwk|import'
   ```
   Likely you need something like:
   ```typescript
   import { Keyset, Key } from '@atproto/jwk'
   // or from '@atproto/oauth-client-node'
   const keyset = await Keyset.fromJWKS({ keys: [privateKey] })
   // then pass keyset to NodeOAuthClient
   ```

2. **Run `tsc --noEmit`** — get to zero errors.

3. **Run `npm test`** — confirm still 35+ tests passing.

4. **Do a manual E2E login test** if you have a Bluesky account handy — or note it as a manual gate item.

5. **Commit** everything with message like:
   ```
   Phase 1 complete: auth, sessions, DB, Docker, abuse stub, setup scripts
   ```

6. **Do not start Phase 2** until Phase 1 gate is fully checked off.

---

## Package versions (installed and working)

```
@atproto/oauth-client-node  — installed
@atproto/api                — installed
drizzle-orm                 — installed
drizzle-kit                 — installed (dev)
postgres                    — installed
tailwindcss ^4.3            — installed
@tailwindcss/vite           — installed
vitest ^4.1.6               — installed
tsx                         — installed (dev, transitive)
rolldown                    — installed (required by vite@8)
@types/node                 — installed (dev)
```

Lucia and @lucia-auth/adapter-drizzle have been **uninstalled**. Do not reinstall them.
