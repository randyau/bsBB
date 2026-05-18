# Quick Start — bsBB Forum

Get bsBB running locally in about 5 minutes. This is for **local development and exploration** — not production.

For a production deployment, see [DEPLOYMENT.md](DEPLOYMENT.md).

---

## Choose Your Setup

- **[Mac or Linux](#mac--linux)** — the straightforward path
- **[Windows with WSL2](#windows-with-wsl2)** — the setup this project is developed on; works great once configured
- **[Windows without WSL2](#windows-without-wsl2)** — not recommended; the dev scripts require bash

---

## Mac / Linux

### What You Need

- **Docker Desktop** (Mac) or **Docker Engine** (Linux) — [docker.com/get-started](https://www.docker.com/get-started/)
- **Node.js 20+** — [nodejs.org](https://nodejs.org/) or via `nvm`
- **Git**

On Linux, after installing Docker, add your user to the docker group so you don't need sudo:
```bash
sudo usermod -aG docker $USER
# Log out and back in
```

### Steps

**1. Clone and install:**
```bash
git clone https://github.com/yourusername/bsBB.git
cd bsBB
npm install
```

**2. Create a config file:**
```bash
cp .env.example .env
```

Open `.env` and fill in the two secrets:
```env
SESSION_SECRET=anything-at-least-32-characters-long
ENCRYPTION_KEY=anything-else-at-least-32-characters
```
Generate real random values with: `openssl rand -hex 32` (run twice)

**3. Start everything:**
```bash
npm run dev:setup
```

This starts PostgreSQL in Docker, runs migrations, seeds test users, and launches the forum at **http://localhost:5173**.

**4. Log in:**

Visit `http://localhost:5173/dev/login` and select **dev-admin.test**.

Press `Ctrl+C` to stop.

---

## Windows with WSL2

This is the setup this project is actively developed on. The approach: **run all dev tooling inside WSL2, use Windows browser and Docker Desktop normally.**

### Why WSL2?

The dev scripts are bash scripts. WSL2 gives you a real Linux environment on Windows, including access to Docker Desktop's daemon. The dev server runs in WSL2 but is accessible from your Windows browser at `localhost:5173` — Docker Desktop and WSL2 integration handles the port forwarding automatically.

### What You Need

- **WSL2 with Ubuntu** — [Microsoft docs](https://learn.microsoft.com/en-us/windows/wsl/install): `wsl --install`
- **Docker Desktop for Windows** with WSL2 integration enabled (Settings → Resources → WSL Integration → enable for your Ubuntu distro)
- **Node.js inside WSL2** — install via `nvm` inside your WSL2 terminal, not the Windows version:
  ```bash
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
  # Restart terminal, then:
  nvm install 20
  nvm use 20
  ```
- **Git** — available inside WSL2 by default

> **Important:** Run all commands below inside a **WSL2 terminal** (the Ubuntu app, or Windows Terminal with Ubuntu profile) — not PowerShell or Command Prompt.

### Steps

**1. Clone into your WSL2 filesystem** (faster I/O than mounting Windows drives):
```bash
# Inside WSL2 terminal
cd ~
git clone https://github.com/yourusername/bsBB.git
cd bsBB
npm install
```

If you prefer to keep the project on your Windows drive (`/mnt/c/...`), that works too — it's just slower.

**2. Create a config file:**
```bash
cp .env.example .env
```

Edit `.env` (use `nano .env` or open the file from VS Code):
```env
SESSION_SECRET=anything-at-least-32-characters-long
ENCRYPTION_KEY=anything-else-at-least-32-characters
```
Generate real random values: `openssl rand -hex 32`

**3. Start everything:**
```bash
npm run dev:setup
```

**4. Open in your Windows browser:**

Visit `http://localhost:5173/dev/login` — this works from Windows even though the server runs in WSL2.

Select **dev-admin.test** to log in.

Press `Ctrl+C` to stop.

### Accessing the Dev Server from Windows

Docker Desktop maps WSL2 ports to Windows `localhost` automatically. You can:
- Open `http://localhost:5173` in any Windows browser
- Use Windows tools like Postman or curl against `localhost:5173`

HTTP testing from *inside* WSL2 against `localhost` can be unreliable (port routing quirks). Prefer testing from the Windows side.

### VS Code with WSL2

If you use VS Code, install the **WSL extension** and open the project with `code .` from inside your WSL2 terminal. This runs VS Code's server inside WSL2 for correct path handling and tooling.

---

## Windows Without WSL2

**Not recommended.** The dev scripts (`dev.sh`, `migrate.sh`, `setup.sh`) are bash scripts and won't run natively on Windows without WSL2 or a bash emulator.

Options if you must avoid WSL2:
- **Git Bash** — can run the scripts, but Docker path handling is unreliable
- **Manual steps** — skip the scripts entirely:
  ```
  1. Start Docker Desktop
  2. docker compose -f docker/docker-compose.dev.yml up -d
  3. npx drizzle-kit migrate
  4. npx tsx scripts/seed.ts
  5. npx tsx scripts/seed-dev-users.ts
  6. npm run dev
  ```
  Run these in a terminal where Node.js and Docker are on PATH.

Strongly consider enabling WSL2 instead — it's a one-time setup and the experience is much smoother.

---

## Resetting to a Clean Slate

If your local database gets into a bad state (run from your WSL2 or Mac/Linux terminal):

```bash
docker compose -f docker/docker-compose.dev.yml down -v
npm run dev:setup
```

The `-v` flag removes the database volume (all data), so you start completely fresh.

---

## What's Next?

- **Explore the features:** see [USER_GUIDE.md](USER_GUIDE.md)
- **Admin tools:** log in as `dev-admin.test` and visit `/admin`
- **Understand the codebase:** [ARCHITECTURE.md](ARCHITECTURE.md)
- **Contribute code:** read [PATTERNS.md](PATTERNS.md) first
- **Deploy to a server:** [DEPLOYMENT.md](DEPLOYMENT.md)

---

## Common Problems

### "Docker not found" or "Cannot connect to Docker daemon"

- **Mac/Linux:** Make sure Docker Desktop/Engine is running
- **WSL2:** Make sure Docker Desktop is running on Windows and WSL integration is enabled for your distro (Docker Desktop → Settings → Resources → WSL Integration)

On Linux (native, not WSL2), you may need to add yourself to the docker group:
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

Another dev server is running. Stop it first, or find what's using the port:
```bash
lsof -i :5173      # Mac/Linux
fuser 5173/tcp     # Linux alternative
# WSL2: run from Windows — netstat -ano | findstr :5173
```

### "Cannot find module" errors

```bash
npm ci
npm run dev:setup
```

### Changes not appearing in the browser

Vite's HMR handles most changes automatically. For server-side changes (routes, API), the dev server restarts automatically. If something seems stuck, do a hard refresh (`Ctrl+Shift+R`).
