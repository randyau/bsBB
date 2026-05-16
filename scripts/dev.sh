#!/bin/bash

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

set -e

# If running as root (via sudo), find npm in the original user's environment
if [ "$EUID" -eq 0 ] && [ -n "$SUDO_USER" ]; then
  NPM_PATH=$(sudo -u "$SUDO_USER" bash -c 'which npm' 2>/dev/null || echo "")
  if [ -z "$NPM_PATH" ]; then
    echo -e "${RED}Error: npm not found in \$SUDO_USER's PATH${NC}"
    echo ""
    echo "Recommended: Add your user to the docker group, then run without sudo:"
    echo "  sudo usermod -aG docker \$USER"
    echo "  (log out and back in)"
    echo "  ./scripts/dev.sh"
    echo ""
    exit 1
  fi
  NPM_RUN="sudo -u $SUDO_USER bash -c"
else
  NPM_PATH="npm"
  NPM_RUN=""
fi

# Cleanup function
cleanup() {
  if [ -z "$SKIP_CLEANUP" ]; then
    echo -e "\n${YELLOW}Cleaning up...${NC}"
    docker compose -f docker/docker-compose.dev.yml down --remove-orphans 2>/dev/null || true
    echo -e "${GREEN}✓ Database stopped${NC}"
  fi
  exit 0
}

# Trap Ctrl+C and other signals
trap cleanup SIGINT SIGTERM EXIT

# Ensure we're in the project root
if [ ! -f "package.json" ]; then
  echo -e "${RED}Error: package.json not found. Run from project root.${NC}"
  exit 1
fi

echo -e "${YELLOW}=== Forum Dev Server ===${NC}\n"

# Check docker access
echo -e "${YELLOW}0. Checking Docker access...${NC}"
if ! docker ps > /dev/null 2>&1; then
  echo -e "${RED}✗ Docker access denied${NC}"
  echo ""
  echo "Option 1 (recommended): Add your user to docker group"
  echo "  sudo usermod -aG docker \$USER"
  echo "  (then log out and back in)"
  echo ""
  echo "Option 2 (quick): Run this script with sudo"
  echo "  sudo ./scripts/dev.sh"
  echo ""
  exit 1
fi
echo -e "${GREEN}✓ Docker accessible${NC}\n"

# Start database
echo -e "${YELLOW}1. Starting database...${NC}"
docker compose -f docker/docker-compose.dev.yml up -d
echo -e "${GREEN}✓ Container started${NC}"

# Wait for database to be healthy
echo -e "${YELLOW}2. Waiting for database to be healthy...${NC}"
for i in {1..30}; do
  if docker compose -f docker/docker-compose.dev.yml exec -T db pg_isready -U forum -d forum > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Database ready${NC}"
    break
  fi
  if [ $i -eq 30 ]; then
    echo -e "${RED}✗ Database failed to start after 30s${NC}"
    echo "Debug: docker logs"
    docker compose -f docker/docker-compose.dev.yml logs db
    exit 1
  fi
  echo -n "."
  sleep 1
done

# Set DATABASE_URL and create .env.local for dev server
DATABASE_URL="postgresql://forum:forum@localhost:5432/forum"
export DATABASE_URL
export DEV_AUTH_ENABLED=true
printf "DATABASE_URL=%s\nDEV_AUTH_ENABLED=true\n" "$DATABASE_URL" > .env.local

# Run migrations
echo -e "\n${YELLOW}3. Running migrations...${NC}"
if [ -n "$NPM_RUN" ]; then
  if DATABASE_URL="$DATABASE_URL" $NPM_RUN "npm exec -- drizzle-kit migrate --config drizzle.config.ts" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Migrations complete${NC}"
  else
    echo -e "${RED}✗ Migrations failed${NC}"
    DATABASE_URL="$DATABASE_URL" $NPM_RUN "npm exec -- drizzle-kit migrate --config drizzle.config.ts"
    exit 1
  fi
else
  if DATABASE_URL="$DATABASE_URL" npm exec -- drizzle-kit migrate --config drizzle.config.ts > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Migrations complete${NC}"
  else
    echo -e "${RED}✗ Migrations failed${NC}"
    DATABASE_URL="$DATABASE_URL" npm exec -- drizzle-kit migrate --config drizzle.config.ts
    exit 1
  fi
fi

# Seed dev users for dev login bypass
echo -e "\n${YELLOW}3b. Seeding dev users...${NC}"
if [ -n "$NPM_RUN" ]; then
  if DATABASE_URL="$DATABASE_URL" $NPM_RUN "npm exec -- tsx scripts/seed-dev-users.ts" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Dev users ready${NC}"
  else
    echo -e "${YELLOW}⊘ Dev users skipped${NC}"
  fi
else
  if DATABASE_URL="$DATABASE_URL" npm exec -- tsx scripts/seed-dev-users.ts > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Dev users ready${NC}"
  else
    echo -e "${YELLOW}⊘ Dev users skipped${NC}"
  fi
fi

# Start dev server
echo -e "\n${YELLOW}4. Starting dev server...${NC}"
echo -e "${GREEN}✓ Running on http://localhost:5173${NC}"
echo -e "${YELLOW}Press Ctrl+C to stop and clean up${NC}\n"

# Use NODE_OPTIONS to preload dotenv, which loads .env.local
# This ensures DATABASE_URL is available in all Node processes including Vite's SSR runner
if [ -n "$NPM_RUN" ]; then
  $NPM_RUN "NODE_OPTIONS=\"--require dotenv/config\" npm run dev"
else
  NODE_OPTIONS="--require dotenv/config" npm run dev
fi
