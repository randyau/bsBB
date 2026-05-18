# Quick Start — bsBB Forum

Get bsBB running locally in about 5 minutes. This is for **local development and exploration** — not production.

For a production deployment, see [DEPLOYMENT.md](DEPLOYMENT.md).

---

## What You Need

- **Docker Desktop** (includes Docker Compose) — [docker.com/get-started](https://www.docker.com/get-started/)
- **Node.js 20 or later** — [nodejs.org](https://nodejs.org/)
- **Git** — [git-scm.com](https://git-scm.com/)

---

## 1. Get the Code

```bash
git clone https://github.com/yourusername/bsBB.git
cd bsBB
npm install
```

---

## 2. Create a Config File

```bash
cp .env.example .env
```

Open `.env` and fill in the two secrets (everything else can stay as-is for local dev):

```env
SESSION_SECRET=anything-at-least-32-characters-long
ENCRYPTION_KEY=anything-else-at-least-32-characters
```

You can use any random strings here — they just need to exist. For real random values:
```bash
openssl rand -hex 32   # run twice, use each output for one variable
```

> **Note:** You do NOT need a Bluesky account, SMTP credentials, or ATproto keys for local development. The dev login bypass handles authentication locally.

---

## 3. Start Everything

```bash
npm run dev:setup
```

This single command:
1. Starts a PostgreSQL database in Docker
2. Runs all schema migrations
3. Creates test user accounts
4. Starts the forum at **http://localhost:5173**

First run takes ~20 seconds while Vite compiles. Subsequent starts are faster.

---

## 4. Log In

Open your browser and go to:

```
http://localhost:5173/dev/login
```

Select **dev-admin.test** and click "Log in as this user."

> This is a development-only login page — it lets you switch between test accounts without needing a real Bluesky account. It's disabled in production.

---

## 5. Explore the Forum

You're now logged in as an admin. Try:

- **Create a forum:** Admin → Forums → New Forum
- **Post a thread:** Click into a forum, then "New Thread"
- **Try moderation:** Log out, log back in as `dev-member.test`, create a post, then switch to `dev-admin.test` and moderate it
- **Admin dashboard:** http://localhost:5173/admin

---

## Stopping

Press `Ctrl+C` in the terminal where `npm run dev:setup` is running. This stops the dev server and shuts down the database container.

---

## Resetting to a Clean Slate

If your local database gets into a bad state:

```bash
docker compose -f docker/docker-compose.dev.yml down -v
npm run dev:setup
```

The `-v` flag removes the database volume (all data), so you start fresh.

---

## What's Next?

- **Understand the codebase:** [ARCHITECTURE.md](ARCHITECTURE.md)
- **Contribute code:** [PATTERNS.md](PATTERNS.md) (read before writing code)
- **Deploy to a server:** [DEPLOYMENT.md](DEPLOYMENT.md)
- **Admin guide:** [ADMIN_GUIDE.md](ADMIN_GUIDE.md)

---

## Common Problems

### "Docker not found" or "Cannot connect to Docker daemon"

Make sure Docker Desktop is running. On Linux, you may need to add your user to the docker group:
```bash
sudo usermod -aG docker $USER
# Log out and back in
```

### Port 5432 already in use

A previous database container is still running:
```bash
docker compose -f docker/docker-compose.dev.yml down
npm run dev:setup
```

### Port 5173 already in use

Another dev server is running. Stop it first, or kill the process:
```bash
# Find what's using port 5173
lsof -i :5173   # macOS/Linux
netstat -ano | findstr :5173   # Windows
```

### "Cannot find module" errors

Your `node_modules` may be missing or corrupted:
```bash
npm ci
npm run dev:setup
```

### Changes not appearing in the browser

Vite's hot module replacement handles most changes automatically. If something seems stuck, refresh the browser. For server-side changes (routes, API), the dev server restarts automatically.
