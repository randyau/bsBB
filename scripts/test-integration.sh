#!/bin/bash
set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== bsBB Integration Test Suite ===${NC}"
echo "This script runs database and integration tests that require elevated privileges."
echo ""

# Check if running with sudo (or can access docker)
if ! docker ps > /dev/null 2>&1; then
  echo -e "${YELLOW}Docker is not accessible. Running with current permissions.${NC}"
  echo "For full integration tests, run with: sudo -E bash scripts/test-integration.sh"
  echo ""
fi

# Check for required environment variables
echo "Checking environment..."

if [ -z "$DATABASE_URL" ]; then
  echo -e "${YELLOW}DATABASE_URL not set. Enter database connection string:${NC}"
  read -p "DATABASE_URL: " DATABASE_URL
  export DATABASE_URL
  echo ""
fi

# Validate database connection
echo "Validating database connection..."
if ! pg_isready -d "$DATABASE_URL" > /dev/null 2>&1; then
  echo -e "${RED}✗ Cannot connect to database at: $DATABASE_URL${NC}"
  echo ""
  echo "To set up a test database locally:"
  echo "  docker compose -f docker/docker-compose.dev.yml up -d"
  echo ""
  exit 1
fi

echo -e "${GREEN}✓ Database connection OK${NC}"
echo ""

# Check if migrations are applied
echo "Checking database schema..."
if ! psql "$DATABASE_URL" -c "SELECT table_name FROM information_schema.tables WHERE table_schema='public' LIMIT 1" > /dev/null 2>&1; then
  echo -e "${YELLOW}Database schema not initialized. Running migrations...${NC}"
  bash scripts/migrate.sh
  bash scripts/seed.ts
  echo -e "${GREEN}✓ Migrations complete${NC}"
  echo ""
fi

# Run the test suite
echo "Running test suite with database access..."
echo ""

npm test

TEST_EXIT_CODE=$?

echo ""
echo "================================"
if [ $TEST_EXIT_CODE -eq 0 ]; then
  echo -e "${GREEN}✓ All tests passed!${NC}"
  echo ""
  echo "Please confirm test results by running:"
  echo "  npm run check-tests"
  echo ""
else
  echo -e "${RED}✗ Tests failed (exit code: $TEST_EXIT_CODE)${NC}"
  echo ""
  echo "Review the output above for details."
  echo ""
  exit $TEST_EXIT_CODE
fi
