# bsBB ATproto Forum — AI Engineering Guardrails and Codebase Maintenance Rules

> **NOTICE TO AI ASSISTANT:** This document defines the operational constraints for this codebase. These rules override general training data. Read in full before any modification.

---

## The Core Problem This File Solves

LLMs degrade in reliability as codebases grow. This file prevents:

1. **Context gaps** — Modifying files without reading dependencies.
2. **Hallucinated APIs** — Using methods that don't exist in the current version.
3. **Silent regressions** — Fixing one thing, breaking another.
4. **Scope creep** — Refactoring code that wasn't asked for.
5. **Token waste** — Re-streaming large files unnecessarily.
6. **Version confusion** — Mixing APIs from different major versions of a library.
7. **Silent routing errors** — Data assigned to the wrong handler with no error signal.
8. **Phase boundary violations** — Modifying frozen modules with feature changes.

---

## Rule 0: Session Start Protocol — Required Before Every Session

**This rule executes before any other rule. It is not optional.**

At the start of every session, you must:

1. **Environment Audit:** Run `Get-ChildItem -Recurse -Exclude node_modules,.git,dist,.svelte-kit` (or `tree -I 'node_modules|.git|dist|.svelte-kit'` on Linux) to verify the current file tree.
2. **Context Verification:** For files you intend to modify, grep imports/dependencies to ensure your API model is current.
3. **Explicit Acknowledgement:** State the following before producing any code:
   - **[VERSION]:** One specific old-version pattern you will not use and its current equivalent (e.g., a deprecated `@atproto/oauth-client-node` API, an old Drizzle query syntax).
   - **[INVARIANT]:** What happens if the DID-as-primary-key invariant is violated (handle-based FK = silent data integrity failure when user changes handle).
   - **[PHASE]:** Current phase and which directories are frozen.
   - **[FILES]:** Which files you will read before modifying any existing code.
4. **Test Gate:** For any change to `src/lib/auth/`, `src/lib/db/`, or `src/lib/permissions/`, name the integration test that must pass before and after. If it does not exist, write it before writing implementation code.

If steps 1–4 are skipped and code is produced directly, reject the output and re-prompt.

---

## Rule 1: Always Read and Verify Before Writing

Before modifying any file:

1. Read the full file.
2. Read files that import from or are imported by it.
3. Read the corresponding test file.
4. State explicitly what you've read and what the module does.
5. **CLI Validation:** Run `npx tsc --noEmit` rather than guessing TypeScript types.

Never modify based on filename alone. Never assume current code matches what was described earlier in the conversation.

---

## Rule 2: Token Efficiency — Grep Before Read, Diff-First Output

Every full file read costs tokens. Exhaust cheaper options first.

**Before reading a file, ask: can grep answer this?**

```bash
# Find where a symbol is defined — don't read the whole file
grep -n "function renderMarkdown\|class MarkdownPipeline" src/

# Check which files import a module — don't read each one
grep -rl "from '\$lib/permissions'" src/

# Verify an API exists in the installed version
grep -n "interpolate\|sanitize" node_modules/rehype-sanitize/index.js

# Check argument order without reading the full function
grep -A3 "export function checkPermission" src/lib/permissions/index.ts
```

**Read a full file only when:**
- You are about to modify it (required by Rule 1).
- Grep results are ambiguous and context is needed to resolve them.
- The file is <50 lines (full read costs little).

**When you do output code:**
- Output only the specific functions or blocks being changed. Use `// ... existing code ...` to indicate elided sections.
- Propose one logical change at a time. Do not mix refactors with feature additions.

---

## Rule 3: ATproto OAuth Client — Version Awareness

The official ATproto OAuth client (`@atproto/oauth-client-node`) is the sole permitted auth mechanism. No custom DPoP or PAR implementation.

| Forbidden Pattern | Required Pattern |
|---|---|
| Any custom OAuth/DPoP implementation | `@atproto/oauth-client-node` SDK only |
| Using `handle` as user identifier | Use `did` from token response `sub` field |
| Storing user OAuth tokens | No user tokens are stored; DMs are sent by the forum service account only |
| Requesting `transition:chat.bsky` from users | DM notifications use `ATPROTO_SERVICE_APP_PASSWORD`; no per-user chat scope |

Verify every ATproto API call against the current `@atproto` package docs before writing. The ATproto API surface changes; do not rely on training data for method signatures.

---

## Rule 4: Database Connections Are Pooled — Never Per-Request

Never create a new Drizzle/pg client inside a SvelteKit server action, load function, or API route handler.

The database pool is initialized once in `src/lib/db/index.ts`.
All queries go through the exported `db` instance from that module.

```typescript
// CORRECT
import { db } from '$lib/db';
const result = await db.select().from(users).where(eq(users.did, did));

// WRONG — never do this
const client = new Pool({ connectionString: DATABASE_URL });
```

---

## Rule 5: DID Is the Immutable User Identity — Never Handle

**This is the most critical correctness rule in the entire codebase.**

Bluesky handles are mutable — a user can change their handle at any time. DIDs are permanent. Every foreign key referencing a user **must** reference `users.did`, never `users.handle`.

Cross-contamination (handle-based FK) produces wrong data **silently** after a handle change. No error is raised.

**Rules:**
- All FK columns referencing users are `TEXT` typed, containing a `did:plc:...` value.
- Display handle is fetched from the `users` table cache — never used as a lookup key.
- If a DID cannot be resolved: raise a hard error. Do not fall back to handle lookup.
- Lazy profile sync: when a post is submitted and `last_profile_sync > 24h`, enqueue background sync — do not block the post submission.

```typescript
// CORRECT — FK is DID
author_did: text('author_did').references(() => users.did)

// WRONG — handle is mutable
author_handle: text('author_handle').references(() => users.handle)
```

**`auth.test.ts` and `users.test.ts` must pass before any change to `src/lib/auth/` or `src/lib/db/schema.ts` is merged.**

---

## Rule 6: Config Files Are Definitions, Not State

`client-metadata.json` and `.env` define inputs. They are not application state.

- The app reads these files at startup — it never writes to them at runtime.
- `client-metadata.json` is a generated artifact (produced by `setup.js`) — never hand-edit it, never regenerate it during a request.
- **Idempotency:** Running `setup.js` twice with the same inputs must produce identical `client-metadata.json` output.
- All paths in config must be environment-relative. No hardcoded absolute paths.

---

## Rule 7: Persistence — Writes Commit Before State Update

PostgreSQL is the crash-safety guarantee.

**Order of operations — never reverse this:**
1. Write and commit to PostgreSQL.
2. Update in-memory / session state.

```typescript
// CORRECT order
await db.insert(posts).values(postData);
locals.session.lastPostAt = now; // session update after DB commit

// WRONG — crash between these lines = ghost state
locals.session.lastPostAt = now;
await db.insert(posts).values(postData);
```

Additional rules:
- Never buffer posts, notifications, or mod log entries in memory before writing.
- Notification queue entries must be written in the same transaction as the triggering post/action.
- The mod log (`mod_log`) is append-only — no update or delete routes. Ever.

---

## Rule 8: Logic Isolation — Auth, Permissions, and Sanitization Live in One Place

**Permission logic** is computed in `src/lib/permissions/index.ts` only.
No inline `role === 'admin'` checks anywhere else in the codebase.

**Markdown sanitization** runs in `src/lib/markdown/index.ts` only.
`body_html` is always sanitized via `rehype-sanitize` **before storage** — never at render time. If you find yourself sanitizing in a Svelte component, that is a bug.

**Rate limiting** is enforced in `src/hooks.server.ts` — by DID post-auth, by IP pre-auth. Not inside individual route handlers.

Rules:
- Permission functions must be pure — no DB calls inside them. Load permission rows before calling.
- On permission check failure: fail closed (deny). Never fail open.
- Hierarchical permission inheritance: if no explicit `forum_permissions` row exists for a child forum, inherit from parent. Explicit rows override.

---

## Rule 9: Document Uncertainty

When uncertain about an API, argument order, payload shape, or behavior:

```
> **UNCERTAINTY:** I am not certain that [thing].
> Verify: [specific CLI command or doc link]. If wrong: [consequence].
```

High-risk areas to flag in this project:
- `@atproto/oauth-client-node` — method signatures change across minor versions; verify against installed package version
- `@atproto/api` chat methods — DM API is `transition:chat.bsky` scoped; verify scope requirements before each call
- Drizzle ORM — query builder API differences between versions; run `tsc --noEmit` to catch type errors
- `rehype-sanitize` — allowed tag/attribute schema changes across versions; verify sanitized output contains no `<script>` tags
- ATproto PLC Directory resolution — network call; can fail; always handle rejection path

---

## Rule 10: Idempotency Is a Tested Invariant

- Submitting the same post twice (duplicate request) must not create two rows — implement idempotency keys or check-before-insert at the server action level.
- Running `setup.js` twice must produce identical `client-metadata.json`.
- Profile sync triggered twice within 24h must be a no-op (check `last_profile_sync` before enqueuing).

`posts.test.ts` enforces the duplicate-submission invariant. Do not break it.

---

## Rule 11: HTML Output Is Derived — Never Source

`body_html` in the `posts` table is a derived, sanitized artifact of `body_markdown`.

- `body_markdown` is the source of truth. It is never modified after insert (edits create a new snapshot — TBD).
- `body_html` is always regenerated from `body_markdown` via the `src/lib/markdown/index.ts` pipeline — never hand-authored, never accepted from client input.
- The pipeline: `body_markdown` → `remark` → `rehype-sanitize` → `body_html` (stored).

```typescript
// markdown/index.ts must be the only place this pipeline runs
assert(bodyHtml === await renderMarkdown(bodyMarkdown), 'INVARIANT: html must derive from markdown pipeline');
```

---

## Rule 12: Module Boundaries

```
┌──────────────────────────────────────────┐
│  Svelte Components (src/routes/ *.svelte)│
│  Display only. No business logic.        │
├──────────────────────────────────────────┤
│  SvelteKit Server Actions / Load Fns     │
│  (+page.server.ts, +layout.server.ts)    │
│  Sequencing. Auth gate. Calls lib fns.   │
├──────────────────────────────────────────┤
│  src/lib/permissions/                    │
│  Pure permission computation. No I/O.    │
├──────────────────────────────────────────┤
│  src/lib/ (auth, markdown, email, ogp)  │
│  Business logic. Pure or single-concern. │
├──────────────────────────────────────────┤
│  src/lib/db/                             │
│  Drizzle schema + query helpers only.    │
│  No business logic. No auth decisions.   │
├──────────────────────────────────────────┤
│  src/hooks.server.ts                     │
│  Rate limiting, session hydration only.  │
└──────────────────────────────────────────┘
```

- Svelte components must not import from `$lib/db` directly.
- Permission checks must not happen inside `$lib/db` query helpers.
- Markdown rendering must not happen inside Svelte components (only display pre-rendered `body_html`).
- Email and ATproto notification calls must not happen synchronously in server actions — enqueue to `notification_queue`, let the worker send.

---

## Rule 13: File and Function Size Limits

| Item | Limit | Action when exceeded |
|---|---|---|
| Any source file | 300 lines | Propose split (see below) |
| Any function / method | 40 lines | Extract helper |
| Any test file | 400 lines | Split by scenario group |
| Nesting depth | 4 levels | Extract named function |
| Function parameters | 5 | Introduce a context/options object |

Approaching a limit is a signal to extract — not a reason to relax the limit.

**When a file exceeds 300 lines, you must propose a split before continuing.**
State the proposed split explicitly:

```
[filename].ts is 420 lines. Proposed split:
  - [filename].core.ts    — [what goes here, e.g. pure logic, ~180 lines]
  - [filename].helpers.ts — [what goes here, e.g. utilities, ~120 lines]
  - [filename].test.ts    — [existing tests extracted, ~120 lines]
Proceed with split? Or continue without splitting?
```

Do not silently continue editing an oversized file. The split proposal is mandatory.
The user may decline — if so, note it and continue — but the offer must be made.

**Why this matters for token efficiency:** files over ~300 lines are expensive to read
in full. Splitting them means future sessions can grep for the relevant module and read
only ~150 lines instead of 400+.

---

## Rule 14: Regression Checklist by Change Type

**Modifying `src/lib/auth/` or ATproto OAuth flow:**
- [ ] `auth.test.ts` passes — ALL tests including session creation and DID extraction.
- [ ] `users.test.ts` passes — upsert, profile sync scheduling.

**Modifying `src/lib/db/schema.ts`:**
- [ ] Drizzle migration generated and reviewed before applying.
- [ ] All existing query helpers typecheck (`tsc --noEmit`).
- [ ] No FK references `users.handle`.

**Modifying `src/lib/permissions/`:**
- [ ] `permissions.test.ts` passes at >= 95% coverage.
- [ ] Hierarchy inheritance tested: child with no row inherits parent; explicit child row overrides.
- [ ] Banned user fails all permission checks.

**Modifying `src/lib/markdown/`:**
- [ ] `markdown.test.ts` passes.
- [ ] Sanitization test: `<script>` tags in input produce no `<script>` in output.

**Modifying notification worker (`src/worker.ts` or `src/lib/notifications.ts`):**
- [ ] `notifications.test.ts` passes.
- [ ] Rate limit test: second DM to same recipient within 1 hour is suppressed.

**All changes:** run `npm test` and `npx tsc --noEmit` before marking complete.

---

## Rule 15: Phase Freeze Boundaries

v1.0 is complete. No modules are currently frozen for active feature work.

The DID invariant (Rule 5), sanitization invariant (Rule 11), and permission isolation invariant (Rule 8) are permanently non-negotiable regardless of phase.

---

## Rule 16: TDD Is Mandatory for Auth, Permission, and DB Schema Changes

When modifying `src/lib/auth/`, `src/lib/permissions/`, or `src/lib/db/schema.ts`, follow this order strictly:

1. Show the existing test that currently passes for the area being changed.
2. Write or update the test that defines the new required behaviour.
3. Confirm the new test **fails** (red) — if it passes already, the test is wrong.
4. Implement the change.
5. Confirm the new test **passes** (green).
6. Run the full test suite.
7. Confirm no previously-passing tests now fail.

**If steps 1–3 are skipped and implementation comes first, the output is rejected.**

These areas have the highest silent failure risk: a permission bug or DID/handle mixup produces plausible-looking output with no runtime error.

---

## Rule 17: Dev Environment — Windows Host, WSL2 Execution

This project is developed on a **Windows 11** machine but targets a **Linux VPS** (Hetzner). All development commands run inside WSL2 to maintain parity with the production environment.

### Command Execution

Every project command — `npm`, `node`, `npx`, `docker`, shell scripts, `pg_dump`, `rclone` — must be invoked via WSL, not PowerShell or CMD.

```powershell
# Invoking a one-off command from PowerShell (acceptable)
wsl -- npm run dev

# Better: open a WSL shell session and stay in it
wsl
cd /path/to/project && npm run dev
```

Never write `.bat` or `.ps1` scripts for project tooling. All scripts are `.sh` and run in WSL bash.

### Filesystem Location

Keep the project and all runtime-generated files (`.env`, `client-metadata.json`, logs, Postgres data) **inside the WSL filesystem** (e.g. `~/projects/bsBB`), not on the mounted Windows drive (`/mnt/e/...`).

Reasons:
- File watchers (Vite HMR, `nodemon`) are unreliable on `/mnt/` paths.
- Line endings and permission bits are correct inside WSL filesystem.
- Env var files read by Node inside WSL must have Unix line endings — a file written by Windows tooling may contain `\r\n` and silently break `dotenv` parsing.

The Windows-side path (`E:\linux\dev\bsBB`) is used only for editing in VS Code via the Remote - WSL extension. All terminal operations happen inside WSL.

### Environment Variables

Environment variable handling across the Windows/WSL boundary is the most common source of silent bugs. Rules:

1. `.env` is always written and read from within WSL. Never edit it with Notepad or a Windows-native editor — use `nano`/`vim` inside WSL or VS Code Remote WSL.
2. After writing `.env`, verify no `\r` carriage returns: `cat -A .env | grep $'\r'` — output should be empty.
3. Never `export` secrets in PowerShell and expect them to appear in WSL. They are separate environments.
4. Docker Compose is run from within WSL (`wsl -- docker compose up`). Docker Desktop with WSL2 backend is required.

### Logging and Debugging

Because stdout is harder to inspect across the Windows/WSL boundary, all long-running processes and scripts write to log files in addition to stdout:

- Dev server output: `npm run dev 2>&1 | tee logs/dev.log`
- Setup script: writes to `logs/setup.log`
- Notification worker: writes structured logs to the `worker_log` DB table (visible at `/admin/notifications`)
- Test runs: `npm test 2>&1 | tee logs/test.log`

`logs/` is gitignored. Create it if it doesn't exist: `mkdir -p logs`.

When debugging a failing script or build step, always check the log file — PowerShell's WSL output buffering can truncate or swallow stderr.

### Docker

Docker Desktop must be running with the WSL2 backend enabled. All `docker compose` commands run from within WSL:

```bash
# Inside WSL
docker compose up -d
docker compose logs -f app
docker exec -it forum-db psql -U postgres forum
```

Never run `docker compose` from PowerShell for this project — volume mount paths differ between Windows and WSL Docker contexts and will produce confusing errors.

---

### When to Work in WSL vs. Windows — Know When to Switch

This is a hybrid dev environment. The wrong context for a task produces confusing failures.

**Use WSL (Linux terminal) for:**
- Running `npm`, `node`, `npx`, `tsc`, shell scripts
- Docker Compose commands
- Editing `.env` (preserve Unix line endings)
- Running the test suite (`npm test`)
- Git operations
- Anything that touches the filesystem at runtime

**Use Windows / VS Code (outside WSL) for:**
- Making HTTP requests to the running dev server (`localhost:5173`)
- Testing API endpoints with `curl` from PowerShell or the VS Code terminal
- Verifying session cookies and HTTP responses
- Using the browser to interact with the running app

**Why the split exists:** Docker on Windows runs on the Windows network stack. Even though the container is in WSL2, `localhost:5173` resolves correctly from the Windows side via Docker Desktop's port-forwarding magic. From *inside* WSL2, `localhost` often does not route to the Windows-hosted Docker ports, so `curl http://localhost:5173/...` from a WSL terminal will fail or hang with no clear error.

**Practical rule:** If you're running commands that build or test code → WSL. If you're hitting a URL to check a live response → Windows terminal or VS Code terminal.

**Test session endpoint example (run from Windows/VS Code terminal, not WSL):**
```powershell
# Create an admin test session
curl -X POST http://localhost:5173/api/test/session `
  -H "Content-Type: application/json" `
  -d '{"did":"did:plc:testadmin","handle":"testadmin","displayName":"Test Admin","globalRole":"admin"}'

# Use the returned token to hit an authenticated route
curl -H "Cookie: session=<token>" http://localhost:5173/admin
```

---

## Rule 19: Build System — No Secrets in Source

- `ATPROTO_PRIVATE_KEY`, `ATPROTO_SERVICE_APP_PASSWORD`, `SMTP_PASS`, `SESSION_SECRET`, and `DATABASE_URL` are never committed to the repository.
- These live in `.env` (gitignored). `.env.example` lists all keys with placeholder values.
- `client-metadata.json` is gitignored — it is a generated artifact containing the public JWK.
- The setup script (`setup.js`) is the only place that writes `.env` and `client-metadata.json`.
- Docker Compose secrets are passed via environment variables only — never baked into the image.

---

## Rule 20: ATproto-Specific Security Rules

- Session cookies: `SameSite=Lax` (required for OAuth redirect from PDS to complete), `HttpOnly`, `Secure` in production.
- Markdown: sanitized server-side via `rehype-sanitize` before storage. CSP headers as additional defence-in-depth, not primary sanitization.
- No per-user ATproto tokens are stored. DM notifications are sent by the forum service account only (`ATPROTO_SERVICE_APP_PASSWORD`).
- DPoP, PAR, and token refresh are handled entirely by `@atproto/oauth-client-node`. Do not reimplement.
- Rate limiting: Drizzle parameterized queries throughout — no raw string concatenation in SQL.

---

## Hard Invariants — Quick Reference

1. **DIDs are the user PK.** All user FKs are `TEXT` containing `did:plc:...`. Handles are display cache only.
2. **HTML is derived.** `body_html` is always produced by the `src/lib/markdown/` pipeline from `body_markdown`. Never accepted from client. Never stored without sanitization.
3. **Permissions are centralized.** All access control lives in `src/lib/permissions/`. Fail closed on error.
4. **DB pool is singleton.** One Drizzle instance from `src/lib/db/index.ts`. Never per-request.
5. **Notifications are async.** Server actions enqueue to `notification_queue`. Worker sends. Never synchronous inline send.
6. **Mod log is append-only.** No update or delete routes exist. Ever.
7. **Persistence before state.** DB commit before session/memory update.
8. **Config is read-only at runtime.** `client-metadata.json` and `.env` are never written during request handling.
9. **No user OAuth tokens stored.** DMs sent by forum service account only; no per-user chat tokens in DB.
10. **Tests before implementation** for all auth, permission, and schema changes.
