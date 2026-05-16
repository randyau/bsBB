# TODO — Human Tasks & Remaining Work

Items requiring human action, credentials, external setup, or decisions. AI-assisted development tasks are tracked separately in CLAUDE.md.

---

## Before First Deploy — Required Setup

- [ ] Generate P-256 JWK keypair: `npx tsx scripts/gen-keypair.js`
- [ ] Set all required env vars in `.env` (see QUICK_REFERENCE.md)
- [ ] Create a Bluesky notification bot account and generate an app password
- [ ] Configure SMTP credentials (Mailgun, Postmark, etc.) — set `ADMIN_EMAIL` too
- [ ] Point a domain at the server; verify Caddy issues a TLS cert
- [ ] Run `docker compose up` and confirm all 3 services start
- [ ] Log in as first user — verify auto-admin promotion and one-time banner
- [ ] Create at least one forum via DB seed or admin UI

## End-to-End Testing Checklist

See [HUMAN_TODO.md](HUMAN_TODO.md) for the full manual testing checklist.

## Upcoming: Phase 7 — Design & UI Refinements

- Light/dark mode toggle (theme stored in localStorage or cookie)
- Cohesive visual theme replacing bare Tailwind defaults
- UX polish: typography, spacing, mobile layout, nav, post actions
- Improved admin UI styling

## Known Issues (Code)

These are documented bugs fixed in the post-Phase-6 cleanup commit — no action needed unless reverting:

- Session cleanup used `eq` instead of `lt` (never deleted expired sessions)
- Post revisions had hardcoded `revisionNumber: 1` (crash on second edit)
- OG fetch had no SSRF guard (could reach internal network IPs)
- Worker used `@example.com` as moderator email domain
- Ban action didn't invalidate active sessions immediately
