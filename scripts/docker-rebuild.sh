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

# Stop running containers
echo -e "${YELLOW}3. Stopping running containers...${NC}"
docker compose -f docker-compose.prod.yml down 2>/dev/null || true
echo -e "${GREEN}✓ Stopped${NC}\n"

# Rebuild images
echo -e "${YELLOW}4. Building Docker images (this may take a minute)...${NC}"
if docker compose -f docker-compose.prod.yml build --no-cache app worker; then
  echo -e "${GREEN}✓ Images built${NC}"
else
  echo -e "${RED}✗ Build failed${NC}"
  exit 1
fi

# Start services
echo -e "\n${YELLOW}5. Starting Docker services...${NC}"
if docker compose -f docker-compose.prod.yml up -d; then
  echo -e "${GREEN}✓ Services started${NC}"
else
  echo -e "${RED}✗ Failed to start services${NC}"
  docker compose -f docker-compose.prod.yml logs
  exit 1
fi

# Wait for app to be healthy
echo -e "\n${YELLOW}6. Waiting for services to be ready...${NC}"
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
