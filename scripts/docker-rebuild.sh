#!/bin/bash
# bsBB Docker Rebuild & Start
# Rebuilds Docker images and starts all services
# Usage: ./scripts/docker-rebuild.sh

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Ensure we're in the project root
if [ ! -f "package.json" ]; then
  echo -e "${RED}Error: package.json not found. Run from project root.${NC}"
  exit 1
fi

echo -e "${YELLOW}=== Rebuilding bsBB Docker Images ===${NC}\n"

# Check docker access
echo -e "${YELLOW}1. Checking Docker access...${NC}"
if ! docker ps > /dev/null 2>&1; then
  echo -e "${RED}✗ Docker access denied${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Docker accessible${NC}\n"

# Check for .env file
echo -e "${YELLOW}2. Checking configuration...${NC}"
if [ ! -f ".env" ]; then
  echo -e "${RED}✗ .env file not found${NC}"
  exit 1
fi
echo -e "${GREEN}✓ .env file found${NC}\n"

# Rebuild images (while old containers are still running)
# Note: --no-cache is intentionally omitted. Each --no-cache run writes fresh
# build cache entries without reading old ones, causing unbounded cache growth.
# Layer caching is correct here: base images are pinned by digest in the
# Dockerfiles, and application code changes invalidate downstream layers
# automatically. Run `docker builder prune -f` manually if you suspect stale
# cached layers from a changed base image.
echo -e "${YELLOW}3. Building Docker images (this may take a minute)...${NC}"
if docker compose -f docker-compose.prod.yml build app worker; then
  echo -e "${GREEN}✓ Images built${NC}"
else
  echo -e "${RED}✗ Build failed — leaving existing containers running${NC}"
  exit 1
fi

# Stop and restart with new images (minimal downtime window)
echo -e "\n${YELLOW}4. Stopping running containers...${NC}"
docker compose -f docker-compose.prod.yml down 2>/dev/null || true
echo -e "${GREEN}✓ Stopped${NC}\n"

echo -e "${YELLOW}5. Starting Docker services...${NC}"
if docker compose -f docker-compose.prod.yml up -d; then
  echo -e "${GREEN}✓ Services started${NC}"
else
  echo -e "${RED}✗ Failed to start services${NC}"
  docker compose -f docker-compose.prod.yml logs
  exit 1
fi

# Clean up images and build cache left behind by this rebuild.
# --no-cache rebuilds accumulate dangling images (old versions of the same
# named image) and stale build cache entries. Prune them now while we know
# the new images are healthy.
echo -e "\n${YELLOW}6. Pruning dangling images and build cache...${NC}"
docker image prune -f > /dev/null
docker builder prune --keep-storage 2GB -f > /dev/null
echo -e "${GREEN}✓ Pruned${NC}"

# Wait for app to be healthy
echo -e "\n${YELLOW}7. Waiting for services to be ready...${NC}"
for i in {1..60}; do
  if docker compose -f docker-compose.prod.yml ps | grep -q "healthy\|Up"; then
    echo -e "${GREEN}✓ Services are ready${NC}"
    break
  fi
  if [ $i -eq 60 ]; then
    echo -e "${YELLOW}⊘ Services not fully healthy yet, but started${NC}"
    break
  fi
  echo -n "."
  sleep 1
done

echo -e "\n${GREEN}✓ bsBB is running!${NC}"
echo -e "\nServices:"
docker compose -f docker-compose.prod.yml ps
echo ""
echo "View logs:    docker compose -f docker-compose.prod.yml logs -f"
echo "Stop:         docker compose -f docker-compose.prod.yml down"
echo "Restart:      ./scripts/docker-restart.sh"
