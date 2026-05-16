# Phase 7 — Design, UI & Interaction Refinements

## Goal

Replace the bare-bones Tailwind defaults with a cohesive, readable visual design. Add a light/dark mode toggle. Polish interactions across all views. The forum should feel intentional and comfortable — not flashy, but not rough either.

**Non-goal:** Redesign or restructure any routes. Phase 7 is styling and UX only — no new features, no schema changes, no new routes.

---

## Commit Plan (6 commits)

---

### Commit 1 — Theme Foundation: CSS Variables + Dark Mode Infrastructure

**What:**
- Define a CSS custom property theme system in `src/app.css`
- Set a default light theme and a dark theme variant under `.dark`
- Wire up Tailwind v4's `@theme` block to consume these variables
- Add a `ThemeToggle` Svelte component that stores preference in `localStorage`
- Apply the `.dark` class to `<html>` on load (before paint, to avoid flash)

**Design tokens (light / dark):**
```css
--color-bg:         #f9f6f1   /  #1a1a1a
--color-surface:    #ffffff   /  #242424
--color-border:     #e2d9cc   /  #333333
--color-text:       #2c2c2c   /  #e8e3dc
--color-text-muted: #6b6359   /  #9e9690
--color-accent:     #5b6ad0   /  #7a87e0   (blue-indigo, Bluesky-adjacent)
--color-accent-hover: #4a57c0 /  #8b96e8
--color-danger:     #c0392b   /  #e05a4f
--color-success:    #27ae60   /  #4cba80
```

**Typography:**
- Body: `system-ui, -apple-system, sans-serif` (no web font fetch)
- Mono (code blocks): `ui-monospace, 'Cascadia Code', monospace`
- Base size: 16px, line-height 1.6

**Files changed:**
- `src/app.css` — theme tokens, base resets
- `src/lib/components/ThemeToggle.svelte` (new)
- `src/routes/+layout.svelte` — add ThemeToggle, inline script to set class before paint

---

### Commit 2 — Layout & Navigation

**What:**
- Restyle the global nav (top bar) — logo, search, user pill, theme toggle
- Add a subtle site-wide content container (`max-w-4xl mx-auto px-4`)
- Consistent header hierarchy across all pages (h1 for page title, consistent spacing)

**Design direction:**
- Nav: light warm-gray bar with accent border-bottom, slight shadow
- Logo: bold, uses `--color-accent`
- User handle: avatar (if available) + handle in a pill
- Search input: rounded, integrated into nav bar
- Theme toggle: sun/moon icon button, 32×32px, no label

**Files changed:**
- `src/routes/+layout.svelte`
- `src/routes/+layout.server.ts` (pass avatar_url if not already)

---

### Commit 3 — Forum Index & Thread List Views

**What:**
- Forum index: card-style forum entries with name, description, thread/post count, last activity
- Thread list: table-like rows — title, author, reply count, last post time
- Pinned threads visually distinguished (pin icon + slight background tint)
- Locked thread indicator (lock icon in title)

**Files changed:**
- `src/routes/+page.svelte`
- `src/routes/f/[forumSlug]/+page.svelte`

---

### Commit 4 — Thread View & Post Styling

**What:**
- Posts: card with subtle border, author avatar + handle + timestamp in header
- "Edited" badge on edited posts
- Quoted post: inset block with left border (like email quote style)
- Link preview card: image thumbnail + title + description, constrained width
- Deleted post: placeholder bar "This post has been removed"
- Action buttons (reply, edit, quote): small, muted, reveal on hover
- Markdown rendered content: proper heading sizes, code block styling, blockquote style

**Files changed:**
- `src/routes/f/[forumSlug]/t/[threadId]/+page.svelte`
- `src/app.css` — add markdown prose styles (`.prose` class)

---

### Commit 5 — Forms & Post Composer

**What:**
- New thread and reply forms: consistent label/input/textarea styling
- Textarea: monospace font, comfortable padding, resize-vertical
- Character counter: right-aligned, warning color at 80% capacity
- Submit/cancel button pair: primary + ghost style
- Error/validation messages: inline, red, with icon
- Markdown preview pane: same `.prose` styling as rendered posts

**Files changed:**
- `src/routes/f/[forumSlug]/new/+page.svelte`
- `src/routes/f/[forumSlug]/t/[threadId]/+page.svelte` (reply form section)

---

### Commit 6 — Admin UI & Miscellaneous Polish

**What:**
- Admin sidebar: left-nav with icon + label for each section
- Admin tables: consistent row styling, action buttons aligned right
- Banned page: simple, non-punishing message with logout link
- Login page: centered card, Bluesky logo/branding, clear CTA
- Search results: styled like thread list rows
- 404 / error pages: friendly message, link back to home
- Mobile: verify all views are usable at 375px width (no horizontal scroll)

**Files changed:**
- `src/routes/admin/+layout.svelte`
- `src/routes/admin/*/+page.svelte` (all admin pages)
- `src/routes/banned/+page.svelte`
- `src/routes/(auth)/login/+page.svelte`
- `src/routes/search/+page.svelte`

---

## Theme Toggle Implementation Detail

The toggle must avoid a flash-of-wrong-theme (FOUT) on load. The pattern:

```html
<!-- In +layout.svelte <svelte:head> or inline in <head> -->
<script>
  // Runs before paint — must be inline, not deferred
  const stored = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (stored === 'dark' || (!stored && prefersDark)) {
    document.documentElement.classList.add('dark');
  }
</script>
```

The `ThemeToggle` component:
- Reads `localStorage.getItem('theme')` on mount
- Toggles `.dark` on `<html>` and writes to `localStorage` on click
- Shows sun icon in dark mode, moon icon in light mode
- `aria-label="Toggle theme"` for accessibility

---

## Visual Direction Reference

The aesthetic target: warm, readable, forum-like. Not a dashboard, not a blog. Think:
- Background: warm off-white (not pure white) in light mode
- Surfaces: clean white cards with soft borders
- Typography: comfortable reading size, generous line height
- Accent: blue-indigo (complementary to Bluesky's palette)
- Dark mode: true dark (not just gray) with warm text tones

Avoid: heavy shadows, gradients, animations beyond 150ms transitions, icon-only navigation without tooltips.

---

## Done Criteria

- [ ] Light and dark mode both look intentional and complete
- [ ] Toggle works, preference persists across page loads, no FOUT
- [ ] All 6 main views look polished at desktop (1280px) and mobile (375px)
- [ ] Markdown-rendered content (headings, code, blockquotes, links) is styled
- [ ] Admin UI is functional and readable (doesn't need to be beautiful)
- [ ] No regressions in functionality — all existing routes still work
- [ ] `tsc --noEmit` passes
