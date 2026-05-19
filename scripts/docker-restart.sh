#!/bin/bash
# bsBB Docker Quick Restart
# Restarts services without rebuilding (faster)
# Usage: ./scripts/docker-restart.sh

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

echo -e "${YELLOW}=== Restarting bsBB Services ===${NC}\n"

# Check docker access
echo -e "${YELLOW}1. Checking Docker access...${NC}"
if ! docker ps > /dev/null 2>&1; then
  echo -e "${RED}✗ Docker access denied${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Docker accessible${NC}\n"

# Restart services
echo -e "${YELLOW}2. Restarting services...${NC}"
if docker compose -f docker-compose.prod.yml restart; then
  echo -e "${GREEN}✓ Services restarted${NC}"
else
  echo -e "${RED}✗ Failed to restart services${NC}"
  exit 1
fi

# Wait for app to be healthy
echo -e "\n${YELLOW}3. Waiting for services to be ready...${NC}"
for i in {1..30}; do
  if docker compose -f docker-compose.prod.yml ps | grep -q "healthy\|Up"; then
    echo -e "${GREEN}✓ Services are ready${NC}"
    break
  fi
  if [ $i -eq 30 ]; then
    echo -e "${YELLOW}⊘ Services not fully healthy yet, but restarted${NC}"
    break
  fi
  echo -n "."
  sleep 1
done

echo -e "\n${GREEN}✓ bsBB is running!${NC}"
echo -e "\nServices:"
docker compose -f docker-compose.prod.yml ps
echo ""
echo "View logs:       docker compose -f docker-compose.prod.yml logs -f"
echo "Rebuild & start: ./scripts/docker-rebuild.sh"
echo "Stop:            docker compose -f docker-compose.prod.yml down"
