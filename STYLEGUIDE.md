# Style Guide — ATproto Forum

**This is the authoritative reference for all style, design, and formatting conventions.** Other documentation files (CLAUDE.md, README.md, PATTERNS.md) reference this guide for detailed conventions.

This document establishes conventions for consistent code style, UI patterns, and development practices across the forum codebase.

## Datetime Formatting

All dates and times must use the centralized formatting functions in `src/lib/utils/time.ts`. This ensures consistency across the entire application.

### When to Use Each Format

| Function | Output | Use Case | Example |
|---|---|---|---|
| `formatTime()` | Relative only | Posts lists, activity feeds, when space is limited | `"2h ago"`, `"5m ago"` |
| `formatDate()` | Date only (YYYY-MM-DD) | When only the date matters, no time component needed | `"2026-05-18"` |
| `formatAbsoluteTime()` | Datetime (YYYY-MM-DD HH:MM) | Mod log, audit trails, absolute reference only | `"2026-05-18 14:30"` |
| `formatTimeDisplay()` | Both (absolute + relative) | **Default choice** — post timestamps, edited dates, precise references | `"2026-05-18 14:30 (2h ago)"` |

### Import and Usage

```typescript
import { formatTime, formatDate, formatAbsoluteTime, formatTimeDisplay } from '$lib/utils/time';

// Thread creation timestamp — shows both absolute and relative
const createdDisplay = formatTimeDisplay(thread.createdAt);  // "2026-05-18 14:30 (2h ago)"

// Activity list — relative time only
const activity = formatTime(post.createdAt);  // "2h ago"

// Audit log entry — absolute datetime only
const logged = formatAbsoluteTime(modAction.createdAt);  // "2026-05-18 14:30"

// Date listing (e.g., archive by date) — date only
const archived = formatDate(post.createdAt);  // "2026-05-18"
```

### Decision Tree

1. **Do you need both absolute and relative?** → Use `formatTimeDisplay()`
2. **Just date, no time?** → Use `formatDate()`
3. **Just absolute datetime?** → Use `formatAbsoluteTime()`
4. **Just relative ("2h ago")?** → Use `formatTime()`

**Default:** Prefer `formatTimeDisplay()` for user-visible timestamps. Only deviate if the UI explicitly requires a different format.

### Examples in Components

```svelte
<!-- Thread detail — timestamps for posts -->
<div class="post-meta">
  <span class="timestamp">{formatTimeDisplay(post.createdAt)}</span>
  {#if post.editedAt}
    <a href="/post/{post.id}/revisions" class="edit-link">
      edited {formatTimeDisplay(post.editedAt)}
    </a>
  {/if}
</div>

<!-- Activity feed — compact relative time -->
<div class="activity-item">
  <span>{user.handle} posted {formatTime(post.createdAt)}</span>
</div>

<!-- Mod log — audit trail with absolute timestamps -->
<tr>
  <td>{moderator.handle}</td>
  <td>{action}</td>
  <td>{formatAbsoluteTime(logEntry.createdAt)}</td>
</tr>

<!-- Archive by date — date only -->
<h3>{formatDate(post.createdAt)}</h3>
```

---

## CSS and Theming

### CSS Variables and Semantic Classes

The design system is built on Tailwind CSS v4 with semantic CSS custom properties for light/dark mode consistency.

#### Semantic Color Variables

All colors are defined as CSS custom properties for theme consistency:

```css
:root {
  --color-bg-primary: rgb(255, 255, 255);
  --color-bg-secondary: rgb(249, 250, 251);
  --color-text-primary: rgb(23, 23, 23);
  --color-text-muted: rgb(115, 115, 115);
  --color-border: rgb(229, 229, 229);
  /* ... more variables in app.css */
}

@media (prefers-color-scheme: dark) {
  :root {
    --color-bg-primary: rgb(23, 23, 23);
    --color-bg-secondary: rgb(38, 38, 38);
    --color-text-primary: rgb(245, 245, 245);
    --color-text-muted: rgb(163, 163, 163);
    --color-border: rgb(64, 64, 64);
  }
}
```

**Never use hardcoded colors in component styles.** Always use CSS variables or semantic classes:

```svelte
<!-- ✗ Bad: hardcoded color -->
<div style="color: #1f2937; background: #ffffff;">...</div>

<!-- ✓ Good: CSS variable -->
<div style="color: rgb(var(--color-text-primary)); background: rgb(var(--color-bg-primary));">...</div>

<!-- ✓ Better: semantic class -->
<div class="box">...</div>
```

#### Semantic Classes

Common UI patterns have dedicated CSS classes for consistency:

| Class | Purpose | Notes |
|---|---|---|
| `.page-title` | Main page heading | Apply to `<h1>` on every route |
| `.section-title` | Section header | Apply to `<h2>` elements |
| `.subsection-title` | Subsection header | Apply to `<h3>` elements |
| `.meta-text` | Secondary metadata text | Smaller size, muted color |
| `.box` | Card/panel wrapper | Light background, border, shadow |
| `.box-secondary` | Secondary card (admin UI) | Slightly different background |
| `.alert-error` | Error message | Red background, semantic icon |
| `.alert-success` | Success message | Green background, semantic icon |
| `.alert-warning` | Warning message | Amber background, semantic icon |
| `.table-container` | Table wrapper | Borderless table, overflow scroll |
| `.btn-primary` | Primary button | Themed color, hover/focus/active states |
| `.btn-secondary` | Secondary button | Muted color, hover/focus/active states |
| `.btn-danger` | Destructive button | Red, for delete/ban/irreversible actions |
| `.form-control` | Input/textarea/select | Consistent styling, focus ring |
| `.form-group` | Field wrapper | Spacing, label alignment |
| `.form-label` | Field label | Typography, required indicator |
| `.form-error` | Error message for field | Inline red text |
| `.form-success` | Success message for field | Inline green text |
| `.post` | Thread post wrapper | Background, borders, spacing |
| `.thread-item` | Thread list item | Background, hover state, badges |
| `.link` | Text link | Color, underline, focus ring |

**Usage:**

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

<button class="btn-primary">Save Changes</button>
<button class="btn-danger">Delete Account</button>
```

### Light/Dark Mode

- Light mode is the default for new users
- Dark mode respects `prefers-color-scheme: dark` system preference
- Theme toggle button in header allows manual override
- All state persisted to localStorage

**Never hardcode colors for light/dark mode.** Always:
1. Use CSS variables defined in `:root` and `@media (prefers-color-scheme: dark)`
2. Use semantic classes (`.box`, `.alert-error`, etc.)
3. Test your changes in both modes before committing

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

Use `$state` rune for reactive variables; avoid manual reactivity:

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

**Confirmation message guidelines:**
- Be specific about what will happen and whether it's reversible
- Use "irreversible" / "cannot be undone" for permanent operations
- Use "removed from view" / "can be restored" for soft-delete
- Keep it 2-3 sentences max

### Button Styling

- **Destructive actions:** Always use `.btn-danger` (red) to signal severity
- **Primary actions:** Use `.btn-primary` for the main CTA
- **Secondary actions:** Use `.btn-secondary` for alternatives
- **Disabled state:** All buttons support `:disabled` with appropriate styling (opacity, no focus)

---

## Accessibility (a11y)

### Dialog Accessibility

All modal dialogs must include ARIA attributes for screen readers:

```svelte
<div role="dialog" aria-modal="true" aria-labelledby="dialog-title">
  <h2 id="dialog-title">Move Thread to Forum</h2>
  <!-- form content -->
</div>
```

### Keyboard Navigation

- All interactive elements must be keyboard-accessible (`Tab`, `Enter`, `Escape`)
- Dialog `Escape` key closes modal (do not require form submission)
- Focus should never be trapped; always provide a way out
- Focus management: move focus to the newly-opened dialog; return focus on close

### Color Contrast

- All text must meet WCAG AA contrast requirements (4.5:1 for normal text, 3:1 for large)
- Do not rely on color alone to convey meaning (use icons, text labels)
- Icon + text combinations have better accessibility than icon-only buttons

---

## Markdown

### Rendering

All markdown is rendered server-side using `unified` + `remark` pipeline:

```typescript
import { renderMarkdownServer } from '$lib/markdown/server';

const html = await renderMarkdownServer(markdownText);
// HTML is sanitized automatically via rehype-sanitize before storage
```

### Editor UX

- Use plain `<textarea>` for editing
- Preview is toggled via button, rendered server-side via `POST /api/preview`
- No client-side markdown dependency; preview is always authoritative

---

## Performance

### Image and Media

- No local image storage; use OpenGraph metadata only
- OG fetch happens once at post submission, stored in `link_metadata` JSONB
- Only bare URLs on their own line trigger OG fetch (reduces noise)
- Static preview cards rendered from cached metadata; no layout shift

### Database Queries

- Always use Drizzle ORM with parameterized queries; never raw SQL concatenation
- Use `select()` with explicit column selection (avoid `SELECT *`)
- Add `.limit()` and `.offset()` for pagination queries
- Use indexed columns (DIDs, forum IDs, post IDs) in `WHERE` clauses

### Pagination

- Default: 25 items per page for posts, 50 for users
- Show current page + total pages to user
- Disable "Previous" / "Next" buttons at boundaries

---

## Testing

### Unit Tests

```bash
npm test
```

Tests go in `src/**/__tests__/**/*.test.ts`.

### Type Checking

```bash
npm run check
```

All files must pass TypeScript + Svelte type checking before commit.

---

## Git and Commits

### Commit Messages

- Use imperative mood: "Add feature" not "Added feature"
- First line ≤ 50 characters
- Reference the issue/task if applicable
- Include reasoning in the body if non-obvious

Example:

```
Add datetime formatting styleguide

Document centralized formatTime/formatDate/formatAbsoluteTime
functions and when to use each variant. Add formatDate() for
date-only use cases. Updated import patterns across codebase.

Resolves: design consistency across datetime rendering
```

### Code Review

- All PRs require review before merge
- CI must pass (tests, type check, linting)
- Accessibility and theme-safety checks encouraged

---

## Resources

- **CLAUDE.md** — Full specification, architecture, and design rationale
- **src/lib/utils/time.ts** — Centralized datetime formatting functions
- **src/app.css** — Design system CSS variables, semantic classes
- **ARCHITECTURE.md** — Database schema, API design patterns
