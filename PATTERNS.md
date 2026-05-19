# Code Patterns, Style Guide & Snippets

Reusable patterns, code snippets, and style conventions. This is the authoritative reference for code style, design, and development practices across the forum codebase.

**For development workflow and script documentation, see [SCRIPTS.md](SCRIPTS.md).**

---

## Datetime Formatting

**All dates and times must use the centralized formatting functions in `src/lib/utils/time.ts`.**

### When to Use Each Format

| Function | Output | Use Case | Example |
|---|---|---|---|
| `formatTime()` | Relative only | Posts lists, activity feeds, limited space | `"2h ago"`, `"5m ago"` |
| `formatDate()` | Date only (YYYY-MM-DD) | Date-only contexts | `"2026-05-18"` |
| `formatAbsoluteTime()` | Datetime (YYYY-MM-DD HH:MM) | Audit trails, mod log | `"2026-05-18 14:30"` |
| `formatTimeDisplay()` | Both (absolute + relative) | **Default choice** — post timestamps, edits, precise references | `"2026-05-18 14:30 (2h ago)"` |

### Import and Usage

```typescript
import { formatTime, formatDate, formatAbsoluteTime, formatTimeDisplay } from '$lib/utils/time';

// Default: show both absolute and relative
const created = formatTimeDisplay(post.createdAt);  // "2026-05-18 14:30 (2h ago)"

// Date only
const dated = formatDate(post.createdAt);  // "2026-05-18"

// Absolute datetime only
const absolute = formatAbsoluteTime(post.createdAt);  // "2026-05-18 14:30"

// Relative only
const relative = formatTime(post.createdAt);  // "2h ago"
```

**Decision Tree:**
1. Need both absolute + relative? → `formatTimeDisplay()`
2. Just date, no time? → `formatDate()`
3. Just absolute datetime? → `formatAbsoluteTime()`
4. Just relative ("2h ago")? → `formatTime()`

**Default:** Prefer `formatTimeDisplay()` for user-visible timestamps.

---

## CSS and Theming

### CSS Variables and Semantic Classes

The design system uses Tailwind CSS v4 with semantic CSS custom properties for light/dark mode.

**Never hardcode colors.** Always use CSS variables or semantic classes:

```svelte
<!-- ✗ Bad: hardcoded color -->
<div style="color: #1f2937; background: #ffffff;">...</div>

<!-- ✓ Good: CSS variable -->
<div style="color: rgb(var(--color-text-primary)); background: rgb(var(--color-bg-primary));">...</div>

<!-- ✓ Better: semantic class -->
<div class="box">...</div>
```

### Semantic Classes

| Class | Purpose |
|---|---|
| `.page-title` | Main page heading (apply to every route's `<h1>`) |
| `.section-title` | Section header (`<h2>`) |
| `.subsection-title` | Subsection header (`<h3>`) |
| `.meta-text` | Secondary metadata text |
| `.box` | Card/panel wrapper |
| `.box-secondary` | Secondary card (admin UI) |
| `.alert-error` | Error message (red) |
| `.alert-success` | Success message (green) |
| `.alert-warning` | Warning message (amber) |
| `.table-container` | Table wrapper (borderless, scrollable) |
| `.btn-primary` | Primary button |
| `.btn-secondary` | Secondary button |
| `.btn-danger` | Destructive button (red) |
| `.form-control` | Input/textarea/select |
| `.form-group` | Field wrapper |
| `.form-label` | Field label |
| `.form-error` | Inline error text |
| `.form-success` | Inline success text |
| `.post` | Thread post wrapper |
| `.thread-item` | Thread list item |
| `.link` | Text link |

**Usage example:**

```svelte
<article class="box">
  <h2 class="section-title">Recent Posts</h2>
  {#each posts as post (post.id)}
    <div class="thread-item">
      <h3 class="subsection-title">{post.title}</h3>
      <p class="meta-text">{formatTimeDisplay(post.createdAt)}</p>
    </div>
  {/each}
</article>

<div class="form-group">
  <label class="form-label" for="email">Email</label>
  <input type="email" id="email" class="form-control" />
</div>

<button class="btn-primary">Save</button>
<button class="btn-danger">Delete</button>
```

### Light/Dark Mode

- Light mode is default for new users
- Dark mode respects `prefers-color-scheme: dark` system preference
- Theme toggle in header allows manual override
- State persisted to localStorage

**Test both modes before committing.**

---

## Markdown Rendering

### Editor Preview

The new thread/reply form shows a **live preview** that updates on every keystroke:

```svelte
<script lang="ts">
  import { renderMarkdownClient } from '$lib/markdown/client';

  let bodyValue: string = $state('');
  let previewHtml: string = $state('');

  $effect(() => {
    previewHtml = renderMarkdownClient(bodyValue);
  });
</script>

<textarea bind:value={bodyValue} placeholder="Write in Markdown..." />
<div>{@html previewHtml}</div>
```

**Key points:**
- Preview updates in real-time using `markdown-it` on the client
- Markdown is rendered **server-side** for final storage (via `renderMarkdown()` in `src/lib/markdown/index.ts`)
- Client preview uses DOMPurify to prevent XSS
- Use `renderMarkdownClient()` for live previews; use `renderMarkdown()` server-side only

### Server-Side Markdown Processing

Always sanitize markdown **before storage** using `renderMarkdown()`:

```typescript
import { renderMarkdown } from '$lib/markdown';

const sanitizedHtml = renderMarkdown(userProvidedMarkdown);
await db.insert(posts).values({
  content_markdown: userProvidedMarkdown,
  content_html: sanitizedHtml,
});
```

**Pipeline:**
1. User writes markdown in textarea
2. Submit → server receives raw markdown
3. Server calls `renderMarkdown()` → sanitized HTML
4. Store both: raw markdown + sanitized HTML
5. Display: use the pre-rendered HTML (no re-rendering at read time)

---

## Component Structure

### Props and Type Safety

All component props must be typed explicitly:

```svelte
<script lang="ts">
  import type { Post, User } from '$lib/db/schema';

  interface Props {
    post: Post;
    author: User;
    isEditable: boolean;
  }

  let { post, author, isEditable }: Props = $props();
</script>
```

### State Management

Use `$state` rune for reactive variables:

```svelte
<script lang="ts">
  let count: number = $state(0);
  let isOpen: boolean = $state(false);

  function increment() {
    count++;  // Automatically triggers updates
  }
</script>
```

---

## Session Management

### Create a new session

```typescript
import { createSession, setSessionCookie } from '$lib/auth/session';

const token = await createSession(did);
setSessionCookie(event, token);
```

### Validate session from request

```typescript
import { getSessionToken, validateSession } from '$lib/auth/session';

const token = getSessionToken(event);
if (token) {
  const session = await validateSession(token);
  event.locals.user = session?.user || null;
}
```

### Delete session

```typescript
import { invalidateSession, deleteSessionCookie } from '$lib/auth/session';

await invalidateSession(sessionId);
deleteSessionCookie(event);
```

---

## User Management

### Upsert user on login

```typescript
import { upsertUser } from '$lib/auth/user';

const user = await upsertUser(did, session);
```

### Claim first admin (idempotent)

```typescript
import { claimFirstAdmin } from '$lib/auth/user';

const isFirstAdmin = await claimFirstAdmin(did);
```

---

## Forms and Validation

### Confirmation Dialogs for Destructive Actions

**All irreversible operations must have a confirmation dialog:**

```typescript
function confirmDelete(): boolean {
  return confirm(
    'Permanently delete this post?\n\n' +
    'This will irreversibly clear all content. The post stub will remain ' +
    'for quotes/links, but content cannot be recovered.\n\n' +
    'This action cannot be undone.'
  );
}
```

Then in the form:

```svelte
<form method="POST" action="?/delete" onsubmit={confirmDelete}>
  <input type="hidden" name="postId" value={post.id} />
  <button class="btn-danger" type="submit">Delete Post</button>
</form>
```

**Message guidelines:**
- Be specific about what happens and whether it's reversible
- Use "irreversible" / "cannot be undone" for permanent operations
- Use "removed from view" / "can be restored" for soft-delete
- Keep it 2-3 sentences max

### PII Wipe vs. Soft Delete

Two distinct destruction levels exist — use the right one:

| Operation | What it erases | Reversible | When to use |
|---|---|---|---|
| **Hide post** (`status = 'hidden'`) | Nothing — hides from public view | Yes (restore) | Moderation: rule violation, off-topic |
| **Permanently delete** (`status = 'deleted'`, content cleared) | `body_markdown`, `body_html`, `link_metadata`, all `post_revisions` rows | No | PII removal; admin posts panel |

The post stub (id, author_did, created_at) always survives so quoted posts and permalink references remain valid.

**PII wipe must always delete `post_revisions` rows** before or in the same transaction as clearing the post body. Leaving revisions intact defeats the purpose — the PII remains accessible in history.

### Button Styling

- **Destructive:** Always use `.btn-danger` (red)
- **Primary:** Use `.btn-primary` for main CTA
- **Secondary:** Use `.btn-secondary` for alternatives
- **Disabled:** All support `:disabled` styling

### CSRF Protection

**All `<form method="POST">` elements must include the `use:enhance` directive.** This is SvelteKit's built-in CSRF protection mechanism. Without it, browsers will reject POST form submissions with a "Cross-site POST form submissions are forbidden" error.

The `use:enhance` directive automatically includes a CSRF token in form submissions, ensuring security without manual token management.

**Usage:**

```svelte
<script lang="ts">
  import { enhance } from '$app/forms';
</script>

<!-- ✓ Correct: use:enhance included -->
<form method="POST" action="?/updateSetting" use:enhance>
  <input type="text" name="value" />
  <button type="submit">Save</button>
</form>

<!-- ✗ Wrong: missing use:enhance → CSRF error -->
<form method="POST" action="?/updateSetting">
  <input type="text" name="value" />
  <button type="submit">Save</button>
</form>
```

**Key points:**
- Import `enhance` from `$app/forms` once per component
- Add `use:enhance` to every `<form method="POST">` element
- Works with all form attributes (`action`, `onsubmit`, `class`, etc.)
- Does not interfere with form submission logic or validation

**Verification:**
To find forms missing CSRF protection, search for:
```bash
grep -r 'method="POST"' src/routes --include="*.svelte" | grep -v use:enhance
```

---

## Accessibility

### Dialog Accessibility

All modals must include ARIA attributes:

```svelte
<div role="dialog" aria-modal="true" aria-labelledby="dialog-title">
  <h2 id="dialog-title">Move Thread to Forum</h2>
  <!-- form content -->
</div>
```

### Keyboard Navigation

- All interactive elements keyboard-accessible (`Tab`, `Enter`, `Escape`)
- Dialog `Escape` key closes modal
- Focus never trapped; always provide a way out
- Move focus on open; return on close

### Color Contrast

- WCAG AA: 4.5:1 for normal text, 3:1 for large text
- Do not rely on color alone; use icons + text
- Test in both light/dark modes

---

## Markdown

### Rendering

All markdown rendered server-side using `unified` + `remark`:

```typescript
import { renderMarkdown } from '$lib/markdown';

const html = await renderMarkdown(markdownText);
// Automatically sanitized via rehype-sanitize before storage
```

### Editor UX

- Plain `<textarea>` for editing
- Live preview on every keystroke via `renderMarkdownClient()` (`markdown-it` + DOMPurify, client-side)
- Server pipeline (`renderMarkdown()`) is authoritative at submit — client preview is for UX only
- `POST /api/preview` endpoint exists but is not used by the UI

---

## Database Queries

### General Rules

- Always use Drizzle ORM with parameterized queries
- Never raw SQL concatenation
- Use explicit column selection (avoid `SELECT *`)
- Add `.limit()` and `.offset()` for pagination
- Use indexed columns in `WHERE` clauses

### Pagination

- Posts: 25 items/page (default)
- Users: 50 items/page (default)
- Show current page + total to user
- Disable "Previous" / "Next" at boundaries

---

## Resources

- **CLAUDE.md** — Full specification and architecture
- **ARCHITECTURE.md** — Database schema and tech decisions
- **README.md** — Entry point and getting started
- **DEPLOYMENT.md** — Deploy guide
- **GUARDRAILS.md** — AI engineering operational rules
- **src/lib/utils/time.ts** — Datetime formatting functions
- **src/app.css** — Design system variables and classes
