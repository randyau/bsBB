#!/bin/bash
# bsBB Docker Stop
# Stops all running services
# Usage: ./scripts/docker-stop.sh

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

echo -e "${YELLOW}=== Stopping bsBB Services ===${NC}\n"

# Check docker access
echo -e "${YELLOW}1. Checking Docker access...${NC}"
if ! docker ps > /dev/null 2>&1; then
  echo -e "${RED}✗ Docker access denied${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Docker accessible${NC}\n"

# Stop services
echo -e "${YELLOW}2. Stopping services...${NC}"
if docker compose -f docker-compose.prod.yml down; then
  echo -e "${GREEN}✓ Services stopped${NC}"
else
  echo -e "${RED}✗ Failed to stop services${NC}"
  exit 1
fi

echo -e "\n${GREEN}✓ All services stopped${NC}"
echo ""
echo "Start again: ./scripts/docker-restart.sh"
echo "Or rebuild:  ./scripts/docker-rebuild.sh"
